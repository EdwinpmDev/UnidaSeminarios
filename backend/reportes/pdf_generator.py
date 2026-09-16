import json
from io import BytesIO

from jinja2 import Environment
from weasyprint import HTML

from utils import FASES_CALIFICACION_DIRECTA

_env = Environment(autoescape=True)


def _url_fetcher_bloqueado(url, *args, **kwargs):
    raise ValueError(f"Carga de recursos externos bloqueada: {url}")


CSS_BASE = """
@page {
    size: A4;
    margin: 18mm 14mm 20mm 14mm;
    @bottom-center {
        content: "Página " counter(page) " de " counter(pages);
        font-size: 8pt;
        color: #6b7280;
    }
}
* { box-sizing: border-box; }
body {
    font-family: 'DejaVu Sans', 'Helvetica', sans-serif;
    color: #1f2937;
    font-size: 10.5pt;
    line-height: 1.45;
}
h2 {
    color: #1B396A;
    border-bottom: 2px solid #D4AF37;
    padding-bottom: 8px;
    margin: 0 0 14px 0;
    font-size: 15pt;
}
h4 {
    color: #1B396A;
    margin: 16px 0 8px 0;
    border-bottom: 1px solid #cbd5e1;
    padding-bottom: 4px;
    font-size: 11pt;
}
.info-seminario {
    font-size: 9.5pt;
    color: #475569;
    margin: -4px 0 14px 0;
    padding-bottom: 10px;
    border-bottom: 1px dashed #cbd5e1;
}
.info-seminario strong { color: #1B396A; }
.encabezado { display: flex; justify-content: space-between; margin-bottom: 16px; }
.encabezado p { margin: 3px 0; }
.calificacion-final { text-align: right; }
.calificacion-final .valor { font-size: 20pt; color: #16a34a; font-weight: 800; margin: 4px 0 0; }
.calificacion-final .etiqueta { font-size: 8.5pt; color: #6b7280; font-weight: bold; text-transform: uppercase; margin: 0; }

/* CLAVE: cada pregunta se mueve completa a la siguiente página si no cabe */
.pregunta-bloque {
    break-inside: avoid;
    page-break-inside: avoid;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 8px;
}
.pregunta-texto { font-size: 9.5pt; font-weight: 600; color: #132848; margin-bottom: 6px; }
.opciones { display: flex; flex-wrap: wrap; gap: 4px; }
.opcion {
    flex: 1;
    min-width: 18px;
    text-align: center;
    border: 1px solid #cbd5e1;
    color: #64748b;
    background: #f1f5f9;
    padding: 5px 0;
    border-radius: 4px;
    font-weight: bold;
    font-size: 8.5pt;
}
.opcion.seleccionada { background: #1B396A; color: white; border-color: #1B396A; }

/* CLAVE: el bloque de comentarios se intenta mantener junto, pero si el
comentario es MUY largo, WeasyPrint permite que el bloque fluya a la
   siguiente página completo en vez de cortar el texto por la mitad. */
.comentarios { margin-top: 18px; padding-top: 12px; border-top: 2px solid #cbd5e1; }
.comentarios .caja {
    background: #f8fafc;
    padding: 14px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    color: #333;
    font-style: italic;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    word-break: break-word;
}

/* Cada evaluación nueva empieza en una página en blanco cuando se combinan varias */
.evaluacion-completa { break-before: page; page-break-before: always; }
.evaluacion-completa:first-child { break-before: auto; page-break-before: auto; }

.aviso {
    background: #fffbeb;
    border: 1px solid #fde68a;
    color: #92400e;
    padding: 16px;
    border-radius: 8px;
    margin-top: 16px;
}
"""

