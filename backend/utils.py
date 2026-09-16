import json
import os
import re
import secrets
import string
import unicodedata
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from openpyxl.styles import Font, PatternFill

VENTANA_EVALUACION_HORAS = 72

RUTA_PREGUNTAS = os.path.join(os.path.dirname(__file__), "..", "preguntas.json")

NOMBRE_REGEX = re.compile(r'^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$')
CORREO_REGEX = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]{2,}$')
NUMERO_CONTROL_REGEX = re.compile(r'^\d{8,}$')
PASSWORD_ESTUDIANTE_REGEX = re.compile(r'^\d{6,}$')
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


# Caracteres que Excel/LibreOffice/Sheets pueden interpretar como inicio de fórmula
CARACTERES_PELIGROSOS_EXCEL = ("=", "+", "-", "@", "\t", "\r", "%", "(", "[", "{", "|", ";", ",", "`", "~", "!", "$", "^")


def sanitizar_celda_excel(valor):
    if valor is None:
        return valor
    texto = str(valor)
    if not texto:
        return texto
    if texto[0] in CARACTERES_PELIGROSOS_EXCEL:
        return "'" + texto
    return texto


def escribir_celda_texto(ws, fila, columna, valor):
    celda = ws.cell(row=fila, column=columna, value=sanitizar_celda_excel(valor))
    celda.data_type = 's'  # Fuerza tipo texto para que Excel no evalúe fórmulas
    return celda


def generar_clave_acceso():
    caracteres = string.ascii_uppercase + string.digits
    return ''.join(secrets.choice(caracteres) for _ in range(8))


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


def es_seminario_de_estudiante(session, id_seminario, id_estudiante):
    # Import local para evitar dependencia circular utils.py - models.py
    from models import Seminario
    return session.query(Seminario).filter_by(id=id_seminario, estudiante_id=id_estudiante).first() is not None


def obtener_banco_preguntas(programa, fase):
    fase_normalizada = "Tutorial" if "tutorial" in (fase or "").lower() else fase
    llave = f"{programa}_{fase_normalizada}"

    with open(RUTA_PREGUNTAS, "r", encoding="utf-8") as f:
        banco = json.load(f)

    return banco.get(llave, banco["Global"])


def validar_y_reconstruir_respuestas(respuestas_cliente, programa, fase):
    """
    Reconstruye respuestas_detalle a partir del banco de preguntas real.
    Ignora texto/escala_maxima que mande el cliente, solo usa el id para
    buscar la pregunta real y valida que el puntaje esté en rango.
    Devuelve (snapshot, None) si todo es válido, o (None, mensaje_error).
    """
    if not respuestas_cliente or not isinstance(respuestas_cliente, list):
        return None, "Faltan las respuestas del cuestionario"

    preguntas_banco = obtener_banco_preguntas(programa, fase)
    preguntas_por_id = {p["id"]: p for p in preguntas_banco}

    if len(respuestas_cliente) != len(preguntas_banco):
        return None, "La cantidad de respuestas no coincide con el cuestionario"

    ids_vistos = set()
    snapshot = []
    for item in respuestas_cliente:
        if not isinstance(item, dict):
            return None, "Respuesta con formato inválido"

        id_pregunta = item.get("id")
        if not id_pregunta:
            return None, "Formato de respuestas desactualizado, recarga la página e intenta de nuevo"

        if id_pregunta in ids_vistos:
            return None, "Hay respuestas duplicadas en el cuestionario"
        ids_vistos.add(id_pregunta)

        pregunta_real = preguntas_por_id.get(id_pregunta)
        if not pregunta_real:
            return None, f"La pregunta {id_pregunta} no existe en el cuestionario"

        puntaje = item.get("puntaje")
        # bool es subclase de int en Python, se excluye para no aceptar true/false como puntaje
        if not isinstance(puntaje, (int, float)) or isinstance(puntaje, bool):
            return None, f"El puntaje de la pregunta {id_pregunta} debe ser numérico"

        escala_real = pregunta_real["escala_maxima"]
        if puntaje < 0 or puntaje > escala_real:
            return None, f"El puntaje de la pregunta {id_pregunta} está fuera de rango"

        snapshot.append({
            "id": id_pregunta,
            "texto": pregunta_real["texto"],
            "escala_maxima": escala_real,
            "puntaje": puntaje,
        })

    return snapshot, None