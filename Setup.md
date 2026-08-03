# 🚀 SETUP - PROYECTO UNIDA

## Instalación en máquina nueva

### 1. Clonar el repositorio
```bash
git clone <repo>
cd ProyectoUnida/backend
```

### 2. Crear archivo .env
```bash
python setup.py
```

### 3. Editar .env con tus credenciales
```bash
nano .env
```

Cambiar:
- `DATABASE_URL` → Tu servidor MySQL
- `ADMIN_PASS` → Contraseña segura (mín 8 caracteres)
- `JWT_SECRET` → Ya está generado automáticamente

### 4. Instalar dependencias
```bash
pip install -r requirements.txt
```

### 5. Ejecutar aplicación
```bash
python app.py
```

Debería ver:
```
✅ Usuario administrador (admin) creado correctamente.
Running on http://127.0.0.1:5000
```

---

## Actualización de archivos

Si actualizas alguno de estos archivos del repositorio, reemplázalos:

- `app.py` - Backend
- `usuario.js` - Panel de administración
- `evaluacion.js` - Sistema de evaluación
- `login.js` - Autenticación
- `requirements.txt` - Dependencias

**NO reemplaces:**
- `.env` - Contiene tus credenciales
- `.gitignore` - Configuración local

---

## Seguridad

- NUNCA compartas el `.env` con nadie
- NUNCA subas `.env` a GitHub
- En producción asegúrate de que `DEBUG=False` (en desarrollo puedes usar `DEBUG=True` para ver logs detallados)
- Usa contraseñas seguras (mín 8 caracteres, letras + números + símbolos)
- Cambia `ADMIN_PASS` después de la primera ejecución

---

## Solución de problemas

### "DatabaseError: mysql.connector.errors.DatabaseError"
- Verifica que MySQL está corriendo
- Verifica que `DATABASE_URL` es correcto
- Verifica credenciales de usuario

### "ModuleNotFoundError: No module named 'flask'"
```bash
pip install -r requirements.txt
```

### "Token inválido" al guardar evaluaciones
- Verifica que iniciaste sesión
- Verifica que `JWT_SECRET` está en `.env`

---

## Base de datos

Crear la BD (si no existe):
```sql
CREATE DATABASE unida_seminarios;
CREATE USER 'app_unida'@'localhost' IDENTIFIED BY 'tu_contraseña';
GRANT ALL PRIVILEGES ON unida_seminarios.* TO 'app_unida'@'localhost';
FLUSH PRIVILEGES;
```

---

## API Endpoints

- `POST /login` - Autenticación
- `POST /registrar-estudiante` - Registrar estudiante
- `GET /estudiantes` - Listar estudiantes
- `POST /guardar-evaluacion` - Guardar evaluación
- `POST /registrar-docente` - Registrar docente

Todos excepto `GET /estudiantes` requieren token JWT en header:
```
Authorization: Bearer <token>
```

## 💾 Respaldos y mantenimiento (Importante)

El código de esta aplicación no realiza respaldos automáticos de la base de datos por sí solo, ya que esta tarea corresponde a la capa de infraestructura. 

**Responsabilidad del administrador del servidor:**
Para evitar la pérdida de información (alumnos, docentes, seminarios y calificaciones), la persona encargada de desplegar este sistema en la nube o en un servidor local **debe** habilitar una política de respaldos (Backups) automatizados diarios de la base de datos `unida_seminarios`.