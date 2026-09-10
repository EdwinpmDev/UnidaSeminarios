import random
import re
import string
import unicodedata
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from openpyxl.styles import Font, PatternFill

VENTANA_EVALUACION_HORAS = 72

NOMBRE_REGEX = re.compile(r'^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$')
CORREO_REGEX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
NUMERO_CONTROL_REGEX = re.compile(r'^\d{8,}$')
PASSWORD_ESTUDIANTE_REGEX = re.compile(r'^[A-Za-z0-9]{4,}$')
CLAVE_ACCESO_REGEX = re.compile(r'^[A-Z0-9]{4,20}$')

PROGRAMAS_VALIDOS = {"Maestría", "Doctorado"}

FASES_POR_PROGRAMA = {
    "Maestría": ["1.- Prototipo", "2.- Tutorial", "3.- Culminacion"],
    "Doctorado": [
        "1.- Prototipo", "2.- Tutorial I", "3.- Avance 1",
        "4.- Predoctoral", "5.- Tutorial II", "6.- Avance 2",
        "7.- Tutorial III", "8.- Culminacion",
    ],
}

LONGITUD_MAX_CORTO = 255
LONGITUD_MAX_NOMBRE_JURADO = 150
LONGITUD_MAX_DURACION = 20
LONGITUD_MAX_COMENTARIO = 2000
LONGITUD_MAX_NOMBRE_EVALUADOR = 100

FASES_CALIFICACION_DIRECTA = [
    "2.- Tutorial",
    "2.- Tutorial I",
    "4.- Predoctoral",
    "5.- Tutorial II",
    "7.- Tutorial III",
]


def limpiar_texto_libre(texto):
    if not texto:
        return ""
    texto = texto.strip()
    return "".join(c for c in texto if c in "\n\t" or unicodedata.category(c)[0] != "C")


def validar_longitud(texto, maximo):
    return len(texto) <= maximo


def sanitizar_celda_excel(valor):
    if valor is None:
        return valor
    texto = str(valor)
    if not texto:
        return texto
    if texto[0] in ("=", "+", "-", "@", "\t", "\r"):
        return "'" + texto
    return texto


def generar_clave_acceso():
    caracteres = string.ascii_uppercase + string.digits
    return ''.join(random.choice(caracteres) for _ in range(8))


def parsear_jurado(jurado_texto):
    resultado = {"Presidente": "", "Secretario": "", "Vocal": ""}
    if not jurado_texto:
        return resultado
    for parte in jurado_texto.split('|'):
        if ':' in parte:
            rol, nombre = parte.split(':', 1)
            rol = rol.strip()
            if rol in resultado:
                resultado[rol] = nombre.strip()
    return resultado


def calcular_ventana_evaluacion(seminario):
    if not seminario.fecha or not seminario.hora:
        return {
            "estado": "sin_fecha",
            "disponible": False,
            "mensaje": "Este seminario todavía no tiene fecha y hora asignadas.",
            "inicio": None,
            "fin": None,
        }

    tz = ZoneInfo("America/Mexico_City")
    fecha_inicio = datetime.combine(seminario.fecha, seminario.hora).replace(tzinfo=tz)
    fecha_fin = fecha_inicio + timedelta(hours=VENTANA_EVALUACION_HORAS)
    ahora = datetime.now(tz)

    inicio_str = fecha_inicio.strftime("%d/%m/%Y %I:%M %p")
    fin_str = fecha_fin.strftime("%d/%m/%Y %I:%M %p")

    if ahora < fecha_inicio:
        return {
            "estado": "antes",
            "disponible": False,
            "mensaje": f"Todavía no se puede evaluar. Estará disponible a partir del {inicio_str}.",
            "inicio": inicio_str,
            "fin": fin_str,
        }

    if ahora > fecha_fin:
        return {
            "estado": "caducado",
            "disponible": False,
            "mensaje": f"El plazo para evaluar este seminario venció el {fin_str} (72 horas después de su inicio).",
            "inicio": inicio_str,
            "fin": fin_str,
        }

    return {
        "estado": "disponible",
        "disponible": True,
        "mensaje": f"Disponible para evaluar hasta el {fin_str}.",
        "inicio": inicio_str,
        "fin": fin_str,
    }


def aplicar_formato_excel(ws):
    header_fill = PatternFill(start_color="1B396A", end_color="1B396A", fill_type="solid")
    header_font = Font(color="FFFFFF", bold=True)
    alt_row_fill = PatternFill(start_color="F0F4F8", end_color="F0F4F8", fill_type="solid")

    for cell in ws[1]:
        cell.fill = header_fill
        cell.font = header_font

    for row_idx, row in enumerate(ws.iter_rows(min_row=2), start=2):
        if row_idx % 2 == 0:
            for cell in row:
                cell.fill = alt_row_fill

    for col in ws.columns:
        max_length = 0
        col_letter = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except Exception:
                pass
        ws.column_dimensions[col_letter].width = max_length + 2