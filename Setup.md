# 🚀 SETUP - PROYECTO UNIDA

## Instalación en máquina nueva

### Requisito previo (Solo para usuarios de Windows)
El sistema utiliza la librería WeasyPrint para generar las cédulas de evaluación en formato PDF. Para que funcione en Windows, es **obligatorio** instalar las librerías gráficas GTK3 en el sistema operativo:

1. Descarga el instalador más reciente de **GTK3 Runtime**
2. Ejecuta el instalador
3. **¡Importante!** Durante la instalación, asegúrate de marcar la casilla que dice **"Set up PATH environment variable to include GTK+"**. Si no marcas esta opción, el sistema no encontrará la librería.
4. Una vez instalado, debes reiniciar tu terminal o editor de codigo.

### Requisito previo (Solo para usuarios de Linux)
WeasyPrint también necesita sus librerías del sistema en Linux (no vienen con `pip install`). En Debian/Ubuntu:

```bash
sudo apt update
sudo apt install -y libpango-1.0-0 libpangocairo-1.0-0 libcairo2 libgdk-pixbuf2.0-0 libffi-dev shared-mime-info
```

En distros basadas en RHEL/CentOS/Fedora el paquete equivalente es `pango`, `cairo` y `gdk-pixbuf2`. Si al generar un PDF sale un error tipo `OSError: cannot load library`, casi siempre es que falta algo de este paso.

Para confirmar que todo quedó bien instalado sin depender de generar una cédula real desde el sistema, correr:

```bash
python3 test_pdf_server.py
```

Revisa las tres librerías y genera un PDF de prueba en `/tmp/`. Sale con código 0 si todo está bien.

Si el servidor de pruebas va a correr como servicio (systemd, supervisor, gunicorn detrás de nginx, etc.) en lugar de `python app.py` directo en una terminal: el usuario administrador **no se crea solo**, porque eso solo pasa en el bloque `if __name__ == "__main__"`. Después de levantar el servicio, correr una vez:

```bash
python scripts/restaurar_admin.py
```

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
- `config.py` - Configuración (CORS, proxy, etc.)
- `usuario/` (módulos JS) / `usuario.html` - Panel de administración
- `dashboard-docente.js` / `dashboard-docente.css` - Panel del docente
- `evaluacion.js` - Sistema de evaluación
- `login.js` - Autenticación
- `requirements.txt` - Dependencias

**NO reemplaces:**
- `.env` - Contiene tus credenciales
- `.gitignore` - Configuración local

---

## Despliegue con dominio o subdominio propio

Cuando ya se sepa qué dominio/subdominio va a usar el servidor de pruebas, agregar estas dos variables al `.env` (no requieren tocar código):

```
CORS_ORIGINS_EXTRA=https://tu-subdominio.ejemplo.edu.mx
NUM_PROXIES=1
```

- `CORS_ORIGINS_EXTRA` → el dominio real por el que va a entrar la gente. Se puede poner más de uno separados por coma.
- `NUM_PROXIES` → poner `1` si el servidor está detrás de un proxy inverso (Nginx, Caddy, un balanceador, un panel tipo Plesk/cPanel con proxy, etc.), que es lo normal cuando hay HTTPS con dominio. Dejar en `0` si Flask/Waitress recibe las peticiones directo de internet, sin nada en medio.

Si no se está seguro de si hay un proxy en medio, dejar `NUM_PROXIES=0` (el valor por defecto) y probar el login: si con varios usuarios entrando a la vez empieza a salir "Demasiados intentos" sin razón, es señal de que sí hay un proxy y hay que cambiarlo a `1`.

## Seguridad

- NUNCA compartas el `.env` con nadie
- NUNCA subas `.env` a GitHub
- En producción asegúrate de que `DEBUG=False` (en desarrollo puedes usar `DEBUG=True` para ver logs detallados)
- Usa contraseñas seguras (mín 8 caracteres, letras + números + símbolos)
- Cambia `ADMIN_PASS` después de la primera ejecución
- `FORCE_SECURE_COOKIES` (por defecto `True`) obliga a que las cookies viajen por HTTPS sin importar `DEBUG`; si lo pones en `False` con `DEBUG=False` el servidor se niega a arrancar

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

## Migraciones

Cuando se actualice el código del backend a una versión que cambie el esquema de la base de datos, hay que correr la migración correspondiente **una sola vez** en cada servidor (desarrollo, staging, producción) **antes** de reiniciar el servicio.

### Migración: invalidación de JWT (`token_version`)

La versión actual del backend incluye un campo `token_version` en la tabla `usuarios_evaluadores`. Sirve para invalidar JWTs viejos cuando se cambia la contraseña de un usuario o del admin. Si tu base de datos es anterior a este cambio, corre:

```sql
ALTER TABLE usuarios_evaluadores ADD COLUMN token_version INT NOT NULL DEFAULT 1;
```

Nota: esta migración invalida todas las sesiones activas de docentes y administradores. Después de aplicarla, esos usuarios deberán volver a iniciar sesión. Los estudiantes no se ven afectados (su sesión no usa este mecanismo).

