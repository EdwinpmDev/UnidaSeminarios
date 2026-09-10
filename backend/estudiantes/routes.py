from datetime import datetime, timedelta

import json
from flask import Blueprint, current_app, jsonify, request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from werkzeug.security import generate_password_hash
from zoneinfo import ZoneInfo

import jwt
from config import JWT_SECRET
from extensions import Session, limiter
from models import Estudiante, Evaluacion, Seminario
from utils import (
    CLAVE_ACCESO_REGEX,
    CORREO_REGEX,
    FASES_POR_PROGRAMA,
    LONGITUD_MAX_COMENTARIO,
    LONGITUD_MAX_CORTO,
    LONGITUD_MAX_NOMBRE_JURADO,
    NOMBRE_REGEX,
    NUMERO_CONTROL_REGEX,
    PASSWORD_ESTUDIANTE_REGEX,
    PROGRAMAS_VALIDOS,
    calcular_ventana_evaluacion,
    generar_clave_acceso,
    limpiar_texto_libre,
    parsear_jurado,
    validar_longitud,
)

from auth.decorators import admin_requerido, csrf_protegido, estudiante_requerido, token_esta_revocado, token_requerido, validar_json

estudiantes_bp = Blueprint("estudiantes", __name__)


def hay_colision_horario(session, fecha_obj, hora_obj, duracion, lugar, excluir_id=None):
    inicio_nuevo = datetime.combine(fecha_obj, hora_obj)
    fin_nuevo = inicio_nuevo + timedelta(minutes=duracion)
    query = session.query(Seminario).filter(
        Seminario.fecha == fecha_obj,
        Seminario.lugar == lugar,
        Seminario.hora.isnot(None),
        Seminario.duracion.isnot(None),
    )
    if excluir_id:
        query = query.filter(Seminario.id != excluir_id)
    for otro in query.all():
        inicio_otro = datetime.combine(otro.fecha, otro.hora)
        fin_otro = inicio_otro + timedelta(minutes=otro.duracion)
        if inicio_nuevo < fin_otro and inicio_otro < fin_nuevo:
            return otro
    return None


def mensaje_colision(otro):
    fin_otro = datetime.combine(otro.fecha, otro.hora) + timedelta(minutes=otro.duracion)
    return (
        f"Ese horario choca con el seminario de {otro.estudiante.nombre} ({otro.proyecto}) "
        f"en {otro.lugar}, agendado el {otro.fecha.strftime('%d/%m/%Y')} "
        f"de {otro.hora.strftime('%H:%M')} a {fin_otro.strftime('%H:%M')}."
    )


# --- GESTIÓN CRUD DE ALUMNOS Y SEMINARIOS

