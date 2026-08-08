import random
import json
import sys
import os
import traceback
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from werkzeug.security import generate_password_hash

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from app import crear_app
    from extensions import Session, engine
    from models import Estudiante, Seminario, Evaluacion, Base
    from utils import generar_clave_acceso
except ImportError as e:
    print(f"❌ Error de importación: {e}")
    print("Asegúrate de ejecutar este script desde la carpeta 'backend'")
    sys.exit(1)

app = crear_app()

LUGARES_COHERENTES = [
    ("Aula Raúl Limón", "Presencial"),
    ("Aula Fermín Carrillo", "Presencial"),
    ("https://meet.google.com/abc-defg-hij", "Virtual"),
    ("https://zoom.us/j/1234567890", "Virtual"),
    ("Sala de juntas - Posgrado", "Presencial"),
    ("Auditorio UNIDA", "Presencial"),
    ("https://meet.google.com/xyz-abc-123", "Virtual"),
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

ROLES_EVALUADOR = ["Externo"]

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

DURACIONES_POSIBLES = ["30 min", "40 min", "45 min", "60 min", "90 min"]

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
        ["corto", "medio", "largo", "extremo"],
        weights=[0.20, 0.35, 0.30, 0.15],
        k=1,
    )[0]

    if categoria == "corto":
        return random.choice(COMENTARIOS_CORTOS)
    elif categoria == "medio":
        return random.choice(COMENTARIOS_MEDIOS)
    elif categoria == "largo":
        return random.choice(COMENTARIOS_LARGOS)
    else:
        return random.choice(COMENTARIOS_EXTREMOS)


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
        print("3. Asegúrate de que la base de datos 'unida_seminarios' exista")
        return False


def crear_tablas_si_no_existen():
    try:
        Base.metadata.create_all(engine)
        print("✅ Tablas verificadas/creadas correctamente.")
        return True
    except Exception as e:
        print(f"❌ Error al crear tablas: {e}")
        return False


def generar_fecha_seminario(estado_tiempo, hoy_mexico):
    if estado_tiempo == "pasado":
        dias_atras = random.randint(5, 180)
        return hoy_mexico - timedelta(days=dias_atras)
    elif estado_tiempo == "activo":
        horas_atras = random.randint(1, 72)
        return hoy_mexico - timedelta(hours=horas_atras)
    else:  # futuro
        dias_adelante = random.randint(1, 30)
        return hoy_mexico + timedelta(days=dias_adelante)


def generar_seminario_para_estudiante(estudiante_id, programa, hoy_mexico, session, forzar_completado=False):
    if forzar_completado:
        estado_tiempo = "pasado"
    else:
        estado_tiempo = random.choices(
            ["pasado", "activo", "futuro"],
            weights=[0.55, 0.25, 0.20]
        )[0]

    fecha_base = generar_fecha_seminario(estado_tiempo, hoy_mexico)

    # Fase según programa
    if programa == "Maestría":
        fases = ["1.- Prototipo", "2.- Tutorial", "3.- Culminacion"]
    else:
        fases = ["1.- Prototipo", "2.- Tutorial", "3.- Avance 1",
                "4.- Predoctoral", "5.- Tutorial", "6.- Avance 2",
                "7.- Tutorial", "8.- Culminacion"]
    fase = random.choice(fases)

    jurado_nombres = [generar_nombre_persona() for _ in range(3)]

    lugar_elegido, modalidad_elegida = random.choice(LUGARES_COHERENTES)

    sem = Seminario(
        estudiante_id=estudiante_id,
        clave_acceso=generar_clave_acceso(),
        tipo_seminario=fase,
        proyecto=generar_nombre_proyecto(),
        fecha=fecha_base.date(),
        hora=fecha_base.time().replace(microsecond=0),
        lugar=lugar_elegido,
        modalidad=modalidad_elegida,
        duracion=random.choice(DURACIONES_POSIBLES),
        jurado_texto=f"Presidente:{jurado_nombres[0]}|Secretario:{jurado_nombres[1]}|Vocal:{jurado_nombres[2]}",
        estado="Agendado"
    )

    session.add(sem)
    session.flush()

    return sem, estado_tiempo


