from datetime import datetime, timedelta, timezone

import jwt
from flask import Blueprint, current_app, jsonify, make_response, request
from flask_limiter.util import get_remote_address
from werkzeug.security import check_password_hash

from config import FORCE_SECURE_COOKIES, JWT_SECRET
from extensions import Session, limiter
from models import Estudiante, Evaluacion, Seminario, UsuarioEvaluador
from utils import calcular_ventana_evaluacion

from .decorators import _decodificar_token, formatear_mensaje_bloqueo, generar_csrf_token, generar_jti, limpiar_cookies_sesion, registrar_intento_login, revocar_token, set_cookies_sesion, validar_json, verificar_bloqueo_login

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


@auth_bp.route("/logout", methods=["POST"])
# sin csrf_protegido: si el token ya expiró, el decorador respondería 403 y las cookies quedarían vivas
def logout():
    data, error = _decodificar_token()
    if not error and data:
        jti = data.get('jti')
        exp = data.get('exp')
        if jti and exp:
            revocar_token(jti, datetime.fromtimestamp(exp, tz=timezone.utc))
    respuesta = jsonify({"success": True})
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

        ip = get_remote_address()
        segundos_espera = verificar_bloqueo_login(ip, usuario)
        if segundos_espera is not None:
            respuesta = jsonify({"success": False, "mensaje": formatear_mensaje_bloqueo(segundos_espera)})
            respuesta.headers["Retry-After"] = str(segundos_espera)
            return respuesta, 429

        usuario_db = session.query(UsuarioEvaluador).filter_by(usuario=usuario).first()
        if not usuario_db or not usuario_db.verificar_password(password):
            current_app.logger.warning(f"intento de login docente fallido para el usuario: {usuario} desde {ip}")
            registrar_intento_login(ip, usuario, exitoso=False)
            return jsonify({"success": False, "mensaje": "Usuario o contraseña incorrectos"}), 401

        registrar_intento_login(ip, usuario, exitoso=True)

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {"usuario": usuario_db.usuario, "nombre_completo": usuario_db.nombre_completo, "is_admin": usuario_db.es_admin, "tv": usuario_db.token_version, "csrf": csrf_token, "jti": generar_jti(), "exp": datetime.now(timezone.utc) + timedelta(hours=8)},
            JWT_SECRET, algorithm="HS256"
        )

        current_app.logger.info(f"inicio de sesión exitoso: {usuario_db.usuario}")
        respuesta = make_response(jsonify({
            "success": True,
            "nombre_completo": usuario_db.nombre_completo,
            "usuario": usuario_db.usuario,
            "is_admin": usuario_db.es_admin
        }))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=FORCE_SECURE_COOKIES)
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

        # se normaliza para que "abc123" y "ABC123" cuenten como la misma clave, tanto para el bloqueo como para la busqueda
        clave_normalizada = clave.strip().upper()

        ip = get_remote_address()
        segundos_espera = verificar_bloqueo_login(ip, clave_normalizada)
        if segundos_espera is not None:
            respuesta = jsonify({"success": False, "mensaje": formatear_mensaje_bloqueo(segundos_espera)})
            respuesta.headers["Retry-After"] = str(segundos_espera)
            return respuesta, 429

        seminario = session.query(Seminario).filter_by(clave_acceso=clave_normalizada).first()
        if not seminario:
            current_app.logger.warning(f"intento de acceso a seminario con clave invalida: {clave} desde {ip}")
            registrar_intento_login(ip, clave_normalizada, exitoso=False)
            return jsonify({"success": False, "mensaje": "Clave incorrecta o seminario no disponible"}), 401

        ventana = calcular_ventana_evaluacion(seminario)
        if not ventana["disponible"]:
            registrar_intento_login(ip, clave_normalizada, exitoso=False)
            return jsonify({"success": False, "mensaje": ventana["mensaje"]}), 401

        registrar_intento_login(ip, clave_normalizada, exitoso=True)

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {"id_seminario": seminario.id, "rol": "evaluador", "csrf": csrf_token, "jti": generar_jti(), "exp": datetime.now(timezone.utc) + timedelta(hours=1)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Acceso concedido"}))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=FORCE_SECURE_COOKIES)
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

        ip = get_remote_address()
        segundos_espera = verificar_bloqueo_login(ip, usuarioAlumno)
        if segundos_espera is not None:
            respuesta = jsonify({"success": False, "mensaje": formatear_mensaje_bloqueo(segundos_espera)})
            respuesta.headers["Retry-After"] = str(segundos_espera)
            return respuesta, 429

        estudiante = session.query(Estudiante).filter_by(usuarioAlumno=usuarioAlumno).first()
        if not estudiante or not check_password_hash(estudiante.password_hash, password):
            current_app.logger.warning(f"intento de login estudiante fallido para control: {usuarioAlumno} desde {ip}")
            registrar_intento_login(ip, usuarioAlumno, exitoso=False)
            return jsonify({"success": False, "mensaje": "Número de control o contraseña incorrectos"}), 401

        registrar_intento_login(ip, usuarioAlumno, exitoso=True)

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {"id_estudiante": estudiante.id, "rol": "estudiante", "tv": estudiante.token_version, "csrf": csrf_token, "jti": generar_jti(), "exp": datetime.now(timezone.utc) + timedelta(hours=2)},
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Login exitoso"}))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=FORCE_SECURE_COOKIES)
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
        clave = data.get("seminar_code", "").strip().upper()

        ip = get_remote_address()
        segundos_espera = verificar_bloqueo_login(ip, control)
        if segundos_espera is not None:
            respuesta = jsonify({"success": False, "mensaje": formatear_mensaje_bloqueo(segundos_espera)})
            respuesta.headers["Retry-After"] = str(segundos_espera)
            return respuesta, 429

        estudiante = session.query(Estudiante).filter_by(usuarioAlumno=control).first()
        if not estudiante or not check_password_hash(estudiante.password_hash, password):
            registrar_intento_login(ip, control, exitoso=False)
            return jsonify({"success": False, "mensaje": "Credenciales de estudiante incorrectas"}), 401

        registrar_intento_login(ip, control, exitoso=True)

        seminario = session.query(Seminario).filter_by(clave_acceso=clave).first()
        if not seminario:
            return jsonify({"success": False, "mensaje": "Clave incorrecta o seminario no disponible"}), 401

        if seminario.estudiante_id == estudiante.id:
            return jsonify({"success": False, "mensaje": "No puedes evaluar tu propio seminario."}), 403

        ya_evaluo = session.query(Evaluacion).filter_by(
            seminario_id=seminario.id, evaluador_estudiante_id=estudiante.id
        ).first()
        if ya_evaluo:
            return jsonify({"success": False, "mensaje": "Ya evaluaste este seminario anteriormente."}), 409

        ventana = calcular_ventana_evaluacion(seminario)
        if not ventana["disponible"]:
            return jsonify({"success": False, "mensaje": ventana["mensaje"]}), 401

        csrf_token = generar_csrf_token()
        token_jwt = jwt.encode(
            {
                "id_seminario": seminario.id, 
                "rol": "evaluador",
                "rol_evaluador": "Alumno",
                "nombre_evaluador": estudiante.nombre,
                "id_estudiante_evaluador": estudiante.id,
                "tv": estudiante.token_version,
                "csrf": csrf_token,
                "jti": generar_jti(),
                "exp": datetime.now(timezone.utc) + timedelta(hours=2)
            },
            JWT_SECRET, algorithm="HS256"
        )
        respuesta = make_response(jsonify({"success": True, "mensaje": "Acceso concedido"}))
        set_cookies_sesion(respuesta, token_jwt, csrf_token, secure=FORCE_SECURE_COOKIES)
        return respuesta
    finally:
        session.close()