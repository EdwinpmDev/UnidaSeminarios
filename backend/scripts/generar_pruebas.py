import json
import os
import random
import sys
import traceback
from datetime import datetime, time, timedelta
from zoneinfo import ZoneInfo

from werkzeug.security import generate_password_hash

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_ROOT = os.path.dirname(BACKEND_DIR)
RUTA_PREGUNTAS = os.path.join(PROJECT_ROOT, "preguntas.json")

sys.path.insert(0, BACKEND_DIR)

try:
    from app import crear_app
    from extensions import Session, engine
    from models import Estudiante, Seminario, Evaluacion, UsuarioEvaluador, Base
    from utils import generar_clave_acceso, FASES_CALIFICACION_DIRECTA
except ImportError as e:
    print(f"❌ Error de importación: {e}")
    print("Revisa que las dependencias del backend estén instaladas (requirements.txt).")
    sys.exit(1)

app = crear_app()


LUGARES_COHERENTES = [
    ("Raúl Limón", "Presencial"),
    ("Fermín Carrillo", "Presencial"),
    ("https://meet.google.com/abc-defg-hij", "Virtual"),
    ("https://zoom.us/j/1234567890", "Virtual"),
    ("https://meet.google.com/xyz-abc-123", "Virtual"),
]

DURACIONES_POSIBLES = [30, 40, 60]

HORA_MIN_JORNADA = 8
HORA_MAX_JORNADA = 19

FASES_MAESTRIA = ["1.- Prototipo", "2.- Tutorial", "3.- Culminacion"]
FASES_DOCTORADO = [
    "1.- Prototipo", "2.- Tutorial I", "3.- Avance 1", "4.- Predoctoral",
    "5.- Tutorial II", "6.- Avance 2", "7.- Tutorial III", "8.- Culminacion",
]

COMENTARIOS_CORTOS = [
    "Buen trabajo, cumple con lo esperado para esta etapa del proyecto.",
    "Se sugiere mejorar la claridad al exponer los resultados finales.",
    "Cronograma cumplido. Faltó profundizar un poco más en la metodología.",
    "Exposición clara, pero el manejo del tiempo debe ajustarse un poco.",
    "Dominio aceptable del tema, buenas respuestas a las preguntas.",
    "Presentación bien estructurada, se recomienda mejorar las diapositivas.",
    "Cumplió con los objetivos planteados para esta fase del proyecto.",
    "Buena defensa del proyecto, se sugiere profundizar en resultados.",
]

COMENTARIOS_MEDIOS = [
    "El estudiante demostró un dominio aceptable del tema, respondiendo la mayoría "
    "de las preguntas con claridad. Se recomienda reforzar la sección de resultados "
    "y actualizar algunas referencias bibliográficas para la siguiente etapa.",

    "La metodología utilizada es correcta y bien justificada. Sin embargo, se sugiere "
    "profundizar en la discusión de los resultados obtenidos y comparar con literatura "
    "reciente sobre el tema, ya que actualmente el análisis se queda un poco superficial.",

    "Buen manejo del tiempo asignado y fluidez al hablar. Las diapositivas son claras, "
    "aunque podrían beneficiarse de menos texto y más apoyo visual. El proyecto en general "
    "va por buen camino y cumple con el cronograma establecido hasta este punto.",

    "Excelente presentación oral, el estudiante demuestra gran conocimiento del tema. "
    "Las diapositivas están bien diseñadas y apoyan adecuadamente la exposición. "
    "Se recomienda agregar más datos cuantitativos en la sección de resultados.",

    "El estudiante mostró seguridad al exponer y respondió adecuadamente las preguntas "
    "del sínodo. La estructura de la presentación es lógica y bien organizada. "
    "Se sugiere mejorar la calidad de las imágenes y gráficos utilizados.",

    "Avance sólido para tratarse de una sesión de tutoría. El estudiante trae claro el "
    "objetivo de la siguiente etapa y responde con seguridad a las observaciones del tutor. "
    "Se recomienda documentar por escrito los acuerdos tomados durante la sesión.",
]

COMENTARIOS_LARGOS = [
    "El estudiante demostró un dominio excepcional del tema, respondiendo a todas las "
    "preguntas del sínodo con rigor científico y mucha claridad conceptual. La estructura "
    "de la presentación fue lógica y bien organizada, permitiendo seguir el hilo conductor "
    "del proyecto sin dificultad. En cuanto al reporte escrito, cumple con el formato "
    "institucional solicitado, aunque se recomienda revisar la ortografía en algunas "
    "secciones y homogeneizar el formato de las citas bibliográficas conforme a la norma "
    "elegida. En general, un trabajo sobresaliente que refleja un compromiso serio con la "
    "investigación y un manejo maduro tanto de la teoría como de la práctica involucrada.",

    "Se observa un avance significativo en el desarrollo del proyecto respecto a la etapa "
    "anterior. La justificación y el planteamiento del problema están mejor delimitados, y "
    "los objetivos ahora son medibles y alcanzables dentro del tiempo restante. Es necesario "
    "prestar más atención a la calidad gráfica de las diapositivas: varias tablas son "
    "difíciles de leer por el tamaño de fuente, y se recomienda simplificar los diagramas de "
    "flujo utilizados para explicar la metodología. Asimismo, sería conveniente incluir un "
    "cronograma actualizado que refleje los ajustes realizados durante este periodo, así "
    "como una sección de limitaciones que reconozca los obstáculos enfrentados hasta ahora.",

    "El seminario presentado cumple satisfactoriamente con los requisitos establecidos "
    "para esta fase del programa de posgrado. El estudiante demostró una comprensión "
    "profunda de la literatura relevante y supo aplicar los conceptos teóricos al desarrollo "
    "práctico del proyecto. La metodología experimental está bien diseñada y los resultados "
    "preliminares son prometedores. Se recomienda, no obstante, ampliar el número de réplicas "
    "experimentales para fortalecer las conclusiones y considerar un análisis estadístico "
    "más robusto. La presentación oral fue clara y bien estructurada, aunque se sugiere "
    "practicar más para ajustar los tiempos y mejorar la fluidez en la transición entre temas.",
]