def generar_evaluaciones_para_seminario(seminario, estado_tiempo, hoy_mexico, session):
    if estado_tiempo == "futuro":
        num_evaluaciones = random.choices([0, 1, 2], weights=[0.6, 0.3, 0.1])[0]
    elif estado_tiempo == "activo":
        num_evaluaciones = random.choices([0, 1, 2, 3], weights=[0.25, 0.35, 0.25, 0.15])[0]
    else:  # pasado
        num_evaluaciones = random.choices([0, 1, 2, 3], weights=[0.05, 0.35, 0.35, 0.25])[0]

    if num_evaluaciones == 0:
        return

    fecha_seminario = datetime.combine(seminario.fecha, seminario.hora)
    fecha_seminario = fecha_seminario.replace(tzinfo=ZoneInfo("America/Mexico_City"))

    if estado_tiempo == "pasado":
        horas_offset = random.randint(1, 168)  # Hasta 7 días después
    else:
        horas_offset = random.randint(1, 70)

    nombres_usados_en_seminario = set()

    for ev_idx in range(num_evaluaciones):
        respuestas_json = {}
        sum_1_8 = 0
        sum_9_12 = 0

        sesgo = random.choices(
            ["estricto", "promedio", "generoso", "muy_generoso", "muy_estricto"],
            weights=[0.2, 0.35, 0.25, 0.1, 0.1]
        )[0]

        rangos = {
            "estricto": {"1_8": (4, 7), "9_12": (2, 3)},
            "muy_estricto": {"1_8": (3, 6), "9_12": (1, 3)},
            "promedio": {"1_8": (6, 9), "9_12": (3, 5)},
            "generoso": {"1_8": (7, 10), "9_12": (4, 5)},
            "muy_generoso": {"1_8": (8, 10), "9_12": (4, 5)},
        }[sesgo]

        for p in range(1, 13):
            if p <= 8:
                valor = random.randint(*rangos["1_8"])
                sum_1_8 += valor
            else:
                valor = random.randint(*rangos["9_12"])
                sum_9_12 += valor
            respuestas_json[f"P{p}"] = float(valor)

        calif = round(((sum_1_8 + (sum_9_12 * 2.0)) / 120.0) * 100, 1)

        # Nombre del evaluador externo, evitando repetir el mismo dentro del mismo seminario.
        intentos = 0
        evaluador_nombre = generar_nombre_evaluador_externo()
        while evaluador_nombre in nombres_usados_en_seminario and intentos < 5:
            evaluador_nombre = generar_nombre_evaluador_externo()
            intentos += 1
        nombres_usados_en_seminario.add(evaluador_nombre)

        # Fechas de evaluación escalonadas
        fecha_evaluacion = fecha_seminario + timedelta(hours=horas_offset + (ev_idx * random.randint(2, 8)))

        # Comentarios
        tipo_comentario = random.choices([None, "extremo"], weights=[0.85, 0.15])[0]

        evaluacion = Evaluacion(
            seminario_id=seminario.id,
            evaluador_nombre=evaluador_nombre,
            evaluador_rol="Externo",
            calificacion_final=calif,
            comentarios=elegir_comentario(tipo_comentario),
            respuestas_detalle=json.dumps(respuestas_json),
            fecha_evaluacion=fecha_evaluacion
        )
        session.add(evaluacion)


