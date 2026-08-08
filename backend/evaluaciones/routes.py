from datetime import datetime, timedelta, timezone

import jwt
import json
from flask import Blueprint, current_app, jsonify, make_response, request

from config import DEBUG_MODE, JWT_SECRET
from extensions import Session, limiter
from models import Evaluacion, Seminario
from utils import parsear_jurado

from auth.decorators import csrf_protegido, validar_json, token_requerido

evaluaciones_bp = Blueprint("evaluaciones", __name__)


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
        if token_data.get("rol") != "evaluador":
            return jsonify({"success": False, "mensaje": "Acceso denegado"}), 403

        seminario_id = token_data["id_seminario"]
        data = request.get_json() or {}
        rol = data.get("rol_evaluador", "").strip()
        nombre = data.get("nombre_evaluador", "").strip()

        if not rol or not nombre:
            return jsonify({"success": False, "mensaje": "Faltan datos de identificación"}), 400

        if rol != "Externo":
            if session.query(Evaluacion).filter_by(seminario_id=seminario_id, evaluador_rol=rol).first():
                return jsonify({"success": False, "mensaje": f"El puesto de {rol} ya fue evaluado."}), 409

        nuevo_token = jwt.encode(
            {"id_seminario": seminario_id, "rol": "evaluador", "rol_evaluador": rol, "nombre_evaluador": nombre, "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True}))
        respuesta.set_cookie('unida_token', nuevo_token, httponly=True, secure=not DEBUG_MODE, samesite='Lax', max_age=28800)
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

        if not evaluador_rol:
            return jsonify({"success": False, "mensaje": "Debes validar tu posición primero."}), 403

        if session.query(Evaluacion).filter_by(seminario_id=id_seminario, evaluador_rol=evaluador_rol).first():
            return jsonify({"success": False, "mensaje": "No se puede evaluar dos veces."}), 409

        data = request.get_json() or {}
        respuestas = []
        respuestas_dict = {}
        for i in range(1, 13):
            valor = data.get(f"P{i}")
            if valor is None:
                return jsonify({"success": False, "mensaje": f"Falta responder la pregunta P{i}"}), 400
            respuestas.append(float(valor))
            respuestas_dict[f"P{i}"] = float(valor)

        calif_final = round(((sum(respuestas[0:8]) + (sum(respuestas[8:12]) * 2.0)) / 120.0) * 100, 1)

        session.add(Evaluacion(
            seminario_id=id_seminario, evaluador_nombre=token_data.get("nombre_evaluador", data.get("evaluador_nombre")),
            evaluador_rol=evaluador_rol, calificacion_final=calif_final, comentarios=data.get("comentarios", "").strip(),
            respuestas_detalle=json.dumps(respuestas_dict)
        ))
        session.commit()

        current_app.logger.info(f"evaluacion registrada para seminario {id_seminario} por el rol de {evaluador_rol}")
        respuesta = make_response(jsonify({"success": True, "calificacion": calif_final}))
        respuesta.set_cookie('unida_token', '', expires=0)
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
        seminario = session.query(Seminario).filter_by(id=data["id_seminario"]).first()
        roles_ya_evaluados = [e.evaluador_rol for e in session.query(Evaluacion).filter_by(seminario_id=seminario.id).all()]

        rol_actual = data.get("rol_evaluador")
        return jsonify({"success": True, "datos": {
            "id_seminario": seminario.id, "nombre_estudiante": seminario.estudiante.nombre,
            "proyecto": seminario.proyecto, "programa": seminario.estudiante.programa,
            "tipo_seminario": seminario.tipo_seminario, "roles_evaluados": roles_ya_evaluados,
            "rol_evaluador": rol_actual, "nombre_evaluador": parsear_jurado(seminario.jurado_texto).get(rol_actual, "") if rol_actual else ""
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
        roles_eval = {e.evaluador_rol for e in evaluaciones}
        jurado_asignado = parsear_jurado(seminario.jurado_texto)

        return jsonify({
            "success": True, "estudiante": seminario.estudiante.nombre,
            "proyecto": seminario.proyecto, "clave_acceso": seminario.clave_acceso,
            "observaciones": seminario.observaciones,
            "codigos_posicion": {
                rol: {"codigo": getattr(seminario, f"clave_{rol.lower()}") if rol not in roles_eval else None, "nombre": jurado_asignado.get(rol, "")}
                for rol in ["Presidente", "Secretario", "Vocal"]
            },
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