Después de correr la migración, reiniciar el servicio:
```bash
sudo systemctl restart unida
```

### Migración: invalidación de JWT para estudiantes (`token_version`)

La versión actual del backend incluye un campo `token_version` también en la tabla `estudiantes`. Sirve para invalidar JWTs viejos cuando se cambia la contraseña de un estudiante. Si tu base de datos es anterior a este cambio, corre:

```sql
ALTER TABLE estudiantes ADD COLUMN token_version INT NOT NULL DEFAULT 1;
```

Nota: esta migración invalida todas las sesiones activas de estudiantes, incluidas las sesiones de evaluador cuando el evaluador es un alumno. Después de aplicarla, deberán volver a iniciar sesión.

Después de correr la migración, reiniciar el servicio:
```bash
sudo systemctl restart unida
```

### Migración: bloqueo por IP+cuenta

La versión actual del backend incluye una tabla `intentos_login` para bloquear intentos de login fallidos repetidos desde la misma IP contra la misma cuenta. Si tu base de datos es anterior a este cambio, crea la tabla con:

```sql
CREATE TABLE intentos_login (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(45) NOT NULL,
    usuario VARCHAR(100) NOT NULL,
    intentos INT NOT NULL DEFAULT 0,
    ultimo_intento DATETIME NULL,
    bloqueado_hasta DATETIME NULL,
    UNIQUE KEY uq_intentos_ip_usuario (ip, usuario),
    INDEX idx_intentos_ip (ip),
    INDEX idx_intentos_usuario (usuario)
);
```

Nota: esta migración no afecta sesiones activas, solo agrega el mecanismo de bloqueo para intentos de login futuros en `/login`, `/login-estudiante` y `/login-alumno-evaluador`.

Después de correr la migración, reiniciar el servicio:
```bash
sudo systemctl restart unida
```

---

## Rotación de secretos

El `JWT_SECRET` del archivo `.env` firma todos los tokens de sesión. Si se filtra (por ejemplo, porque el `.env` se compartió por error, se subió a un repositorio, o el servidor fue comprometido), cualquier persona con ese valor puede emitir tokens válidos y hacerse pasar por cualquier usuario.

### Cuándo rotar el `JWT_SECRET`

- Sospecha o confirmación de filtración del archivo `.env`.
- Cambio de personal con acceso al servidor o al repositorio.
- Auditoría de seguridad externa.
- Como medida preventiva anual.

### Cómo rotar el `JWT_SECRET`

1. Generar un nuevo secret:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. Reemplazar el valor de `JWT_SECRET` en el archivo `.env` del servidor.
3. Reiniciar el servicio:
   ```bash
   sudo systemctl restart unida
   ```

Efecto inmediato: todas las sesiones activas quedan invalidadas. Docentes, administradores, estudiantes y evaluadores externos deberán volver a iniciar sesión. Esto es deseable en un escenario de filtración.

### Cómo verificar que la rotación funcionó

- Revisar `logs/unida_auditoria.log` y confirmar que ya no se aceptan peticiones con tokens firmados por el secret viejo.
- Probar un login nuevo y verificar que funciona.
- Probar un token viejo (si se conserva alguno) y verificar que es rechazado.

### Prevención

- Nunca subir el `.env` a un repositorio.
- Revisar `git log` periódicamente por si el `.env` se commiteó alguna vez.
- Considerar un gestor de secretos en producción (Vault, AWS Secrets Manager, etc.) si el proyecto crece.

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

## 💾 Backups automáticos

`backend/scripts/backup_db.py` respalda la base de datos usando las credenciales de `DATABASE_URL` del `.env`. Genera un dump comprimido en `backend/backups/`, y puede listar, restaurar o limpiar backups viejos.

```bash
cd backend/scripts
python backup_db.py backup              # crea un backup nuevo
python backup_db.py list                # lista backups con tamaño y fecha
python backup_db.py restore              # restaura el más reciente
python backup_db.py restore archivo.sql.gz   # restaura uno específico
python backup_db.py clean                # borra backups con más de 30 días
```

El script no se ejecuta solo. Para que corra automáticamente, hay que agregarlo al `crontab` del servidor:

```bash
crontab -e
```

Y agregar una línea con la ruta completa al Python del entorno virtual:

```
0 3 * * * cd /ruta/al/proyecto/backend/scripts && /ruta/al/venv/bin/python backup_db.py backup && /ruta/al/venv/bin/python backup_db.py clean
```

Esto corre un backup y una limpieza todas las noches a las 3am. Sin este paso, el script solo sirve para correrlo a mano.

## 🩺 Health Check

`GET /health` verifica que el servidor esté corriendo y conectado a MySQL. Sirve para monitoreo externo (UptimeRobot, balanceadores, etc.) o para revisar rápido si un problema es de la app o de la base de datos.

```bash
curl http://127.0.0.1:5000/health
```

Responde `{"status": "ok", "timestamp": "..."}` con código 200 si todo está bien, o `"status": "error"` con código 503 si no logra conectarse a la BD.