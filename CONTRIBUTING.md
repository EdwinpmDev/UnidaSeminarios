# Proyecto UNIDA - Seminarios

Este es el sistema para registrar y evaluar los seminarios de posgrado en el ITVER.

## ¿Cómo configurar el proyecto localmente?

El proyecto está dividido en Frontend (las vistas) y Backend (la API en Python). Para evitar conflictos con las librerías de tu computadora, es recomendable configurar un entorno virtual antes de empezar a programar.

### 1. Configurar el entorno virtual y dependencias

Abre tu terminal, asegúrate de estar en la carpeta raíz del proyecto (`ProyectoUnida`) y sigue estos pasos:

**A. Crea el entorno virtual (venv):**
```bash
python -m venv .venvUnida
```

**B. Activa el entorno virtual:**
Dependiendo de tu sistema operativo, ejecuta el comando correspondiente:

- Si usas **Windows**:
  ```bash
  .venvUnida\Scripts\activate
  ```
- Si usas **Linux o Mac**:
  ```bash
  source .venvUnida/bin/activate
  ```

**C. Instalar las librerías:**
Con el entorno activado y desde la misma carpeta raíz (donde está el archivo `requirements.txt`), descarga las dependencias ejecutando:
```bash
pip install -r requirements.txt
```
*(Opcional: para verificar las librerías instaladas en tu entorno, puedes ejecutar `pip freeze`).*

---

### 2. Actualizar librerías (Para quienes añadan código nuevo)

En caso de añadir librerías nuevas al proyecto (haciendo un nuevo `pip install`), favor de actualizar el archivo de requerimientos para que al resto del equipo no le falle el código.

Para eso, debes posicionarte en la carpeta raíz con tu entorno activado y ejecutar el siguiente comando:
```bash
pip freeze > requirements.txt
```

Finalmente, verifica abriendo el archivo que las librerías nuevas hayan sido añadidas.