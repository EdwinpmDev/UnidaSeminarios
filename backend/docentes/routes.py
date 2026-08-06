from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import generate_password_hash

from extensions import Session
from models import UsuarioEvaluador

from auth.decorators import admin_requerido, csrf_protegido, validar_json

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
        return jsonify({"success": False, "error": str(e)}), 500
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
