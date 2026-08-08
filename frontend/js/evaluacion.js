const API_BASE = window.location.origin;

const bancoPreguntas = {
    1: "Planteamiento del problema, justificación y definición clara de objetivos.",
    2: "Dominio, rigor científico y profundidad conceptual del tema expuesto.",
    3: "Metodología utilizada, materiales, desarrollo y consistencia de la investigación.",
    4: "Resultados obtenidos, conclusiones alcanzadas o aportaciones esperadas.",
    5: "Uso correcto del tiempo asignado para la exposición oral.",
    6: "Claridad, fluidez, dicción y propiedad en la expresión oral.",
    7: "Calidad de las diapositivas, recursos audiovisuales y herramientas de apoyo.",
    8: "Organización, estructura y secuencia lógica de la presentación.",
    9: "Estructura formal del reporte escrito entregado previamente.",
    10: "Actualización, pertinencia y calidad de las referencias bibliográficas.",
    11: "Cumplimiento del plan de trabajo y cronograma establecido.",
    12: "Capacidad de respuesta y debate crítico ante las preguntas del sínodo."
};

let seminarioData = null;

const gatePosicion = document.getElementById('gate-posicion');
const tarjetaEvaluacion = document.getElementById('tarjeta-evaluacion');
const codigoPosicionInput = document.getElementById('codigo_posicion');
const errorPosicion = document.getElementById('errorPosicion');
const btnValidarPosicion = document.getElementById('btnValidarPosicion');

document.addEventListener("DOMContentLoaded", async () => {
    construirQuest('quest-container-10', 1, 8, 10);
    construirQuest('quest-container-5', 9, 12, 5);

    try {
        const res = await fetch(`${API_BASE}/datos-evaluacion`);
        const data = await res.json();

        if (data.success) {
            seminarioData = data.datos;
            if (seminarioData.rol_evaluador) {
                mostrarFormularioConRol(seminarioData.rol_evaluador, seminarioData.nombre_evaluador);
            }
        } else {
            alert("Sesión inválida o expirada. Asegúrate de ingresar tu clave correctamente.");
            window.location.href = '/';
        }
    } catch (error) {
        alert("Error de conexión con el servidor.");
        window.location.href = '/';
    }
});

