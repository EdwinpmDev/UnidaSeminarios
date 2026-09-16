from datetime import datetime
import json

from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import generate_password_hash

from extensions import Session
from models import Evaluacion, Seminario, UsuarioEvaluador
from utils import (
    FASES_CALIFICACION_DIRECTA,
    LONGITUD_MAX_COMENTARIO,
    calcular_ventana_evaluacion,
    limpiar_texto_libre,
    parsear_jurado,
    validar_longitud,
    validar_y_reconstruir_respuestas,
)

from auth.decorators import admin_requerido, csrf_protegido, token_requerido, validar_json

docentes_bp = Blueprint("docentes", __name__)


@docentes_bp.route("/docentes", methods=["GET"])
@admin_requerido
def obtener_docentes():
    session = Session()
    try:
        page = int(request.args.get('page', 1))
        per_page = 10
        search = request.args.get('search', '').strip()

        query = session.query(UsuarioEvaluador).filter_by(es_admin=False)

        if search:
            query = query.filter(
                (UsuarioEvaluador.nombre_completo.ilike(f'%{search}%')) |
                (UsuarioEvaluador.usuario.ilike(f'%{search}%'))
            )

        total_records = query.count()
        total_pages = (total_records + per_page - 1) // per_page

        docentes = query.order_by(UsuarioEvaluador.id.desc()).offset((page - 1) * per_page).limit(per_page).all()

        lista = [{"id": d.id, "usuario": d.usuario, "nombre_completo": d.nombre_completo} for d in docentes]

        return jsonify({
            "success": True,
            "docentes": lista,
            "total_pages": total_pages if total_pages > 0 else 1,
            "current_page": page
        }), 200
    except Exception as e:
        session.rollback()
        current_app.logger.error(f"error al listar docentes: {e}")
        return jsonify({"success": False, "mensaje": "Ocurrió un error interno. Intenta de nuevo."}), 500
    finally:
        session.close()


@docentes_bp.route("/registrar-docente", methods=["POST"])
@admin_requerido
@csrf_protegido
@validar_json
def registrar_docente():
    session = Session()
    try:
        data = request.get_json()
        usuario, password, nombre = data.get("usuario", "").strip(), data.get("password", "").strip(), data.get("nombre_completo", "").strip()

        if not usuario or not nombre:
            return jsonify({"success": False, "mensaje": "Nombre y usuario son obligatorios"}), 400
        if len(password) < 8:
            return jsonify({"success": False, "mensaje": "Contraseña muy corta"}), 400
        if session.query(UsuarioEvaluador).filter_by(usuario=usuario).first():
            return jsonify({"success": False, "mensaje": "Usuario ocupado"}), 400

        session.add(UsuarioEvaluador(usuario=usuario, password_hash=generate_password_hash(password, method="pbkdf2:sha256", salt_length=16), nombre_completo=nombre))
        session.commit()

        current_app.logger.info(f"usuario {request.usuario_actual} creo al docente {usuario}")
        return jsonify({"success": True, "mensaje": "Docente registrado."}), 201
    finally:
        session.close()


@docentes_bp.route("/editar-docente/<int:id_docente>", methods=["PUT"])
@admin_requerido
@csrf_protegido
@validar_json
def editar_docente(id_docente):
    session = Session()
    try:
        docente = session.query(UsuarioEvaluador).filter_by(id=id_docente).first()
        if not docente:
            return jsonify({"success": False, "mensaje": "Docente no encontrado"}), 404
        if docente.es_admin:
            return jsonify({"success": False, "mensaje": "No puedes editar a un administrador"}), 403

        data = request.get_json() or {}
        usuario_nuevo = data.get("usuario", "").strip()
        nombre_nuevo = data.get("nombre_completo", "").strip()

        if not usuario_nuevo or not nombre_nuevo:
            return jsonify({"success": False, "mensaje": "Nombre y usuario son obligatorios"}), 400

        if usuario_nuevo != docente.usuario and session.query(UsuarioEvaluador).filter_by(usuario=usuario_nuevo).first():
            return jsonify({"success": False, "mensaje": "Usuario ocupado"}), 400

        docente.nombre_completo, docente.usuario = data.get("nombre_completo", "").strip(), usuario_nuevo
        if data.get("password"):
            docente.password_hash = generate_password_hash(data.get("password").strip(), method="pbkdf2:sha256", salt_length=16)
            docente.token_version += 1  # invalida cualquier jwt viejo de este docente

        session.commit()
        return jsonify({"success": True, "mensaje": "Docente actualizado."})
    finally:
        session.close()


