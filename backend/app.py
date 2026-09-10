import logging
import sys
import os
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler
from configuracion.routes import configuracion_bp

from flask import Flask, jsonify
from flask_cors import CORS
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from sqlalchemy import text

from config import ADMIN_PASS, ADMIN_USER, CORS_ORIGINS, DEBUG_MODE, NUM_PROXIES
from extensions import Base, Session, engine, limiter

import models

from auth.routes import auth_bp
from auth.decorators import limpiar_tokens_revocados_expirados
from docentes.routes import docentes_bp
from estudiantes.routes import estudiantes_bp
from evaluaciones.routes import evaluaciones_bp
from paginas.routes import paginas_bp
from reportes.routes import reportes_bp


def crear_app():
    app = Flask(__name__, static_folder=None)

    if NUM_PROXIES > 0:
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=NUM_PROXIES, x_proto=NUM_PROXIES, x_host=NUM_PROXIES)

    app.config['MAX_CONTENT_LENGTH'] = 1 * 1024 * 1024

    CORS(app, resources={r"/*": {"origins": CORS_ORIGINS}})

    limiter.init_app(app)

    os.makedirs('logs', exist_ok=True)

    handler = RotatingFileHandler('logs/unida_auditoria.log', maxBytes=2000000, backupCount=10)
    handler.setFormatter(logging.Formatter('%(asctime)s - %(levelname)s - %(message)s'))
    handler.setLevel(logging.INFO if DEBUG_MODE else logging.WARNING)
    app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO if DEBUG_MODE else logging.WARNING)

    @app.after_request
    def aplicar_cabeceras_seguridad(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['X-XSS-Protection'] = '1; mode=block'
        response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
        return response

    @app.errorhandler(Exception)
    def manejar_error(error):
        if DEBUG_MODE:
            return jsonify({"success": False, "error": str(error)}), 500

        app.logger.error(f"error no controlado detectado: {str(error)}")
        return jsonify({"success": False, "mensaje": "Ocurrió un error interno. El administrador ha sido notificado."}), 500

    @app.errorhandler(429)
    def demasiados_intentos(error):
        app.logger.warning(f"bloqueo por exceso de peticiones desde ip: {get_remote_address()}")
        return jsonify({"success": False, "mensaje": "Demasiados intentos."}), 429

    @app.route('/health')
    def salud():
        try:
            with engine.connect() as conexion:
                conexion.execute(text('SELECT 1'))
            estado = 'ok'
            codigo = 200
        except Exception as error:
            app.logger.error(f"health check falló: {str(error)}")
            estado = 'error'
            codigo = 503

        return jsonify({
            'status': estado,
            'timestamp': datetime.now(timezone.utc).isoformat(),
        }), codigo

    # solo crea lo que falte
    Base.metadata.create_all(engine)

    app.register_blueprint(auth_bp)
    app.register_blueprint(estudiantes_bp)
    app.register_blueprint(evaluaciones_bp)
    app.register_blueprint(docentes_bp)
    app.register_blueprint(reportes_bp)
    app.register_blueprint(paginas_bp)
    app.register_blueprint(configuracion_bp)

    return app


def crear_usuario_administrador_inicial():
    from werkzeug.security import generate_password_hash
    from models import UsuarioEvaluador

    limpiar_tokens_revocados_expirados()

    session = Session()
    try:
        if not ADMIN_USER or not ADMIN_PASS:
            return

        admin_existente = session.query(UsuarioEvaluador).filter_by(es_admin=True).first()

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
    
    from waitress import serve
    print("🚀 Servidor en ejecución (Waitress) multiplataforma http://127.0.0.1:5000")
    serve(app, host="0.0.0.0", port=5000)