COMENTARIOS_EXTREMOS = [
    "Este es un comentario deliberadamente extenso para forzar el caso límite de "
    "generación de PDF: un bloque de retroalimentación que por sí solo puede ocupar "
    "más de una página completa. " + " ".join([
        "El estudiante presentó avances relevantes en el desarrollo experimental de su "
        "proyecto, mostrando consistencia entre la metodología planteada originalmente y "
        "los resultados preliminares obtenidos hasta el momento. Durante la sesión de "
        "preguntas se evidenció un manejo sólido de los conceptos teóricos fundamentales, "
        "aunque hubo cierta duda al momento de justificar la elección de algunos parámetros "
        "experimentales, lo cual deberá reforzarse antes de la siguiente evaluación. "
    ] * 6) + "Se recomienda ampliamente que el estudiante prepare una versión revisada del "
    "documento escrito antes de la siguiente fase, incorporando todas las observaciones "
    "anteriores, y que practique la exposición oral cuidando los tiempos para cada sección. "
    "Adicionalmente, sería beneficioso que el estudiante consultara bibliografía "
    "complementaria para fortalecer el marco teórico y justificar con mayor solidez "
    "las decisiones metodológicas tomadas durante el desarrollo del proyecto."
]

NOMBRES_PILA = ["Ana", "Luis", "María", "Carlos", "Sofia", "Jorge", "Elena", "Miguel",
                "Lucía", "Diego", "Carmen", "Fernando", "Laura", "Ricardo", "Patricia",
                "José", "Marta", "David", "Paula", "Alejandro", "Valeria", "Javier",
                "Isabel", "Daniel", "Andrea", "Roberto", "Daniela", "Francisco", "Sara",
                "Antonio", "Gabriela", "Manuel", "Teresa", "Rafael", "Claudia", "Oscar",
                "Karla", "Mónica", "Iván", "Sandra", "Adrián", "Verónica", "Raúl",
                "Alicia", "Emilio", "Renata", "Hugo", "Ximena", "Gerardo", "Nadia"]

APELLIDOS = ["Gómez", "Pérez", "Domínguez", "Ruiz", "López", "Castro", "Vega", "Flores",
            "Navarro", "Morales", "Silva", "Gil", "Ortiz", "Ríos", "Santos", "García",
            "Martínez", "Rodríguez", "Hernández", "González", "Díaz", "Sánchez", "Ramírez",
            "Cruz", "Reyes", "Mendoza", "Gutiérrez", "Vargas", "Ramos", "Álvarez",
            "Mora", "Cordero", "Pacheco", "Salazar", "Juárez", "Espinoza",
            "Contreras", "Aguilar", "Peña", "Cabrera", "Rosales", "Delgado", "Fuentes"]

TITULOS = ["Dr.", "Dra.", "Ing.", "Lic.", "M.C.", "Mtra.", "Mtro.", ""]

INSTITUCIONES_EXTERNAS = [
    "ITSON", "Tecnológico de Monterrey", "UNAM", "IPN", "Universidad de Sonora",
    "UANL", "Universidad Veracruzana", "Centro de Investigación Científica",
    "Industria privada", "CONACYT", "Universidad Autónoma de Sinaloa",
]

PROYECTOS_TEMAS = [
    'robótica', 'biología', 'química', 'sistemas', 'alimentos',
    'materiales', 'energías renovables', 'inteligencia artificial',
    'nanotecnología', 'biomedicina', 'electrónica', 'mecatrónica',
    'control automático', 'procesamiento de señales', 'óptica',
    'farmacología', 'biología molecular', 'ecología', 'ciberseguridad',
    'ciencia de datos', 'visión por computadora', 'genética', 'geofísica',
    'ingeniería ambiental', 'automatización industrial', 'bioinformática',
]

PROYECTOS_PLANTILLAS = [
    "Proyecto de investigación enfocada en {tema}",
    "Desarrollo de un prototipo aplicado a {tema}",
    "Análisis experimental sobre {tema}",
    "Diseño e implementación de un sistema para {tema}",
    "Estudio comparativo de técnicas de {tema}",
    "Optimización de procesos relacionados con {tema}",
    "Modelo predictivo orientado a {tema}",
    "Evaluación de un caso de estudio en {tema}",
]

CANTIDAD_DOCENTES_MUESTRA = 12
PROBABILIDAD_CON_CORREO = 0.7
PASSWORD_DEMO = "Demo1234"


def cargar_banco_preguntas():
    with open(RUTA_PREGUNTAS, "r", encoding="utf-8") as f:
        return json.load(f)