def poblar_datos(cantidad_estudiantes=200):
    print("=" * 70)
    print("🚀 INICIANDO GENERACIÓN DE DATOS DE PRUEBA")
    print("   EVALUADORES: SOLO ROL EXTERNO (Docente/Alumno aún no aplica)")
    print("=" * 70)

    if not verificar_conexion_db():
        print("\n❌ No se puede continuar sin conexión a la base de datos.")
        return False

    if not crear_tablas_si_no_existen():
        return False

    with app.app_context():
        session = Session()
        try:
            print(f"\n⏳ Generando {cantidad_estudiantes} alumnos con múltiples seminarios y evaluaciones...")

            hoy_mexico = datetime.now(ZoneInfo("America/Mexico_City"))
            estudiantes_creados = 0
            seminarios_creados = 0

            for i in range(cantidad_estudiantes):
                # Crear estudiante
                nombre_completo = f"{random.choice(NOMBRES_PILA)} {random.choice(APELLIDOS)} {random.choice(APELLIDOS)}"
                num_control = f"E{20260000 + i}"
                programa = random.choice(["Maestría", "Doctorado"])
                password_str = f"Pass{random.randint(1000, 9999)}"

                estudiante = Estudiante(
                    usuarioAlumno=num_control,
                    password_hash=generate_password_hash(password_str, method="pbkdf2:sha256", salt_length=16),
                    nombre=nombre_completo,
                    correo=f"alumno{i}@ejemplo.com",
                    programa=programa
                )
                session.add(estudiante)
                session.flush()
                estudiantes_creados += 1

                num_seminarios = random.choices(
                    [1, 2, 3, 4, 5, 6],
                    weights=[0.10, 0.20, 0.25, 0.20, 0.15, 0.10]
                )[0]

                if i % 7 == 0:
                    num_seminarios = random.randint(5, 8)

                for sem_idx in range(num_seminarios):
                    forzar_completado = sem_idx < num_seminarios - 1 and random.random() < 0.7

                    seminario, estado_tiempo = generar_seminario_para_estudiante(
                        estudiante.id, programa, hoy_mexico, session, forzar_completado
                    )
                    seminarios_creados += 1

                    generar_evaluaciones_para_seminario(
                        seminario, estado_tiempo, hoy_mexico, session
                    )

                # Mostrar progreso
                if (i + 1) % 20 == 0:
                    print(f"   Procesados {i + 1} de {cantidad_estudiantes} estudiantes...")

            # Confirmar todos los cambios
            session.commit()

            # Contar resultados finales
            total_seminarios = session.query(Seminario).count()
            total_evaluaciones = session.query(Evaluacion).count()

            print("\n" + "=" * 70)
            print("✅ ¡ÉXITO! Datos de prueba generados correctamente.")
            print("=" * 70)
            print("\n📊 ESTADÍSTICAS FINALES:")
            print(f"   • Estudiantes creados: {estudiantes_creados}")
            print(f"   • Seminarios creados: {total_seminarios}")
            print(f"   • Evaluaciones creadas (todas rol Externo): {total_evaluaciones}")
            print(f"   • Promedio seminarios/estudiante: {total_seminarios/estudiantes_creados:.2f}")
            print(f"   • Promedio evaluaciones/seminario: {total_evaluaciones/total_seminarios:.2f}")

            seminarios_con_evaluacion = session.query(Seminario).join(Evaluacion).distinct().count()
            print(f"   • Seminarios con al menos 1 evaluación externa: {seminarios_con_evaluacion}")
            print(f"   • Porcentaje con evaluación: {(seminarios_con_evaluacion/total_seminarios*100):.1f}%")

            print("\n💡 DATOS DE ACCESO:")
            print("   • Contraseñas de estudiantes: Entre Pass1000 y Pass9999")
            print("   • Usuario: E20260000, Contraseña: Pass1000")
            print("   • Usuario: E20260001, Contraseña: Pass1001")
            print("   • ... y así sucesivamente")

            print("\n📋 PRUEBAS RECOMENDADAS:")
            print("   • Alumnos con varios seminarios en distintas fases (histórico)")
            print("   • Seminarios con 0, 1, 2 y 3 evaluadores externos")
            print("   • Descarga de PDF individual y descarga múltiple de Externos")
            print("   • Verificación de que los comentarios largos no rompen el PDF")
            print("   • Prueba de agenda con filtros por mes/año/programa/fase")

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
        try:
            cantidad = int(sys.argv[1])
            print(f"📝 Usando cantidad de estudiantes: {cantidad}")
        except ValueError:
            print("⚠️ Argumento inválido. Usando valor por defecto: 200")

    exito = poblar_datos(cantidad)

    if not exito:
        sys.exit(1)