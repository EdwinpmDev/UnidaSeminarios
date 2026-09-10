import { API_BASE, csrfHeaders } from './shared/api.js';
import { escapeHTML } from './shared/dom.js';
import { mostrarToast } from './shared/toast.js';

function mostrarModalAviso(mensaje) {
    let overlay = document.getElementById('modalAvisoGlobal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalAvisoGlobal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:15px;';
        overlay.innerHTML = `
            <div style="background:#ffffff;padding:25px;border-radius:10px;width:100%;max-width:420px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.15);border-top:4px solid var(--primary);">
                <p id="modalAvisoMensaje" style="color:var(--text);font-size:0.95rem;line-height:1.5;margin-bottom:20px;white-space:pre-line;"></p>
                <div style="display:flex;justify-content:flex-end;">
                    <button type="button" id="btnAceptarAviso" style="background:var(--primary);color:#ffffff;border:none;padding:10px 20px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:0.95rem;">Aceptar</button>
                </div>
            </div>
        `;
        overlay.classList.add('hidden');
        document.body.appendChild(overlay);

        overlay.querySelector('#btnAceptarAviso').addEventListener('click', () => {
            overlay.classList.add('hidden');
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    }

    overlay.querySelector('#modalAvisoMensaje').textContent = mensaje;
    overlay.classList.remove('hidden');
}

let seminarioData = null;
let preguntasActuales = [];
let esFaseDirecta = false;
let FASES_DIRECTAS = [];

const gatePosicion = document.getElementById('gate-posicion');
const tarjetaEvaluacion = document.getElementById('tarjeta-evaluacion');
const codigoPosicionInput = document.getElementById('codigo_posicion');
const errorPosicion = document.getElementById('errorPosicion');
const btnValidarPosicion = document.getElementById('btnValidarPosicion');

document.addEventListener("DOMContentLoaded", async () => {

    try {
        const resFases = await fetch(`${API_BASE}/api/fases-directas`);
        FASES_DIRECTAS = await resFases.json();
    } catch (error) {
        FASES_DIRECTAS = [];
    }

    try {
        const res = await fetch(`${API_BASE}/datos-evaluacion`);
        if (!res.ok && !res.headers.get("content-type")?.includes("application/json")) {
            throw new Error("El servidor no respondió correctamente. Intenta de nuevo más tarde.");
        }
        const data = await res.json();

        if (data.success) {
            seminarioData = data.datos;

            if (seminarioData.ya_evaluo) {
                gatePosicion.classList.add('hidden');
                tarjetaEvaluacion.classList.add('hidden');
                document.getElementById('bannerEnviado').textContent =
                    "⚠️ Ya registraste una evaluación para este seminario. No puedes evaluar dos veces.";
                document.getElementById('bannerEnviado').classList.remove('hidden');
                document.getElementById('btnSalirEvaluacion').classList.remove('hidden');
                return;
            }

            esFaseDirecta = FASES_DIRECTAS.includes(seminarioData.tipo_seminario);

            if (!esFaseDirecta) {
                const resPreguntas = await fetch(`${API_BASE}/api/preguntas?programa=${encodeURIComponent(seminarioData.programa)}&fase=${encodeURIComponent(seminarioData.tipo_seminario)}`);
                preguntasActuales = await resPreguntas.json();
                construirQuest(preguntasActuales);
            }


            if (seminarioData.rol_evaluador) {
                mostrarFormularioConRol(seminarioData.rol_evaluador, seminarioData.nombre_evaluador);
            }
        } else {
            mostrarToast("Sesión inválida o expirada. Asegúrate de ingresar tu clave correctamente.", 'error');
            window.location.href = '/';
        }
    } catch (error) {
        mostrarToast("Error de conexión con el servidor.", 'error');
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
            if (!res.ok && !res.headers.get("content-type")?.includes("application/json")) {
                throw new Error("El servidor no respondió correctamente. Intenta de nuevo más tarde.");
            }
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

window.verificarFormularioIdentificacion = verificarFormularioIdentificacion;


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
    const select = document.getElementById('select-evaluado');
    select.innerHTML = `<option value="${seminarioData.id_seminario}" selected>${escapeHTML(seminarioData.nombre_estudiante)} — Proyecto: ${escapeHTML(seminarioData.proyecto.substring(0, 40))}...</option>`;

    document.getElementById('proyecto_titulo').value = seminarioData.proyecto;
    document.getElementById('proyecto_programa').value = seminarioData.programa;

    const contenedor = document.getElementById('contenedor-seminarios-dinamicos');
    contenedor.innerHTML = `
        <div class="radio-btn">
            <input type="radio" id="sem-asignado" name="tipo_seminario" value="${escapeHTML(seminarioData.tipo_seminario)}" checked>
            <label for="sem-asignado">${escapeHTML(seminarioData.tipo_seminario)}</label>
        </div>
    `;

    esFaseDirecta = FASES_DIRECTAS.includes(seminarioData.tipo_seminario);

    const contQuest10 = document.getElementById('quest-container-10');
    const contQuest5 = document.getElementById('quest-container-5');
    const subOral = document.getElementById('subtitulo-oral');
    const subEscrito = document.getElementById('subtitulo-escrito');
    const contenedorDirecta = document.getElementById('contenedor-calificacion-directa');
    const inputDirecta = document.getElementById('calificacion_directa');

    if (esFaseDirecta) {
        contQuest10.classList.add('hidden');
        contQuest5.classList.add('hidden');
        if (subOral) subOral.classList.add('hidden');
        if (subEscrito) subEscrito.classList.add('hidden');
        contenedorDirecta.classList.remove('hidden');
        inputDirecta.required = true;
    } else {
        contQuest10.classList.remove('hidden');
        contQuest5.classList.remove('hidden');
        if (subOral) subOral.classList.remove('hidden');
        if (subEscrito) subEscrito.classList.remove('hidden');
        contenedorDirecta.classList.add('hidden');
        inputDirecta.required = false;
    }

    document.getElementById('sec-paso1').classList.remove('disabled');
    document.getElementById('sec-paso2').classList.remove('disabled');
    document.getElementById('sec-paso3').classList.remove('disabled');
}


function construirQuest(preguntas) {
    const grupos = {};
    preguntas.forEach(p => {
        (grupos[p.escala_maxima] ||= []).push(p);
    });
    const escalas = Object.keys(grupos).map(Number).sort((a, b) => b - a);
    const contenedores = [document.getElementById('quest-container-10'), document.getElementById('quest-container-5')];
    contenedores.forEach(c => { if (c) c.innerHTML = ''; });

    escalas.forEach((escala, idx) => {
        const container = contenedores[idx] || contenedores[contenedores.length - 1];
        grupos[escala].forEach(p => {
            let optionsHtml = '';
            for (let j = 1; j <= p.escala_maxima; j++) {
                optionsHtml += `
                <div class="scale-box">
                    <input type="radio" id="P${p.id}-${j}" name="P${p.id}" value="${j}" required onchange="validarComentarios()">
                    <label for="P${p.id}-${j}">${j}</label>
                </div>`;
            }
            container.innerHTML += `
                <div class="quest-card">
                    <div class="quest-header">${p.texto}</div>
                    <div class="scale-row">${optionsHtml}</div>
                </div>`;
        });
    });
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

window.validarComentarios = validarComentarios;

async function enviarEvaluacionCompleta(event) {
    event.preventDefault();

    const btnSubmit = document.getElementById('btn-enviar-todo');
    btnSubmit.disabled = true;
    btnSubmit.textContent = "Guardando Evaluación...";

    const payload = {
        evaluador_nombre: document.getElementById('evaluador_nombre').value.trim(),
        evaluador_rol: document.getElementById('evaluador_rol_fijo').value,
        comentarios: document.getElementById('txt-comentarios').value.trim(),
        respuestas: esFaseDirecta ? [] : preguntasActuales.map(p => ({
            texto: p.texto,
            escala_maxima: p.escala_maxima,
            puntaje: Number(document.querySelector(`input[name="P${p.id}"]:checked`).value)
        }))
    };

    if (esFaseDirecta) {
        payload.calificacion_directa = document.getElementById('calificacion_directa').value;
    }


    try {
        const req = await fetch(`${API_BASE}/guardar-evaluacion`, {
            method: "POST",
            headers: csrfHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify(payload)
        });
        if (!req.ok && !req.headers.get("content-type")?.includes("application/json")) {
            throw new Error("El servidor no respondió correctamente. Intenta de nuevo más tarde.");
        }
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
            mostrarToast("❌ Error: " + res.mensaje, 'error');
            btnSubmit.disabled = false;
            btnSubmit.textContent = "Enviar evaluación final";
        }
    } catch (error) {
        console.error(error);
        mostrarToast("No fue posible conectar con el servidor.", 'error');
        btnSubmit.disabled = false;
        btnSubmit.textContent = "Enviar evaluación final";
    }
}
window.enviarEvaluacionCompleta = enviarEvaluacionCompleta;