def obtener_preguntas(banco_preguntas, programa, fase):
    fase_normalizada = "Tutorial" if "tutorial" in fase.lower() else fase
    llave = f"{programa}_{fase_normalizada}"
    return banco_preguntas.get(llave, banco_preguntas["Global"])


PATRONES_POR_ESTADO = {
    "futuro": [
        ([], 0.75),
        (["Docente"], 0.15),
        (["Externo"], 0.10),
    ],
    "activo": [
        ([], 0.12),
        (["Docente"], 0.15),
        (["Externo"], 0.15),
        (["Alumno"], 0.10),
        (["Docente", "Externo"], 0.18),
        (["Docente", "Alumno"], 0.12),
        (["Externo", "Alumno"], 0.12),
        (["Docente", "Externo", "Alumno"], 0.06),
    ],
    "pasado": [
        ([], 0.02),
        (["Docente"], 0.08),
        (["Externo"], 0.08),
        (["Alumno"], 0.06),
        (["Docente", "Externo"], 0.16),
        (["Docente", "Alumno"], 0.12),
        (["Externo", "Alumno"], 0.12),
        (["Docente", "Externo", "Alumno"], 0.24),
        (["Externo", "Externo", "Docente"], 0.05),
        (["Externo", "Externo", "Docente", "Alumno"], 0.07),
    ],
}


def elegir_patron_evaluadores(estado_tiempo):
    patrones = PATRONES_POR_ESTADO[estado_tiempo]
    opciones = [p[0] for p in patrones]
    pesos = [p[1] for p in patrones]
    return list(random.choices(opciones, weights=pesos, k=1)[0])


def generar_nombre_proyecto():
    plantilla = random.choice(PROYECTOS_PLANTILLAS)
    tema = random.choice(PROYECTOS_TEMAS)
    return plantilla.format(tema=tema)


def generar_nombre_persona():
    nombre = f"{random.choice(TITULOS)} {random.choice(NOMBRES_PILA)} {random.choice(APELLIDOS)}".strip()
    return ' '.join(nombre.split())


def generar_nombre_evaluador_externo():
    nombre = generar_nombre_persona()
    if random.random() < 0.6:
        return f"{nombre} ({random.choice(INSTITUCIONES_EXTERNAS)})"
    return nombre


def elegir_comentario(tipo_preferido=None):
    if tipo_preferido == "extremo":
        return random.choice(COMENTARIOS_EXTREMOS)

    categoria = random.choices(
        ["sin_comentario", "corto", "medio", "largo", "extremo"],
        weights=[0.14, 0.18, 0.32, 0.24, 0.12],
        k=1,
    )[0]

    if categoria == "sin_comentario":
        return ""
    elif categoria == "corto":
        return random.choice(COMENTARIOS_CORTOS)
    elif categoria == "medio":
        return random.choice(COMENTARIOS_MEDIOS)
    elif categoria == "largo":
        return random.choice(COMENTARIOS_LARGOS)
    else:
        return random.choice(COMENTARIOS_EXTREMOS)


def generar_correo(control, con_correo):
    if not con_correo:
        return ""
    return f"{control.lower()}@ejemplo.com"


RANGOS_SESGO_PORCENTAJE = {
    "muy_estricto": (0.30, 0.55),
    "estricto": (0.45, 0.65),
    "promedio": (0.60, 0.80),
    "generoso": (0.75, 0.92),
    "muy_generoso": (0.85, 1.00),
}


def generar_respuestas_y_calificacion(preguntas):
    sesgo = random.choices(
        list(RANGOS_SESGO_PORCENTAJE.keys()),
        weights=[0.15, 0.20, 0.35, 0.20, 0.10],
        k=1,
    )[0]
    porc_min, porc_max = RANGOS_SESGO_PORCENTAJE[sesgo]

    respuestas = []
    suma_puntajes = 0.0
    suma_escalas = 0.0

    for pregunta in preguntas:
        escala = pregunta["escala_maxima"]
        puntaje = round(escala * random.uniform(porc_min, porc_max))
        puntaje = max(1, min(puntaje, escala))

        respuestas.append({
            "texto": pregunta["texto"],
            "escala_maxima": escala,
            "puntaje": float(puntaje),
        })
        suma_puntajes += puntaje
        suma_escalas += escala

    calif = round((suma_puntajes / suma_escalas) * 100, 1) if suma_escalas else 0.0
    return respuestas, calif


def generar_evaluacion(tipo_seminario, preguntas):
    if tipo_seminario in FASES_CALIFICACION_DIRECTA:
        return [], round(random.uniform(55, 98), 1)
    return generar_respuestas_y_calificacion(preguntas)


def verificar_conexion_db():
    try:
        session = Session()
        count = session.query(Estudiante).count()
        session.close()
        print(f"✅ Conexión a base de datos exitosa. {count} estudiantes existentes.")
        return True
    except Exception as e:
        print(f"❌ Error de conexión a base de datos: {e}")
        print("\nPosibles soluciones:")
        print("1. Verifica que MySQL esté corriendo")
        print("2. Revisa las credenciales en el archivo .env")
        print("3. Asegúrate de que la base de datos exista")
        return False


def crear_tablas_si_no_existen():
    try:
        Base.metadata.create_all(engine)
        print("✅ Tablas verificadas/creadas correctamente.")
        return True
    except Exception as e:
        print(f"❌ Error al crear tablas: {e}")
        return False