@estudiantes_bp.route("/registrar-estudiante", methods=["POST"])
@admin_requerido
@csrf_protegido
@validar_json
@limiter.limit("10 per minute")
def registrar_estudiante():
    session = Session()
    try:
        data = request.get_json() or {}
        usuarioAlumno, nombre = data.get("usuarioAlumno", "").strip(), data.get("nombre", "").strip()
        password, correo = data.get("password_estudiante", "").strip(), data.get("correo", "").strip()
        programa = data.get("programa", "").strip()
        tipo_seminario = data.get("tipo_seminario", "").strip()
        lugar = limpiar_texto_libre(data.get("lugar", ""))
        proyecto = limpiar_texto_libre(data.get("proyecto", ""))
        observaciones = limpiar_texto_libre(data.get("observaciones", ""))
        presidente = limpiar_texto_libre(data.get("presidente", ""))
        secretario = limpiar_texto_libre(data.get("secretario", ""))
        vocal = limpiar_texto_libre(data.get("vocal", ""))

        try:
            duracion = int(data.get("duracion"))
        except (TypeError, ValueError):
            return jsonify({"success": False, "mensaje": "La duración debe ser un número de minutos válido"}), 400
        if duracion <= 0:
            return jsonify({"success": False, "mensaje": "La duración debe ser mayor a 0"}), 400

        if not usuarioAlumno or not nombre:
            return jsonify({"success": False, "mensaje": "Faltan datos obligatorios (Control o Nombre)"}), 400

        for campo, valor, maximo in (
            ("proyecto", proyecto, LONGITUD_MAX_CORTO),
            ("lugar", lugar, LONGITUD_MAX_CORTO),
            ("observaciones", observaciones, LONGITUD_MAX_COMENTARIO),
            ("presidente", presidente, LONGITUD_MAX_NOMBRE_JURADO),
            ("secretario", secretario, LONGITUD_MAX_NOMBRE_JURADO),
            ("vocal", vocal, LONGITUD_MAX_NOMBRE_JURADO),
        ):
            if not validar_longitud(valor, maximo):
                return jsonify({"success": False, "mensaje": f"El campo '{campo}' no puede superar los {maximo} caracteres"}), 400

        estudiante_existente = session.query(Estudiante).filter_by(usuarioAlumno=usuarioAlumno).first()
        if not estudiante_existente and not password:
            return jsonify({"success": False, "mensaje": "La contraseña es obligatoria para nuevos alumnos"}), 400

        if not NOMBRE_REGEX.match(nombre):
            return jsonify({"success": False, "mensaje": "El nombre solo puede contener letras y espacios"}), 400
        if not NUMERO_CONTROL_REGEX.match(usuarioAlumno):
            return jsonify({"success": False, "mensaje": "El número de control debe contener mínimo 8 números (sin letras)."}), 400
        if password and not PASSWORD_ESTUDIANTE_REGEX.match(password):
            return jsonify({"success": False, "mensaje": "La contraseña debe contener al menos 4 caracteres/numeros"}), 400
        if correo and not CORREO_REGEX.match(correo):
            return jsonify({"success": False, "mensaje": "El correo no es válido (falta un @ o un dominio, ej. .com)"}), 400
        if not lugar:
            return jsonify({"success": False, "mensaje": "Debes indicar el aula, enlace o modalidad del seminario"}), 400
        if programa not in PROGRAMAS_VALIDOS:
            return jsonify({"success": False, "mensaje": "Selecciona un programa válido (Maestría o Doctorado)"}), 400
        if tipo_seminario not in FASES_POR_PROGRAMA.get(programa, []):
            return jsonify({"success": False, "mensaje": "La fase del seminario no es válida para el programa seleccionado"}), 400

        try:
            fecha_obj = datetime.strptime(data.get("fecha", ""), "%Y-%m-%d").date()
            hoy_mexico = datetime.now(ZoneInfo("America/Mexico_City")).date()
            if fecha_obj < hoy_mexico:
                return jsonify({"success": False, "mensaje": "No puedes agendar seminarios en el pasado."}), 400
            hora_obj = datetime.strptime(data.get("hora", ""), "%H:%M").time()
        except ValueError:
            return jsonify({"success": False, "mensaje": "Formatos de fecha/hora inválidos."}), 400

        colision = hay_colision_horario(session, fecha_obj, hora_obj, duracion, lugar)
        if colision:
            return jsonify({"success": False, "mensaje": mensaje_colision(colision)}), 400

        estudiante = session.query(Estudiante).filter_by(usuarioAlumno=usuarioAlumno).first()
        if not estudiante:
            if not password:
                return jsonify({"success": False, "mensaje": "La contraseña es obligatoria para nuevos alumnos"}), 400
            estudiante = Estudiante(
                usuarioAlumno=usuarioAlumno,
                password_hash=generate_password_hash(password, method="pbkdf2:sha256", salt_length=16),
                nombre=nombre, correo=correo, programa=programa
            )
            session.add(estudiante)
            session.flush()
        else:
            estudiante.nombre = nombre
            estudiante.correo = correo
            estudiante.programa = programa
            if password:
                estudiante.password_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

        clave_acceso_input = data.get("clave_acceso", "").strip().upper()
        if clave_acceso_input and not CLAVE_ACCESO_REGEX.match(clave_acceso_input):
            return jsonify({"success": False, "mensaje": "La clave de acceso debe tener entre 4 y 20 caracteres: solo letras mayúsculas (A-Z) y números"}), 400
        clave_acceso = clave_acceso_input or generar_clave_acceso()

        def es_codigo_libre(codigo):
            return not session.query(Seminario).filter(
                (Seminario.clave_acceso == codigo)
            ).first()

        def generar_codigo_unico_global(codigos_usados_en_este_registro):
            for _ in range(10):
                candidato = generar_clave_acceso()
                if candidato not in codigos_usados_en_este_registro and es_codigo_libre(candidato):
                    return candidato
            raise ValueError("No se pudo generar un código único tras varios intentos")

        intentos = 5
        while not es_codigo_libre(clave_acceso) and intentos > 0:
            clave_acceso = generar_clave_acceso()
            intentos -= 1
        if not es_codigo_libre(clave_acceso):
            return jsonify({"success": False, "mensaje": "No se pudo generar una clave de acceso única, intenta de nuevo"}), 500


        jurado_nombres = []
        if presidente:
            jurado_nombres.append(f"Presidente:{presidente}")
        if secretario:
            jurado_nombres.append(f"Secretario:{secretario}")
        if vocal:
            jurado_nombres.append(f"Vocal:{vocal}")
        jurado_texto = "|".join(jurado_nombres)

        session.add(Seminario(
            estudiante_id=estudiante.id, clave_acceso=clave_acceso,
            tipo_seminario=tipo_seminario, proyecto=proyecto,
            fecha=fecha_obj, hora=hora_obj, lugar=lugar, modalidad=data.get("modalidad", ""),
            duracion=duracion, jurado_texto=jurado_texto, observaciones=observaciones,
            programa_historico=estudiante.programa
        ))
        session.commit()

        current_app.logger.info(f"usuario {request.usuario_actual} registro al estudiante {usuarioAlumno}")
        return jsonify({
            "success": True, "mensaje": f"Seminario agendado para {nombre}",
            "clave_acceso": clave_acceso
        }), 201
    except IntegrityError:
        session.rollback()
        return jsonify({"success": False, "mensaje": "Número de control duplicado."}), 400
    except Exception as e:
        session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/registro-publico", methods=["POST"])
