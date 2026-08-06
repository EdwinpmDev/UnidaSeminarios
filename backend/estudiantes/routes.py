from datetime import datetime

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
    CORREO_REGEX,
    NOMBRE_REGEX,
    NUMERO_CONTROL_REGEX,
    PASSWORD_ESTUDIANTE_REGEX,
    generar_clave_acceso,
    parsear_jurado,
)

from auth.decorators import csrf_protegido, token_requerido, validar_json

estudiantes_bp = Blueprint("estudiantes", __name__)


# --- GESTIÓN CRUD DE ALUMNOS Y SEMINARIOS ---

@estudiantes_bp.route("/registrar-estudiante", methods=["POST"])
@token_requerido
@csrf_protegido
@validar_json
@limiter.limit("10 per minute")
def registrar_estudiante():
    session = Session()
    try:
        data = request.get_json() or {}
        usuarioAlumno, nombre = data.get("usuarioAlumno", "").strip(), data.get("nombre", "").strip()
        password, correo = data.get("password_estudiante", "").strip(), data.get("correo", "").strip()
        lugar = data.get("lugar", "").strip()
        duracion = data.get("duracion", "").strip()

        if not usuarioAlumno or not nombre:
            return jsonify({"success": False, "mensaje": "Faltan datos obligatorios (Control o Nombre)"}), 400

        # Verificar si el estudiante ya existe
        estudiante_existente = session.query(Estudiante).filter_by(usuarioAlumno=usuarioAlumno).first()

        # Si no existe, la contraseña es obligatoria
        if not estudiante_existente and not password:
            return jsonify({"success": False, "mensaje": "La contraseña es obligatoria para nuevos alumnos"}), 400

        if not NOMBRE_REGEX.match(nombre):
            return jsonify({"success": False, "mensaje": "El nombre solo puede contener letras y espacios"}), 400
        if not NUMERO_CONTROL_REGEX.match(usuarioAlumno):
            return jsonify({"success": False, "mensaje": "El usuario debe tener al menos 8 caracteres/numeros."}), 400
        if password and not PASSWORD_ESTUDIANTE_REGEX.match(password):
            return jsonify({"success": False, "mensaje": "La contraseña debe contener al menos 4 caracteres/numeros"}), 400
        if correo and not CORREO_REGEX.match(correo):
            return jsonify({"success": False, "mensaje": "El correo no es válido (falta un @ o un dominio, ej. .com)"}), 400
        if not lugar:
            return jsonify({"success": False, "mensaje": "Debes indicar el aula, enlace o modalidad del seminario"}), 400
        if not duracion:
            return jsonify({"success": False, "mensaje": "Debes indicar la duración del seminario"}), 400

        try:
            fecha_obj = datetime.strptime(data.get("fecha", ""), "%Y-%m-%d").date()
            hoy_mexico = datetime.now(ZoneInfo("America/Mexico_City")).date()
            if fecha_obj < hoy_mexico:
                return jsonify({"success": False, "mensaje": "No puedes agendar seminarios en el pasado."}), 400
            hora_obj = datetime.strptime(data.get("hora", ""), "%H:%M").time()
        except ValueError:
            return jsonify({"success": False, "mensaje": "Formatos de fecha/hora inválidos."}), 400

        # --- OBTENER O CREAR ESTUDIANTE ---
        estudiante = session.query(Estudiante).filter_by(usuarioAlumno=usuarioAlumno).first()
        if not estudiante:
            # Si no existe, lo creamos (contraseña es obligatoria aqui)
            if not password:
                return jsonify({"success": False, "mensaje": "La contraseña es obligatoria para nuevos alumnos"}), 400
            estudiante = Estudiante(
                usuarioAlumno=usuarioAlumno,
                password_hash=generate_password_hash(password, method="pbkdf2:sha256", salt_length=16),
                nombre=nombre, correo=correo, programa=data.get("programa", "").strip()
            )
            session.add(estudiante)
            session.flush()
        else:
            # Si ya existe, actualizamos
            estudiante.nombre = nombre
            estudiante.correo = correo
            estudiante.programa = data.get("programa", estudiante.programa).strip()
            if password:
                estudiante.password_hash = generate_password_hash(password, method="pbkdf2:sha256", salt_length=16)

        clave_acceso = data.get("clave_acceso", "").strip().upper() or generar_clave_acceso()

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

        # Si la clave general ya existe en la base de datos, se reintenta con una nueva
        intentos = 5
        while not es_codigo_libre(clave_acceso) and intentos > 0:
            clave_acceso = generar_clave_acceso()
            intentos -= 1
        if not es_codigo_libre(clave_acceso):
            return jsonify({"success": False, "mensaje": "No se pudo generar una clave de acceso única, intenta de nuevo"}), 500


        jurado_nombres = []
        if data.get("presidente"):
            jurado_nombres.append(f"Presidente:{data.get('presidente').strip()}")
        if data.get("secretario"):
            jurado_nombres.append(f"Secretario:{data.get('secretario').strip()}")
        if data.get("vocal"):
            jurado_nombres.append(f"Vocal:{data.get('vocal').strip()}")
        jurado_texto = "|".join(jurado_nombres)

        session.add(Seminario(
            estudiante_id=estudiante.id, clave_acceso=clave_acceso,
            clave_presidente=None, clave_secretario=None, clave_vocal=None,
            tipo_seminario=data.get("tipo_seminario", ""), proyecto=data.get("proyecto", "").strip(),
            fecha=fecha_obj, hora=hora_obj, lugar=data.get("lugar", ""), modalidad=data.get("modalidad", ""),
            duracion=data.get("duracion", ""), jurado_texto=jurado_texto, observaciones=data.get("observaciones", "")
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


@estudiantes_bp.route("/seminario/<int:id_seminario>", methods=["PUT"])
@token_requerido
@csrf_protegido
@validar_json
def editar_seminario(id_seminario):
    session = Session()
    try:
        seminario = session.query(Seminario).filter_by(id=id_seminario).first()
        if not seminario:
            return jsonify({"success": False, "mensaje": "Seminario no encontrado"}), 404

        data = request.get_json() or {}

        lugar = data.get("lugar", "").strip()
        duracion = data.get("duracion", "").strip()
        proyecto = data.get("proyecto", "").strip()

        if not lugar or not duracion or not proyecto:
            return jsonify({"success": False, "mensaje": "Debes indicar el proyecto, lugar y la duración del seminario"}), 400

        try:
            fecha_obj = datetime.strptime(data.get("fecha", ""), "%Y-%m-%d").date()
            hoy_mexico = datetime.now(ZoneInfo("America/Mexico_City")).date()
            if fecha_obj < hoy_mexico:
                return jsonify({"success": False, "mensaje": "La fecha del seminario no puede estar en el pasado"}), 400
            hora_obj = datetime.strptime(data.get("hora", ""), "%H:%M").time()
        except ValueError:
            return jsonify({"success": False, "mensaje": "Fecha u hora inválida"}), 400

        seminario.proyecto = proyecto
        seminario.tipo_seminario = data.get("tipo_seminario")
        seminario.modalidad = data.get("modalidad")
        seminario.lugar = lugar
        seminario.duracion = duracion
        seminario.fecha = fecha_obj
        seminario.hora = hora_obj

        # Construir el texto del jurado a partir de los nombres
        jurado_nombres = []
        if data.get("presidente"):
            jurado_nombres.append(f"Presidente:{data.get('presidente').strip()}")
        if data.get("secretario"):
            jurado_nombres.append(f"Secretario:{data.get('secretario').strip()}")
        if data.get("vocal"):
            jurado_nombres.append(f"Vocal:{data.get('vocal').strip()}")
        seminario.jurado_texto = "|".join(jurado_nombres)

        seminario.observaciones = data.get("observaciones", "").strip()

        session.commit()
        current_app.logger.info(f"usuario {request.usuario_actual} edito el seminario id {id_seminario}")
        return jsonify({"success": True, "mensaje": "Información del seminario actualizada"})
    except Exception as e:
        session.rollback()
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        session.close()


@estudiantes_bp.route("/eliminar-estudiante/<int:id_estudiante>", methods=["DELETE"])
@token_requerido
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

        # Prepara la consulta base
        query = session.query(Estudiante).options(
            selectinload(Estudiante.seminarios).selectinload(Seminario.evaluaciones)
        )

        # Si hay texto de búsqueda se aplica el filtro en MySQL
        if search:
            query = query.filter(
                (Estudiante.nombre.ilike(f'%{search}%')) |
                (Estudiante.usuarioAlumno.ilike(f'%{search}%'))
            )

        # Conteo del total sin cargar los datos
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
                es_evaluado = len(evals) >= 3
                if not es_evaluado:
                    activos += 1
                    promedio_str = f"Pendiente ({len(evals)}/3)"
                else:
                    promedio_str = f"{round(sum(e.calificacion_final for e in evals) / len(evals), 1)} / 100"

                jurado = parsear_jurado(s.jurado_texto)

                sems_list.append({
                    "id_seminario": s.id, "proyecto": s.proyecto, "tipo_seminario": s.tipo_seminario,
                    "clave_acceso": s.clave_acceso, "calificacion": promedio_str, "es_evaluado": es_evaluado,
                    "clave_presidente": s.clave_presidente, "presidente": jurado.get("Presidente", ""),
                    "clave_secretario": s.clave_secretario, "secretario": jurado.get("Secretario", ""),
                    "clave_vocal": s.clave_vocal, "vocal": jurado.get("Vocal", ""),
                    "calificacion": promedio_str, "es_evaluado": es_evaluado,
                    "fecha": str(s.fecha) if s.fecha else "", "hora": s.hora.strftime("%H:%M") if s.hora else "",
                    "lugar": s.lugar or "", "modalidad": s.modalidad or ""
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
@token_requerido
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
            return jsonify({"success": False, "mensaje": "El número de control debe tener al menos 8 números."}), 400
        if not NOMBRE_REGEX.match(nombre):
            return jsonify({"success": False, "mensaje": "El nombre solo puede contener letras y espacios."}), 400

        est.usuarioAlumno = usuarioAlumno
        est.nombre = nombre
        est.correo = data.get("correo", "").strip()
        est.programa = data.get("programa", est.programa).strip()
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


@estudiantes_bp.route("/buscar-alumnos-simple", methods=["GET"])
@token_requerido
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
@token_requerido
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
@token_requerido
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


@estudiantes_bp.route("/mi-informacion", methods=["GET"])
def mi_informacion():
    token = request.cookies.get('unida_token')
    if not token:
        return jsonify({"success": False}), 401

    session = Session()
    try:
        data = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        if data.get("rol") != "estudiante":
            return jsonify({"success": False}), 403

        estudiante = session.query(Estudiante).filter_by(id=data["id_estudiante"]).first()
        if not estudiante:
            return jsonify({"success": False}), 404

        # Obtenemos TODOS los seminarios del estudiante (del más reciente al más antiguo)
        seminarios_db = session.query(Seminario).filter_by(estudiante_id=estudiante.id).order_by(Seminario.fecha.asc(), Seminario.hora.asc()).all()

        lista_seminarios = []
        for sem in seminarios_db:
            evals = session.query(Evaluacion).filter_by(seminario_id=sem.id).all()
            promedio = round(sum(e.calificacion_final for e in evals) / len(evals), 1) if len(evals) >= 3 else None

            estado_jurado = [
                {
                    "rol": "Evaluador",
                    "nombre": e.evaluador_nombre,
                    "evaluo": True,
                    "comentarios": e.comentarios,
                }
                for e in evals
            ]

            lista_seminarios.append({
                "id_seminario": sem.id,
                "proyecto": sem.proyecto,
                "tipo_seminario": sem.tipo_seminario,
                "fecha": str(sem.fecha) if sem.fecha else "Por definir",
                "hora": str(sem.hora) if sem.hora else "Por definir",
                "lugar": sem.lugar or "Por definir",
                "modalidad": sem.modalidad or "Por definir",
                "jurado_texto": sem.jurado_texto or "Por asignar",
                "evaluadores": estado_jurado,
                "promedio": promedio if promedio is not None else f"Pendiente ({len(evals)}/3 evaluaciones)"
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
