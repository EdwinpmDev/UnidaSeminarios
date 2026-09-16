import hmac
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import current_app, jsonify, request
from flask_limiter.util import get_remote_address
from sqlalchemy.exc import IntegrityError

from config import JWT_SECRET
from extensions import Session
from models import Estudiante, IntentoLogin, Seminario, TokenRevocado, UsuarioEvaluador
from utils import calcular_ventana_evaluacion


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


def limpiar_intentos_login_viejos():
    # borra los registros de intentos_login el cual ultimo_intento tiene mas de 24 horas; los registros con ultimo_intento en none no se tocan
    session = Session()
    try:
        session.query(IntentoLogin).filter(
            IntentoLogin.ultimo_intento < datetime.now(timezone.utc) - timedelta(hours=24)
        ).delete()
        session.commit()
    finally:
        session.close()


# los primeros 4 intentos fallidos por combinacion (ip, usuario) no tienen penalizacion
UMBRAL_INTENTOS_LOGIN = 4
# espera progresiva a partir del 5to intento fallido; del 8vo en adelante se usa el tope
ESPERAS_LOGIN = {5: timedelta(seconds=30), 6: timedelta(minutes=1), 7: timedelta(minutes=5)}
ESPERA_LOGIN_TOPE = timedelta(minutes=15)
# si no hay actividad en este lapso desde el ultimo intento fallido, el contador se reinicia
VENTANA_SIN_ACTIVIDAD_LOGIN = timedelta(minutes=15)


def _espera_por_intento(intentos):
    return ESPERAS_LOGIN.get(intentos, ESPERA_LOGIN_TOPE)


def _asegurar_utc(dt):
    # la bd devuelve el datetime sin tzinfo aunque se guardo en utc; sin esto, restar contra datetime.now(timezone.utc) truena
    if dt and dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def formatear_mensaje_bloqueo(segundos):
    # arma el mensaje de espera del bloqueo por intentos fallidos; en segundos si falta menos de un minuto, en minutos (redondeando hacia arriba) si falta un minuto o mas
    if segundos < 60:
        return f"Demasiados intentos, espera {segundos} segundos e intenta de nuevo."
    minutos = -(-segundos // 60)
    unidad = "minuto" if minutos == 1 else "minutos"
    return f"Demasiados intentos, espera {minutos} {unidad} e intenta de nuevo."


def verificar_bloqueo_login(ip, usuario):
    # revisa si la combinacion (ip, usuario) esta bloqueada; devuelve los segundos restantes o none si puede intentar
    usuario = (usuario or "").strip().lower()
    if not usuario:
        return None
    ahora = datetime.now(timezone.utc)
    session = Session()
    try:
        registro = session.query(IntentoLogin).filter_by(ip=ip, usuario=usuario).first()
        if not registro:
            return None
        if registro.ultimo_intento and (ahora - _asegurar_utc(registro.ultimo_intento)) > VENTANA_SIN_ACTIVIDAD_LOGIN:
            registro.intentos = 0
            registro.bloqueado_hasta = None
            session.commit()
            return None
        if registro.bloqueado_hasta and _asegurar_utc(registro.bloqueado_hasta) > ahora:
            return int((_asegurar_utc(registro.bloqueado_hasta) - ahora).total_seconds())
        return None
    finally:
        session.close()


def registrar_intento_login(ip, usuario, exitoso):
    # actualiza el contador de intentos fallidos por combinacion (ip, usuario); si exitoso, lo reinicia
    usuario = (usuario or "").strip().lower()
    if not usuario:
        return
    ahora = datetime.now(timezone.utc)
    session = Session()
    try:
        registro = session.query(IntentoLogin).filter_by(ip=ip, usuario=usuario).first()
        if exitoso:
            if registro and (registro.intentos or registro.bloqueado_hasta):
                registro.intentos = 0
                registro.bloqueado_hasta = None
                registro.ultimo_intento = ahora
                session.commit()
            return
        if not registro:
            registro = IntentoLogin(ip=ip, usuario=usuario, intentos=0)
            session.add(registro)
        elif registro.ultimo_intento and (ahora - _asegurar_utc(registro.ultimo_intento)) > VENTANA_SIN_ACTIVIDAD_LOGIN:
            registro.intentos = 0
            registro.bloqueado_hasta = None
        registro.intentos += 1
        registro.ultimo_intento = ahora
        if registro.intentos > UMBRAL_INTENTOS_LOGIN:
            registro.bloqueado_hasta = ahora + _espera_por_intento(registro.intentos)
        try:
            session.commit()
        except IntegrityError:
            session.rollback()
    finally:
        session.close()


def _version_token_vigente(data):
    # tokens de docente/admin llevan 'usuario'; tokens de estudiante llevan 'id_estudiante' y rol 'estudiante'
    if 'usuario' in data:
        session = Session()
        try:
            usuario_db = session.query(UsuarioEvaluador).filter_by(usuario=data['usuario']).first()
            return bool(usuario_db) and usuario_db.token_version == data.get('tv')
        finally:
            session.close()
    if 'id_estudiante' in data and data.get('rol') == 'estudiante':
        session = Session()
        try:
            estudiante_db = session.query(Estudiante).filter_by(id=data['id_estudiante']).first()
            return bool(estudiante_db) and estudiante_db.token_version == data.get('tv')
        finally:
            session.close()
    return True


def _ventana_evaluacion_vigente(data):
    # solo aplica a tokens de evaluador externo o alumno evaluador, que llevan rol 'evaluador' e id_seminario; los demás roles no hacen esta consulta
    if data.get('rol') != 'evaluador' or 'id_seminario' not in data:
        return True
    session = Session()
    try:
        seminario = session.query(Seminario).filter_by(id=data['id_seminario']).first()
        if not seminario:
            return False
        return calcular_ventana_evaluacion(seminario)["estado"] != "caducado"
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
    if not _version_token_vigente(data):
        return None, (jsonify({"success": False, "mensaje": "Token inválido"}), 401)
    if not _ventana_evaluacion_vigente(data):
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