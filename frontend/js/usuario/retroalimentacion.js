import { API_BASE, apiFetch } from '../shared/api.js';
import { escapeHTML } from '../shared/dom.js';
import { estudianteSeleccionado } from './directorio-estudiantes.js';

// MODAL DE RETROALIMENTACIÓN
const modalRetro = document.getElementById('modalRetro');
const retroContenido = document.getElementById('retroContenido');
const retroTitulo = document.getElementById('retroTitulo');
const btnCerrarRetro = document.getElementById('btnCerrarRetro');
const modalDetalleEvaluacion = document.getElementById('modalDetalleEvaluacion');
const btnCerrarDetalleEvaluacion = document.getElementById('btnCerrarDetalleEvaluacion');

window.verRetroalimentacion = async function (idSeminario) {
    const semInfo = estudianteSeleccionado ? estudianteSeleccionado.seminarios.find(s => s.id_seminario === idSeminario) : null;
    const nombreEstudiante = estudianteSeleccionado ? estudianteSeleccionado.nombre : '';
    const tituloProyecto = semInfo ? semInfo.proyecto : '';
    const etapaSeminario = semInfo ? semInfo.tipo_seminario : '';

    retroTitulo.textContent = `Resultados — ${nombreEstudiante}`;
    const retroSubtitulo = document.getElementById('retroSubtitulo');
    if (retroSubtitulo) {
        retroSubtitulo.textContent = tituloProyecto ? `${tituloProyecto}${etapaSeminario ? ' · ' + etapaSeminario : ''}` : '';
    }
    retroContenido.innerHTML = '<div style="text-align:center; padding: 20px; color:#6b7280;">Cargando datos...</div>';
    modalRetro.classList.remove('hidden');

    try {
        const res = await apiFetch(`${API_BASE}/retroalimentacion/${idSeminario}`);
        if (res.status === 401) { modalRetro.classList.add('hidden'); return; }

        const data = await res.json();
        if (!data.success) {
            retroContenido.innerHTML = `<p style="color:#dc2626;">${data.mensaje || 'No fue posible cargar la retroalimentación.'}</p>`;
            return;
        }

        window.evaluacionesActualesCache = data.evaluaciones;
        window.idSeminarioActualRetro = idSeminario;

        renderizarPestanaRetro('Externo');

    } catch (error) {
        retroContenido.innerHTML = '<p style="color:#dc2626; text-align:center; padding: 20px;">Error de conexión al cargar la retroalimentación.</p>';
        console.error(error);
    }
};