def crear_docentes_de_prueba(session, cantidad=CANTIDAD_DOCENTES_MUESTRA):
    docentes_existentes = session.query(UsuarioEvaluador).filter_by(es_admin=False).all()
    if docentes_existentes:
        print(f"ℹ️  Ya existen {len(docentes_existentes)} docentes en la base de datos, se reutilizarán.")
        return docentes_existentes

    print(f"⏳ Generando {cantidad} cuentas de docente de prueba...")
    docentes_creados = []
    for i in range(cantidad):
        nombre_completo = generar_nombre_persona()
        usuario = f"docente{str(i + 1).zfill(2)}"
        password_str = f"Docente{1000 + i}"

        docente = UsuarioEvaluador(
            usuario=usuario,
            password_hash=generate_password_hash(password_str, method="pbkdf2:sha256", salt_length=16),
            nombre_completo=nombre_completo,
            es_admin=False
        )
        session.add(docente)
        docentes_creados.append((docente, password_str))

    session.flush()
    print(f"✅ {cantidad} docentes de prueba creados.")
    print(f"   • Usuario: {docentes_creados[0][0].usuario}, Contraseña: {docentes_creados[0][1]}")
    print(f"   • ... y así sucesivamente hasta docente{str(cantidad).zfill(2)}")
    return [d for d, _ in docentes_creados]


PERFILES_PROGRAMA = [
    ("mixto", 0.55),
    ("solo_maestria", 0.22),
    ("solo_doctorado", 0.23),
]


def elegir_perfil_programa():
    opciones = [p[0] for p in PERFILES_PROGRAMA]
    pesos = [p[1] for p in PERFILES_PROGRAMA]
    return random.choices(opciones, weights=pesos, k=1)[0]


def programa_de_estudiante_y_seminario(perfil, estado_tiempo):
    if perfil == "solo_maestria":
        return "Maestría", "Maestría"
    if perfil == "solo_doctorado":
        return "Doctorado", "Doctorado"

    if estado_tiempo in ("futuro", "activo"):
        return "Doctorado", "Doctorado"
    return "Doctorado", random.choices(["Maestría", "Doctorado"], weights=[0.55, 0.45], k=1)[0]


