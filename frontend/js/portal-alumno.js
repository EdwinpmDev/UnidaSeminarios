import { API_BASE, csrfHeaders } from './shared/api.js';
import { escapeHTML } from './shared/dom.js';

let seminariosCompletos = [];
const seminariosPorId = {};

const COLOR_ESTADO_TEMPORAL = {
    "Pendiente": "#f59e0b",
    "Activo": "#2563eb",
    "Terminado": "#6b7280",
    "Sin fecha": "#9ca3af"
};

function renderizarSeminarios(listaSeminarios, programaSeleccionado = 'todos') {
    const contenedor = document.getElementById("contenedor-seminarios");
    let htmlSeminarios = '';

    if (!listaSeminarios || listaSeminarios.length === 0) {
        htmlSeminarios = programaSeleccionado !== 'todos'
            ? `<p style="text-align:center; color: #6b7280; padding: 20px;">Sin seminarios registrados de ${programaSeleccionado}.</p>`
            : '<p style="text-align:center; color: #6b7280; padding: 20px;">No tienes seminarios registrados en este periodo.</p>';
    } else {
        const esUnico = listaSeminarios.length === 1;

        listaSeminarios.forEach(sem => {
            seminariosPorId[sem.id_seminario] = sem;

            const evaluadoresLi = sem.evaluadores.map(ev => {
                const estado = `${ev.evaluo ? "✅" : "⏳"} ${escapeHTML(ev.rol)}: ${escapeHTML(ev.nombre)} — ${ev.evaluo ? "ya calificó" : "pendiente"}`;
                const comentario = ev.evaluo && ev.comentarios ? `<p class="texto-scroll" style="margin-top:4px; color:#374151; font-style:italic;">"${escapeHTML(ev.comentarios)}"</p>` : "";
                return `<li style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;"><span style="color:${ev.evaluo ? 'var(--ok, #16a34a)' : 'inherit'}; font-weight:600;">${estado}</span>${comentario}</li>`;
            }).join('');

            const bloqueEvaluadores = sem.evaluadores.length > 3
                ? `<button type="button" class="btn-ver-comentarios" data-id="${sem.id_seminario}" style="background: var(--primary); color:white; border:none; padding:8px 14px; border-radius:8px; cursor:pointer; font-weight:600;">Ver todos los comentarios (${sem.evaluadores.length})</button>`
                : `<ul style="margin-top: 8px; list-style: none; padding: 0;">${evaluadoresLi}</ul>`;

            const detalleId = `detalles-${sem.id_seminario}`;
            const displayDetalle = esUnico ? 'block' : 'none';
            const cursorStyle = esUnico ? 'default' : 'pointer';
            const iconToggle = esUnico ? '' : '<span class="icono-toggle" style="font-size: 1.2rem; color: var(--primary);">▼</span>';
            const colorCalif = String(sem.promedio).includes('Sin evaluar') ? '#f59e0b' : '#16a34a';
            const colorEstadoTemporal = COLOR_ESTADO_TEMPORAL[sem.estado_temporal] || '#9ca3af';

            htmlSeminarios += `
            <section class="card" style="margin-bottom: 20px; border-left: 4px solid var(--accent);">

                <div style="display: flex; justify-content: space-between; align-items: center; cursor: ${cursorStyle}; padding-bottom: ${esUnico ? '15px' : '0'}; border-bottom: ${esUnico ? '2px solid var(--accent)' : 'none'};" ${esUnico ? '' : `data-toggle-id="${detalleId}"`}>
                    <div style="flex: 1; padding-right: 15px;">
                        <h2 style="color: var(--primary); font-size: 1.25rem; margin: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">${escapeHTML(sem.proyecto)}</h2>
                        <p style="margin: 5px 0 0; color: #6b7280; font-size: 0.9rem;">📅 ${escapeHTML(sem.fecha)} a las ${escapeHTML(sem.hora)}</p>
                        <span style="display:inline-block; margin-top:6px; background: ${colorEstadoTemporal}; color: white; padding: 2px 10px; border-radius: 10px; font-size: 0.78rem; font-weight: bold;">${escapeHTML(sem.estado_temporal)}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <span style="background: ${colorCalif}; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85rem; font-weight: bold; white-space: nowrap;">
                            ${escapeHTML(sem.promedio)}
                        </span>
                        ${iconToggle}
                    </div>
                </div>

                <div id="${detalleId}" style="display: ${displayDetalle}; margin-top: ${esUnico ? '0' : '15px'}; padding-top: ${esUnico ? '0' : '15px'}; border-top: ${esUnico ? 'none' : '1px solid #e5e7eb'};">
                    <div class="grid">
                        <div>
                            <label>Fase / Tipo de seminario:</label>
                            <p style="font-weight: bold; color: var(--primary); font-size: 1.05rem;">${escapeHTML(sem.tipo_seminario)}</p>
                        </div>
                        <div>
                            <label>Programa:</label>
                            <p style="font-weight: bold;">${escapeHTML(sem.programa_historico)}</p>
                        </div>

                        <div style="grid-column: 1 / -1;">
                            <label>Título del proyecto:</label>
                            <p style="font-weight: bold;">${escapeHTML(sem.proyecto)}</p>
                        </div>

                        <div>
                            <label>Lugar / Enlace:</label>
                            <p>${escapeHTML(sem.lugar)}</p>
                        </div>
                        <div>
                            <label>Modalidad:</label>
                            <p>${escapeHTML(sem.modalidad)}</p>
                        </div>
                        <div>
                            <label>Duración:</label>
                            <p>${sem.duracion !== 'Por definir' ? `${escapeHTML(sem.duracion)} min` : escapeHTML(sem.duracion)}</p>
                        </div>

                        ${sem.jurado_texto !== 'Por asignar' ? `
                        <div style="grid-column: 1 / -1; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                            <label style="color: var(--primary-dark);">Comité evaluador:</label>
                            <p style="margin-top: 5px; color: var(--text);">${escapeHTML(sem.jurado_texto)}</p>
                        </div>
                        ` : ''}

                        <div style="grid-column: 1 / -1; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid var(--border);">
                            <label style="color: var(--primary-dark);">Estado de las evaluaciones:</label>
                            ${bloqueEvaluadores}
                        </div>
                    </div>
                    <div style="margin-top: 25px; text-align: center; background: #eff6ff; padding: 20px; border-radius: 12px; border: 2px solid var(--primary);">
                        <h3 style="margin: 0; color: var(--primary-dark);">Calificación final</h3>
                        <p style="font-size: 2rem; font-weight: bold; margin: 10px 0 0; color: var(--primary);">${escapeHTML(sem.promedio)}</p>
                    </div>
                </div>
            </section>
            `;
        });
    }
    contenedor.innerHTML = htmlSeminarios;

    document.querySelectorAll('.btn-ver-comentarios').forEach(btn => {
        btn.addEventListener('click', () => abrirModalComentarios(btn.dataset.id));
    });

    // delega el toggle de las tarjetas (generadas dinámicamente) en vez de usar onclick inline
    document.querySelectorAll('[data-toggle-id]').forEach(header => {
        header.addEventListener('click', () => toggleSeminario(header.dataset.toggleId, header));
    });
}

