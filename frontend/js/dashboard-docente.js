import { API_BASE, csrfHeaders } from './shared/api.js';
import { escapeHTML } from './shared/dom.js';
import { mostrarToast } from './shared/toast.js';

const NOMBRES_MES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

let seminariosDelMes = [];
let idSeminarioActivo = null;
let preguntasActuales = [];
let esFaseDirecta = false;
let diaSeleccionadoEl = null;
let FASES_DIRECTAS = [];

const selectorMesNum = document.getElementById('selector-mes-mes');
const selectorMesAnio = document.getElementById('selector-mes-anio');
const calendarioGrid = document.getElementById('calendario-grid');
const tituloMes = document.getElementById('titulo-mes');
const panelDia = document.getElementById('panel-dia');
const tituloDia = document.getElementById('titulo-dia');
const buscadorDia = document.getElementById('buscador-dia');
const listaSeminariosDia = document.getElementById('lista-seminarios-dia');

const modalSeminario = document.getElementById('modal-seminario');
const vistaInfoPrevia = document.getElementById('vista-info-previa');
const contenidoInfoPrevia = document.getElementById('contenido-info-previa');
const avisoEvaluado = document.getElementById('ya-evaluado-aviso');
const avisoNoDisponible = document.getElementById('no-disponible-aviso');
const btnComenzarEvaluacion = document.getElementById('btn-comenzar-evaluacion');
const formEvaluacion = document.getElementById('form-evaluacion-docente');
const btnEnviarEvaluacion = document.getElementById('btn-enviar-evaluacion-docente');
const txtComentarios = document.getElementById('txt-comentarios-docente');
const inputCalificacionDirecta = document.getElementById('calificacion_directa');
const contenedorCalificacionDirecta = document.getElementById('contenedor-calificacion-directa');

function poblarSelectoresMes(anioActual, mesActual) {
    NOMBRES_MES.forEach((nombre, idx) => {
        const opt = document.createElement('option');
        opt.value = String(idx + 1).padStart(2, '0');
        opt.textContent = nombre;
        selectorMesNum.appendChild(opt);
    });

    for (let anio = anioActual - 2; anio <= anioActual + 2; anio++) {
        const opt = document.createElement('option');
        opt.value = String(anio);
        opt.textContent = String(anio);
        selectorMesAnio.appendChild(opt);
    }

    selectorMesNum.value = String(mesActual).padStart(2, '0');
    selectorMesAnio.value = String(anioActual);
}

function obtenerMesSeleccionado() {
    return `${selectorMesAnio.value}-${selectorMesNum.value}`;
}

document.addEventListener('DOMContentLoaded', async () => {

    try {
        const resFases = await fetch(`${API_BASE}/api/fases-directas`);
        FASES_DIRECTAS = await resFases.json();
    } catch (error) {
        FASES_DIRECTAS = [];
    }

    try {
        const res = await fetch(`${API_BASE}/verificar-sesion`);
        const data = await res.json();
        if (!data.logueado) {
            window.location.href = '/';
            return;
        }
        document.getElementById('nombre-docente').textContent = data.nombre_completo;
    } catch (error) {
        window.location.href = '/';
        return;
    }

    const hoy = new Date();
    poblarSelectoresMes(hoy.getFullYear(), hoy.getMonth() + 1);
    cargarMes(obtenerMesSeleccionado());
});

selectorMesNum.addEventListener('change', () => cargarMes(obtenerMesSeleccionado()));
selectorMesAnio.addEventListener('change', () => cargarMes(obtenerMesSeleccionado()));

async function cargarMes(mesStr) {
    calendarioGrid.innerHTML = '<p class="mensaje-vacio">Cargando calendario...</p>';
    panelDia.classList.add('hidden');
    diaSeleccionadoEl = null;

    try {
        const res = await fetch(`${API_BASE}/docentes/calendario?mes=${mesStr}`);
        const data = await res.json();

        if (!data.success) {
            calendarioGrid.innerHTML = '<p class="mensaje-vacio">No se pudo cargar el calendario.</p>';
            return;
        }

        seminariosDelMes = data.seminarios;
        renderizarCalendario(mesStr);
    } catch (error) {
        calendarioGrid.innerHTML = '<p class="mensaje-vacio">Error de conexión con el servidor.</p>';
    }
}

