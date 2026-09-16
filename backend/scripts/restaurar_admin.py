import argparse
import getpass
import os
import sys

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, BACKEND_DIR)

try:
    from werkzeug.security import generate_password_hash
    from config import ADMIN_USER, ADMIN_PASS
    from extensions import Session, engine
    from models import Base, UsuarioEvaluador
except ImportError as e:
    print(f"❌ Error de importación: {e}")
    print("Revisa que las dependencias del backend estén instaladas (requirements.txt)")
    print("y que estés ejecutando el script desde el entorno virtual del proyecto.")
    sys.exit(1)


def parsear_argumentos():
    parser = argparse.ArgumentParser(
        description="Restaura (o crea) al administrador del sistema UNIDA usando el .env del backend "
                    "o credenciales indicadas por línea de comandos."
    )
    parser.add_argument("-u", "--usuario", help="Usuario nuevo para el administrador (por defecto: ADMIN_USER del .env)")
    parser.add_argument("-p", "--password", help="Contraseña nueva (por defecto: ADMIN_PASS del .env). Si no se indica ninguna, se pedirá por teclado.")
    parser.add_argument("-y", "--si", action="store_true", help="No pedir confirmación antes de sobrescribir un administrador existente")
    return parser.parse_args()


def resolver_credenciales(args):
    usuario = args.usuario or ADMIN_USER
    password = args.password or ADMIN_PASS

    if not usuario:
        usuario = input("Usuario para el administrador [admin]: ").strip() or "admin"

    if not password:
        print("No se encontró ADMIN_PASS en el .env ni se pasó --password.")
        while True:
            password = getpass.getpass("Nueva contraseña para el administrador: ").strip()
            confirmacion = getpass.getpass("Confirma la contraseña: ").strip()
            if password != confirmacion:
                print("Las contraseñas no coinciden, intenta de nuevo.\n")
                continue
            if len(password) < 8:
                print("La contraseña debe tener al menos 8 caracteres.\n")
                continue
            break

    if len(password) < 8:
        print("❌ La contraseña debe tener al menos 8 caracteres.")
        sys.exit(1)

    return usuario, password


def restaurar_admin(usuario, password, confirmar=True):
    Base.metadata.create_all(engine)
    session = Session()
    try:
        admin = session.query(UsuarioEvaluador).filter_by(es_admin=True).first()
        hash_nuevo = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

        if admin:
            print(f"ℹ️  Administrador existente encontrado: '{admin.usuario}' (id {admin.id}).")
            if confirmar:
                respuesta = input(f"¿Sobrescribir sus credenciales por '{usuario}'? [s/N]: ").strip().lower()
                if respuesta != "s":
                    print("Operación cancelada, no se modificó nada.")
                    return False

            if usuario != admin.usuario and session.query(UsuarioEvaluador).filter_by(usuario=usuario).first():
                print(f"❌ Ya existe otra cuenta con el usuario '{usuario}'. Elige otro con --usuario.")
                return False

            admin.usuario = usuario
            admin.password_hash = hash_nuevo
            admin.token_version += 1  # invalida cualquier jwt viejo del admin
            session.commit()
            print(f"✅ Credenciales del administrador restauradas (id {admin.id}).")
        else:
            if session.query(UsuarioEvaluador).filter_by(usuario=usuario).first():
                print(f"❌ Ya existe una cuenta de docente con el usuario '{usuario}'. Elige otro con --usuario.")
                return False

            nuevo_admin = UsuarioEvaluador(
                usuario=usuario,
                password_hash=hash_nuevo,
                nombre_completo="Administrador de seminarios",
                es_admin=True,
            )
            session.add(nuevo_admin)
            session.commit()
            print(f"✅ No existía ningún administrador, se creó uno nuevo (id {nuevo_admin.id}).")

        return True
    except Exception as e:
        session.rollback()
        print(f"❌ Ocurrió un error al restaurar el administrador: {e}")
        return False
    finally:
        session.close()


def main():
    args = parsear_argumentos()
    usuario, password = resolver_credenciales(args)

    exito = restaurar_admin(usuario, password, confirmar=not args.si)
    if not exito:
        sys.exit(1)

    print("\n" + "=" * 60)
    print("🔐 ACCESO DE ADMINISTRADOR RESTAURADO")
    print("=" * 60)
    print(f"   Usuario:     {usuario}")
    print("=" * 60)
    print("Inicia sesión con la contraseña que indicaste en la pantalla")
    print("de login y cambia la contraseña desde el panel ('Editar mi")
    print("perfil') en cuanto puedas.")


if __name__ == "__main__":
    main()