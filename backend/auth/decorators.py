import hmac
import secrets
import uuid
from datetime import datetime, timezone
from functools import wraps

import jwt
from flask import current_app, jsonify, request
from flask_limiter.util import get_remote_address
from sqlalchemy.exc import IntegrityError

from config import JWT_SECRET
from extensions import Session
from models import TokenRevocado


def generar_csrf_token():
    return secrets.token_urlsafe(32)


def generar_jti():
    return uuid.uuid4().hex


def token_esta_revocado(jti):
    if not jti:
        return False
    session = Session()
    try:
        return session.query(TokenRevocado).filter_by(jti=jti).first() is not None
    finally:
        session.close()


def revocar_token(jti, fecha_expiracion):
    if not jti:
        return
    session = Session()
    try:
        if session.query(TokenRevocado).filter_by(jti=jti).first():
            return
        session.add(TokenRevocado(jti=jti, fecha_expiracion=fecha_expiracion))
        session.commit()
    except IntegrityError:
        session.rollback()
    finally:
        session.close()


def limpiar_tokens_revocados_expirados():
    session = Session()
    try:
        session.query(TokenRevocado).filter(TokenRevocado.fecha_expiracion < datetime.now(timezone.utc)).delete()
        session.commit()
    finally:
        session.close()


def set_cookies_sesion(respuesta, token_jwt, csrf_token, secure, max_age=28800):
    respuesta.set_cookie('unida_token', token_jwt, httponly=True, secure=secure, samesite='Lax', max_age=max_age)
    respuesta.set_cookie('unida_csrf', csrf_token, httponly=False, secure=secure, samesite='Lax', max_age=max_age)
    return respuesta


def limpiar_cookies_sesion(respuesta):
    respuesta.set_cookie('unida_token', '', expires=0)
    respuesta.set_cookie('unida_csrf', '', expires=0)
    return respuesta


def _decodificar_token():
    token = request.cookies.get('unida_token')
    if not token:
        return None, (jsonify({"success": False, "mensaje": "Falta el token de seguridad"}), 401)
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None, (jsonify({"success": False, "mensaje": "Token expirado"}), 401)
    except jwt.InvalidTokenError:
        return None, (jsonify({"success": False, "mensaje": "Token inválido"}), 401)
    if token_esta_revocado(data.get('jti')):
        return None, (jsonify({"success": False, "mensaje": "Token inválido"}), 401)
    return data, None


def token_requerido(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        data, error = _decodificar_token()
        if error:
            return error
        if 'usuario' not in data:
            return jsonify({"success": False, "mensaje": "Permisos insuficientes."}), 401
        request.usuario_actual = data['usuario']
        return f(*args, **kwargs)
    return decorador


def estudiante_requerido(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        data, error = _decodificar_token()
        if error:
            return error
        if data.get('rol') != 'estudiante' or 'id_estudiante' not in data:
            return jsonify({"success": False, "mensaje": "Se requiere sesión de estudiante."}), 403
        request.id_estudiante_actual = data['id_estudiante']
        return f(*args, **kwargs)
    return decorador


def admin_requerido(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        data, error = _decodificar_token()
        if error:
            return error
        if 'usuario' not in data or not data.get('is_admin'):
            return jsonify({"success": False, "mensaje": "Se requiere rol de administrador."}), 403
        request.usuario_actual = data['usuario']
        return f(*args, **kwargs)
    return decorador


def csrf_protegido(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        data, error = _decodificar_token()
        if error:
            current_app.logger.warning(f"intento de csrf bloqueado desde ip: {get_remote_address()}")
            return jsonify({"success": False, "mensaje": "Petición bloqueada por seguridad (CSRF)."}), 403
        csrf_esperado = data.get('csrf')
        csrf_recibido = request.headers.get('X-CSRF-Token')
        if not csrf_esperado or not csrf_recibido or not hmac.compare_digest(csrf_esperado, csrf_recibido):
            current_app.logger.warning(f"intento de csrf bloqueado desde ip: {get_remote_address()}")
            return jsonify({"success": False, "mensaje": "Petición bloqueada por seguridad (CSRF)."}), 403
        return f(*args, **kwargs)
    return decorador


def validar_json(f):
    @wraps(f)
    def decorador(*args, **kwargs):
        if not request.is_json:
            return jsonify({"success": False, "mensaje": "La petición debe ser en formato JSON."}), 400
        return f(*args, **kwargs)
    return decorador