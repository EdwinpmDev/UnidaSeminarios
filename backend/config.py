import os
from dotenv import load_dotenv

load_dotenv()

# --- MODO DE EJECUCIÓN ---
DEBUG_MODE = os.getenv("DEBUG", "False").lower() == "true"

# --- SEGURIDAD ---
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise ValueError("CRÍTICO: JWT_SECRET no encontrado en el archivo .env")

# --- BASE DE DATOS ---
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("CRÍTICO: No se encontró DATABASE_URL en el archivo .env")

# --- ADMINISTRADOR INICIAL ---
ADMIN_USER = os.getenv("ADMIN_USER")
ADMIN_PASS = os.getenv("ADMIN_PASS")

# --- RUTAS ---
FRONTEND_PATH = os.path.join(os.path.dirname(__file__), '../frontend')

# --- CORS ---
CORS_ORIGINS = [
    "http://127.0.0.1:5000",
    "http://localhost:5000",
    "http://192.168.100.11:5000",
]
