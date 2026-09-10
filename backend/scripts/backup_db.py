import argparse
import gzip
import os
import subprocess
import sys
from datetime import datetime, timedelta
from urllib.parse import urlparse

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
BACKUPS_DIR = os.path.join(BACKEND_DIR, "backups")
sys.path.insert(0, BACKEND_DIR)

try:
    from config import DATABASE_URL
except ImportError as e:
    print(f"❌ Error de importación: {e}")
    print("Revisa que estés ejecutando el script desde el entorno virtual del proyecto.")
    sys.exit(1)


def parsear_credenciales():
    url = urlparse(DATABASE_URL)
    return {
        "usuario": url.username,
        "password": url.password,
        "host": url.hostname or "localhost",
        "puerto": str(url.port or 3306),
        "base_datos": url.path.lstrip("/"),
    }


def nombre_backup():
    marca = datetime.now().strftime("%Y%m%d_%H%M%S")
    return f"unida_{marca}.sql.gz"


def comando_backup():
    os.makedirs(BACKUPS_DIR, exist_ok=True)
    cred = parsear_credenciales()
    destino = os.path.join(BACKUPS_DIR, nombre_backup())

    comando = [
        "mysqldump",
        "-h", cred["host"],
        "-P", cred["puerto"],
        "-u", cred["usuario"],
        f"-p{cred['password']}",
        "--single-transaction",
        "--routines",
        "--triggers",
        cred["base_datos"],
    ]

    print(f"Generando backup de '{cred['base_datos']}'...")
    proceso = subprocess.run(comando, capture_output=True)

    if proceso.returncode != 0:
        print(f"❌ mysqldump falló: {proceso.stderr.decode(errors='replace')}")
        sys.exit(1)

    with gzip.open(destino, "wb") as archivo:
        archivo.write(proceso.stdout)

    tamano_mb = os.path.getsize(destino) / (1024 * 1024)
    print(f"✅ Backup guardado en {destino} ({tamano_mb:.2f} MB)")


def listar_backups():
    if not os.path.isdir(BACKUPS_DIR):
        return []
    return sorted(
        [f for f in os.listdir(BACKUPS_DIR) if f.endswith(".sql.gz")],
        reverse=True,
    )


def comando_list():
    archivos = listar_backups()
    if not archivos:
        print("No hay backups todavía.")
        return

    for nombre in archivos:
        ruta = os.path.join(BACKUPS_DIR, nombre)
        tamano_mb = os.path.getsize(ruta) / (1024 * 1024)
        fecha = datetime.fromtimestamp(os.path.getmtime(ruta)).strftime("%Y-%m-%d %H:%M")
        print(f"{nombre}  ({tamano_mb:.2f} MB)  {fecha}")


def comando_restore(nombre_archivo):
    archivos = listar_backups()
    if not archivos:
        print("❌ No hay backups disponibles para restaurar.")
        sys.exit(1)

    if not nombre_archivo:
        nombre_archivo = archivos[0]
        print(f"No se indicó archivo, usando el más reciente: {nombre_archivo}")

    ruta = os.path.join(BACKUPS_DIR, nombre_archivo)
    if not os.path.isfile(ruta):
        print(f"❌ No se encontró el backup: {nombre_archivo}")
        sys.exit(1)

    cred = parsear_credenciales()
    respuesta = input(
        f"Esto sobrescribirá la base de datos '{cred['base_datos']}'. ¿Continuar? [s/N]: "
    ).strip().lower()
    if respuesta != "s":
        print("Operación cancelada.")
        return

    comando = [
        "mysql",
        "-h", cred["host"],
        "-P", cred["puerto"],
        "-u", cred["usuario"],
        f"-p{cred['password']}",
        cred["base_datos"],
    ]

    print(f"Restaurando desde {nombre_archivo}...")
    with gzip.open(ruta, "rb") as archivo:
        proceso = subprocess.run(comando, stdin=archivo, capture_output=True)

    if proceso.returncode != 0:
        print(f"❌ mysql falló: {proceso.stderr.decode(errors='replace')}")
        sys.exit(1)

    print("✅ Base de datos restaurada correctamente.")


def comando_clean(dias=30):
    archivos = listar_backups()
    if not archivos:
        print("No hay backups que limpiar.")
        return

    limite = datetime.now() - timedelta(days=dias)
    eliminados = 0

    for nombre in archivos:
        ruta = os.path.join(BACKUPS_DIR, nombre)
        modificado = datetime.fromtimestamp(os.path.getmtime(ruta))
        if modificado < limite:
            os.remove(ruta)
            print(f"🗑️  Eliminado: {nombre}")
            eliminados += 1

    if eliminados == 0:
        print(f"No hay backups con más de {dias} días.")
    else:
        print(f"✅ Se eliminaron {eliminados} backup(s) antiguos.")


def parsear_argumentos():
    parser = argparse.ArgumentParser(description="Backup de la base de datos UNIDA")
    subparsers = parser.add_subparsers(dest="accion", required=True)

    subparsers.add_parser("backup", help="Crea un nuevo backup")
    subparsers.add_parser("list", help="Lista los backups disponibles")

    restore_parser = subparsers.add_parser("restore", help="Restaura un backup")
    restore_parser.add_argument(
        "archivo", nargs="?", help="Nombre del backup a restaurar (por defecto: el más reciente)"
    )

    clean_parser = subparsers.add_parser("clean", help="Elimina backups con más de N días")
    clean_parser.add_argument("--dias", type=int, default=30, help="Días de antigüedad máxima")

    return parser.parse_args()


def main():
    args = parsear_argumentos()

    if args.accion == "backup":
        comando_backup()
    elif args.accion == "list":
        comando_list()
    elif args.accion == "restore":
        comando_restore(args.archivo)
    elif args.accion == "clean":
        comando_clean(args.dias)


if __name__ == "__main__":
    main()