function renderizarCalendario(mesStr) {
    const [anio, mes] = mesStr.split('-').map(Number);
    tituloMes.textContent = `${NOMBRES_MES[mes - 1]} ${anio}`;

    const primerDiaSemana = new Date(anio, mes - 1, 1).getDay();
    const totalDias = new Date(anio, mes, 0).getDate();

    const seminariosPorDia = {};
    seminariosDelMes.forEach(sem => {
        const diaNum = parseInt(sem.fecha.split('-')[2], 10);
        if (!seminariosPorDia[diaNum]) seminariosPorDia[diaNum] = [];
        seminariosPorDia[diaNum].push(sem);
    });

    let html = '';
    for (let i = 0; i < primerDiaSemana; i++) {
        html += '<div class="dia-celda vacio"></div>';
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const tieneSeminarios = seminariosPorDia[dia] && seminariosPorDia[dia].length > 0;
        html += `
            <div class="dia-celda ${tieneSeminarios ? 'con-seminarios' : ''}" data-dia="${dia}">
                ${dia}
                ${tieneSeminarios ? '<div class="punto-indicador"></div>' : ''}
            </div>`;
    }

    calendarioGrid.innerHTML = html;

    calendarioGrid.querySelectorAll('.dia-celda.con-seminarios').forEach(celda => {
        celda.addEventListener('click', () => {
            const dia = parseInt(celda.dataset.dia, 10);
            mostrarSeminariosDelDia(dia, seminariosPorDia[dia], anio, mes);

            if (diaSeleccionadoEl) diaSeleccionadoEl.classList.remove('seleccionado');
            celda.classList.add('seleccionado');
            diaSeleccionadoEl = celda;
        });
    });
}

function claseEstado(sem) {
    if (sem.ya_evaluado_por_mi) return 'evaluado';
    switch (sem.estado_ventana) {
        case 'antes': return 'no-disponible';
        case 'caducado': return 'caducado';
        case 'sin_fecha': return 'sin-fecha';
        default: return 'pendiente';
    }
}

function textoEstado(sem) {
    if (sem.ya_evaluado_por_mi) return '✅ Evaluado';
    switch (sem.estado_ventana) {
        case 'antes': return '🔵 Aún no disponible';
        case 'caducado': return '🔴 Plazo vencido';
        case 'sin_fecha': return '⚪ Sin fecha';
        default: return '🟡 Pendiente';
    }
}

