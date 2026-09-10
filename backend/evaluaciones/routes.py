from datetime import datetime, timedelta, timezone

import jwt
import json
from flask import Blueprint, current_app, jsonify, make_response, request

from config import DEBUG_MODE, JWT_SECRET
from extensions import Session, limiter
from models import Evaluacion, Seminario
from utils import (
    FASES_CALIFICACION_DIRECTA,
    LONGITUD_MAX_COMENTARIO,
    LONGITUD_MAX_NOMBRE_EVALUADOR,
    calcular_ventana_evaluacion,
    limpiar_texto_libre,
    parsear_jurado,
    validar_longitud,
)

from auth.decorators import csrf_protegido, generar_jti, limpiar_cookies_sesion, set_cookies_sesion, token_esta_revocado, validar_json, token_requerido

evaluaciones_bp = Blueprint("evaluaciones", __name__)

ROLES_EVALUADOR_VALIDOS = {"Externo"}


@evaluaciones_bp.route("/validar-posicion", methods=["POST"])
@limiter.limit("10 per minute")
@validar_json
def validar_posicion():
    token = request.cookies.get('unida_token')
    if not token:
        return jsonify({"success": False, "mensaje": "No autorizado"}), 401
    session = Session()
    try:
        token_data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if token_esta_revocado(token_data.get("jti")):
            return jsonify({"success": False, "mensaje": "No autorizado"}), 401
        if token_data.get("rol") != "evaluador":
            return jsonify({"success": False, "mensaje": "Acceso denegado"}), 403

        seminario_id = token_data["id_seminario"]
        data = request.get_json() or {}
        rol = data.get("rol_evaluador", "").strip()
        nombre = limpiar_texto_libre(data.get("nombre_evaluador", ""))

        if not rol or not nombre:
            return jsonify({"success": False, "mensaje": "Faltan datos de identificación"}), 400
        if rol not in ROLES_EVALUADOR_VALIDOS:
            return jsonify({"success": False, "mensaje": "Rol de evaluador inválido"}), 400
        if not validar_longitud(nombre, LONGITUD_MAX_NOMBRE_EVALUADOR):
            return jsonify({"success": False, "mensaje": f"El nombre no puede superar los {LONGITUD_MAX_NOMBRE_EVALUADOR} caracteres"}), 400

        if rol != "Externo":
            if session.query(Evaluacion).filter_by(seminario_id=seminario_id, evaluador_rol=rol).first():
                return jsonify({"success": False, "mensaje": f"El puesto de {rol} ya fue evaluado."}), 409
        else:
            if session.query(Evaluacion).filter_by(seminario_id=seminario_id, evaluador_rol="Externo", evaluador_nombre=nombre).first():
                return jsonify({"success": False, "mensaje": "Ya registraste una evaluación con este nombre para este seminario."}), 409

        csrf_token = token_data.get("csrf")
        nuevo_token = jwt.encode(
            {"id_seminario": seminario_id, "rol": "evaluador", "rol_evaluador": rol, "nombre_evaluador": nombre, "csrf": csrf_token, "jti": generar_jti(), "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True}))
        set_cookies_sesion(respuesta, nuevo_token, csrf_token, secure=not DEBUG_MODE)
        return respuesta
    finally:
        session.close()


@evaluaciones_bp.route("/guardar-evaluacion", methods=["POST"])
@limiter.limit("10 per minute")
@csrf_protegido
@validar_json
def guardar_evaluacion():
    token = request.cookies.get('unida_token')
    if not token:
        return jsonify({"success": False, "mensaje": "No autorizado"}), 401
    session = Session()
    try:
        token_data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        id_seminario, evaluador_rol = token_data.get("id_seminario"), token_data.get("rol_evaluador")
        id_estudiante_evaluador = token_data.get("id_estudiante_evaluador")

        if not evaluador_rol:
            return jsonify({"success": False, "mensaje": "Debes validar tu posición primero."}), 403

        seminario = session.query(Seminario).filter_by(id=id_seminario).with_for_update().first()
        if not seminario:
            return jsonify({"success": False, "mensaje": "Seminario no encontrado"}), 404

        ventana = calcular_ventana_evaluacion(seminario)
        if not ventana["disponible"]:
            return jsonify({"success": False, "mensaje": ventana["mensaje"]}), 403

        if evaluador_rol == "Alumno" and id_estudiante_evaluador:
            ya_evaluo = session.query(Evaluacion).filter_by(
                seminario_id=id_seminario, evaluador_estudiante_id=id_estudiante_evaluador
            ).first()
        elif evaluador_rol == "Externo":
            ya_evaluo = session.query(Evaluacion).filter_by(
                seminario_id=id_seminario, evaluador_rol="Externo", evaluador_nombre=token_data.get("nombre_evaluador")
            ).first()
        else:
            ya_evaluo = session.query(Evaluacion).filter_by(
                seminario_id=id_seminario, evaluador_rol=evaluador_rol
            ).first()

        if ya_evaluo:
            return jsonify({"success": False, "mensaje": "No se puede evaluar dos veces."}), 409

        data = request.get_json() or {}
        comentarios = limpiar_texto_libre(data.get("comentarios", ""))
        if not validar_longitud(comentarios, LONGITUD_MAX_COMENTARIO):
            return jsonify({"success": False, "mensaje": f"Los comentarios no pueden superar los {LONGITUD_MAX_COMENTARIO} caracteres"}), 400

        es_fase_directa = seminario.tipo_seminario in FASES_CALIFICACION_DIRECTA

        if es_fase_directa:
            try:
                calif_final = round(float(data.get("calificacion_directa", "")), 1)
            except (TypeError, ValueError):
                return jsonify({"success": False, "mensaje": "La calificación directa debe ser un número"}), 400

            if calif_final < 0 or calif_final > 100:
                return jsonify({"success": False, "mensaje": "La calificación directa debe estar entre 0 y 100"}), 400

            snapshot = []
        else:
            snapshot = data.get("respuestas")
            if not snapshot or not isinstance(snapshot, list):
                return jsonify({"success": False, "mensaje": "Faltan las respuestas del cuestionario"}), 400

            suma_puntajes, suma_escalas = 0.0, 0.0
            for item in snapshot:
                if item.get("puntaje") is None or item.get("escala_maxima") is None:
                    return jsonify({"success": False, "mensaje": "Respuesta incompleta en el cuestionario"}), 400
                suma_puntajes += float(item["puntaje"])
                suma_escalas += float(item["escala_maxima"])

            if suma_escalas == 0:
                return jsonify({"success": False, "mensaje": "Cuestionario inválido"}), 400

            calif_final = round((suma_puntajes / suma_escalas) * 100, 1)

        session.add(Evaluacion(
            seminario_id=id_seminario, evaluador_nombre=token_data.get("nombre_evaluador", data.get("evaluador_nombre")),
            evaluador_rol=evaluador_rol, evaluador_estudiante_id=id_estudiante_evaluador,
            calificacion_final=calif_final, comentarios=comentarios,
            respuestas_detalle=json.dumps(snapshot)
        ))

        session.commit()

        current_app.logger.info(f"evaluacion registrada para seminario {id_seminario} por el rol de {evaluador_rol}")
        respuesta = make_response(jsonify({"success": True, "calificacion": calif_final}))
        limpiar_cookies_sesion(respuesta)
        return respuesta, 201
    finally:
        session.close()


@evaluaciones_bp.route("/datos-evaluacion", methods=["GET"])
def datos_evaluacion():
    token = request.cookies.get('unida_token')
    if not token:
        return jsonify({"success": False, "mensaje": "No autorizado"}), 401
    session = Session()
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if token_esta_revocado(data.get("jti")):
            return jsonify({"success": False, "mensaje": "No autorizado"}), 401
        seminario = session.query(Seminario).filter_by(id=data["id_seminario"]).first()
        roles_ya_evaluados = [e.evaluador_rol for e in session.query(Evaluacion).filter_by(seminario_id=seminario.id).all()]

        rol_actual = data.get("rol_evaluador")
        id_estudiante_evaluador = data.get("id_estudiante_evaluador")
        nombre_evaluador = data.get("nombre_evaluador") or (
            parsear_jurado(seminario.jurado_texto).get(rol_actual, "") if rol_actual else ""
        )

        ya_evaluo = False
        if rol_actual == "Alumno" and id_estudiante_evaluador:
            ya_evaluo = session.query(Evaluacion).filter_by(
                seminario_id=seminario.id, evaluador_estudiante_id=id_estudiante_evaluador
            ).first() is not None
        elif rol_actual == "Externo":
            ya_evaluo = session.query(Evaluacion).filter_by(
                seminario_id=seminario.id, evaluador_rol="Externo", evaluador_nombre=nombre_evaluador
            ).first() is not None
        elif rol_actual:
            ya_evaluo = rol_actual in roles_ya_evaluados

        return jsonify({"success": True, "datos": {
            "id_seminario": seminario.id, "nombre_estudiante": seminario.estudiante.nombre,
            "proyecto": seminario.proyecto, "programa": seminario.estudiante.programa,
            "tipo_seminario": seminario.tipo_seminario, "roles_evaluados": roles_ya_evaluados,
            "rol_evaluador": rol_actual, "nombre_evaluador": nombre_evaluador, "ya_evaluo": ya_evaluo
        }}), 200
    finally:
        session.close()


@evaluaciones_bp.route("/retroalimentacion/<int:id_seminario>", methods=["GET"])
@token_requerido
def obtener_retroalimentacion(id_seminario):
    session = Session()
    try:
        seminario = session.query(Seminario).filter_by(id=id_seminario).first()
        if not seminario:
            return jsonify({"success": False}), 404

        evaluaciones = session.query(Evaluacion).filter_by(seminario_id=id_seminario).order_by(Evaluacion.fecha_evaluacion.asc()).all()
        jurado_asignado = parsear_jurado(seminario.jurado_texto)

        return jsonify({
            "success": True, "estudiante": seminario.estudiante.nombre,
            "proyecto": seminario.proyecto, "clave_acceso": seminario.clave_acceso,
            "observaciones": seminario.observaciones,
            "jurado": jurado_asignado,
            "evaluaciones": [
                {
                    "id": e.id,
                    "rol": e.evaluador_rol, 
                    "nombre": e.evaluador_nombre, 
                    "calificacion": e.calificacion_final, 
                    "comentarios": e.comentarios,
                    "fecha": e.fecha_evaluacion.strftime("%Y-%m-%d %H:%M") if e.fecha_evaluacion else "",
                    "respuestas": json.loads(e.respuestas_detalle) if e.respuestas_detalle else None
                } for e in evaluaciones
            ]
        }), 200
    finally:
        session.close()