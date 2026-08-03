import os
import secrets
import string
from dotenv import set_key

ENV_FILE = '.env'


def generar_secreto_seguro(longitud=64):
    caracteres = string.ascii_letters + string.digits + string.punctuation
    return ''.join(secrets.choice(caracteres) for _ in range(longitud))


def crear_env():
    if not os.path.exists(ENV_FILE):
        print("\nPRIMERA INSTALACIÓN - Creando .env...\n")
        secreto_jwt = generar_secreto_seguro(64)
        valores = {
            "DEBUG": "False",
            "DATABASE_URL": "mysql+pymysql://app_unida:CAMBIAR_CONTRASEÑA@localhost:3306/unida_seminarios",
            "ADMIN_USER": "admin",
            "ADMIN_PASS": "CAMBIAR_CONTRASEÑA_2026",
            "JWT_SECRET": secreto_jwt
        }
        for clave, valor in valores.items():
            set_key(ENV_FILE, clave, valor)

        print("Archivo .env creado exitosamente\n")
        print("IMPORTANTE:")
        print("1. Abre backend/.env")
        print("2. CAMBIA 'CAMBIAR_CONTRASEÑA' por tus valores reales")
        print("3. Verifica que DATABASE_URL sea correcto")
        print("4. Luego ejecuta: python app.py\n")
    else:
        print(".env ya existe. Continuando...\n")


if __name__ == "__main__":
    crear_env()