function abrirModalComentarios(idSeminario) {
    const sem = seminariosPorId[idSeminario];
    if (!sem) return;

    const grupos = { Externo: [], Docente: [], Alumno: [] };
    sem.evaluadores.forEach(ev => {
        if (grupos[ev.rol]) grupos[ev.rol].push(ev);
    });

    const bloque = (titulo, lista) => {
        if (lista.length === 0) return '';
        const items = lista.map(ev => `
            <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb;">
                <strong style="color: var(--primary-dark);">${escapeHTML(ev.nombre)}</strong>
                <p style="margin: 4px 0 0; color: #374151;">${ev.evaluo && ev.comentarios ? escapeHTML(ev.comentarios) : 'Sin comentarios todavía.'}</p>
            </div>
        `).join('');
        return `<div style="margin-bottom: 18px;">
            <h4 style="color: var(--primary); margin-bottom: 6px;">${titulo}</h4>
            ${items}
        </div>`;
    };

    document.getElementById('contenidoModalComentarios').innerHTML =
        bloque('Externos', grupos.Externo) +
        bloque('Docentes', grupos.Docente) +
        bloque('Alumnos', grupos.Alumno);

    document.getElementById('modalComentariosAlumno').classList.remove('hidden');
}

document.getElementById('btnCerrarModalComentarios').addEventListener('click', () => {
    document.getElementById('modalComentariosAlumno').classList.add('hidden');
});

function poblarSelectorAnio(seminarios) {
    const selectorAnio = document.getElementById('selector-anio-seminarios');
    const anioActual = String(new Date().getFullYear());

    const anios = [...new Set(seminarios
        .map(sem => (sem.fecha_raw) ? sem.fecha_raw.split('-')[0] : null)
        .filter(Boolean))].sort((a, b) => b - a);

    if (!anios.includes(anioActual)) anios.unshift(anioActual);

    selectorAnio.innerHTML = anios.map(a => `<option value="${a}">${a}</option>`).join('')
        + '<option value="todos">Todos</option>';
    selectorAnio.value = anioActual;
}