@limiter.limit("5 per minute")
@validar_json
def registro_publico():
    session = Session()
    try:
        data = request.get_json()
        control = data.get("usuarioAlumno", "").strip()
        nombre = data.get("nombre", "").strip()
        password = data.get("password_estudiante", "").strip()
        correo = data.get("correo", "").strip()
        programa = data.get("programa", "").strip()

        if not control or not nombre or not password or not correo or not programa:
            return jsonify({"success": False, "mensaje": "Faltan datos obligatorios"}), 400

        # --- MISMAS RESTRICCIONES QUE USA EL ADMIN AL REGISTRAR ALUMNOS
        if not NOMBRE_REGEX.match(nombre):
            return jsonify({"success": False, "mensaje": "El nombre solo puede contener letras y espacios (sin números ni símbolos)"}), 400
        if not NUMERO_CONTROL_REGEX.match(control):
            return jsonify({"success": False, "mensaje": "El número de control debe contener mínimo 8 números (sin letras)."}), 400
        if not PASSWORD_ESTUDIANTE_REGEX.match(password):
            return jsonify({"success": False, "mensaje": "La contraseña debe contener al menos 4 letras/números"}), 400
        if not CORREO_REGEX.match(correo):
            return jsonify({"success": False, "mensaje": "El correo no es válido (falta un @ o un dominio, ej. .com)"}), 400
        if programa not in ("Maestría", "Doctorado"):
            return jsonify({"success": False, "mensaje": "Selecciona un programa válido"}), 400

        if session.query(Estudiante).filter_by(usuarioAlumno=control).first():
            return jsonify({"success": False, "mensaje": "Este número de control ya está registrado."}), 400

        nuevo_estudiante = Estudiante(
            usuarioAlumno=control,
            password_hash=generate_password_hash(password, method="pbkdf2:sha256", salt_length=16),
            nombre=nombre,
            correo=correo,
            programa=programa
        )
        session.add(nuevo_estudiante)
        session.commit()

        return jsonify({"success": True, "mensaje": "Cuenta creada. Pide a coordinación que asigne tu seminario."}), 201
    except IntegrityError:
        session.rollback()
        return jsonify({"success": False, "mensaje": "Número de control duplicado."}), 400
    except Exception as e:
        session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/seminario/<int:id_seminario>", methods=["PUT"])
