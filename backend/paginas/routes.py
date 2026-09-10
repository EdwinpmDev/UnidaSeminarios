import jwt
from flask import Blueprint, redirect, request, send_from_directory

from auth.decorators import token_esta_revocado
from config import FRONTEND_PATH, JWT_SECRET

paginas_bp = Blueprint("paginas", __name__)

PAGINAS_PROTEGIDAS = {
    'usuario.html',
    'index.html',
    'portal-alumno.html',
    'evaluacion.html',
    'dashboard-docente.html',
}


@paginas_bp.route('/')
def index():
    return send_from_directory(FRONTEND_PATH, 'login.html')


@paginas_bp.route('/<path:path>')
def static_files(path):
    if path in PAGINAS_PROTEGIDAS:
        token = request.cookies.get('unida_token')
        if not token:
            return redirect('/')
        try:
            data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.InvalidTokenError:
            return redirect('/')
        if token_esta_revocado(data.get('jti')):
            return redirect('/')
    return send_from_directory(FRONTEND_PATH, path)