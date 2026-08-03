"""
SCRIPT DE CORRECCIÓN DE USUARIOS
--------------------------------
Este script actualiza todos los estudiantes para que cumplan con las reglas:
- Número de control: 8 dígitos aleatorios (EXCEPTO el de Edwin)
- Contraseña: 000001, 000002, 000003, ... (secuencial)

EXCEPCIÓN: El usuario administrador 'edwin' NO se modifica.
"""

import re
import os
import random
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from werkzeug.security import generate_password_hash

# Cargar variables de entorno
load_dotenv()

# Conectar a la base de datos
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("CRÍTICO: No se encontró DATABASE_URL en el archivo .env")

# Crear engine y sesión
engine = create_engine(DATABASE_URL, pool_pre_ping=True, echo=False)
Session = scoped_session(sessionmaker(bind=engine))
session = Session()

# Importar modelos (necesitamos definirlos aquí o importarlos)
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, Date, Time, Boolean
from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Definir modelo Estudiante (solo lo necesario)
class Estudiante(Base):
    __tablename__ = "estudiantes"
    id = Column(Integer, primary_key=True)
    numero_control = Column(String(15), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(150), nullable=False)
    programa = Column(String(50), nullable=False)

# --- FUNCIONES DE AYUDA ---

# NÚMERO DE EDWIN - PROHIBIDO USARLO
NUMERO_PROHIBIDO = "23020843"

def generar_numero_control_aleatorio():
    """
    Genera un número de control aleatorio de 8 dígitos.
    EXCLUYE el número de Edwin (23020843)
    """
    while True:
        # Generar 8 dígitos aleatorios
        numero = ''.join(str(random.randint(0, 9)) for _ in range(8))
        # Si empieza con 0, lo regeneramos
        if numero[0] == '0':
            continue
        # Si es el número de Edwin, lo regeneramos
        if numero == NUMERO_PROHIBIDO:
            continue
        return numero

def generar_contraseña_secuencial(indice):
    """
    Genera una contraseña secuencial de 6 dígitos.
    Formato: 000001, 000002, 000003, ...
    """
    return f"{indice:06d}"

# --- MAIN ---

print("=" * 70)
print("🔧 CORRECCIÓN DE USUARIOS - UNIDA")
print("=" * 70)

# Obtener todos los estudiantes (ordenados por ID para consistencia)
estudiantes = session.query(Estudiante).order_by(Estudiante.id).all()
print(f"\n📊 Total de estudiantes encontrados: {len(estudiantes)}")

# Contadores
contador_modificados = 0
contador_errores = 0
contador_secuencia = 1  # Empieza en 1 para la contraseña

# Conjunto para evitar duplicados en números de control
numeros_usados = set()

print("\n" + "=" * 70)
print("📝 LISTA DE USUARIOS A MODIFICAR")
print("=" * 70)

for est in estudiantes:
    # EXCEPCIÓN: No modificar al admin 'edwin'
    if est.nombre.lower() == "edwin" or est.nombre.lower().startswith("administrador"):
        print(f"\n⏭️  SALTANDO: {est.nombre} (ID: {est.id}) - Admin, no se modifica")
        print(f"   Control actual: {est.numero_control}")
        continue
    
    # Generar nuevo número de control (aleatorio y único)
    nuevo_control = generar_numero_control_aleatorio()
    # Asegurar que no se repita
    while nuevo_control in numeros_usados:
        nuevo_control = generar_numero_control_aleatorio()
    numeros_usados.add(nuevo_control)
    
    # Contraseña secuencial
    nueva_password = generar_contraseña_secuencial(contador_secuencia)
    contador_secuencia += 1
    
    # Actualizar
    print(f"\n✅ {est.nombre} (ID: {est.id})")
    print(f"   Control antiguo: '{est.numero_control}'")
    print(f"   Control nuevo:   '{nuevo_control}'")
    print(f"   Contraseña:      {nueva_password}")
    
    est.numero_control = nuevo_control
    est.password_hash = generate_password_hash(nueva_password, method="pbkdf2:sha256", salt_length=16)
    contador_modificados += 1
    print("   " + "-" * 50)

# Guardar cambios
try:
    session.commit()
    print("\n" + "=" * 70)
    print("✅ CAMBIOS GUARDADOS EXITOSAMENTE")
    print("=" * 70)
    print(f"\n📊 RESUMEN FINAL:")
    print(f"   ✅ Usuarios modificados: {contador_modificados}")
    print(f"   ⏭️  Usuarios saltados (admin): {len(estudiantes) - contador_modificados}")
    print(f"   ❌ Errores: {contador_errores}")
    print(f"\n🔑 TODOS los usuarios (excepto admin) tienen contraseña secuencial:")
    print(f"   000001, 000002, 000003, ...")
    print(f"\n📌 Números de control: 8 dígitos aleatorios")
    print(f"   ⚠️  Número {NUMERO_PROHIBIDO} PROHIBIDO (es de Edwin)")
    
except Exception as e:
    session.rollback()
    print("\n" + "=" * 70)
    print("❌ ERROR AL GUARDAR CAMBIOS")
    print("=" * 70)
    print(f"   {str(e)}")
    print("\n   ⚠️ Los cambios han sido revertidos. No se modificó nada.")

finally:
    session.close()

print("\n" + "=" * 70)
print("💡 INSTRUCCIONES DE ACCESO:")
print("   📌 Usuario = Número de control (8 dígitos aleatorios)")
print("   🔑 Contraseña = Secuencial (000001, 000002, 000003, ...)")
print("   ⚠️  El admin 'edwin' mantiene sus credenciales originales")
print("   🚫 El número 23020843 está PROHIBIDO (es de Edwin)")
print("=" * 70)