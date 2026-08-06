from functools import wraps

import jwt
from flask import current_app, jsonify, request
from flask_limiter.util import get_remote_address

from config import JWT_SECRET


def _decodificar_token():
    token = request.cookies.get('unida_token')
    if not token:
        return None, (jsonify({"success": False, "mensaje": "Falta el token de seguridad"}), 401)
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        return data, None
    except jwt.ExpiredSignatureError:
        return None, (jsonify({"success": False, "mensaje": "Token expirado"}), 401)
    except jwt.InvalidTokenError:
        return None, (jsonify({"success": False, "mensaje": "Token inválido"}), 401)


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
    # bloquea peticiones que no vengan del mismo dominio para endpoints que modifican datos
    @wraps(f)
    def decorador(*args, **kwargs):
        referer = request.headers.get("Referer")
        if not referer or request.host_url not in referer:
            current_app.logger.warning(f"intento de csrf bloqueado desde ip: {get_remote_address()}")
            return jsonify({"success": False, "mensaje": "Petición bloqueada por seguridad (CSRF)."}), 403
        return f(*args, **kwargs)
    return decorador


def validar_json(f):
    # fuerza a que todas las peticiones de escritura incluyan el tipo de contenido correcto
    @wraps(f)
    def decorador(*args, **kwargs):
        if not request.is_json:
            return jsonify({"success": False, "mensaje": "La petición debe ser en formato JSON."}), 400
        return f(*args, **kwargs)
    return decorador