def generar_hora_aleatoria():
    minutos_totales = random.randrange(HORA_MIN_JORNADA * 60, HORA_MAX_JORNADA * 60, 5)
    return time(minutos_totales // 60, minutos_totales % 60)


def hay_colision(session, fecha, hora, duracion, lugar):
    inicio = datetime.combine(fecha, hora)
    fin = inicio + timedelta(minutes=duracion)
    for otro in session.query(Seminario).filter(Seminario.fecha == fecha, Seminario.lugar == lugar):
        inicio_otro = datetime.combine(otro.fecha, otro.hora)
        fin_otro = inicio_otro + timedelta(minutes=otro.duracion)
        if inicio < fin_otro and inicio_otro < fin:
            return True
    return False


def generar_fecha_seminario(estado_tiempo, hoy_mexico):
    if estado_tiempo == "pasado":
        dias_atras = random.randint(5, 180)
        fecha = (hoy_mexico - timedelta(days=dias_atras)).date()
        return datetime.combine(fecha, generar_hora_aleatoria())
    elif estado_tiempo == "activo":
        horas_atras = random.randint(1, 72)
        return hoy_mexico - timedelta(hours=horas_atras)
    else:
        dias_adelante = random.randint(1, 30)
        fecha = (hoy_mexico + timedelta(days=dias_adelante)).date()
        return datetime.combine(fecha, generar_hora_aleatoria())


def generar_seminario_para_estudiante(estudiante_id, programa_seminario, estado_tiempo, hoy_mexico, session):
    fases = FASES_MAESTRIA if programa_seminario == "Maestría" else FASES_DOCTORADO
    fase = random.choice(fases)
    jurado_nombres = [generar_nombre_persona() for _ in range(3)]

    for _ in range(6):
        fecha_base = generar_fecha_seminario(estado_tiempo, hoy_mexico)
        lugar_elegido, modalidad_elegida = random.choice(LUGARES_COHERENTES)
        duracion_elegida = random.choice(DURACIONES_POSIBLES)
        if not hay_colision(session, fecha_base.date(), fecha_base.time().replace(microsecond=0), duracion_elegida, lugar_elegido):
            break

    sem = Seminario(
        estudiante_id=estudiante_id,
        clave_acceso=generar_clave_acceso(),
        tipo_seminario=fase,
        proyecto=generar_nombre_proyecto(),
        fecha=fecha_base.date(),
        hora=fecha_base.time().replace(microsecond=0),
        lugar=lugar_elegido,
        modalidad=modalidad_elegida,
        duracion=duracion_elegida,
        jurado_texto=f"Presidente:{jurado_nombres[0]}|Secretario:{jurado_nombres[1]}|Vocal:{jurado_nombres[2]}",
        estado="Agendado",
        programa_historico=programa_seminario,
    )

    session.add(sem)
    session.flush()

    return sem, estado_tiempo


def generar_evaluaciones_para_seminario(seminario, estado_tiempo, hoy_mexico, session,
                                        docentes_disponibles, estudiantes_disponibles,
                                        banco_preguntas, programa_seminario):
    patron = elegir_patron_evaluadores(estado_tiempo)
    if not patron:
        return

    preguntas = obtener_preguntas(banco_preguntas, programa_seminario, seminario.tipo_seminario)

    fecha_seminario = datetime.combine(seminario.fecha, seminario.hora).replace(tzinfo=ZoneInfo("America/Mexico_City"))
    horas_offset_base = random.randint(1, 168) if estado_tiempo == "pasado" else random.randint(1, 70)

    docentes_usados = set()
    alumnos_usados = set()
    nombres_externos_usados = set()

    companeros_disponibles = [e for e in estudiantes_disponibles if e.id != seminario.estudiante_id]

    for idx, rol in enumerate(patron):
        docente_elegido = None
        alumno_elegido = None

        if rol == "Docente":
            candidatos = [d for d in docentes_disponibles if d.id not in docentes_usados]
            if not candidatos:
                continue
            docente_elegido = random.choice(candidatos)
            docentes_usados.add(docente_elegido.id)
        elif rol == "Alumno":
            candidatos = [e for e in companeros_disponibles if e.id not in alumnos_usados]
            if not candidatos:
                continue
            alumno_elegido = random.choice(candidatos)
            alumnos_usados.add(alumno_elegido.id)

        respuestas, calif = generar_evaluacion(seminario.tipo_seminario, preguntas)
        fecha_evaluacion = fecha_seminario + timedelta(hours=horas_offset_base + (idx * random.randint(2, 8)))

        tipo_comentario = random.choices([None, "extremo"], weights=[0.85, 0.15])[0]
        comentarios = elegir_comentario(tipo_comentario)

        campos_comunes = dict(
            seminario_id=seminario.id,
            calificacion_final=calif,
            comentarios=comentarios,
            respuestas_detalle=json.dumps(respuestas),
            fecha_evaluacion=fecha_evaluacion,
        )

        if rol == "Docente":
            session.add(Evaluacion(
                evaluador_id=docente_elegido.id,
                evaluador_nombre=docente_elegido.nombre_completo,
                evaluador_rol="Docente",
                **campos_comunes
            ))
        elif rol == "Alumno":
            session.add(Evaluacion(
                evaluador_estudiante_id=alumno_elegido.id,
                evaluador_nombre=alumno_elegido.nombre,
                evaluador_rol="Alumno",
                **campos_comunes
            ))
        else:
            nombre_externo = generar_nombre_evaluador_externo()
            intentos = 0
            while nombre_externo in nombres_externos_usados and intentos < 5:
                nombre_externo = generar_nombre_evaluador_externo()
                intentos += 1
            nombres_externos_usados.add(nombre_externo)

            session.add(Evaluacion(
                evaluador_nombre=nombre_externo,
                evaluador_rol="Externo",
                **campos_comunes
            ))


CASOS_DEMO = [
    {
        "control": "99000001", "programa": "Maestría", "con_correo": True,
        "nombre": "Ana Sofía Martínez López",
        "escenario": "Activo (dentro de la ventana de 72h), fase Prototipo, SIN evaluar todavía.",
    },
    {
        "control": "99000002", "programa": "Maestría", "con_correo": False,
        "nombre": "Carlos Eduardo Ramírez Cruz",
        "escenario": "CADUCADO, SIN evaluar (debe verse en Registro histórico). Alumno SIN correo cargado.",
    },
    {
        "control": "99000003", "programa": "Doctorado", "con_correo": True,
        "nombre": "María Fernanda Torres Ruiz",
        "escenario": "FUTURO, todavía no disponible para evaluar.",
    },
    {
        "control": "99000004", "programa": "Doctorado", "con_correo": True,
        "nombre": "Jorge Luis Hernández Flores",
        "escenario": "Fase '2.- Tutorial I' (calificación directa, sin cuestionario) evaluada por "
                    "Docente + Externo + Alumno; prueba la cédula completa y la descarga de PDF/ZIP.",
        "fase_forzada": "2.- Tutorial I", "roles_forzados": ["Docente", "Externo", "Alumno"],
    },
    {
        "control": "99000005", "programa": "Maestría", "con_correo": False,
        "nombre": "Lucía Isabel Gómez Domínguez",
        "escenario": "Fase '2.- Tutorial' (calificación directa) evaluada SOLO por un Externo. "
                    "Alumno SIN correo.",
        "fase_forzada": "2.- Tutorial", "roles_forzados": ["Externo"],
    },
    {
        "control": "99000006", "programa": "Doctorado", "con_correo": True,
        "nombre": "Diego Alejandro Castro Vega",
        "escenario": "Fase '5.- Tutorial II' (calificación directa), evaluada SOLO por un Alumno.",
        "fase_forzada": "5.- Tutorial II", "roles_forzados": ["Alumno"],
    },
    {
        "control": "99000007", "programa": "Doctorado", "con_correo": True,
        "nombre": "Patricia Elena Sánchez Ríos",
        "escenario": "Fase '7.- Tutorial III' (calificación directa), evaluada SOLO por un Docente.",
        "fase_forzada": "7.- Tutorial III", "roles_forzados": ["Docente"],
    },
    {
        "control": "99000008", "programa": "Maestría", "con_correo": False,
        "nombre": "Roberto Daniel Flores Aguilar",
        "escenario": "Pasado, evaluado por DOS externos distintos (sin docente ni alumno).",
        "roles_forzados": ["Externo", "Externo"],
    },
    {
        "control": "99000009", "programa": "Doctorado", "con_correo": True,
        "nombre": "Verónica Alejandra Juárez Peña",
        "escenario": "Fase con cuestionario completo (8.- Culminacion) y comentario de retroalimentación "
                    "EXTREMADAMENTE largo (prueba de límite del PDF).",
        "fase_forzada": "8.- Culminacion", "roles_forzados": ["Externo"], "forzar_comentario_extremo": True,
    },
    {
        "control": "99000010", "programa": "Maestría", "con_correo": True,
        "nombre": "Adrián Emilio Ortiz Salazar",
        "escenario": "Pasado, evaluado por Docente + Alumno (sin evaluador externo).",
        "roles_forzados": ["Docente", "Alumno"],
    },
    {
        "control": "99000011", "programa": "Doctorado", "con_correo": True,
        "nombre": "Renata Ximena Delgado Contreras",
        "escenario": "Trayectoria completa: 4 seminarios en fases distintas "
                    "(Prototipo, Tutorial I, Avance 1, Predoctoral) con estados mezclados.",
        "trayectoria": ["1.- Prototipo", "2.- Tutorial I", "3.- Avance 1", "4.- Predoctoral"],
    },
    {
        "control": "99000012", "programa": "Maestría", "con_correo": False,
        "nombre": "Gerardo Iván Fuentes Mora",
        "escenario": "Trayectoria de Maestría: Prototipo (pasado, evaluado), Tutorial (activo, "
                    "sin evaluar), Culminación (futuro). Alumno SIN correo.",
        "trayectoria": ["1.- Prototipo", "2.- Tutorial", "3.- Culminacion"],
    },
]


def _crear_estudiante_demo(session, caso):
    estudiante = session.query(Estudiante).filter_by(usuarioAlumno=caso["control"]).first()
    if estudiante:
        return estudiante
    estudiante = Estudiante(
        usuarioAlumno=caso["control"],
        password_hash=generate_password_hash(PASSWORD_DEMO, method="pbkdf2:sha256", salt_length=16),
        nombre=caso["nombre"],
        correo=generar_correo(caso["control"], caso.get("con_correo", True)),
        programa=caso["programa"],
    )
    session.add(estudiante)
    session.flush()
    return estudiante


def _crear_seminario_demo(session, estudiante, fecha_hora, fase, programa_seminario=None):
    jurado_nombres = [generar_nombre_persona() for _ in range(3)]
    fecha, hora = fecha_hora.date(), fecha_hora.time().replace(microsecond=0)

    for _ in range(6):
        lugar_elegido, modalidad_elegida = random.choice(LUGARES_COHERENTES)
        duracion_elegida = random.choice(DURACIONES_POSIBLES)
        if not hay_colision(session, fecha, hora, duracion_elegida, lugar_elegido):
            break

    sem = Seminario(
        estudiante_id=estudiante.id,
        clave_acceso=generar_clave_acceso(),
        tipo_seminario=fase,
        proyecto=generar_nombre_proyecto(),
        fecha=fecha,
        hora=hora,
        lugar=lugar_elegido,
        modalidad=modalidad_elegida,
        duracion=duracion_elegida,
        jurado_texto=f"Presidente:{jurado_nombres[0]}|Secretario:{jurado_nombres[1]}|Vocal:{jurado_nombres[2]}",
        estado="Agendado",
        programa_historico=programa_seminario or estudiante.programa,
    )
    session.add(sem)
    session.flush()
    return sem


def _agregar_evaluacion_demo(session, seminario, rol, fecha_evaluacion, preguntas,
                            comentario_extremo=False, docente=None, alumno_evaluador=None):
    respuestas, calif = generar_evaluacion(seminario.tipo_seminario, preguntas)
    comentarios = random.choice(COMENTARIOS_EXTREMOS) if comentario_extremo else elegir_comentario()

    campos_comunes = dict(
        seminario_id=seminario.id,
        calificacion_final=calif,
        comentarios=comentarios,
        respuestas_detalle=json.dumps(respuestas),
        fecha_evaluacion=fecha_evaluacion,
    )
    if rol == "Docente" and docente:
        session.add(Evaluacion(
            evaluador_id=docente.id, evaluador_nombre=docente.nombre_completo,
            evaluador_rol="Docente", **campos_comunes
        ))
    elif rol == "Alumno" and alumno_evaluador:
        session.add(Evaluacion(
            evaluador_estudiante_id=alumno_evaluador.id, evaluador_nombre=alumno_evaluador.nombre,
            evaluador_rol="Alumno", **campos_comunes
        ))
    else:
        session.add(Evaluacion(
            evaluador_nombre=generar_nombre_evaluador_externo(), evaluador_rol="Externo", **campos_comunes
        ))


def crear_casos_demo(session, hoy_mexico, docentes_disponibles, banco_preguntas):
    print("\n⏳ Generando casos de demostración fijos...")

    docente_demo = docentes_disponibles[0] if docentes_disponibles else None
    alumno_companero = None

    for caso in CASOS_DEMO:
        estudiante = _crear_estudiante_demo(session, caso)
        if alumno_companero is None:
            alumno_companero = estudiante

        if "trayectoria" in caso:
            for i, fase in enumerate(caso["trayectoria"]):
                if i < len(caso["trayectoria"]) - 1:
                    fecha_sem = hoy_mexico - timedelta(days=(len(caso["trayectoria"]) - i) * 40)
                    sem = _crear_seminario_demo(session, estudiante, fecha_sem, fase)
                    preguntas = obtener_preguntas(banco_preguntas, caso["programa"], fase)
                    _agregar_evaluacion_demo(
                        session, sem, "Docente", fecha_sem + timedelta(hours=2),
                        preguntas, docente=docente_demo
                    )
                else:
                    if caso["control"] == "99000012":
                        fecha_sem = hoy_mexico + timedelta(days=10)
                    else:
                        fecha_sem = hoy_mexico - timedelta(hours=20)
                    _crear_seminario_demo(session, estudiante, fecha_sem, fase)
            continue

        fase = caso.get("fase_forzada") or random.choice(
            FASES_MAESTRIA if caso["programa"] == "Maestría" else FASES_DOCTORADO
        )

        if caso["escenario"].startswith("FUTURO"):
            fecha_sem = hoy_mexico + timedelta(days=5)
        elif caso["escenario"].startswith("CADUCADO"):
            fecha_sem = hoy_mexico - timedelta(hours=100)
        elif caso["escenario"].startswith("Activo"):
            fecha_sem = hoy_mexico - timedelta(hours=10)
        else:
            fecha_sem = hoy_mexico - timedelta(days=random.randint(8, 20))

        sem = _crear_seminario_demo(session, estudiante, fecha_sem, fase)

        roles = caso.get("roles_forzados")
        if not roles:
            continue

        preguntas = obtener_preguntas(banco_preguntas, caso["programa"], fase)
        fecha_ev_base = fecha_sem + timedelta(hours=2)
        docentes_usados_local = set()

        for i, rol in enumerate(roles):
            comentario_extremo = caso.get("forzar_comentario_extremo", False) and rol == roles[0]
            fecha_ev = fecha_ev_base + timedelta(hours=i)

            if rol == "Docente":
                candidatos = [d for d in docentes_disponibles if d.id not in docentes_usados_local]
                docente_elegido = random.choice(candidatos) if candidatos else docente_demo
                if docente_elegido:
                    docentes_usados_local.add(docente_elegido.id)
                _agregar_evaluacion_demo(session, sem, "Docente", fecha_ev, preguntas,
                                        comentario_extremo, docente=docente_elegido)
            elif rol == "Alumno":
                _agregar_evaluacion_demo(session, sem, "Alumno", fecha_ev, preguntas,
                                        comentario_extremo, alumno_evaluador=alumno_companero)
            else:
                _agregar_evaluacion_demo(session, sem, "Externo", fecha_ev, preguntas, comentario_extremo)

    session.flush()
    print(f"✅ {len(CASOS_DEMO)} casos de demostración listos (99000001 a {CASOS_DEMO[-1]['control']}).")


def poblar_datos(cantidad_estudiantes=200):
    print("=" * 70)
    print("🚀 INICIANDO GENERACIÓN DE DATOS DE PRUEBA")
    print("   EVALUADORES: Externo, Docente y Alumno (mezcla realista)")
    print("=" * 70)

    if not verificar_conexion_db():
        print("\n❌ No se puede continuar sin conexión a la base de datos.")
        return False

    if not crear_tablas_si_no_existen():
        return False

    try:
        banco_preguntas = cargar_banco_preguntas()
    except FileNotFoundError:
        print(f"❌ No se encontró preguntas.json en: {RUTA_PREGUNTAS}")
        return False
    except json.JSONDecodeError as e:
        print(f"❌ preguntas.json tiene un error de formato: {e}")
        return False

    with app.app_context():
        session = Session()
        try:
            docentes_creados = crear_docentes_de_prueba(session)

            hoy_mexico = datetime.now(ZoneInfo("America/Mexico_City"))
            crear_casos_demo(session, hoy_mexico, docentes_creados, banco_preguntas)

            estudiantes_creados = 0
            seminarios_creados = 0
            estudiantes_generados = []

            if cantidad_estudiantes <= 0:
                print("\nℹ️  Modo demo: no se generarán alumnos aleatorios adicionales.")
            else:
                print(f"\n⏳ Generando {cantidad_estudiantes} alumnos con múltiples seminarios y evaluaciones...")

                anio_control = random.randint(19, 26)
                depto_control = random.randint(1, 9)

                for i in range(cantidad_estudiantes):
                    nombre_completo = f"{random.choice(NOMBRES_PILA)} {random.choice(APELLIDOS)} {random.choice(APELLIDOS)}"
                    num_control = f"{anio_control:02d}{depto_control:02d}{i:04d}"
                    perfil_programa = elegir_perfil_programa()
                    programa_actual, _ = programa_de_estudiante_y_seminario(perfil_programa, "activo")
                    password_str = f"Pass{random.randint(1000, 9999)}"
                    con_correo = random.random() < PROBABILIDAD_CON_CORREO

                    estudiante = Estudiante(
                        usuarioAlumno=num_control,
                        password_hash=generate_password_hash(password_str, method="pbkdf2:sha256", salt_length=16),
                        nombre=nombre_completo,
                        correo=generar_correo(num_control, con_correo),
                        programa=programa_actual
                    )
                    session.add(estudiante)
                    session.flush()
                    estudiantes_creados += 1
                    estudiantes_generados.append(estudiante)

                    num_seminarios = random.choices(
                        [1, 2, 3, 4, 5, 6],
                        weights=[0.10, 0.20, 0.25, 0.20, 0.15, 0.10]
                    )[0]

                    if i % 7 == 0:
                        num_seminarios = random.randint(5, 8)

                    for sem_idx in range(num_seminarios):
                        forzar_completado = sem_idx < num_seminarios - 1 and random.random() < 0.7

                        if forzar_completado:
                            estado_tiempo = "pasado"
                        else:
                            estado_tiempo = random.choices(
                                ["pasado", "activo", "futuro"],
                                weights=[0.55, 0.25, 0.20]
                            )[0]

                        _, programa_seminario = programa_de_estudiante_y_seminario(perfil_programa, estado_tiempo)

                        seminario, estado_tiempo = generar_seminario_para_estudiante(
                            estudiante.id, programa_seminario, estado_tiempo, hoy_mexico, session
                        )
                        seminarios_creados += 1

                        generar_evaluaciones_para_seminario(
                            seminario, estado_tiempo, hoy_mexico, session,
                            docentes_disponibles=docentes_creados,
                            estudiantes_disponibles=estudiantes_generados,
                            banco_preguntas=banco_preguntas,
                            programa_seminario=programa_seminario,
                        )

                    if (i + 1) % 20 == 0:
                        print(f"   Procesados {i + 1} de {cantidad_estudiantes} estudiantes...")

            session.commit()

            total_seminarios = session.query(Seminario).count()
            total_evaluaciones = session.query(Evaluacion).count()
            total_externos = session.query(Evaluacion).filter_by(evaluador_rol="Externo").count()
            total_docentes_evals = session.query(Evaluacion).filter_by(evaluador_rol="Docente").count()
            total_alumnos_evals = session.query(Evaluacion).filter_by(evaluador_rol="Alumno").count()
            total_sin_correo = session.query(Estudiante).filter_by(correo="").count()
            total_con_correo = session.query(Estudiante).filter(Estudiante.correo != "").count()

            print("\n" + "=" * 70)
            print("✅ ¡ÉXITO! Datos de prueba generados correctamente.")
            print("=" * 70)
            print("\n📊 ESTADÍSTICAS FINALES:")
            print(f"   • Estudiantes creados (aleatorios): {estudiantes_creados}")
            print(f"   • Docentes de prueba: {len(docentes_creados)}")
            print(f"   • Seminarios creados: {total_seminarios}")
            print(f"   • Evaluaciones creadas: {total_evaluaciones}")
            print(f"       - Externo: {total_externos}")
            print(f"       - Docente: {total_docentes_evals}")
            print(f"       - Alumno:  {total_alumnos_evals}")
            print(f"   • Alumnos CON correo: {total_con_correo}")
            print(f"   • Alumnos SIN correo: {total_sin_correo}")

            total_estudiantes_db = session.query(Estudiante).count()
            if total_estudiantes_db and total_seminarios:
                print(f"   • Promedio seminarios/estudiante: {total_seminarios/total_estudiantes_db:.2f}")
            if total_seminarios:
                print(f"   • Promedio evaluaciones/seminario: {total_evaluaciones/total_seminarios:.2f}")
                seminarios_con_evaluacion = session.query(Seminario).join(Evaluacion).distinct().count()
                print(f"   • Seminarios con al menos 1 evaluación: {seminarios_con_evaluacion}")
                print(f"   • Porcentaje con evaluación: {(seminarios_con_evaluacion/total_seminarios*100):.1f}%")

            if estudiantes_generados:
                print("\n💡 DATOS DE ACCESO (alumnos aleatorios):")
                print("   • Contraseñas de estudiantes: Entre Pass1000 y Pass9999")
                print(f"   • Usuario: {estudiantes_generados[0].usuarioAlumno}, Contraseña: Pass1000")
            print(f"   • Docentes: usuario docente01..docente{str(len(docentes_creados)).zfill(2)}, "
                f"Contraseña: Docente1000, Docente1001, ...")

            print(f"\n🎯 CASOS DE DEMOSTRACIÓN (contraseña para todos: {PASSWORD_DEMO}):")
            for caso in CASOS_DEMO:
                print(f"   • {caso['control']}  —  {caso['nombre']}  ({caso['programa']})")
                print(f"     {caso['escenario']}")

            return True

        except Exception as e:
            session.rollback()
            print("\n❌ ERROR DETALLADO:")
            print("=" * 70)
            traceback.print_exc()
            print("=" * 70)
            print(f"\nError: {e}")
            return False
        finally:
            session.close()


if __name__ == "__main__":
    cantidad = 200
    if len(sys.argv) > 1:
        arg = sys.argv[1].strip().lower()
        if arg in ("demo", "demostracion", "presentacion"):
            cantidad = 0
            print("📝 Modo demo: solo se generarán los casos de demostración fijos (sin alumnos aleatorios).")
        else:
            try:
                cantidad = int(arg)
                print(f"📝 Usando cantidad de estudiantes aleatorios: {cantidad}")
            except ValueError:
                print("⚠️ Argumento inválido. Usando valor por defecto: 200")

    exito = poblar_datos(cantidad)

    if not exito:
        sys.exit(1)