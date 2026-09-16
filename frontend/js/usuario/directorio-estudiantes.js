import { API_BASE, AUTH, apiFetch } from '../shared/api.js';
import { escapeHTML } from '../shared/dom.js';
import { mostrarToast, mostrarModalConfirmacion } from '../shared/toast.js';
import { abrirEdicionAlumno } from './edicion-seminario.js';
import { verRetroalimentacion } from './retroalimentacion.js';

export let listaGlobalEstudiantes = [];
export let paginaActual = 1;
let totalPaginasBackend = 1;
export let estudianteSeleccionado = null;
let timeoutBusquedaDirectorio = null;

const vistaDirectorio = document.getElementById('vista-directorio');
const vistaDetallesEstudiante = document.getElementById('vista-detalles-estudiante');
const btnVolverDirectorio = document.getElementById('btnVolverDirectorio');

if (btnVolverDirectorio) {
    btnVolverDirectorio.addEventListener('click', () => {
        vistaDetallesEstudiante.classList.add('hidden');
        vistaDirectorio.classList.remove('hidden');
        cargarTablaEstudiantes(paginaActual);
    });
}

// delega el clic de "Abrir seminarios" de la tabla, generada dinamicamente
const tablaEstudiantesBody = document.getElementById('tablaEstudiantesBody');
if (tablaEstudiantesBody) {
    tablaEstudiantesBody.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-action="abrir-seminarios"]');
        if (btn) abrirDetallesEstudiante(parseInt(btn.dataset.id, 10));
    });
}