@docentes_bp.route("/eliminar-docente/<int:id_docente>", methods=["DELETE"])
@admin_requerido
@csrf_protegido
def eliminar_docente(id_docente):
    session = Session()
    try:
        docente = session.query(UsuarioEvaluador).filter_by(id=id_docente).first()
        if not docente:
            return jsonify({"success": False, "mensaje": "Docente no encontrado"}), 404
        if docente.es_admin:
            return jsonify({"success": False, "mensaje": "No se puede eliminar a un administrador"}), 403

        usuario_respaldo = docente.usuario
        session.delete(docente)
        session.commit()

        current_app.logger.info(f"usuario {request.usuario_actual} elimino al docente {usuario_respaldo}")
        return jsonify({"success": True, "mensaje": "Docente eliminado."})
    finally:
        session.close()


@docentes_bp.route("/editar-perfil-admin", methods=["PUT"])
@admin_requerido
@csrf_protegido
@validar_json
def editar_perfil_admin():
    session = Session()
    try:
        admin = session.query(UsuarioEvaluador).filter_by(usuario=request.usuario_actual).first()
        if not admin:
            return jsonify({"success": False, "mensaje": "Administrador no encontrado"}), 404

        data = request.get_json() or {}
        usuario_nuevo = data.get("usuario", "").strip()
        password_nueva = data.get("password", "").strip()

        if not usuario_nuevo and not password_nueva:
            return jsonify({"success": False, "mensaje": "No se enviaron datos para actualizar"}), 400

        if usuario_nuevo:
            if usuario_nuevo != admin.usuario and session.query(UsuarioEvaluador).filter_by(usuario=usuario_nuevo).first():
                return jsonify({"success": False, "mensaje": "Ese usuario ya está ocupado"}), 400
            admin.usuario = usuario_nuevo

        if password_nueva:
            admin.password_hash = generate_password_hash(password_nueva, method="pbkdf2:sha256", salt_length=16)
            admin.token_version += 1  # invalida cualquier jwt viejo del admin

        session.commit()
        return jsonify({"success": True, "mensaje": "Tus datos han sido actualizados."})
    finally:
        session.close()


@docentes_bp.route("/docentes/calendario", methods=["GET"])
@token_requerido
def calendario_docente():
    session = Session()
    try:
        mes = request.args.get("mes", "")
        try:
            anio_int, mes_int = int(mes.split("-")[0]), int(mes.split("-")[1])
        except (ValueError, IndexError):
            hoy = datetime.now()
            anio_int, mes_int = hoy.year, hoy.month

        seminarios = session.query(Seminario).filter(
            Seminario.fecha.isnot(None)
        ).all()

        docente = session.query(UsuarioEvaluador).filter_by(usuario=request.usuario_actual).first()

        lista = []
        for sem in seminarios:
            if sem.fecha.year != anio_int or sem.fecha.month != mes_int:
                continue

            ya_evaluo = False
            if docente:
                ya_evaluo = session.query(Evaluacion).filter_by(
                    seminario_id=sem.id, evaluador_id=docente.id
                ).first() is not None

            ventana = calcular_ventana_evaluacion(sem)

            lista.append({
                "id_seminario": sem.id,
                "estudiante": sem.estudiante.nombre,
                "proyecto": sem.proyecto,
                "tipo_seminario": sem.tipo_seminario,
                "fecha": str(sem.fecha),
                "hora": sem.hora.strftime("%H:%M") if sem.hora else "",
                "lugar": sem.lugar or "",
                "modalidad": sem.modalidad or "",
                "ya_evaluado_por_mi": ya_evaluo,
                "estado_ventana": ventana["estado"],
                "disponible_para_evaluar": ventana["disponible"]
            })

        return jsonify({"success": True, "seminarios": lista}), 200
    finally:
        session.close()


