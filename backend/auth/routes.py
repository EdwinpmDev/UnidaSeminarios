from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import jwt
from flask import Blueprint, current_app, jsonify, make_response, redirect, request
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash

from config import DEBUG_MODE, JWT_SECRET
from extensions import Session, limiter
from models import Estudiante, Seminario, UsuarioEvaluador

from .decorators import _decodificar_token, validar_json

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/verificar-sesion")
def verificar_sesion():
    data, error = _decodificar_token()
    if error:
        return jsonify({"logueado": False}), 200
    return jsonify({"logueado": True, "usuario": data.get('usuario'), "is_admin": data.get('is_admin', False)})


@auth_bp.route("/logout")
def logout():
    respuesta = redirect('/')
    respuesta.set_cookie('unida_token', '', expires=0)
    return respuesta


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("5 per minute")
@validar_json
def login():
    session = Session()
    try:
        data = request.get_json()
        usuario, password = data.get("usuario", "").strip(), data.get("password", "").strip()

        if not usuario or len(password) < 8:
            return jsonify({"success": False, "mensaje": "Credenciales inválidas"}), 400

        usuario_db = session.query(UsuarioEvaluador).filter_by(usuario=usuario).first()
        if not usuario_db or not usuario_db.verificar_password(password):
            current_app.logger.warning(f"intento de login docente fallido para el usuario: {usuario} desde {get_remote_address()}")
            return jsonify({"success": False, "mensaje": "Usuario o contraseña incorrectos"}), 401

        token_jwt = jwt.encode(
            {"usuario": usuario_db.usuario, "is_admin": usuario_db.es_admin, "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )

        current_app.logger.info(f"inicio de sesión exitoso: {usuario_db.usuario}")
        respuesta = make_response(jsonify({"success": True, "usuario": usuario_db.nombre_completo, "is_admin": usuario_db.es_admin}))
        respuesta.set_cookie('unida_token', token_jwt, httponly=True, secure=not DEBUG_MODE, samesite='Lax', max_age=28800)
        return respuesta
    finally:
        session.close()


@auth_bp.route("/login-evaluador", methods=["POST"])
@limiter.limit("5 per minute")
@validar_json
def login_evaluador():
    session = Session()
    try:
        clave = (request.get_json() or {}).get("seminar_code", "").strip()
        if not clave:
            return jsonify({"success": False, "mensaje": "Falta clave de acceso"}), 400

        seminario = session.query(Seminario).filter_by(clave_acceso=clave).first()
        if not seminario:
            current_app.logger.warning(f"intento de acceso a seminario con clave invalida: {clave} desde {get_remote_address()}")
            return jsonify({"success": False, "mensaje": "Clave incorrecta"}), 401

        # --- VALIDACIÓN DE PLAZOS (ANTES DE INICIAR Y 72 HORAS) ---
        if seminario.fecha and seminario.hora:
            fecha_inicio = datetime.combine(seminario.fecha, seminario.hora).replace(tzinfo=ZoneInfo("America/Mexico_City"))
            fecha_fin = fecha_inicio + timedelta(hours=72)
            ahora = datetime.now(ZoneInfo("America/Mexico_City"))
            
            inicio_str = fecha_inicio.strftime("%d/%m/%Y %I:%M %p")
            fin_str = fecha_fin.strftime("%d/%m/%Y %I:%M %p")

            if ahora < fecha_inicio:
                return jsonify({
                    "success": False, 
                    "mensaje": f"Todavía no se puede evaluar este seminario.\n\n"
                        f"🎓 Alumno: {seminario.estudiante.nombre}\n"
                        f"📚 Proyecto: {seminario.proyecto}\n\n"
                        f"🟢 Disponible desde:\n{inicio_str}\n"
                        f"🔴 Plazo máximo:\n{fin_str}"
                }), 403

            if ahora > fecha_fin:
                return jsonify({
                    "success": False, 
                    "mensaje": f"El periodo de evaluación caducó.\nInicio: {inicio_str}\nFin: {fin_str}"
                        f"⏳ El plazo máximo de 72 horas para realizar la evaluación ha concluido.\n\n"
                        f"🟢 Inició: {inicio_str}\n"
                        f"🔴 Finalizó: {fin_str}"
                }), 403
        # ------------------------------

        token_jwt = jwt.encode(
            {"id_seminario": seminario.id, "rol": "evaluador", "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Acceso concedido"}))
        respuesta.set_cookie('unida_token', token_jwt, httponly=True, secure=not DEBUG_MODE, samesite='Lax', max_age=28800)
        return respuesta
    finally:
        session.close()


@auth_bp.route("/login-estudiante", methods=["POST"])
@limiter.limit("5 per minute")
@validar_json
def login_estudiante():
    session = Session()
    try:
        data = request.get_json()
        usuarioAlumno, password = data.get("usuario", "").strip(), data.get("password", "").strip()

        estudiante = session.query(Estudiante).filter_by(usuarioAlumno=usuarioAlumno).first()
        if not estudiante or not check_password_hash(estudiante.password_hash, password):
            current_app.logger.warning(f"intento de login estudiante fallido para control: {usuarioAlumno} desde {get_remote_address()}")
            return jsonify({"success": False, "mensaje": "Número de control o contraseña incorrectos"}), 401

        token_jwt = jwt.encode(
            {"id_estudiante": estudiante.id, "rol": "estudiante", "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Login exitoso"}))
        respuesta.set_cookie('unida_token', token_jwt, httponly=True, secure=not DEBUG_MODE, samesite='Lax', max_age=28800)
        return respuesta
    finally:
        session.close()