window.renderizarPestanaRetro = function (rolFiltro) {
    document.querySelectorAll('.tab-retro').forEach(btn => {
        btn.style.background = '#f1f5f9';
        btn.style.color = '#64748b';
        btn.style.border = '1px solid var(--border)';
        btn.style.borderBottom = 'none';
    });
    const tabActiva = document.getElementById('tab-retro-' + rolFiltro);
    if (tabActiva) {
        tabActiva.style.background = 'var(--primary)';
        tabActiva.style.color = 'white';
        tabActiva.style.border = 'none';
    }

    const evaluacionesFiltradas = window.evaluacionesActualesCache.filter(ev => ev.rol === rolFiltro);
    let totalParticipantes = evaluacionesFiltradas.length;
    let sumaCalificaciones = 0;
    let promedioGlobal = 0;

    if (totalParticipantes > 0) {
        evaluacionesFiltradas.forEach(ev => { sumaCalificaciones += ev.calificacion; });
        promedioGlobal = (sumaCalificaciones / totalParticipantes).toFixed(1);
    }

    let tituloRol = rolFiltro === 'Externo' ? 'Externos' : (rolFiltro === 'Docente' ? 'Docentes' : 'Alumnos');

    let panelSuperiorHTML = `
        <div style="background: #eff6ff; border: 2px solid var(--primary); border-radius: 10px; padding: 20px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
            <div>
                <h4 style="margin: 0 0 5px 0; color: var(--primary-dark); font-size: 1.1rem;">Resumen Global (${tituloRol})</h4>
                <p style="margin: 0; color: #4b5563; font-size: 0.95rem;">Participantes que evaluaron: <strong>${totalParticipantes}</strong></p>
                ${totalParticipantes > 0 ? `<button type="button" onclick="preguntarDescargaMasiva('${rolFiltro}')" style="margin-top: 10px; background: #dc2626; color: white; border: none; padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.85rem; transition: background 0.2s;" onmouseover="this.style.background='#b91c1c'" onmouseout="this.style.background='#dc2626'">📥 Descargar PDFs de ${tituloRol}</button>` : ''}
            </div>
            <div style="text-align: right; background: white; padding: 10px 20px; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                <p style="margin: 0; font-size: 0.85rem; color: var(--muted); font-weight: bold; text-transform: uppercase;">Calificación Promedio</p>
                <p style="margin: 0; font-size: 2rem; color: ${promedioGlobal >= 70 ? 'var(--ok)' : 'var(--error)'}; font-weight: 800;">${totalParticipantes > 0 ? promedioGlobal : 'N/A'}</p>
            </div>
        </div>
    `;

    let listaEvaluacionesHTML = '';
    if (totalParticipantes === 0) {
        listaEvaluacionesHTML = `<div style="text-align:center; padding: 30px; background: #f8fafc; border-radius: 8px; color: #64748b; font-style: italic;">Todavía ningún ${rolFiltro.toLowerCase()} ha evaluado este seminario.</div>`;
    } else {
        listaEvaluacionesHTML = evaluacionesFiltradas.map((ev) => {
            const indexGlobal = window.evaluacionesActualesCache.findIndex(e => e === ev);
            return `
            <div style="border: 1px solid var(--border); border-left: 4px solid var(--accent); border-radius: 8px; padding: 18px; margin-bottom: 15px; background: white; box-shadow: 0 2px 5px rgba(0,0,0,0.02);">
                <div style="display:flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; flex-wrap: wrap; gap: 10px;">
                    <div>
                        <h4 style="margin: 0 0 4px 0; color: var(--primary); font-size: 1.1rem;">${escapeHTML(ev.nombre) || 'Evaluador sin nombre'}</h4>
                        <span style="font-size: 0.8rem; background: #e2e8f0; color: #475569; padding: 3px 8px; border-radius: 12px; font-weight: bold;">Rol: ${escapeHTML(ev.rol)}</span>
                        <span style="font-size: 0.8rem; color: #64748b; margin-left: 10px;">🕒 ${escapeHTML(ev.fecha) || 'Fecha desconocida'}</span>
                    </div>
                    <div style="font-size: 1.3rem; font-weight: bold; color: var(--primary-dark);">
                        ${ev.calificacion} <span style="font-size:0.8rem; color:var(--muted);">/ 100</span>
                    </div>
                </div>
                
                <div style="display: flex; gap: 10px; margin-top: 15px; border-top: 1px dashed var(--border); padding-top: 15px;">
                    <button type="button" onclick="verDetalleCuestionario(${indexGlobal})" style="background: var(--primary); color: white; padding: 8px 15px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem; flex: 1; transition: background 0.2s;" onmouseover="this.style.background='var(--primary-dark)'" onmouseout="this.style.background='var(--primary)'">👁️ Ver Evaluación</button>
                    <button type="button" onclick="descargarPDF(${indexGlobal})" style="background: #f1f5f9; color: var(--primary); border: 1px solid var(--border); padding: 8px 15px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.9rem; flex: 1; transition: background 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">📄 Descargar PDF</button>
                </div>
            </div>
        `}).join('');
    }

    retroContenido.innerHTML = panelSuperiorHTML + listaEvaluacionesHTML;
};

let rolDescargaTemporal = '';

window.preguntarDescargaMasiva = function (rolFiltro) {
    rolDescargaTemporal = rolFiltro;
    document.getElementById('modalOpcionesDescargaPDF').classList.remove('hidden');
};

