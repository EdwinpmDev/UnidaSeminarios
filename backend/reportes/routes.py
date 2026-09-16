import zipfile

from io import BytesIO
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import openpyxl
from flask import Blueprint, current_app, jsonify, make_response, request, send_file
from sqlalchemy import extract, func
from sqlalchemy.orm import selectinload

from extensions import Session
from models import Estudiante, Seminario, UsuarioEvaluador, Evaluacion
from utils import aplicar_formato_excel, calcular_ventana_evaluacion, escribir_celda_texto, parsear_jurado
from reportes.pdf_generator import construir_ev_dict, renderizar_pdf, nombre_archivo_evaluacion

from auth.decorators import admin_requerido, token_requerido

reportes_bp = Blueprint("reportes", __name__)


@reportes_bp.route("/descargar-reporte", methods=["GET"])
@token_requerido
def descargar_reporte():
    programa_filtro = request.args.get('programa', 'todos').strip()
    fase_filtro = request.args.get('fase', 'todos').strip()

    session = Session()
    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Directorio de alumnos"

        for col, titulo in enumerate(['No. Control', 'Nombre de alumno', 'Programa', 'Seminarios activos', 'Seminarios evaluados', 'Proyectos Registrados'], start=1):
            ws.cell(row=1, column=col, value=titulo)

        query = session.query(Estudiante).options(
            selectinload(Estudiante.seminarios).selectinload(Seminario.evaluaciones)
        )

        if programa_filtro != 'todos':
            query = query.filter(Estudiante.programa == programa_filtro)
        if fase_filtro != 'todos':
            query = query.filter(Estudiante.seminarios.any(Seminario.tipo_seminario == fase_filtro))

        estudiantes = query.all()
        fila = 2
        for est in estudiantes:
            activos = 0
            evaluados = 0
            nombres_proyectos = []
            for s in est.seminarios:
                nombres_proyectos.append(s.proyecto)
                plazo_vencido = calcular_ventana_evaluacion(s)["estado"] == "caducado"
                if plazo_vencido:
                    evaluados += 1
                else:
                    activos += 1

            proyectos_str = " | ".join(nombres_proyectos) if nombres_proyectos else "Sin proyectos"

            escribir_celda_texto(ws, fila, 1, est.usuarioAlumno)
            escribir_celda_texto(ws, fila, 2, est.nombre)
            escribir_celda_texto(ws, fila, 3, est.programa)
            escribir_celda_texto(ws, fila, 4, activos)
            escribir_celda_texto(ws, fila, 5, evaluados)
            escribir_celda_texto(ws, fila, 6, proyectos_str)
            fila += 1

        aplicar_formato_excel(ws)

        out = BytesIO()
        wb.save(out)
        out.seek(0)

        respuesta = make_response(out.read())
        respuesta.mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        respuesta.headers["Content-Disposition"] = "attachment;filename=reporte_alumnos.xlsx"
        return respuesta
    finally:
        session.close()


@reportes_bp.route("/descargar-agenda", methods=["GET"])
@token_requerido
def descargar_agenda():
    mes_filtro = request.args.get('mes', 'todos')
    anio_filtro = request.args.get('anio', 'todos')
    programa_filtro = request.args.get('programa', 'todos').strip()
    fase_filtro = request.args.get('fase', 'todos').strip()

    session = Session()
    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Agenda filtrada"
        for col, titulo in enumerate(['Fecha', 'Hora', 'Lugar', 'Modalidad', 'Estudiante', 'No. Control', 'Tipo de seminario', 'Proyecto'], start=1):
            ws.cell(row=1, column=col, value=titulo)

        query = session.query(Seminario).join(Estudiante)

        if anio_filtro != 'todos':
            query = query.filter(extract('year', Seminario.fecha) == int(anio_filtro))
        if mes_filtro != 'todos':
            query = query.filter(extract('month', Seminario.fecha) == int(mes_filtro))
        if programa_filtro != 'todos':
            query = query.filter(Estudiante.programa == programa_filtro)
        if fase_filtro != 'todos':
            query = query.filter(Seminario.tipo_seminario == fase_filtro)

        seminarios = query.order_by(Seminario.fecha.asc(), Seminario.hora.asc()).all()

        fila = 2
        for s in seminarios:
            if not s.fecha:
                continue

            hora_str = s.hora.strftime('%H:%M') if s.hora else 'Sin hora'
            escribir_celda_texto(ws, fila, 1, s.fecha.strftime("%d/%m/%Y"))
            escribir_celda_texto(ws, fila, 2, hora_str)
            escribir_celda_texto(ws, fila, 3, s.lugar)
            escribir_celda_texto(ws, fila, 4, s.modalidad)
            escribir_celda_texto(ws, fila, 5, s.estudiante.nombre)
            escribir_celda_texto(ws, fila, 6, s.estudiante.usuarioAlumno)
            escribir_celda_texto(ws, fila, 7, s.tipo_seminario)
            escribir_celda_texto(ws, fila, 8, s.proyecto)
            fila += 1

        aplicar_formato_excel(ws)

        out = BytesIO()
        wb.save(out)
        out.seek(0)

        respuesta = make_response(out.read())
        respuesta.mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        respuesta.headers["Content-Disposition"] = f"attachment;filename=agenda_{mes_filtro}_{anio_filtro}.xlsx"
        return respuesta
    finally:
        session.close()


