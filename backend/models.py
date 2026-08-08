from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, Date, Time, Boolean
from sqlalchemy.orm import relationship
from werkzeug.security import check_password_hash

from extensions import Base


class UsuarioEvaluador(Base):
    __tablename__ = "usuarios_evaluadores"
    id = Column(Integer, primary_key=True, autoincrement=True)
    usuario = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre_completo = Column(String(100), nullable=False)
    es_admin = Column(Boolean, default=False, nullable=False)

    def verificar_password(self, password):
        return check_password_hash(self.password_hash, password)


class Estudiante(Base):
    __tablename__ = "estudiantes"
    id = Column(Integer, primary_key=True, autoincrement=True)
    usuarioAlumno = Column(String(15), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    nombre = Column(String(100), nullable=False)
    correo = Column(String(150), nullable=False)
    programa = Column(String(50), nullable=False)

    seminarios = relationship("Seminario", back_populates="estudiante", cascade="all, delete-orphan")


class Seminario(Base):
    __tablename__ = "seminarios"
    id = Column(Integer, primary_key=True, autoincrement=True)
    estudiante_id = Column(Integer, ForeignKey("estudiantes.id", ondelete="CASCADE"), nullable=False)

    clave_acceso = Column(String(20), unique=True, nullable=False)
    clave_presidente = Column(String(20), nullable=True)
    clave_secretario = Column(String(20), nullable=True)
    clave_vocal = Column(String(20), nullable=True)

    tipo_seminario = Column(String(50), nullable=False)
    proyecto = Column(Text, nullable=False)
    estado = Column(String(20), default="Agendado", nullable=False, index=True)

    fecha = Column(Date, nullable=True, index=True)
    hora = Column(Time, nullable=True)
    lugar = Column(String(255), nullable=True)
    modalidad = Column(String(20), nullable=True)
    duracion = Column(String(20), nullable=True)
    jurado_texto = Column(Text, nullable=True)
    observaciones = Column(Text, nullable=True)

    estudiante = relationship("Estudiante", back_populates="seminarios")
    evaluaciones = relationship("Evaluacion", back_populates="seminario", cascade="all, delete-orphan")


class Evaluacion(Base):
    __tablename__ = "evaluaciones"
    id = Column(Integer, primary_key=True, autoincrement=True)
    seminario_id = Column(Integer, ForeignKey("seminarios.id", ondelete="CASCADE"), nullable=False)
    evaluador_nombre = Column(String(100), nullable=False)
    evaluador_rol = Column(String(50), nullable=False)
    calificacion_final = Column(Float, nullable=False)
    comentarios = Column(Text, nullable=False)
    respuestas_detalle = Column(Text, nullable=True)
    fecha_evaluacion = Column(DateTime, default=lambda: datetime.now(ZoneInfo("America/Mexico_City")))

    seminario = relationship("Seminario", back_populates="evaluaciones")