@docentes_bp.route("/docentes/seminario/<int:id_seminario>/info", methods=["GET"])
@token_requerido
def info_previa_seminario(id_seminario):
    session = Session()
    try:
        sem = session.query(Seminario).filter_by(id=id_seminario).first()
        if not sem:
            return jsonify({"success": False, "mensaje": "Seminario no encontrado"}), 404

        docente = session.query(UsuarioEvaluador).filter_by(usuario=request.usuario_actual).first()
        ya_evaluo = False
        if docente:
            ya_evaluo = session.query(Evaluacion).filter_by(
                seminario_id=sem.id, evaluador_id=docente.id
            ).first() is not None

        jurado = parsear_jurado(sem.jurado_texto)
        ventana = calcular_ventana_evaluacion(sem)

        return jsonify({"success": True, "datos": {
            "id_seminario": sem.id,
            "estudiante": sem.estudiante.nombre,
            "programa": sem.estudiante.programa,
            "proyecto": sem.proyecto,
            "tipo_seminario": sem.tipo_seminario,
            "fecha": sem.fecha.strftime("%d/%m/%Y") if sem.fecha else "",
            "fecha_raw": str(sem.fecha) if sem.fecha else "",
            "hora": sem.hora.strftime("%H:%M") if sem.hora else "",
            "lugar": sem.lugar or "",
            "modalidad": sem.modalidad or "",
            "duracion": sem.duracion or "",
            "observaciones": sem.observaciones or "",
            "presidente": jurado.get("Presidente", ""),
            "secretario": jurado.get("Secretario", ""),
            "vocal": jurado.get("Vocal", ""),
            "ya_evaluado_por_mi": ya_evaluo,
            "estado_ventana": ventana["estado"],
            "disponible_para_evaluar": ventana["disponible"],
            "mensaje_ventana": ventana["mensaje"]
        }}), 200
    finally:
        session.close()


@docentes_bp.route("/docentes/seminario/<int:id_seminario>/evaluar", methods=["POST"])
@token_requerido
@csrf_protegido
@validar_json
def evaluar_como_docente(id_seminario):
    session = Session()
    try:
        docente = session.query(UsuarioEvaluador).filter_by(usuario=request.usuario_actual).first()
        if not docente:
            return jsonify({"success": False, "mensaje": "Docente no encontrado"}), 404

        sem = session.query(Seminario).filter_by(id=id_seminario).with_for_update().first()
        if not sem:
            return jsonify({"success": False, "mensaje": "Seminario no encontrado"}), 404

        ya_evaluo = session.query(Evaluacion).filter_by(
            seminario_id=id_seminario, evaluador_id=docente.id
        ).first()
        if ya_evaluo:
            return jsonify({"success": False, "mensaje": "Ya evaluaste este seminario."}), 409

        ventana = calcular_ventana_evaluacion(sem)
        if not ventana["disponible"]:
            return jsonify({"success": False, "mensaje": ventana["mensaje"]}), 403

        data = request.get_json() or {}
        comentarios = limpiar_texto_libre(data.get("comentarios", ""))
        if not validar_longitud(comentarios, LONGITUD_MAX_COMENTARIO):
            return jsonify({"success": False, "mensaje": f"Los comentarios no pueden superar los {LONGITUD_MAX_COMENTARIO} caracteres"}), 400

        es_fase_directa = sem.tipo_seminario in FASES_CALIFICACION_DIRECTA

        if es_fase_directa:
            try:
                calif_final = round(float(data.get("calificacion_directa", "")), 1)
            except (TypeError, ValueError):
                return jsonify({"success": False, "mensaje": "La calificación directa debe ser un número"}), 400

            if calif_final < 0 or calif_final > 100:
                return jsonify({"success": False, "mensaje": "La calificación directa debe estar entre 0 y 100"}), 400

            snapshot = []
        else:
            snapshot, error = validar_y_reconstruir_respuestas(
                data.get("respuestas"), sem.estudiante.programa, sem.tipo_seminario
            )
            if error:
                return jsonify({"success": False, "mensaje": error}), 400

            suma_puntajes = sum(r["puntaje"] for r in snapshot)
            suma_escalas = sum(r["escala_maxima"] for r in snapshot)

            if suma_escalas == 0:
                return jsonify({"success": False, "mensaje": "Cuestionario inválido"}), 400

            calif_final = round((suma_puntajes / suma_escalas) * 100, 1)

        session.add(Evaluacion(
            seminario_id=id_seminario,
            evaluador_id=docente.id,
            evaluador_nombre=docente.nombre_completo,
            evaluador_rol="Docente",
            calificacion_final=calif_final,
            comentarios=comentarios,
            respuestas_detalle=json.dumps(snapshot)
        ))
        session.commit()

        current_app.logger.info(f"docente {docente.usuario} evaluo el seminario {id_seminario}")
        return jsonify({"success": True, "calificacion": calif_final}), 201
    finally:
        session.close()