@reportes_bp.route("/agenda-paginada", methods=["GET"])
@token_requerido
def agenda_paginada():
    session = Session()
    try:
        mes_filtro = request.args.get('mes', 'todos')
        anio_filtro = request.args.get('anio', 'todos')
        programa_filtro = request.args.get('programa', 'todos').strip()
        fase_filtro = request.args.get('fase', 'todos').strip()
        page = int(request.args.get('page', 1))
        per_page = 15

        query = session.query(Seminario).join(Estudiante)

        if anio_filtro != 'todos':
            query = query.filter(extract('year', Seminario.fecha) == int(anio_filtro))
        if mes_filtro != 'todos':
            query = query.filter(extract('month', Seminario.fecha) == int(mes_filtro))
        if programa_filtro != 'todos':
            query = query.filter(Estudiante.programa == programa_filtro)
        if fase_filtro != 'todos':
            query = query.filter(Seminario.tipo_seminario == fase_filtro)
            
        total_records = query.count()
        has_more = (page * per_page) < total_records

        seminarios_bd = query.order_by(Seminario.fecha.asc(), Seminario.hora.asc()).offset((page - 1) * per_page).limit(per_page).all()

        eventos = []
        for sem in seminarios_bd:
            if not sem.fecha:
                continue

            opciones_meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
            fecha_str = f"{sem.fecha.day} de {opciones_meses[sem.fecha.month - 1]} de {sem.fecha.year}"

            jurado = parsear_jurado(sem.jurado_texto)

            estado_plazo = "Activo"
            if sem.fecha and sem.hora:
                fecha_inicio = datetime.combine(sem.fecha, sem.hora).replace(tzinfo=ZoneInfo("America/Mexico_City"))
                fecha_fin = fecha_inicio + timedelta(hours=72)
                ahora = datetime.now(ZoneInfo("America/Mexico_City"))
                
                if ahora < fecha_inicio:
                    estado_plazo = "Pendiente"
                elif ahora > fecha_fin:
                    estado_plazo = "Terminado"

            eventos.append({
                "id_seminario": sem.id,
                "proyecto": sem.proyecto,
                "tipo_seminario": sem.tipo_seminario,
                "lugar": sem.lugar or "No definido",
                "modalidad": sem.modalidad or "Presencial",
                "estado_plazo": estado_plazo,
                "fecha_raw": str(sem.fecha),
                "fecha_bonita": fecha_str,
                "hora": sem.hora.strftime("%H:%M") if sem.hora else "00:00",
                "clave_acceso": sem.clave_acceso,
                "presidente": jurado.get("Presidente", ""),
                "secretario": jurado.get("Secretario", ""),
                "vocal": jurado.get("Vocal", ""),
                "nombre_estudiante": sem.estudiante.nombre,
                "usuarioAlumno": sem.estudiante.usuarioAlumno,
                "programa": sem.estudiante.programa
            })

        return jsonify({
            "success": True,
            "eventos": eventos,
            "has_more": has_more,
            "total": total_records
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error en agenda paginada: {e}")
        return jsonify({"success": False, "mensaje": "Ocurrió un error interno. Intenta de nuevo."}), 500
    finally:
        session.close()


@reportes_bp.route("/agenda-anios-disponibles", methods=["GET"])
@token_requerido
def agenda_anios_disponibles():
    session = Session()
    try:
        anio_minimo, anio_maximo = session.query(
            func.min(extract('year', Seminario.fecha)),
            func.max(extract('year', Seminario.fecha))
        ).filter(Seminario.fecha.isnot(None)).first()

        anio_actual = datetime.now(ZoneInfo("America/Mexico_City")).year
        return jsonify({
            "success": True,
            "anio_minimo": int(anio_minimo) if anio_minimo else anio_actual,
            "anio_maximo": int(anio_maximo) if anio_maximo else anio_actual
        }), 200
    finally:
        session.close()


@reportes_bp.route("/descargar-docentes", methods=["GET"])
@admin_requerido
# exporta el directorio de docentes a excel, sin exponer el id interno
def descargar_docentes():
    session = Session()
    try:
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Directorio de docentes"
        for col, titulo in enumerate(['Nombre completo', 'Usuario de acceso'], start=1):
            ws.cell(row=1, column=col, value=titulo)

        docentes = session.query(UsuarioEvaluador).filter_by(es_admin=False).all()
        fila = 2
        for d in docentes:
            escribir_celda_texto(ws, fila, 1, d.nombre_completo)
            escribir_celda_texto(ws, fila, 2, d.usuario)
            fila += 1

        aplicar_formato_excel(ws)

        out = BytesIO()
        wb.save(out)
        out.seek(0)

        respuesta = make_response(out.read())
        respuesta.mimetype = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        respuesta.headers["Content-Disposition"] = "attachment;filename=directorio_docentes.xlsx"
        return respuesta
    finally:
        session.close()


@reportes_bp.route("/evaluacion-pdf/<int:id_evaluacion>", methods=["GET"])
@token_requerido
def evaluacion_pdf(id_evaluacion):
    session = Session()
    try:
        evaluacion = session.query(Evaluacion).filter_by(id=id_evaluacion).first()
        if not evaluacion:
            return jsonify({"success": False, "mensaje": "Evaluación no encontrada"}), 404
        pdf_io = renderizar_pdf([construir_ev_dict(evaluacion)])
        return send_file(
            pdf_io,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=nombre_archivo_evaluacion(evaluacion),
        )
    finally:
        session.close()

@reportes_bp.route("/evaluaciones-pdf/<int:id_seminario>", methods=["GET"])
@token_requerido
def evaluaciones_pdf_seminario(id_seminario):
    rol_filtro = request.args.get("rol", "todos")
    session = Session()
    try:
        query = session.query(Evaluacion).filter_by(seminario_id=id_seminario)
        if rol_filtro != "todos":
            query = query.filter_by(evaluador_rol=rol_filtro)
        evaluaciones = query.order_by(Evaluacion.fecha_evaluacion.asc()).all()

        if not evaluaciones:
            return jsonify({"success": False, "mensaje": "No hay evaluaciones para generar el PDF"}), 404

        pdf_io = renderizar_pdf([construir_ev_dict(e) for e in evaluaciones])

        return send_file(
            pdf_io,
            mimetype="application/pdf",
            as_attachment=True,
            download_name=f"Compendio_Evaluaciones_{rol_filtro}.pdf",
        )
    finally:
        session.close()


@reportes_bp.route("/evaluaciones-zip/<int:id_seminario>", methods=["GET"])
@token_requerido
def evaluaciones_zip_seminario(id_seminario):
    rol_filtro = request.args.get("rol", "todos")
    session = Session()
    try:
        query = session.query(Evaluacion).filter_by(seminario_id=id_seminario)
        if rol_filtro != "todos":
            query = query.filter_by(evaluador_rol=rol_filtro)
        evaluaciones = query.order_by(Evaluacion.fecha_evaluacion.asc()).all()

        if not evaluaciones:
            return jsonify({"success": False, "mensaje": "No hay evaluaciones para generar el PDF"}), 404

        zip_io = BytesIO()
        nombres_usados = {}
        with zipfile.ZipFile(zip_io, "w", zipfile.ZIP_DEFLATED) as zf:
            for evaluacion in evaluaciones:
                pdf_io = renderizar_pdf([construir_ev_dict(evaluacion)])

                base = nombre_archivo_evaluacion(evaluacion).replace(".pdf", "")
                nombre_final, contador = base, 2
                while nombre_final in nombres_usados:
                    nombre_final = f"{base}_{contador}"
                    contador += 1
                nombres_usados[nombre_final] = True

                zf.writestr(f"{nombre_final}.pdf", pdf_io.getvalue())

        zip_io.seek(0)
        return send_file(
            zip_io,
            mimetype="application/zip",
            as_attachment=True,
            download_name=f"Evaluaciones_Individuales_{rol_filtro}.zip",
        )
    finally:
        session.close()