@admin_requerido
@csrf_protegido
@validar_json
def editar_seminario(id_seminario):
    session = Session()
    try:
        seminario = session.query(Seminario).filter_by(id=id_seminario).first()
        if not seminario:
            return jsonify({"success": False, "mensaje": "Seminario no encontrado"}), 404

        data = request.get_json() or {}

        lugar = limpiar_texto_libre(data.get("lugar", ""))
        proyecto = limpiar_texto_libre(data.get("proyecto", ""))
        observaciones = limpiar_texto_libre(data.get("observaciones", ""))
        presidente = limpiar_texto_libre(data.get("presidente", ""))
        secretario = limpiar_texto_libre(data.get("secretario", ""))
        vocal = limpiar_texto_libre(data.get("vocal", ""))

        try:
            duracion = int(data.get("duracion"))
        except (TypeError, ValueError):
            return jsonify({"success": False, "mensaje": "La duración debe ser un número de minutos válido"}), 400
        if duracion <= 0:
            return jsonify({"success": False, "mensaje": "La duración debe ser mayor a 0"}), 400

        if not lugar or not proyecto:
            return jsonify({"success": False, "mensaje": "Debes indicar el proyecto y el lugar del seminario"}), 400

        for campo, valor, maximo in (
            ("proyecto", proyecto, LONGITUD_MAX_CORTO),
            ("lugar", lugar, LONGITUD_MAX_CORTO),
            ("observaciones", observaciones, LONGITUD_MAX_COMENTARIO),
            ("presidente", presidente, LONGITUD_MAX_NOMBRE_JURADO),
            ("secretario", secretario, LONGITUD_MAX_NOMBRE_JURADO),
            ("vocal", vocal, LONGITUD_MAX_NOMBRE_JURADO),
        ):
            if not validar_longitud(valor, maximo):
                return jsonify({"success": False, "mensaje": f"El campo '{campo}' no puede superar los {maximo} caracteres"}), 400

        try:
            fecha_obj = datetime.strptime(data.get("fecha", ""), "%Y-%m-%d").date()
            hoy_mexico = datetime.now(ZoneInfo("America/Mexico_City")).date()
            if fecha_obj < hoy_mexico:
                return jsonify({"success": False, "mensaje": "La fecha del seminario no puede estar en el pasado"}), 400
            hora_obj = datetime.strptime(data.get("hora", ""), "%H:%M").time()
        except ValueError:
            return jsonify({"success": False, "mensaje": "Fecha u hora inválida"}), 400

        tipo_seminario = data.get("tipo_seminario", "").strip()
        programa_referencia = seminario.programa_historico or seminario.estudiante.programa
        if tipo_seminario not in FASES_POR_PROGRAMA.get(programa_referencia, []):
            return jsonify({"success": False, "mensaje": "La fase del seminario no es válida para el programa del alumno"}), 400

        colision = hay_colision_horario(session, fecha_obj, hora_obj, duracion, lugar, excluir_id=id_seminario)
        if colision:
            return jsonify({"success": False, "mensaje": mensaje_colision(colision)}), 400

        seminario.proyecto = proyecto
        seminario.tipo_seminario = tipo_seminario
        seminario.modalidad = data.get("modalidad")
        seminario.lugar = lugar
        seminario.duracion = duracion
        seminario.fecha = fecha_obj
        seminario.hora = hora_obj

        # Construir el texto del jurado a partir de los nombres
        jurado_nombres = []
        if presidente:
            jurado_nombres.append(f"Presidente:{presidente}")
        if secretario:
            jurado_nombres.append(f"Secretario:{secretario}")
        if vocal:
            jurado_nombres.append(f"Vocal:{vocal}")
        jurado_texto_nuevo = "|".join(jurado_nombres)

        if jurado_texto_nuevo != seminario.jurado_texto:
            tiene_evaluaciones = session.query(Evaluacion).filter_by(seminario_id=id_seminario).first()
            if tiene_evaluaciones:
                return jsonify({"success": False, "mensaje": "No puedes modificar el jurado porque el seminario ya tiene evaluaciones registradas"}), 400

        seminario.jurado_texto = jurado_texto_nuevo

        seminario.observaciones = observaciones

        session.commit()
        current_app.logger.info(f"usuario {request.usuario_actual} edito el seminario id {id_seminario}")
        return jsonify({"success": True, "mensaje": "Información del seminario actualizada"})
    except Exception as e:
        session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/eliminar-estudiante/<int:id_estudiante>", methods=["DELETE"])
@admin_requerido
@csrf_protegido
def eliminar_estudiante(id_estudiante):
    session = Session()
    try:
        est = session.query(Estudiante).filter_by(id=id_estudiante).first()
        if not est:
            return jsonify({"success": False, "mensaje": "No encontrado"}), 404

        num_control_respaldo = est.usuarioAlumno
        session.delete(est)
        session.commit()

        current_app.logger.info(f"usuario {request.usuario_actual} elimino al estudiante con control {num_control_respaldo}")
        return jsonify({"success": True, "mensaje": "Registro eliminado del sistema."})
    finally:
        session.close()


