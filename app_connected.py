from flask import Flask, request, jsonify
from flask_cors import CORS
from sqlalchemy import create_engine, Column, Integer, String, Float
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, date
import json
import re
import os  # ✅ IMPORTANTE PARA RENDER

app = Flask(__name__)
CORS(app)

# ===== Base de datos (SQLite local) =====
engine = create_engine("sqlite:///seminarios.db", connect_args={"check_same_thread": False})
Base = declarative_base()
Session = sessionmaker(bind=engine)


# ===== Modelos =====
class Evaluado(Base):
    __tablename__ = "evaluados"
    id = Column(Integer, primary_key=True)
    nombre = Column(String)
    proyecto = Column(String)
    programa = Column(String)
    seminario = Column(String)
    fecha = Column(String, default=lambda: date.today().isoformat())
    hora = Column(String, default="10:00")


class Evaluacion(Base):
    __tablename__ = "evaluaciones"
    id = Column(Integer, primary_key=True)
    evaluado_id = Column(Integer)
    evaluador = Column(String)
    rol = Column(String)
    proyecto = Column(String)
    programa = Column(String)
    tipo = Column(String)
    fecha = Column(String, default=lambda: datetime.now().strftime('%Y-%m-%d %H:%M'))
    calificacion = Column(Float, default=0.0)
    comentarios = Column(String)
    respuestas = Column(String)


Base.metadata.create_all(engine)


# ===== Helpers =====
def normalize_fecha(val):
    s = str(val or '').strip().replace('/', '-')
    m = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})$', s)
    if not m:
        return date.today().isoformat()
    y, mo, d = map(int, m.groups())
    try:
        return date(y, mo, d).isoformat()
    except:
        return date.today().isoformat()


def normalize_hora(val):
    s = str(val or '').strip().lower()
    s = s.replace(' ', ' ')
    s = ' '.join(s.split())

    repl = {
        'a. m.': 'am', 'p. m.': 'pm', 'a. m': 'am', 'p. m': 'pm',
        'a.m.': 'am', 'p.m.': 'pm', 'a.m': 'am', 'p.m': 'pm',
        ' a m': ' am', ' p m': ' pm'
    }
    for k, v in repl.items():
        s = s.replace(k, v)

    m = re.match(r'^(\d{1,2}):(\d{2})\s*(am|pm)?$', s)
    if not m:
        m2 = re.match(r'^(\d{1,2})\s*(am|pm)?$', s)
        if not m2:
            return '10:00'
        hh = int(m2.group(1))
        ap = m2.group(2)
        mm = 0
    else:
        hh = int(m.group(1))
        mm = int(m.group(2))
        ap = m.group(3)

    if ap == 'pm' and hh < 12:
        hh += 12
    if ap == 'am' and hh == 12:
        hh = 0

    hh = max(0, min(23, hh))
    mm = max(0, min(59, mm))
    return f"{hh:02d}:{mm:02d}"


# ===== Endpoints =====
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(force=True, silent=True) or {}
    role = data.get('role', 'profesor')
    return jsonify({
        'ok': True,
        'token': '123456',
        'user': {'name': 'Profesor Demo', 'role': role}
    })


@app.route('/api/evaluado', methods=['POST'])
def guardar_evaluado():
    data = request.get_json(force=True, silent=True) or {}

    fecha_in = data.get('fecha') or data.get('fecha_programada') or date.today().isoformat()
    hora_in = data.get('hora') or data.get('hora_programada') or data.get('horaProgramada') or '10:00'

    s = Session()
    nuevo = Evaluado(
        nombre=data.get('nombre', ''),
        proyecto=data.get('proyecto', ''),
        programa=data.get('programa', ''),
        seminario=data.get('seminario', ''),
        fecha=normalize_fecha(fecha_in),
        hora=normalize_hora(hora_in),
    )
    s.add(nuevo)
    s.commit()

    return jsonify({'ok': True, 'id': nuevo.id})


@app.route('/api/evaluados', methods=['GET'])
def obtener_evaluados():
    s = Session()
    evaluados = s.query(Evaluado).all()

    return jsonify([{
        'id': e.id,
        'nombre': e.nombre,
        'proyecto': e.proyecto,
        'programa': e.programa,
        'seminario': e.seminario,
        'fecha': normalize_fecha(e.fecha),
        'hora': normalize_hora(e.hora),
    } for e in evaluados])


@app.route('/api/agenda', methods=['GET'])
def agenda_por_dia():
    iso = request.args.get('date')

    s = Session()
    q = s.query(Evaluado)

    if iso:
        q = q.filter(Evaluado.fecha == iso)

    rows = q.all()

    def minutes(hhmm):
        hhmm = normalize_hora(hhmm)
        hh, mm = hhmm.split(':')
        return int(hh) * 60 + int(mm)

    rows.sort(key=lambda e: minutes(e.hora))

    items = [{
        'id': e.id,
        'participante': e.nombre,
        'programa': e.programa,
        'tipo': e.seminario,
        'titulo': e.proyecto,
        'hora': normalize_hora(e.hora),
    } for e in rows]

    return jsonify({'ok': True, 'items': items})


@app.route('/api/historial', methods=['GET'])
def historial():
    eid = request.args.get('evaluadoId')

    s = Session()
    q = s.query(Evaluacion)

    if eid:
        try:
            q = q.filter(Evaluacion.evaluado_id == int(eid))
        except:
            pass

    items = [{
        'tipo': ev.tipo,
        'fecha': ev.fecha,
        'calificacion': ev.calificacion,
        'comentarios': ev.comentarios or ''
    } for ev in q.order_by(Evaluacion.id.desc()).all()]

    return jsonify({'ok': True, 'items': items})


@app.route('/api/evaluaciones', methods=['POST'])
def guardar_evaluacion():
    payload = request.get_json(force=True, silent=True) or {}
    fila = payload.get('fila', {})
    comentarios = payload.get('comentarios')

    def val(clave):
        try:
            return float(fila.get(clave))
        except:
            return None

    try:
        evaluado_id = int(fila.get('Evaluado - ID') or 0)
    except:
        evaluado_id = None

    valores = []
    for i in range(1, 13):
        v = val(f"P{i} ")
        if v is None:
            k = next((k for k in fila.keys() if k.startswith(f"P{i} ")), None)
            if k:
                try:
                    v = float(fila[k])
                except:
                    v = None
        valores.append(v if v is not None else 0.0)

    norm = 0.0
    for idx, v in enumerate(valores, start=1):
        if idx <= 8:
            norm += max(0.0, min(10.0, v))
        else:
            norm += max(0.0, min(5.0, v)) * 2.0

    calificacion = round(norm / 12.0, 1)

    ev = Evaluacion(
        evaluado_id=evaluado_id,
        evaluador=fila.get('Evaluador - Nombre', ''),
        rol=fila.get('Evaluador - Rol', ''),
        proyecto=fila.get('Título del proyecto', ''),
        programa=('maestria' if 'Maestr' in (fila.get('Programa') or '')
                  else ('doctorado' if 'Doctor' in (fila.get('Programa') or '') else '')),
        tipo=fila.get('Tipo de seminario', ''),
        calificacion=calificacion,
        comentarios=comentarios or '',
        respuestas=json.dumps({k: v for k, v in fila.items() if k.startswith('P')})
    )

    s = Session()
    s.add(ev)
    s.commit()

    return jsonify({'ok': True, 'id': ev.id})


# ===== RUN PARA RENDER =====
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))  # ✅ usa el puerto de Render
    app.run(host='0.0.0.0', port=port, debug=False)  # ✅ accesible desde internet