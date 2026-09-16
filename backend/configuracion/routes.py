from flask import Blueprint, jsonify, request

from utils import FASES_CALIFICACION_DIRECTA, obtener_banco_preguntas

configuracion_bp = Blueprint("configuracion", __name__)


@configuracion_bp.route("/api/preguntas", methods=["GET"])
def obtener_preguntas():
    programa = request.args.get("programa", "")
    fase = request.args.get("fase", "")
    return jsonify(obtener_banco_preguntas(programa, fase)), 200


@configuracion_bp.route("/api/fases-directas", methods=["GET"])
def obtener_fases_directas():
    return jsonify(FASES_CALIFICACION_DIRECTA), 200