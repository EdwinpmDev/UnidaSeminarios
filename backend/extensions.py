from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, scoped_session
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

from config import DATABASE_URL

# --- BASE DE DATOS ---
engine = create_engine(DATABASE_URL, pool_pre_ping=True, pool_recycle=3600, echo=False)
Base = declarative_base()
Session = scoped_session(sessionmaker(bind=engine))

# --- LIMITADOR DE PETICIONES (previene fuerza bruta) ---
# Nota: se "conecta" a la app real con limiter.init_app(app) dentro de app.py
limiter = Limiter(get_remote_address, default_limits=[], storage_uri="memory://")