# --- OBTENCIÓN DE DATOS (LISTADOS) ---

@estudiantes_bp.route("/estudiantes", methods=["GET"])
@token_requerido
def obtener_estudiantes():
    session = Session()
    try:
        # Obtiene los parametros enviados
        page = int(request.args.get('page', 1))
        per_page = 10
        search = request.args.get('search', '').strip()
        programa = request.args.get('programa', 'todos').strip()
        fase = request.args.get('fase', 'todos').strip()

        query = session.query(Estudiante).options(
            selectinload(Estudiante.seminarios).selectinload(Seminario.evaluaciones)
        )

        if search:
            query = query.filter(
                (Estudiante.nombre.ilike(f'%{search}%')) |
                (Estudiante.usuarioAlumno.ilike(f'%{search}%'))
            )
            
        if programa != 'todos':
            query = query.filter(Estudiante.programa == programa)
            
        if fase != 'todos':
            query = query.filter(Estudiante.seminarios.any(Seminario.tipo_seminario == fase))

        total_records = query.count()
        total_pages = (total_records + per_page - 1) // per_page

        # Extracción de los 10 alumnos que tocan en esta página
        estudiantes = query.order_by(Estudiante.id.desc()).offset((page - 1) * per_page).limit(per_page).all()

        lista = []
        for est in estudiantes:
            sems_list = []
            activos = 0
            for s in est.seminarios:
                evals = s.evaluaciones
                tiene_evaluaciones = len(evals) > 0

                # Un seminario sigue activo mientras su ventana de evaluación no haya vencido
                plazo_vencido = calcular_ventana_evaluacion(s)["estado"] == "caducado"
                es_evaluado = plazo_vencido

                if not es_evaluado:
                    activos += 1

                if tiene_evaluaciones:
                    promedio_str = f"{round(sum(e.calificacion_final for e in evals) / len(evals), 1)} / 100"
                else:
                    promedio_str = "Sin evaluar"

                jurado = parsear_jurado(s.jurado_texto)

                evals_det = [{"rol": e.evaluador_rol, "calificacion": e.calificacion_final} for e in evals]

                sems_list.append({
                    "id_seminario": s.id, "proyecto": s.proyecto, "tipo_seminario": s.tipo_seminario,
                    "clave_acceso": s.clave_acceso, "calificacion": promedio_str,
                    "es_evaluado": es_evaluado, "plazo_vencido": plazo_vencido,
                    "presidente": jurado.get("Presidente", ""),
                    "secretario": jurado.get("Secretario", ""),
                    "vocal": jurado.get("Vocal", ""),
                    "fecha": str(s.fecha) if s.fecha else "", "hora": s.hora.strftime("%H:%M") if s.hora else "",
                    "lugar": s.lugar or "", "modalidad": s.modalidad or "",
                    "programa_historico": s.programa_historico or est.programa,
                    "evaluaciones_detalle": evals_det
                })

            sems_list.sort(key=lambda x: x['fecha'], reverse=True)
            lista.append({
                "id_estudiante": est.id, "nombre": est.nombre, "usuarioAlumno": est.usuarioAlumno,
                "correo": est.correo, "programa": est.programa, "seminarios_activos": activos,
                "seminarios": sems_list
            })

        # Retorno de los datos
        return jsonify({
            "success": True,
            "estudiantes": lista,
            "total_pages": total_pages if total_pages > 0 else 1,
            "current_page": page
        }), 200
    except Exception as e:
        session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/estudiante/<int:id_estudiante>", methods=["PUT"])