function mostrarSeminariosDelDia(dia, seminarios, anio, mes) {
    tituloDia.textContent = `Seminarios del ${dia} de ${NOMBRES_MES[mes - 1]}`;

    seminarios.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));

    listaSeminariosDia.innerHTML = seminarios.map(sem => `
        <div class="item-seminario" data-id="${sem.id_seminario}" data-alumno="${escapeHTML(sem.estudiante.toLowerCase())}" data-proyecto="${escapeHTML(sem.proyecto.toLowerCase())}">
            <div class="datos-alumno">
                <strong>${escapeHTML(sem.estudiante)}</strong>
                <div class="proyecto-titulo-tarjeta">${escapeHTML(sem.proyecto)}</div>
                <span>${escapeHTML(sem.hora) || 'Hora por definir'} · ${escapeHTML(sem.tipo_seminario)} · ${escapeHTML(sem.modalidad) || 'Sin modalidad'}</span>
            </div>
            <span class="etiqueta-estado ${claseEstado(sem)}">
                ${textoEstado(sem)}
            </span>
        </div>
    `).join('');

    listaSeminariosDia.querySelectorAll('.item-seminario').forEach(item => {
        item.addEventListener('click', () => abrirModalSeminario(item.dataset.id));
    });

    panelDia.classList.remove('hidden');
    panelDia.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function abrirModalSeminario(idSeminario) {
    idSeminarioActivo = idSeminario;
    resetearModal();
    modalSeminario.classList.remove('hidden');
    contenidoInfoPrevia.innerHTML = '<p>Cargando información...</p>';

    try {
        const res = await fetch(`${API_BASE}/docentes/seminario/${idSeminario}/info`);
        const data = await res.json();

        if (!data.success) {
            contenidoInfoPrevia.innerHTML = '<p>No se pudo cargar la información del seminario.</p>';
            return;
        }

        const d = data.datos;
        contenidoInfoPrevia.innerHTML = `
            <div class="seccion-info seccion-alumno">
                <div class="seccion-titulo">👤 Alumno y proyecto</div>
                <p><strong>Estudiante:</strong> ${escapeHTML(d.estudiante)}</p>
                <p><strong>Programa:</strong> ${escapeHTML(d.programa)}</p>
                <p><strong>Proyecto:</strong> ${escapeHTML(d.proyecto)}</p>
                <p><strong>Tipo de seminario:</strong> ${escapeHTML(d.tipo_seminario)}</p>
            </div>

            <div class="seccion-info seccion-logistica">
                <div class="seccion-titulo">📅 Fecha y lugar</div>
                <p><strong>Fecha y hora:</strong> ${escapeHTML(d.fecha)} ${escapeHTML(d.hora)}</p>
                <p><strong>Lugar:</strong> ${escapeHTML(d.lugar) || 'Por definir'}</p>
                <p><strong>Modalidad:</strong> ${escapeHTML(d.modalidad) || 'Por definir'}</p>
                <p><strong>Duración:</strong> ${escapeHTML(d.duracion) || 'Por definir'}</p>
            </div>

            ${(d.presidente || d.secretario || d.vocal) ? `
            <div class="seccion-info seccion-jurado">
                <div class="seccion-titulo">⚖️ Jurado</div>
                ${d.presidente ? `<p><strong>Presidente:</strong> ${escapeHTML(d.presidente)}</p>` : ''}
                ${d.secretario ? `<p><strong>Secretario:</strong> ${escapeHTML(d.secretario)}</p>` : ''}
                ${d.vocal ? `<p><strong>Vocal:</strong> ${escapeHTML(d.vocal)}</p>` : ''}
            </div>` : ''}

            ${d.observaciones ? `
            <div class="seccion-info seccion-observaciones">
                <div class="seccion-titulo">📝 Observaciones</div>
                <p>${escapeHTML(d.observaciones)}</p>
            </div>` : ''}
        `;

        esFaseDirecta = FASES_DIRECTAS.includes(d.tipo_seminario);

        const contQuest10 = document.getElementById('quest-container-10');
        const contQuest5 = document.getElementById('quest-container-5');
        const subOral = document.getElementById('subtitulo-oral');
        const subEscrito = document.getElementById('subtitulo-escrito');

        if (esFaseDirecta) {
            preguntasActuales = [];
            contQuest10.innerHTML = '';
            contQuest5.innerHTML = '';
            contQuest10.classList.add('hidden');
            contQuest5.classList.add('hidden');
            if (subOral) subOral.classList.add('hidden');
            if (subEscrito) subEscrito.classList.add('hidden');
            contenedorCalificacionDirecta.classList.remove('hidden');
            inputCalificacionDirecta.required = true;
        } else {
            contQuest10.classList.remove('hidden');
            contQuest5.classList.remove('hidden');
            if (subOral) subOral.classList.remove('hidden');
            if (subEscrito) subEscrito.classList.remove('hidden');
            contenedorCalificacionDirecta.classList.add('hidden');
            inputCalificacionDirecta.required = false;

            const resPreguntas = await fetch(`${API_BASE}/api/preguntas?programa=${encodeURIComponent(d.programa)}&fase=${encodeURIComponent(d.tipo_seminario)}`);
            preguntasActuales = await resPreguntas.json();
            construirPreguntas(preguntasActuales);
        }

        avisoEvaluado.classList.add('hidden');
        avisoNoDisponible.classList.add('hidden');
        btnComenzarEvaluacion.classList.remove('hidden');

        if (d.ya_evaluado_por_mi) {
            avisoEvaluado.classList.remove('hidden');
            btnComenzarEvaluacion.classList.add('hidden');
        } else if (!d.disponible_para_evaluar) {
            avisoNoDisponible.textContent = '⏳ ' + d.mensaje_ventana;
            avisoNoDisponible.className = 'aviso-ventana ' + (d.estado_ventana === 'caducado' ? 'caducado' : 'no-disponible');
            avisoNoDisponible.classList.remove('hidden');
            btnComenzarEvaluacion.classList.add('hidden');
        }
    } catch (error) {
        contenidoInfoPrevia.innerHTML = '<p>Error de conexión con el servidor.</p>';
    }
}

