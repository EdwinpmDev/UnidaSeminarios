import os
from dotenv import load_dotenv

load_dotenv()

# --- MODO DE EJECUCIÓN ---
DEBUG_MODE = os.getenv("DEBUG", "False").lower() == "true"

# --- SEGURIDAD ---
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("CRÍTICO: JWT_SECRET no encontrado en el archivo .env")

# Secure de las cookies: independiente de DEBUG para no exponerlas por error
FORCE_SECURE_COOKIES = os.getenv("FORCE_SECURE_COOKIES", "True").lower() == "true"
if not DEBUG_MODE and not FORCE_SECURE_COOKIES:
    raise ValueError("CRÍTICO: no se puede arrancar en producción (DEBUG=False) con FORCE_SECURE_COOKIES=False, las cookies viajarían sin cifrar")

# --- BASE DE DATOS ---
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("CRÍTICO: No se encontró DATABASE_URL en el archivo .env")

# --- ADMINISTRADOR INICIAL ---
ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")
BACKUP_GPG_RECIPIENT = os.getenv("BACKUP_GPG_RECIPIENT")
REDIS_URL = os.getenv("REDIS_URL")

# --- RUTAS ---
FRONTEND_PATH = os.path.join(os.path.dirname(__file__), '../frontend')

# --- CORS ---
CORS_ORIGINS = [
    "http://127.0.0.1:5000",
    "http://localhost:5000",
]

CORS_ORIGINS_EXTRA = os.getenv("CORS_ORIGINS_EXTRA", "")
if CORS_ORIGINS_EXTRA:
    CORS_ORIGINS += [origen.strip() for origen in CORS_ORIGINS_EXTRA.split(",") if origen.strip()]

NUM_PROXIES = int(os.getenv("NUM_PROXIES", "0"))