function poblarSelectorPrograma() {
    const selectorPrograma = document.getElementById('selector-programa-seminarios');

    selectorPrograma.innerHTML = `
        <option value="todos">Todos</option>
        <option value="Maestría">Maestría</option>
        <option value="Doctorado">Doctorado</option>
    `;
    selectorPrograma.value = 'todos';
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch(`${API_BASE}/mi-informacion`);
        const data = await res.json();

        if (data.success) {
            const d = data.datos;

            document.getElementById("nombre-alumno-header").textContent = d.nombre;
            document.getElementById("lbl-nombre").textContent = d.nombre;
            document.getElementById("lbl-usuarioAlumno").textContent = d.usuarioAlumno;
            document.getElementById("lbl-correo").textContent = d.correo || 'sin correo';
            document.getElementById("lbl-programa").textContent = d.programa;
            document.getElementById("info-card-base").style.display = "block";

            seminariosCompletos = d.seminarios || [];
            poblarSelectorAnio(seminariosCompletos);
            poblarSelectorPrograma();

            const selectorAnio = document.getElementById('selector-anio-seminarios');
            const selectorPrograma = document.getElementById('selector-programa-seminarios');
            selectorPrograma.value = d.programa;
            const aplicarFiltros = () => {
                const anioSel = selectorAnio.value;
                const programaSel = selectorPrograma.value;
                const filtrados = seminariosCompletos.filter(sem => {
                    const pasaAnio = anioSel === 'todos' || (sem.fecha_raw && sem.fecha_raw.startsWith(anioSel));
                    const pasaPrograma = programaSel === 'todos' || sem.programa_historico === programaSel;
                    return pasaAnio && pasaPrograma;
                });
                renderizarSeminarios(filtrados, programaSel);
            };
            selectorAnio.addEventListener('change', aplicarFiltros);
            selectorPrograma.addEventListener('change', aplicarFiltros);
            aplicarFiltros();
        } else {
            window.location.href = "/";
        }

    } catch (error) {
        console.error(error);
        window.location.href = "/";
    }
});

// --- CERRAR SESIÓN ---
// El logout ahora requiere POST + token CSRF (antes era un simple onclick a /logout vía GET)
const btnLogoutAlumno = document.getElementById('btnLogoutAlumno');
if (btnLogoutAlumno) {
    btnLogoutAlumno.addEventListener('click', async () => {
        try {
            await fetch(`${API_BASE}/logout`, { method: 'POST', headers: csrfHeaders() });
        } finally {
            window.location.href = '/';
        }
    });
}

// --- EDICIÓN DEL CORREO INSTITUCIONAL ---
const vistaCorreo = document.getElementById("vista-correo");
const edicionCorreo = document.getElementById("edicion-correo");
const inputNuevoCorreo = document.getElementById("input-nuevo-correo");
const msgCorreo = document.getElementById("msg-correo");

function mostrarMensajeCorreo(texto, esError) {
    msgCorreo.textContent = texto;
    msgCorreo.style.color = esError ? "#dc2626" : "#16a34a";
    msgCorreo.style.display = "block";
}

document.getElementById("btnEditarCorreo").addEventListener("click", () => {
    inputNuevoCorreo.value = document.getElementById("lbl-correo").textContent === "sin correo"
        ? "" : document.getElementById("lbl-correo").textContent;
    msgCorreo.style.display = "none";
    vistaCorreo.style.display = "none";
    edicionCorreo.style.display = "flex";
    inputNuevoCorreo.focus();
});

document.getElementById("btnCancelarCorreo").addEventListener("click", () => {
    edicionCorreo.style.display = "none";
    vistaCorreo.style.display = "flex";
});

document.getElementById("btnGuardarCorreo").addEventListener("click", async () => {
    const btnGuardar = document.getElementById("btnGuardarCorreo");
    const correoNuevo = inputNuevoCorreo.value.trim();
    msgCorreo.style.display = "none";

    if (!correoNuevo) {
        mostrarMensajeCorreo("⚠️ Escribe un correo válido.", true);
        return;
    }

    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando...";

    try {
        const res = await fetch(`${API_BASE}/actualizar-mi-correo`, {
            method: "PUT",
            headers: csrfHeaders({ "Content-Type": "application/json" }),
            body: JSON.stringify({ correo: correoNuevo })
        });
        const data = await res.json();

        if (data.success) {
            document.getElementById("lbl-correo").textContent = data.correo || correoNuevo;
            edicionCorreo.style.display = "none";
            vistaCorreo.style.display = "flex";
            mostrarMensajeCorreo("✅ " + data.mensaje, false);
        } else {
            mostrarMensajeCorreo("⚠️ " + data.mensaje, true);
        }
    } catch (error) {
        mostrarMensajeCorreo("⚠️ Error de conexión con el servidor.", true);
    } finally {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Guardar";
    }
});

// Función para abrir y cerrar las tarjetas si hay 2 o más seminarios
function toggleSeminario(id, headerEl) {
    const el = document.getElementById(id);
    const icon = headerEl.querySelector('.icono-toggle');
    if (el.style.display === 'none') {
        el.style.display = 'block';
        headerEl.style.paddingBottom = '15px';
        headerEl.style.borderBottom = '2px solid var(--accent)';
        if (icon) icon.textContent = '▲';
    } else {
        el.style.display = 'none';
        headerEl.style.paddingBottom = '0';
        headerEl.style.borderBottom = 'none';
        if (icon) icon.textContent = '▼';
    }
}