@admin_requerido
@csrf_protegido
@validar_json
def editar_solo_estudiante(id_estudiante):
    session = Session()
    try:
        est = session.query(Estudiante).filter_by(id=id_estudiante).first()
        if not est:
            return jsonify({"success": False, "mensaje": "Estudiante no encontrado"}), 404

        data = request.get_json() or {}
        usuarioAlumno = data.get("usuarioAlumno", "").strip()
        nombre = data.get("nombre", "").strip()
        if not usuarioAlumno or not nombre:
            return jsonify({"success": False, "mensaje": "Control y Nombre obligatorios"}), 400

        if usuarioAlumno != est.usuarioAlumno and session.query(Estudiante).filter_by(usuarioAlumno=usuarioAlumno).first():
            return jsonify({"success": False, "mensaje": "Número de control ocupado por otro alumno"}), 400

        if not NUMERO_CONTROL_REGEX.match(usuarioAlumno):
            return jsonify({"success": False, "mensaje": "El número de control debe contener mínimo 8 números (sin letras)."}), 400
        if not NOMBRE_REGEX.match(nombre):
            return jsonify({"success": False, "mensaje": "El nombre solo puede contener letras y espacios."}), 400

        programa = data.get("programa", est.programa).strip()
        if programa not in PROGRAMAS_VALIDOS:
            return jsonify({"success": False, "mensaje": "Selecciona un programa válido (Maestría o Doctorado)"}), 400

        est.usuarioAlumno = usuarioAlumno
        est.nombre = nombre
        est.correo = data.get("correo", "").strip()
        est.programa = programa
        pw = data.get("password_estudiante", "").strip()
        if pw:
            if not PASSWORD_ESTUDIANTE_REGEX.match(pw):
                return jsonify({"success": False, "mensaje": "La contraseña debe contener al menos 4 letras/numeros."}), 400
            est.password_hash = generate_password_hash(pw, method="pbkdf2:sha256", salt_length=16)

        session.commit()
        return jsonify({"success": True, "mensaje": "Datos del alumno actualizados exitosamente."})
    except Exception as e:
        session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/api/verificar-estudiante/<control>", methods=["GET"])
@admin_requerido
def verificar_estudiante(control):
    session = Session()
    try:
        estudiante = session.query(Estudiante).filter_by(usuarioAlumno=control.strip()).first()
        if not estudiante:
            return jsonify({"success": False, "mensaje": "Alumno no encontrado"}), 404

        return jsonify({
            "success": True,
            "nombre": estudiante.nombre,
            "correo": estudiante.correo,
            "programa": estudiante.programa
        }), 200
    finally:
        session.close()


@estudiantes_bp.route("/buscar-alumnos-simple", methods=["GET"])
@admin_requerido
def buscar_alumnos_simple():
    session = Session()
    try:
        search = request.args.get('search', '').strip()
        page = int(request.args.get('page', 1))
        per_page = 10

        query = session.query(Estudiante)

        if search:
            query = query.filter(
                (Estudiante.nombre.ilike(f'%{search}%')) |
                (Estudiante.usuarioAlumno.ilike(f'%{search}%'))
            )

        total_records = query.count()
        has_more = (page * per_page) < total_records

        estudiantes = query.order_by(Estudiante.id.desc()).offset((page - 1) * per_page).limit(per_page).all()

        lista = []
        for est in estudiantes:
            lista.append({
                "id_estudiante": est.id,
                "nombre": est.nombre,
                "usuarioAlumno": est.usuarioAlumno,
                "correo": est.correo,
                "programa": est.programa
            })

        return jsonify({
            "success": True,
            "estudiantes": lista,
            "has_more": has_more,
            "total": total_records
        }), 200
    except Exception as e:
        current_app.logger.error(f"Error en búsqueda simple: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/eliminar-seminario/<int:id_seminario>", methods=["DELETE"])
@admin_requerido
@csrf_protegido
def eliminar_seminario(id_seminario):
    session = Session()
    try:
        sem = session.query(Seminario).filter_by(id=id_seminario).first()
        if not sem:
            return jsonify({"success": False, "mensaje": "No encontrado"}), 404
        session.delete(sem)
        session.commit()
        return jsonify({"success": True, "mensaje": "Seminario eliminado correctamente."})
    finally:
        session.close()


@estudiantes_bp.route("/seminario/<int:id_seminario>", methods=["GET"])
@admin_requerido
def obtener_seminario_editable(id_seminario):
    session = Session()
    try:
        seminario = session.query(Seminario).filter_by(id=id_seminario).first()
        if not seminario:
            return jsonify({"success": False, "mensaje": "Seminario no encontrado"}), 404
        estudiante = seminario.estudiante
        jurado = parsear_jurado(seminario.jurado_texto)

        return jsonify({"success": True, "datos": {
            "id_estudiante": estudiante.id, "id_seminario": seminario.id, "usuarioAlumno": estudiante.usuarioAlumno,
            "nombre": estudiante.nombre, "correo": estudiante.correo, "programa": estudiante.programa,
            "proyecto": seminario.proyecto, "tipo_seminario": seminario.tipo_seminario, "modalidad": seminario.modalidad or "",
            "lugar": seminario.lugar or "", "duracion": seminario.duracion or "", "fecha": str(seminario.fecha) if seminario.fecha else "",
            "hora": seminario.hora.strftime("%H:%M") if seminario.hora else "", 
            "presidente": jurado.get("Presidente", ""),
            "secretario": jurado.get("Secretario", ""), 
            "vocal": jurado.get("Vocal", ""), 
            "observaciones": seminario.observaciones or ""
        }}), 200
    finally:
        session.close()


