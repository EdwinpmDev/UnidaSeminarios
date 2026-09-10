# UNIDA - Seminarios

Proyecto para registrar y evaluar los seminarios de posgrado del Instituto Tecnológico de Veracruz. 

## Tecnologías que usamos
* HTML, CSS, JavaScript
* Python (Flask)
* Base de datos: MySQL

## Mantenimiento

### Backups
La base de datos se respalda con `backend/scripts/backup_db.py`. Genera un dump comprimido en `backend/backups/` y borra los que tengan más de 30 días.

```bash
python backup_db.py backup
python backup_db.py list
python backup_db.py restore
python backup_db.py clean
```

No se ejecuta solo: hay que programarlo con cron en el servidor. Detalles en [Setup.md](Setup.md#backups-automáticos).

### Health Check
`GET /health` revisa que el backend esté corriendo y conectado a MySQL.

```json
{"status": "ok", "timestamp": "2026-09-09T05:32:00+00:00"}
```

`status` es `"ok"` (200) o `"error"` (503) si falla la conexión a la BD.

### PDFs
Las cédulas de evaluación se generan con WeasyPrint, que en Linux necesita Pango, Cairo y GDK-Pixbuf instalados aparte del `pip install`. Ver [Setup.md](Setup.md#requisito-previo-solo-para-usuarios-de-linux).

## 💡 Sobre el desarrollo

Este sistema fue desarrollado de forma conjunta para la Unidad de Investigación y Desarrollo en Alimentos (UNIDA) del Instituto Tecnológico de Veracruz. El objetivo principal fue digitalizar y asegurar el proceso de evaluación de seminarios para sus programas.

Para entregar una solución ágil y funcional, dividimos las responsabilidades del proyecto de acuerdo con nuestros perfiles técnicos:

*   **Alberto Márquez Landeros:** Responsable de la infraestructura y redes. Lideró el levantamiento de requerimientos técnicos con el centro de investigación, la planificación del entorno de despliegue, la configuración del servidor y las políticas de acceso y conexión segura a la base de datos MySQL. Su enfoque garantizó que el sistema estuviera preparado para ser alojado en la red de la institución de forma estable y segura.

*   **Edwin Francisco Pérez Mayo:** Responsable del desarrollo de software. Asumí este proyecto como un reto para trasladar mis bases de Python al entorno web. Construí el backend utilizando Flask, implementando la seguridad de la plataforma (manejo de sesiones con JWT y protección CSRF), y desarrollé el frontend con HTML, CSS y JavaScript puro para garantizar un sistema ligero y fácil de mantener.

En conclusión, este proyecto fue una gran oportunidad para trabajar en un escenario real. Logramos entregar un sistema funcional y práctico que facilita la administración de los seminarios en la UNIDA, y a nosotros nos sirvió muchísimo para entender en la práctica cómo se conecta el código con la configuración de un servidor.