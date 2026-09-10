import json
import os

from flask import Blueprint, jsonify, request

from utils import FASES_CALIFICACION_DIRECTA

configuracion_bp = Blueprint("configuracion", __name__)

RUTA_PREGUNTAS = os.path.join(os.path.dirname(__file__), "..", "..", "preguntas.json")


@configuracion_bp.route("/api/preguntas", methods=["GET"])
def obtener_preguntas():
    programa = request.args.get("programa", "")
    fase = request.args.get("fase", "")
    llave = f"{programa}_{fase}"


    fase_normalizada = "Tutorial" if "tutorial" in fase.lower() else fase
    llave = f"{programa}_{fase_normalizada}"

    with open(RUTA_PREGUNTAS, "r", encoding="utf-8") as f:
        banco = json.load(f)

    return jsonify(banco.get(llave, banco["Global"])), 200


@configuracion_bp.route("/api/fases-directas", methods=["GET"])
def obtener_fases_directas():
    return jsonify(FASES_CALIFICACION_DIRECTA), 200