function resetearModal() {
    avisoEvaluado.classList.add('hidden');
    avisoNoDisponible.classList.add('hidden');
    btnComenzarEvaluacion.classList.remove('hidden');
    vistaInfoPrevia.classList.remove('hidden');
    formEvaluacion.classList.add('hidden');
    formEvaluacion.reset();
    txtComentarios.value = '';
    inputCalificacionDirecta.value = '';
    actualizarContadorComentarios();
}

document.getElementById('btn-cerrar-modal').addEventListener('click', () => {
    modalSeminario.classList.add('hidden');
    idSeminarioActivo = null;
});

btnComenzarEvaluacion.addEventListener('click', () => {
    vistaInfoPrevia.classList.add('hidden');
    formEvaluacion.classList.remove('hidden');
});

function construirPreguntas(preguntas) {
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
            let opciones = '';
            for (let j = 1; j <= p.escala_maxima; j++) {
                opciones += `
                    <div class="scale-box">
                        <input type="radio" id="dP${p.id}-${j}" name="dP${p.id}" value="${j}" required onchange="actualizarContadorComentarios()">
                        <label for="dP${p.id}-${j}">${j}</label>
                    </div>`;
            }
            container.innerHTML += `
                <div class="quest-card">
                    <div class="quest-header">${p.texto}</div>
                    <div class="scale-row">${opciones}</div>
                </div>`;
        });
    });
}


txtComentarios.addEventListener('input', actualizarContadorComentarios);
inputCalificacionDirecta.addEventListener('input', actualizarContadorComentarios);

function actualizarContadorComentarios() {
    const texto = txtComentarios.value.trim();
    const info = document.getElementById('comentarios-info-docente');
    const formValido = formEvaluacion.checkValidity();

    info.textContent = `${texto.length} / 50 caracteres`;

    if (texto.length >= 50 && formValido) {
        info.className = 'char-counter valid';
        btnEnviarEvaluacion.disabled = false;
    } else {
        info.className = 'char-counter';
        btnEnviarEvaluacion.disabled = true;
    }
}
// Los radios de preguntas se generan por innerHTML con onchange="actualizarContadorComentarios()"
window.actualizarContadorComentarios = actualizarContadorComentarios;

btnEnviarEvaluacion.addEventListener('click', async () => {
    if (!idSeminarioActivo) return;

    btnEnviarEvaluacion.disabled = true;
    btnEnviarEvaluacion.textContent = 'Guardando evaluación...';

    const payload = {
        comentarios: txtComentarios.value.trim(),
        respuestas: esFaseDirecta ? [] : preguntasActuales.map(p => ({
            texto: p.texto,
            escala_maxima: p.escala_maxima,
            puntaje: Number(document.querySelector(`input[name="dP${p.id}"]:checked`)?.value)
        }))
    };

    if (esFaseDirecta) {
        payload.calificacion_directa = inputCalificacionDirecta.value;
    }


    try {
        const res = await fetch(`${API_BASE}/docentes/seminario/${idSeminarioActivo}/evaluar`, {
            method: 'POST',
            headers: csrfHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.success) {
            mostrarToast(`Evaluación guardada correctamente (Calificación: ${data.calificacion}/100)`, 'exito');
            modalSeminario.classList.add('hidden');
            cargarMes(obtenerMesSeleccionado());
        } else {
            mostrarToast(data.mensaje, 'error');
        }
    } catch (error) {
        mostrarToast('Error de conexión con el servidor.', 'error');
    } finally {
        btnEnviarEvaluacion.disabled = false;
        btnEnviarEvaluacion.textContent = 'Enviar evaluación';
    }
});

buscadorDia.addEventListener('input', () => {
    const texto = buscadorDia.value.trim().toLowerCase();
    listaSeminariosDia.querySelectorAll('.item-seminario').forEach(item => {
        const alumno = item.dataset.alumno || '';
        const proyecto = item.dataset.proyecto || '';
        const coincide = alumno.includes(texto) || proyecto.includes(texto);
        item.classList.toggle('hidden', !coincide);
    });
});