import jwt
from flask import Blueprint, redirect, request, send_from_directory

from config import FRONTEND_PATH, JWT_SECRET

paginas_bp = Blueprint("paginas", __name__)

PAGINAS_PROTEGIDAS = {
    'usuario.html': None,
    'index.html': None,
    'portal-alumno.html': None,
    'evaluacion.html': None,
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
            if PAGINAS_PROTEGIDAS[path] == 'admin' and not data.get('is_admin'):
                return redirect('/')
        except jwt.InvalidTokenError:
            return redirect('/')
    return send_from_directory(FRONTEND_PATH, path)