_TEMPLATE_EVALUACION = _env.from_string("""
<div class="evaluacion-completa">
    <h2>Cédula de Evaluación - {{ ev.rol }}</h2>
    <p class="info-seminario">
        <strong>Seminario:</strong> {{ ev.proyecto or 'N/A' }} &nbsp;|&nbsp;
        <strong>Etapa:</strong> {{ ev.etapa or 'N/A' }} &nbsp;|&nbsp;
        <strong>Evaluado:</strong> {{ ev.estudiante or 'N/A' }}
    </p>
    {% if ev.es_directa %}
        <div class="encabezado">
            <div>
                <p><strong>Evaluador:</strong> {{ ev.nombre }}</p>
                <p><strong>Fecha:</strong> {{ ev.fecha or 'N/A' }}</p>
            </div>
            <div class="calificacion-final">
                <p class="etiqueta">Calificación Directa</p>
                <p class="valor">{{ ev.calificacion }} / 100</p>
            </div>
        </div>

        <div class="comentarios">
            <h4>Observaciones y retroalimentación:</h4>
            <div class="caja">{{ ev.comentarios or 'Sin comentarios registrados.' }}</div>
        </div>
    {% elif not ev.respuestas or ev.respuestas is mapping %}
        <div class="encabezado">
            <div>
                <p><strong>Evaluador:</strong> {{ ev.nombre }}</p>
                <p><strong>Fecha:</strong> {{ ev.fecha or 'N/A' }}</p>
            </div>
        </div>
        <div class="aviso">
            <p>Esta evaluación es de una versión anterior. Sólo cuenta con la calificación final ({{ ev.calificacion }} / 100) y el comentario.</p>
            <p><strong>Comentarios:</strong> {{ ev.comentarios }}</p>
        </div>
    {% else %}
        <div class="encabezado">
            <div>
                <p><strong>Evaluador:</strong> {{ ev.nombre }}</p>
                <p><strong>Fecha:</strong> {{ ev.fecha or 'N/A' }}</p>
            </div>
            <div class="calificacion-final">
                <p class="etiqueta">Calificación Final</p>
                <p class="valor">{{ ev.calificacion }} / 100</p>
            </div>
        </div>

        {% for r in ev.respuestas %}
            {% if loop.first or r.escala_maxima != loop.previtem.escala_maxima %}
                <h4>Escala 1 al {{ r.escala_maxima }}</h4>
            {% endif %}
            <div class="pregunta-bloque">
                <div class="pregunta-texto">P{{ loop.index }}. {{ r.texto }}</div>
                <div class="opciones">
                    {% for j in range(1, r.escala_maxima + 1) %}
                        <div class="opcion {{ 'seleccionada' if j == r.puntaje|int else '' }}">{{ j }}</div>
                    {% endfor %}
                </div>
            </div>
        {% endfor %}


        <div class="comentarios">
            <h4>Observaciones y retroalimentación:</h4>
            <div class="caja">{{ ev.comentarios or 'Sin comentarios registrados.' }}</div>
        </div>
    {% endif %}
</div>
""")


def construir_ev_dict(evaluacion):
    seminario = evaluacion.seminario
    return {
        "id": evaluacion.id,
        "rol": evaluacion.evaluador_rol,
        "nombre": evaluacion.evaluador_nombre,
        "calificacion": evaluacion.calificacion_final,
        "comentarios": evaluacion.comentarios,
        "fecha": evaluacion.fecha_evaluacion.strftime("%d/%m/%Y %H:%M") if evaluacion.fecha_evaluacion else "",
        "respuestas": json.loads(evaluacion.respuestas_detalle) if evaluacion.respuestas_detalle else None,
        "proyecto": seminario.proyecto if seminario else "",
        "etapa": seminario.tipo_seminario if seminario else "",
        "estudiante": seminario.estudiante.nombre if seminario and seminario.estudiante else "",
        "es_directa": seminario.tipo_seminario in FASES_CALIFICACION_DIRECTA if seminario else False,
    }


def renderizar_pdf(evaluaciones_dicts):
    cuerpo = "\n".join(
        _TEMPLATE_EVALUACION.render(ev=ev)
        for ev in evaluaciones_dicts
    )
    html_completo = f"<html><head><style>{CSS_BASE}</style></head><body>{cuerpo}</body></html>"
    pdf_bytes = HTML(string=html_completo, url_fetcher=_url_fetcher_bloqueado).write_pdf()
    return BytesIO(pdf_bytes)



def nombre_archivo_evaluacion(evaluacion):
    prefijo_rol = {"Externo": "externo", "Docente": "docente"}.get(evaluacion.evaluador_rol, "estudiante")
    nombre_limpio = evaluacion.evaluador_nombre.replace(" ", "_")
    return f"{prefijo_rol}_{nombre_limpio}_evaluacion.pdf"