if (btnValidarPosicion) {
    btnValidarPosicion.addEventListener('click', async () => {
        const rol = "Externo";
        const nombre = document.getElementById('evaluador_nombre').value.trim();
        errorPosicion.classList.add('hidden');

        btnValidarPosicion.disabled = true;
        btnValidarPosicion.textContent = 'Verificando disponibilidad...';

        try {
            const res = await fetch(`${API_BASE}/validar-posicion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rol_evaluador: rol, nombre_evaluador: nombre })
            });
            const data = await res.json();

            if (data.success) {
                mostrarFormularioConRol(rol, nombre);
            } else {
                errorPosicion.textContent = data.mensaje || 'Error al validar la posición.';
                errorPosicion.classList.remove('hidden');
            }
        } catch (error) {
            errorPosicion.textContent = 'Error de conexión con el servidor.';
            errorPosicion.classList.remove('hidden');
        } finally {
            btnValidarPosicion.disabled = false;
            btnValidarPosicion.textContent = 'Comenzar Evaluación';
        }
    });
}

function verificarFormularioIdentificacion() {
    const nombre = document.getElementById('evaluador_nombre').value.trim();
    const btnComenzar = document.getElementById('btnValidarPosicion');

    if (nombre.length >= 4) {
        btnComenzar.disabled = false;
    } else {
        btnComenzar.disabled = true;
    }
}


function mostrarFormularioConRol(rol, nombre) {
    gatePosicion.classList.add('hidden');
    tarjetaEvaluacion.classList.remove('hidden');

    document.getElementById('evaluador_rol_fijo').value = rol;
    document.getElementById('display-nombre-evaluador').textContent = nombre;

    if (seminarioData) {
        prellenarDatos();
    }

    validarComentarios();
}

function prellenarDatos() {
    // Rellenamos el paso 1
    const select = document.getElementById('select-evaluado');
    select.innerHTML = `<option value="${seminarioData.id_seminario}" selected>${seminarioData.nombre_estudiante} — Proyecto: ${seminarioData.proyecto.substring(0, 40)}...</option>`;

    document.getElementById('proyecto_titulo').value = seminarioData.proyecto;
    document.getElementById('proyecto_programa').value = seminarioData.programa;

    // Rellenamos el paso 2
    const contenedor = document.getElementById('contenedor-seminarios-dinamicos');
    contenedor.innerHTML = `
        <div class="radio-btn">
            <input type="radio" id="sem-asignado" name="tipo_seminario" value="${seminarioData.tipo_seminario}" checked>
            <label for="sem-asignado">${seminarioData.tipo_seminario}</label>
        </div>
    `;

    // Desbloqueamos todos los pasos visualmente
    document.getElementById('sec-paso1').classList.remove('disabled');
    document.getElementById('sec-paso2').classList.remove('disabled');
    document.getElementById('sec-paso3').classList.remove('disabled');
}


function construirQuest(containerId, min, max, maxEscala) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    for (let i = min; i <= max; i++) {
        let optionsHtml = '';
        for (let j = 1; j <= maxEscala; j++) {
            optionsHtml += `
            <div class="scale-box">
                <input type="radio" id="P${i}-${j}" name="P${i}" value="${j}" required onchange="validarComentarios()">
                <label for="P${i}-${j}">${j}</label>
            </div>`;
        }
        container.innerHTML += `
            <div class="quest-card">
                <div class="quest-header">P${i}. ${bancoPreguntas[i]}</div>
                <div class="scale-row">${optionsHtml}</div>
            </div>`;
    }
}

function validarComentarios() {
    const texto = document.getElementById('txt-comentarios').value.trim();
    const info = document.getElementById('comentarios-info');
    const formValido = document.getElementById('evalForm').checkValidity();

    info.textContent = `${texto.length} / 50 caracteres`;

    if (texto.length >= 50 && formValido) {
        info.className = "char-counter valid";
        document.getElementById('btn-enviar-todo').disabled = false;
    } else {
        info.className = "char-counter";
        document.getElementById('btn-enviar-todo').disabled = true;
    }
}

async function enviarEvaluacionCompleta(event) {
    event.preventDefault();

    const btnSubmit = document.getElementById('btn-enviar-todo');
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Guardando Evaluación...";

    const payload = {
        evaluador_nombre: document.getElementById('evaluador_nombre').value.trim(),
        evaluador_rol: document.getElementById('evaluador_rol_fijo').value,
        comentarios: document.getElementById('txt-comentarios').value.trim()
    };

    for (let i = 1; i <= 12; i++) {
        payload[`P${i}`] = document.querySelector(`input[name="P${i}"]:checked`).value;
    }

    try {
        const req = await fetch(`${API_BASE}/guardar-evaluacion`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });
        const res = await req.json();

        if (res.success) {
            document.getElementById('bannerEnviado').textContent =
                `✅ Evaluación enviada correctamente (Calificación: ${res.calificacion}/100). Puedes revisar tus respuestas abajo. Cuando termines, pulsa "Cerrar sesión / Salir" arriba para liberar el equipo.`;
            document.getElementById('bannerEnviado').classList.remove('hidden');
            document.getElementById('btnSalirEvaluacion').classList.remove('hidden');
            tarjetaEvaluacion.classList.add('evaluacion-bloqueada');
            document.querySelectorAll('#evalForm input, #evalForm textarea, #evalForm select, #evalForm button')
                .forEach(el => { el.disabled = true; });
            btnSubmit.textContent = "Evaluación enviada";
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
            alert("❌ Error: " + res.mensaje);
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Enviar evaluación final";
        }
    } catch (error) {
        console.error(error);
        alert("No fue posible conectar con el servidor.");
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar evaluación final";
    }
}