export async function cargarTablaEstudiantes(pagina = 1) {
    paginaActual = pagina;
    const buscador = document.getElementById('buscadorAlumnos');
    const textoBusqueda = buscador ? buscador.value.trim() : '';
    const filtroPrograma = document.getElementById('filtroProgramaAlumnos') ? document.getElementById('filtroProgramaAlumnos').value : 'todos';
    const filtroFase = document.getElementById('filtroFaseAlumnos') ? document.getElementById('filtroFaseAlumnos').value : 'todos';

    const tbody = document.getElementById('tablaEstudiantesBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #6b7280; font-style: italic;">Cargando directorio...</td></tr>';

    try {
        const url = `${API_BASE}/estudiantes?page=${paginaActual}&search=${encodeURIComponent(textoBusqueda)}&programa=${encodeURIComponent(filtroPrograma)}&fase=${encodeURIComponent(filtroFase)}`;
        const response = await apiFetch(url, { cache: 'no-store' });

        if (response.status === 401) return;
        const data = await response.json();

        if (data.success) {
            listaGlobalEstudiantes = data.estudiantes;
            totalPaginasBackend = data.total_pages;
            paginaActual = data.current_page;
            renderizarTablaAlumnos();
        }
    } catch (error) {
        console.error("Error cargando la tabla:", error);
        if (tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--error);">Error al cargar los datos.</td></tr>';
    }
}

function renderizarTablaAlumnos() {
    const tbody = document.getElementById('tablaEstudiantesBody');
    const btnAnt = document.getElementById('btnPaginaAnt');
    const btnSig = document.getElementById('btnPaginaSig');
    const textoPag = document.getElementById('textoPaginacion');

    if (!tbody) return;

    tbody.innerHTML = '';
    if (listaGlobalEstudiantes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #6b7280; font-weight: bold;">No se encontraron resultados.</td></tr>';
    } else {
        listaGlobalEstudiantes.forEach(est => {
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #e5e7eb; transition: background 0.2s;">
                    <td style="padding: 16px 10px; vertical-align: middle; font-size: 1.05rem;">${escapeHTML(est.nombre)}</td>
                    <td style="padding: 16px 10px; vertical-align: middle; font-size: 1.05rem;"><strong>${escapeHTML(est.usuarioAlumno)}</strong></td>
                    <td style="padding: 16px 10px; vertical-align: middle;"><span style="background: #e0e7ff; color: var(--primary); padding: 6px 12px; border-radius: 12px; font-weight: bold;">${escapeHTML(est.seminarios_activos)} registrados</span></td>
                    <td style="padding: 16px 10px; vertical-align: middle;">
                        <button type="button" data-action="abrir-seminarios" data-id="${est.id_estudiante}" style="background: var(--primary); color: white; padding: 8px 14px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 0.95rem;">Abrir seminarios</button>
                    </td>
                </tr>
            `;
        });
    }

    if (textoPag) textoPag.textContent = `Página ${paginaActual} de ${totalPaginasBackend}`;
    if (btnAnt) {
        btnAnt.disabled = (paginaActual === 1);
        btnAnt.style.opacity = (paginaActual === 1) ? '0.5' : '1';
        btnAnt.style.cursor = (paginaActual === 1) ? 'not-allowed' : 'pointer';
    }
    if (btnSig) {
        btnSig.disabled = (paginaActual >= totalPaginasBackend);
        btnSig.style.opacity = (paginaActual >= totalPaginasBackend) ? '0.5' : '1';
        btnSig.style.cursor = (paginaActual >= totalPaginasBackend) ? 'not-allowed' : 'pointer';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    const buscador = document.getElementById('buscadorAlumnos');
    if (buscador) {
        buscador.addEventListener('input', () => {
            clearTimeout(timeoutBusquedaDirectorio);
            timeoutBusquedaDirectorio = setTimeout(() => {
                cargarTablaEstudiantes(1);
            }, 400);
        });
    }

    const filtroProg = document.getElementById('filtroProgramaAlumnos');
    if (filtroProg) filtroProg.addEventListener('change', () => cargarTablaEstudiantes(1));

    const filtroFase = document.getElementById('filtroFaseAlumnos');
    if (filtroFase) filtroFase.addEventListener('change', () => cargarTablaEstudiantes(1));

    const btnAnt = document.getElementById('btnPaginaAnt');
    if (btnAnt) btnAnt.addEventListener('click', () => {
        if (paginaActual > 1) cargarTablaEstudiantes(paginaActual - 1);
    });

    const btnSig = document.getElementById('btnPaginaSig');
    if (btnSig) btnSig.addEventListener('click', () => {
        if (paginaActual < totalPaginasBackend) cargarTablaEstudiantes(paginaActual + 1);
    });
});

// etiqueta visual segun si ya se puede evaluar, todavia no llega la fecha, o no tiene fecha asignada
function etiquetaEstadoVentana(sem) {
    switch (sem.estado_ventana) {
        case 'disponible': return { texto: '🟢 Activo', bg: '#dcfce7', color: '#166534' };
        case 'antes': return { texto: '🕓 Pendiente', bg: '#ffedd5', color: '#9a3412' };
        default: return { texto: '⚪ Sin fecha', bg: '#f1f5f9', color: '#475569' };
    }
}

// ABRIR PANEL DE DETALLES DEL ESTUDIANTE
function renderizarListaActivos(lista, esAdmin, programaSeleccionado = 'todos') {
    const contenedorActivos = document.getElementById('contenedor-seminarios-activos');
    if (lista.length === 0) {
        const mensajeVacio = programaSeleccionado !== 'todos'
            ? `Sin seminarios activos de ${programaSeleccionado}.`
            : 'No hay seminarios activos pendientes de evaluación.';
        contenedorActivos.innerHTML = `<p style="color: #6b7280; font-style: italic;">${mensajeVacio}</p>`;
    } else {
        contenedorActivos.innerHTML = lista.map(sem => {
            const estado = etiquetaEstadoVentana(sem);
            return `
            <div style="border-left: 4px solid var(--accent); background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px;">
                    <h4 style="margin:0; color: var(--primary); font-size: 1.15rem;">${escapeHTML(sem.proyecto)}</h4>
                    <div style="display: flex; align-items: center; gap: 8px; flex-shrink:0;">
                        <span style="font-size: 0.8rem; font-weight: bold; padding: 3px 10px; border-radius: 12px; background: ${estado.bg}; color: ${estado.color};">${estado.texto}</span>
                        <span style="font-size: 0.85rem; font-family: monospace; background: #e0e7ff; color: var(--primary); padding: 3px 8px; border-radius: 4px; font-weight: bold;">Clave: ${escapeHTML(sem.clave_acceso)}</span>
                    </div>
                </div>
                <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #4b5563;"><strong>Fase:</strong> ${escapeHTML(sem.tipo_seminario)} &nbsp;|&nbsp; <strong>Programa:</strong> ${escapeHTML(sem.programa_historico || '')} &nbsp;|&nbsp; <strong>Fecha:</strong> ${escapeHTML(sem.fecha)} a las ${escapeHTML(sem.hora)}</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" class="btn-copiar-link-activo" data-clave="${escapeHTML(sem.clave_acceso)}" style="background: #059669; padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Copiar enlace evaluador</button>
                    ${esAdmin ? `<button type="button" class="btn-editar-seminario-activo" data-id="${sem.id_seminario}" style="background: #d97706; padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Editar Seminario</button>` : ''}
                    <button type="button" class="btn-retro-seminario-activo" data-id="${sem.id_seminario}" style="background: var(--primary); padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Retroalimentación</button>
                    ${esAdmin ? `<button type="button" class="btn-eliminar-seminario-activo btn-danger" data-id="${sem.id_seminario}" style="padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Eliminar Seminario</button>` : ''}
                </div>
            </div>
        `;
        }).join('');

        contenedorActivos.querySelectorAll('.btn-copiar-link-activo').forEach(btn => {
            btn.addEventListener('click', () => copiarLinkEvaluador(btn.dataset.clave));
        });
        contenedorActivos.querySelectorAll('.btn-editar-seminario-activo').forEach(btn => {
            btn.addEventListener('click', () => abrirEdicionAlumno(parseInt(btn.dataset.id, 10)));
        });
        contenedorActivos.querySelectorAll('.btn-retro-seminario-activo').forEach(btn => {
            btn.addEventListener('click', () => verRetroalimentacion(parseInt(btn.dataset.id, 10)));
        });
        contenedorActivos.querySelectorAll('.btn-eliminar-seminario-activo').forEach(btn => {
            btn.addEventListener('click', () => eliminarSeminario(parseInt(btn.dataset.id, 10)));
        });
    }
}

function inyectarFiltroPrograma(idFiltro, contenedorReferencia, seminarios, onCambio, valorInicial = 'todos') {
    let filtro = document.getElementById(idFiltro);
    if (!filtro) {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '10px';
        wrapper.innerHTML = `
            <label for="${idFiltro}" style="margin-right: 8px; font-size: 0.9rem; color: var(--muted);">Filtrar por programa:</label>
            <select id="${idFiltro}" style="padding: 5px 10px; border-radius: 6px; border: 1px solid var(--border);">
                <option value="todos">Todos</option>
                <option value="Maestría">Maestría</option>
                <option value="Doctorado">Doctorado</option>
            </select>
        `;
        contenedorReferencia.parentNode.insertBefore(wrapper, contenedorReferencia);
        filtro = wrapper.querySelector(`#${idFiltro}`);
    }

    filtro.onchange = onCambio;
    filtro.value = valorInicial;
    return filtro;
}

export function abrirDetallesEstudiante(id_estudiante) {
    estudianteSeleccionado = listaGlobalEstudiantes.find(e => e.id_estudiante === id_estudiante);
    if (!estudianteSeleccionado) return;

    vistaDirectorio.classList.add('hidden');
    vistaDetallesEstudiante.classList.remove('hidden');

    document.getElementById('detalles-nombre').textContent = estudianteSeleccionado.nombre;
    document.getElementById('detalles-control').textContent = "Control: " + estudianteSeleccionado.usuarioAlumno;
    document.getElementById('detalles-programa').textContent = "Programa: " + estudianteSeleccionado.programa;

    const esAdmin = !!(AUTH.user && AUTH.user.isAdmin);
    const semsActivos = estudianteSeleccionado.seminarios.filter(s => !s.es_evaluado);
    const contenedorActivos = document.getElementById('contenedor-seminarios-activos');

    const filtroActivos = inyectarFiltroPrograma('filtro-programa-activos', contenedorActivos, semsActivos, () => {
        const seleccion = filtroActivos.value;
        const filtrados = seleccion === 'todos' ? semsActivos : semsActivos.filter(s => s.programa_historico === seleccion);
        renderizarListaActivos(filtrados, esAdmin, seleccion);
    }, estudianteSeleccionado.programa);

    const seleccionActual = filtroActivos.value;
    const semsActivosFiltrados = seleccionActual === 'todos' ? semsActivos : semsActivos.filter(s => s.programa_historico === seleccionActual);
    renderizarListaActivos(semsActivosFiltrados, esAdmin, seleccionActual);
}

// BOTONES DEL PANEL DE DETALLES
document.getElementById('btnEliminarAlumnoTotal').addEventListener('click', async () => {
    if (!estudianteSeleccionado) return;
    mostrarModalConfirmacion("⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de eliminar a este alumno? Se borrarán TODOS sus seminarios y calificaciones de forma permanente.", async () => {
        try {
            const req = await apiFetch(`${API_BASE}/eliminar-estudiante/${estudianteSeleccionado.id_estudiante}`, { method: 'DELETE' });
            if (req.status === 401) return;
            const res = await req.json();
            if (res.success) {
                mostrarToast("🗑️ " + res.mensaje, 'exito');
                document.getElementById('btnVolverDirectorio').click();
            } else {
                mostrarToast("❌ Error: " + res.mensaje, 'error');
            }
        } catch (e) { mostrarToast("Error de conexión", 'error'); }
    });
});

export function eliminarSeminario(id_seminario) {
    mostrarModalConfirmacion("⚠️ ¿Deseas eliminar únicamente este seminario?", async () => {
        try {
            const req = await apiFetch(`${API_BASE}/eliminar-seminario/${id_seminario}`, { method: 'DELETE' });
            if (req.status === 401) return;
            const res = await req.json();
            if (res.success) {
                mostrarToast("🗑️ " + res.mensaje, 'exito');
                await cargarTablaEstudiantes();
                abrirDetallesEstudiante(estudianteSeleccionado.id_estudiante);
            } else {
                mostrarToast("❌ Error: " + res.mensaje, 'error');
            }
        } catch (e) { mostrarToast("Error de conexión", 'error'); }
    });
}

function renderizarListaHistorial(lista, programaSeleccionado = 'todos') {
    const contenedor = document.getElementById('contenedor-historial-seminarios');

    if (lista.length === 0) {
        const mensajeVacio = programaSeleccionado !== 'todos'
            ? `Sin seminarios evaluados de ${programaSeleccionado}.`
            : 'No hay seminarios evaluados aún.';
        contenedor.innerHTML = `<p style="color: #6b7280; text-align: center;">${mensajeVacio}</p>`;
    } else {
        contenedor.innerHTML = lista.map((sem) => {
            let evals = sem.evaluaciones_detalle || [];
            let tot = evals.length;
            let ext = evals.filter(e => e.rol === 'Externo');
            let doc = evals.filter(e => e.rol === 'Docente');
            let alu = evals.filter(e => e.rol === 'Alumno');

            const calcProm = (arr) => arr.length ? (arr.reduce((s, x) => s + x.calificacion, 0) / arr.length).toFixed(1) : 'N/A';

            let htmlPromedios = `
                <div style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px; margin-top: 12px; font-size: 0.85rem; color: #475569;">
                    <div style="display: flex; justify-content: space-between; font-weight: bold; margin-bottom: 6px; color: var(--primary-dark);">
                        <span>Total de evaluadores: ${tot}</span>
                        <span>Promedio Global: ${calcProm(evals)} / 100</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; gap: 10px;">
                        <span><strong>Externos (${ext.length}):</strong> ${calcProm(ext)}</span>
                        <span><strong>Docentes (${doc.length}):</strong> ${calcProm(doc)}</span>
                        <span><strong>Alumnos (${alu.length}):</strong> ${calcProm(alu)}</span>
                    </div>
                </div>
            `;

            const sinEvaluarPorPlazoVencido = sem.plazo_vencido && tot === 0;
            const colorBadgeFecha = sinEvaluarPorPlazoVencido ? '#dc2626' : 'var(--ok)';
            const etiquetaFecha = sinEvaluarPorPlazoVencido ? `${sem.fecha} · Plazo vencido` : sem.fecha;

            return `
            <div style="border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px;">
                <div class="cabecera-historial-seminario" data-id="hist-${sem.id_seminario}" style="padding: 12px; background: #f8fafc; cursor: pointer; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex:1;">
                        <span style="font-size: 0.8rem; background: ${colorBadgeFecha}; color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-bottom: 4px; display: inline-block;">${escapeHTML(etiquetaFecha)}</span>
                        <h4 style="margin: 0; color: var(--primary); font-size: 1.05rem;">${escapeHTML(sem.tipo_seminario)} - ${escapeHTML(sem.calificacion)}</h4>
                        <p style="margin: 4px 0 0; font-size: 0.8rem; color: #6b7280;">${escapeHTML(sem.programa_historico || '')}</p>
                    </div>
                    <span style="font-size: 1.2rem; color: var(--primary);">▼</span>
                </div>
                <div id="hist-${sem.id_seminario}" class="hidden" style="padding: 15px; border-top: 1px solid var(--border);">
                    <p style="margin: 0 0 8px 0;"><strong>Proyecto:</strong> ${escapeHTML(sem.proyecto)}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Lugar:</strong> ${escapeHTML(sem.lugar)} (${escapeHTML(sem.modalidad)})</p>
                    ${htmlPromedios}
                    <button type="button" class="btn-retro-seminario-historial" data-id="${sem.id_seminario}" style="margin-top: 12px; background: var(--primary); padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Ver Calificaciones y Retroalimentación</button>
                </div>
            </div>
        `}).join('');

        contenedor.querySelectorAll('.cabecera-historial-seminario').forEach(cab => {
            cab.addEventListener('click', () => {
                document.getElementById(cab.dataset.id).classList.toggle('hidden');
            });
        });
        contenedor.querySelectorAll('.btn-retro-seminario-historial').forEach(btn => {
            btn.addEventListener('click', () => verRetroalimentacion(parseInt(btn.dataset.id, 10)));
        });
    }
}

// MODAL: HISTORIAL DE SEMINARIOS EVALUADOS
document.getElementById('btnHistorialSeminarios').addEventListener('click', () => {
    const semsEvaluados = estudianteSeleccionado.seminarios.filter(s => s.es_evaluado);
    const contenedor = document.getElementById('contenedor-historial-seminarios');

    const filtroHistorial = inyectarFiltroPrograma('filtro-programa-historial', contenedor, semsEvaluados, () => {
        const seleccion = filtroHistorial.value;
        const filtrados = seleccion === 'todos' ? semsEvaluados : semsEvaluados.filter(s => s.programa_historico === seleccion);
        renderizarListaHistorial(filtrados, seleccion);
    }, estudianteSeleccionado.programa);

    const seleccionActual = filtroHistorial.value;
    const semsEvaluadosFiltrados = seleccionActual === 'todos' ? semsEvaluados : semsEvaluados.filter(s => s.programa_historico === seleccionActual);
    renderizarListaHistorial(semsEvaluadosFiltrados, seleccionActual);

    document.getElementById('modalHistorial').classList.remove('hidden');
});

document.getElementById('btnCerrarHistorial').addEventListener('click', () => document.getElementById('modalHistorial').classList.add('hidden'));