@estudiantes_bp.route("/actualizar-mi-correo", methods=["PUT"])
@estudiante_requerido
@csrf_protegido
@validar_json
def actualizar_mi_correo():
    session = Session()
    try:
        estudiante = session.query(Estudiante).filter_by(id=request.id_estudiante_actual).first()
        if not estudiante:
            return jsonify({"success": False, "mensaje": "Estudiante no encontrado"}), 404

        data = request.get_json() or {}
        correo_nuevo = data.get("correo", "").strip()

        if not correo_nuevo:
            return jsonify({"success": False, "mensaje": "Debes indicar un correo"}), 400
        if not CORREO_REGEX.match(correo_nuevo):
            return jsonify({"success": False, "mensaje": "El correo no es válido (falta un @ o un dominio, ej. .com)"}), 400

        estudiante.correo = correo_nuevo
        session.commit()

        current_app.logger.info(f"el estudiante {estudiante.usuarioAlumno} actualizo su correo")
        return jsonify({"success": True, "mensaje": "Tu correo institucional fue actualizado.", "correo": estudiante.correo}), 200
    except Exception as e:
        session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/mi-informacion", methods=["GET"])
def mi_informacion():
    token = request.cookies.get('unida_token')
    if not token:
        return jsonify({"success": False}), 401

    session = Session()
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if token_esta_revocado(data.get("jti")):
            return jsonify({"success": False}), 401
        if data.get("rol") != "estudiante":
            return jsonify({"success": False}), 403

        estudiante = session.query(Estudiante).filter_by(id=data["id_estudiante"]).first()
        if not estudiante:
            return jsonify({"success": False}), 404

        # Obtenemos TODOS los seminarios del estudiante
        seminarios_db = session.query(Seminario).filter_by(estudiante_id=estudiante.id).order_by(Seminario.fecha.desc(), Seminario.hora.desc()).all()

        etiquetas_estado_temporal = {
            "antes": "Pendiente",
            "disponible": "Activo",
            "caducado": "Terminado",
            "sin_fecha": "Sin fecha",
        }

        lista_seminarios = []
        for sem in seminarios_db:
            evals = session.query(Evaluacion).filter_by(seminario_id=sem.id).all()
            promedio = round(sum(e.calificacion_final for e in evals) / len(evals), 1) if len(evals) > 0 else None

            estado_jurado = [
                {
                    "rol": e.evaluador_rol,
                    "nombre": e.evaluador_nombre,
                    "evaluo": True,
                    "comentarios": e.comentarios,
                }
                for e in evals
            ]

            ventana = calcular_ventana_evaluacion(sem)
            estado_temporal = etiquetas_estado_temporal.get(ventana["estado"], "Sin fecha")

            lista_seminarios.append({
                "id_seminario": sem.id,
                "proyecto": sem.proyecto,
                "tipo_seminario": sem.tipo_seminario,
                "fecha": str(sem.fecha) if sem.fecha else "Por definir",
                "hora": str(sem.hora) if sem.hora else "Por definir",
                "lugar": sem.lugar or "Por definir",
                "modalidad": sem.modalidad or "Por definir",
                "duracion": sem.duracion or "Por definir",
                "jurado_texto": sem.jurado_texto or "Por asignar",
                "programa_historico": sem.programa_historico or estudiante.programa,
                "evaluadores": estado_jurado,
                "promedio": promedio if promedio is not None else f"Sin evaluar (0 evaluaciones)",
                "estado_temporal": estado_temporal
            })

        return jsonify({"success": True, "datos": {
            "nombre": estudiante.nombre,
            "usuarioAlumno": estudiante.usuarioAlumno,
            "correo": estudiante.correo,
            "programa": estudiante.programa,
            "seminarios": lista_seminarios
        }}), 200
    finally:
        session.close()