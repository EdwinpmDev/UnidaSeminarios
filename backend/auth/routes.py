from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, current_app, jsonify, make_response, redirect, request
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash

from config import DEBUG_MODE, JWT_SECRET
from extensions import Session, limiter
from models import Estudiante, Evaluacion, Seminario, UsuarioEvaluador
from utils import VENTANA_EVALUACION_HORAS, calcular_ventana_evaluacion

from .decorators import _decodificar_token, generar_csrf_token, generar_jti, limpiar_cookies_sesion, revocar_token, set_cookies_sesion, validar_json

auth_bp = Blueprint("auth", __name__)


@auth_bp.route("/verificar-sesion")
def verificar_sesion():
    data, error = _decodificar_token()
    if error:
        return jsonify({"logueado": False}), 200
    return jsonify({
        "logueado": True,
        "usuario": data.get('usuario'),
        "nombre_completo": data.get('nombre_completo', data.get('usuario')),
        "is_admin": data.get('is_admin', False)
    })


@auth_bp.route("/logout")
def logout():
    data, error = _decodificar_token()
    if not error and data:
        jti = data.get('jti')
        exp = data.get('exp')
        if jti and exp:
            revocar_token(jti, datetime.fromtimestamp(exp, tz=timezone.utc))
    respuesta = redirect('/')
    limpiar_cookies_sesion(respuesta)
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

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {"usuario": usuario_db.usuario, "nombre_completo": usuario_db.nombre_completo, "is_admin": usuario_db.es_admin, "csrf": csrf_token, "jti": generar_jti(), "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )

        current_app.logger.info(f"inicio de sesión exitoso: {usuario_db.usuario}")
        respuesta = make_response(jsonify({
            "success": True,
            "nombre_completo": usuario_db.nombre_completo,
            "usuario": usuario_db.usuario,
            "is_admin": usuario_db.es_admin
        }))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=not DEBUG_MODE)
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

        ventana = calcular_ventana_evaluacion(seminario)
        if not ventana["disponible"]:
            if ventana["estado"] == "antes":
                mensaje = (
                    f"Todavía no se puede evaluar este seminario.\n\n"
                    f"🎓 Alumno: {seminario.estudiante.nombre}\n"
                    f"📚 Proyecto: {seminario.proyecto}\n\n"
                    f"🟢 Disponible desde:\n{ventana['inicio']}\n"
                    f"🔴 Plazo máximo:\n{ventana['fin']}"
                )
            elif ventana["estado"] == "caducado":
                mensaje = (
                    f"El periodo de evaluación caducó.\n\n"
                    f"⏳ El plazo máximo de {VENTANA_EVALUACION_HORAS} horas para realizar la evaluación ha concluido.\n\n"
                    f"🟢 Inició: {ventana['inicio']}\n"
                    f"🔴 Finalizó: {ventana['fin']}"
                )
            else:
                mensaje = ventana["mensaje"]
            return jsonify({"success": False, "mensaje": mensaje}), 403

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {"id_seminario": seminario.id, "rol": "evaluador", "csrf": csrf_token, "jti": generar_jti(), "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Acceso concedido"}))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=not DEBUG_MODE)
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

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {"id_estudiante": estudiante.id, "rol": "estudiante", "csrf": csrf_token, "jti": generar_jti(), "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Login exitoso"}))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=not DEBUG_MODE)
        return respuesta
    finally:
        session.close()



@auth_bp.route("/login-alumno-evaluador", methods=["POST"])
@limiter.limit("5 per minute")
@validar_json
def login_alumno_evaluador():
    session = Session()
    try:
        data = request.get_json()
        control = data.get("usuarioAlumno", "").strip()
        password = data.get("password", "").strip()
        clave = data.get("seminar_code", "").strip()

        estudiante = session.query(Estudiante).filter_by(usuarioAlumno=control).first()
        if not estudiante or not check_password_hash(estudiante.password_hash, password):
            return jsonify({"success": False, "mensaje": "Credenciales de estudiante incorrectas"}), 401

        seminario = session.query(Seminario).filter_by(clave_acceso=clave).first()
        if not seminario:
            return jsonify({"success": False, "mensaje": "Clave de seminario incorrecta"}), 401

        if seminario.estudiante_id == estudiante.id:
            return jsonify({"success": False, "mensaje": "No puedes evaluar tu propio seminario."}), 403

        ya_evaluo = session.query(Evaluacion).filter_by(
            seminario_id=seminario.id, evaluador_estudiante_id=estudiante.id
        ).first()
        if ya_evaluo:
            return jsonify({"success": False, "mensaje": "Ya evaluaste este seminario anteriormente."}), 409

        ventana = calcular_ventana_evaluacion(seminario)
        if not ventana["disponible"]:
            if ventana["estado"] == "antes":
                mensaje = (
                    f"Todavía no se puede evaluar este seminario.\n\n"
                    f"🟢 Disponible desde:\n{ventana['inicio']}\n"
                    f"🔴 Plazo máximo:\n{ventana['fin']}"
                )
            elif ventana["estado"] == "caducado":
                mensaje = (
                    f"El periodo de evaluación caducó.\n\n"
                    f"⏳ El plazo máximo de {VENTANA_EVALUACION_HORAS} horas para realizar la evaluación ha concluido.\n\n"
                    f"🟢 Inició: {ventana['inicio']}\n"
                    f"🔴 Finalizó: {ventana['fin']}"
                )
            else:
                mensaje = ventana["mensaje"]
            return jsonify({"success": False, "mensaje": mensaje}), 403

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {
                "id_seminario": seminario.id, 
                "rol": "evaluador",
                "rol_evaluador": "Alumno",
                "nombre_evaluador": estudiante.nombre,
                "id_estudiante_evaluador": estudiante.id,
                "csrf": csrf_token,
                "jti": generar_jti(),
                "exp": datetime.now(timezone.utc) + timedelta(hours=8)
            },
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Acceso concedido"}))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=not DEBUG_MODE)
        return respuesta
    finally:
        session.close()