// DIBUJA EL CUESTIONARIO VISUAL
window.verDetalleCuestionario = function (index) {
    const ev = window.evaluacionesActualesCache[index];
    if (!ev) return;

    document.getElementById('detalleEvalSubtitulo').innerHTML = `<strong>Evaluador:</strong> ${escapeHTML(ev.nombre)} | <strong>Rol:</strong> ${escapeHTML(ev.rol)} | <strong>Fecha:</strong> ${escapeHTML(ev.fecha) || 'N/A'}`;
    document.getElementById('detalleEvalCalificacion').textContent = `Calificación Final: ${ev.calificacion} / 100`;
    document.getElementById('detalleEvalComentarios').textContent = ev.comentarios || 'Sin comentarios registrados.';

    const contenedorCuestionario = document.getElementById('detalleEvalCuestionario');

    if (!ev.respuestas || !Array.isArray(ev.respuestas)) {
        contenedorCuestionario.innerHTML = `
            <div style="background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
                <h4 style="margin: 0 0 10px 0;">⚠️ Información no disponible</h4>
                <p style="margin: 0; font-size: 0.95rem;">Esta evaluación fue realizada antes de la actualización del sistema. Sólo se cuenta con la calificación final y el comentario, pero no con el desglose de las preguntas individuales.</p>
            </div>
        `;
        modalDetalleEvaluacion.classList.remove('hidden');
        return;
    }

    let htmlCuestionario = '';
    let escalaAnterior = null;

    ev.respuestas.forEach((r, idx) => {
        if (escalaAnterior !== r.escala_maxima) {
            htmlCuestionario += `<h4 style="color:var(--primary); margin: 20px 0 15px 0; padding-bottom: 5px; border-bottom: 1px solid var(--border);">Escala 1 al ${r.escala_maxima}</h4>`;
            escalaAnterior = r.escala_maxima;
        }

        let opcionesHtml = '';
        for (let j = 1; j <= r.escala_maxima; j++) {
            const isSeleccionada = (j === parseInt(r.puntaje));
            const bgColor = isSeleccionada ? 'var(--primary)' : '#f1f5f9';
            const textColor = isSeleccionada ? 'white' : '#64748b';
            const borderColor = isSeleccionada ? 'var(--primary)' : '#cbd5e1';

            opcionesHtml += `
                <div style="flex: 1; min-width: 35px; text-align: center; background: ${bgColor}; color: ${textColor}; border: 1px solid ${borderColor}; padding: 6px 0; border-radius: 4px; font-weight: bold; font-size: 0.85rem;">
                    ${j}
                </div>
            `;
        }

        htmlCuestionario += `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 12px;">
                <div style="font-size: 0.95rem; font-weight: 600; color: var(--primary-dark); margin-bottom: 10px;">P${idx + 1}. ${r.texto}</div>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">${opcionesHtml}</div>
            </div>
        `;
    });

    contenedorCuestionario.innerHTML = htmlCuestionario;
    modalDetalleEvaluacion.classList.remove('hidden');
};

// LISTENERS DE CIERRE DE MODALES
if (btnCerrarRetro) {
    btnCerrarRetro.addEventListener('click', () => modalRetro.classList.add('hidden'));
}
if (btnCerrarDetalleEvaluacion) {
    btnCerrarDetalleEvaluacion.addEventListener('click', () => modalDetalleEvaluacion.classList.add('hidden'));
}
if (modalDetalleEvaluacion) {
    modalDetalleEvaluacion.addEventListener('click', (e) => {
        if (e.target === modalDetalleEvaluacion) modalDetalleEvaluacion.classList.add('hidden');
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const btnCombinada = document.getElementById('btnDescargaCombinada');
    const btnIndividual = document.getElementById('btnDescargaIndividual');

    if (btnCombinada) {
        btnCombinada.addEventListener('click', () => {
            document.getElementById('modalOpcionesDescargaPDF').classList.add('hidden');
            descargarTodosPDF(rolDescargaTemporal, false);
        });
    }
    if (btnIndividual) {
        btnIndividual.addEventListener('click', () => {
            document.getElementById('modalOpcionesDescargaPDF').classList.add('hidden');
            descargarTodosPDF(rolDescargaTemporal, true);
        });
    }
});

// PDF'S
function descargarDesdeUrl(url) {
    const enlace = document.createElement('a');
    enlace.href = url;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
}

window.descargarPDF = function (index) {
    const ev = window.evaluacionesActualesCache[index];
    if (!ev || !ev.id) return;

    descargarDesdeUrl(`${API_BASE}/evaluacion-pdf/${ev.id}`);
};

window.descargarTodosPDF = function (rolFiltro, individuales = false) {
    if (!window.idSeminarioActualRetro) return;

    const ruta = individuales ? 'evaluaciones-zip' : 'evaluaciones-pdf';
    descargarDesdeUrl(`${API_BASE}/${ruta}/${window.idSeminarioActualRetro}?rol=${encodeURIComponent(rolFiltro)}`);
};
