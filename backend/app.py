import logging
import os
from logging.handlers import RotatingFileHandler

from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter.util import get_remote_address

from config import ADMIN_PASS, ADMIN_USER, CORS_ORIGINS, DEBUG_MODE
from extensions import Base, Session, engine, limiter

import models

from auth.routes import auth_bp
from docentes.routes import docentes_bp
from estudiantes.routes import estudiantes_bp
from evaluaciones.routes import evaluaciones_bp
from paginas.routes import paginas_bp
from reportes.routes import reportes_bp


def crear_app():
    app = Flask(__name__, static_folder=None)

    # configura el límite de peso por petición para evitar ataques dos (1 mb máximo)
    app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

    # permite peticiones cruzadas para el entorno de desarrollo
    CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

    # previene ataques de fuerza bruta limitando las peticiones por ip
    limiter.init_app(app)

    # crea la carpeta de logs si no existe
    os.makedirs('logs', exist_ok=True)

    # configura la rotación diaria de bitacoras de auditoria y errores
    handler = RotatingFileHandler('logs/unida_auditoria.log', maxBytes=2000000, backupCount=10)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    handler.setLevel(logging.INFO if DEBUG_MODE else logging.WARNING)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO if DEBUG_MODE else logging.WARNING)

    @app.after_request
    def aplicar_cabeceras_seguridad(response):
        # inyecta cabeceras http de seguridad en todas las respuestas
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    @app.errorhandler(Exception)
    def manejar_error(error):
        if DEBUG_MODE:
            return jsonify({"success": False, "error": str(error)}), 500

        # guarda el error en la bitácora sin exponer el código al usuario
        app.logger.error(f"error no controlado detectado: {str(error)}")
        return jsonify({"success": False, "mensaje": "Ocurrió un error interno. El administrador ha sido notificado."}), 500

    @app.errorhandler(429)
    def demasiados_intentos(error):
        app.logger.warning(f"bloqueo por exceso de peticiones desde ip: {get_remote_address()}")
        return jsonify({"success": False, "mensaje": "Demasiados intentos. Espera un momento y vuelve a intentarlo."}), 429

    # crea las tablas en la base de datos si no existen
    Base.metadata.create_all(engine)

    app.register_blueprint(auth_bp)
    app.register_blueprint(estudiantes_bp)
    app.register_blueprint(evaluaciones_bp)
    app.register_blueprint(docentes_bp)
    app.register_blueprint(reportes_bp)
    app.register_blueprint(paginas_bp)

    return app


def crear_usuario_administrador_inicial():
    # crea al administrador en la configuración de entorno
    from werkzeug.security import generate_password_hash
    from models import UsuarioEvaluador

    session = Session()
    try:
        if not ADMIN_USER or not ADMIN_PASS:
            return

        # Buscamos si ya existe AL MENOS UN administrador en el sistema
        admin_existente = session.query(UsuarioEvaluador).filter_by(es_admin=True).first()

        # Solo si no existe NINGÚN administrador, creamos el inicial
        if not admin_existente:
            pw_hash = generate_password_hash(ADMIN_PASS, method="pbkdf2:sha256", salt_length=16)
            session.add(UsuarioEvaluador(
                usuario=ADMIN_USER, 
                password_hash=pw_hash, 
                nombre_completo="Administrador de seminarios", 
                es_admin=True
            ))
            session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


app = crear_app()

if __name__ == "__main__":
    crear_usuario_administrador_inicial()
    # Para producción, usar Gunicorn en lugar de app.run()
    # Pero si usas app.run(), quita el debug
    app.run(host="0.0.0.0", port=5000, debug=False)
