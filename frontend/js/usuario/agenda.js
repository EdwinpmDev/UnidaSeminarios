import { API_BASE, apiFetch } from '../shared/api.js';
import { escapeHTML } from '../shared/dom.js';

const vistaFormulario = document.getElementById('vista-formulario');
const vistaDirectorio = document.getElementById('vista-directorio');
const vistaDocentes = document.getElementById('vista-docentes');
const vistaAgenda = document.getElementById('vista-agenda');
const btnVerAgenda = document.getElementById('btnVerAgenda');
const btnVolverRegistroDesdeAgenda = document.getElementById('btnVolverRegistroDesdeAgenda');
const modalDetallesAgenda = document.getElementById('modalDetallesAgenda');
const btnCerrarDetallesAgenda = document.getElementById('btnCerrarDetallesAgenda');
const filtroMesAgenda = document.getElementById('filtroMesAgenda');
const filtroAnioAgenda = document.getElementById('filtroAnioAgenda');

if (btnVerAgenda) {
    btnVerAgenda.addEventListener('click', async () => {
        vistaFormulario.classList.add('hidden');
        if (vistaDirectorio) vistaDirectorio.classList.add('hidden');
        if (vistaDocentes) vistaDocentes.classList.add('hidden');
        vistaAgenda.classList.remove('hidden');
        await poblarFiltrosAgenda();
        cargarAgendaBackend(1, false);
    });
}

if (btnVolverRegistroDesdeAgenda) {
    btnVolverRegistroDesdeAgenda.addEventListener('click', () => {
        vistaAgenda.classList.add('hidden');
        vistaFormulario.classList.remove('hidden');
    });
}

if (btnCerrarDetallesAgenda) {
    btnCerrarDetallesAgenda.addEventListener('click', () => modalDetallesAgenda.classList.add('hidden'));
}

if (filtroMesAgenda) {
    filtroMesAgenda.addEventListener('change', () => cargarAgendaBackend(1, false));
}
if (filtroAnioAgenda) {
    filtroAnioAgenda.addEventListener('change', () => cargarAgendaBackend(1, false));
}

const filtroProgramaAgenda = document.getElementById('filtroProgramaAgenda');
if (filtroProgramaAgenda) {
    filtroProgramaAgenda.addEventListener('change', () => cargarAgendaBackend(1, false));
}

const filtroFaseAgenda = document.getElementById('filtroFaseAgenda');
if (filtroFaseAgenda) {
    filtroFaseAgenda.addEventListener('change', () => cargarAgendaBackend(1, false));
}

export let paginaAgendaActual = 1;
let cargandoAgenda = false;
let eventosAgendaEnMemoria = [];
let filtrosAgendaPoblados = false;

async function poblarFiltrosAgenda() {
    if (filtrosAgendaPoblados) return;
    filtrosAgendaPoblados = true;

    const hoy = new Date();
    const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
    const anioActual = hoy.getFullYear();

    if (filtroMesAgenda) filtroMesAgenda.value = mesActual;

    if (filtroAnioAgenda) {
        let anioMinimo = anioActual;
        try {
            const res = await apiFetch(`${API_BASE}/agenda-anios-disponibles`, { cache: 'no-store' });
            const data = await res.json();
            if (data.success && data.anio_minimo) anioMinimo = data.anio_minimo;
        } catch (error) {
            console.error(error);
        }

        filtroAnioAgenda.innerHTML = '<option value="todos">Todos los años</option>';
        for (let anio = anioActual; anio >= anioMinimo; anio--) {
            filtroAnioAgenda.innerHTML += `<option value="${anio}">${anio}</option>`;
        }
        filtroAnioAgenda.value = String(anioActual);
    }
}

export async function cargarAgendaBackend(page = 1, esCargarMas = false) {
    const contenedor = document.getElementById('contenedorAgenda');
    if (!contenedor || cargandoAgenda) return;

    cargandoAgenda = true;
    paginaAgendaActual = page;

    const mesFiltro = filtroMesAgenda ? filtroMesAgenda.value : 'todos';
    const anioFiltro = filtroAnioAgenda ? filtroAnioAgenda.value : 'todos';
    const programaFiltro = document.getElementById('filtroProgramaAgenda') ? document.getElementById('filtroProgramaAgenda').value : 'todos';
    const faseFiltro = document.getElementById('filtroFaseAgenda') ? document.getElementById('filtroFaseAgenda').value : 'todos';

    if (!esCargarMas) {
        contenedor.innerHTML = '';
        eventosAgendaEnMemoria = [];
    }

    const botonAnterior = document.getElementById('btn-cargar-mas-agenda');
    if (botonAnterior) botonAnterior.remove();

    const idCarga = 'indicador-carga-agenda-' + Date.now();
    contenedor.innerHTML += `<div id="${idCarga}" style="text-align: center; color: #6b7280; padding: 20px; font-style: italic;">Consultando agenda...</div>`;

    try {
        const url = `${API_BASE}/agenda-paginada?mes=${mesFiltro}&anio=${anioFiltro}&programa=${encodeURIComponent(programaFiltro)}&fase=${encodeURIComponent(faseFiltro)}&page=${page}`;
        const response = await apiFetch(url, { cache: 'no-store' });

        document.getElementById(idCarga)?.remove();

        if (response.status === 401) return;
        const data = await response.json();

        if (!data.success || (data.eventos.length === 0 && page === 1)) {
            contenedor.innerHTML = `<div style="text-align: center; color: #6b7280; padding: 20px; font-weight: bold; background:#f8fafc; border-radius:8px;">No hay seminarios agendados para este periodo.</div>`;
            cargandoAgenda = false;
            return;
        }

        eventosAgendaEnMemoria = [...eventosAgendaEnMemoria, ...data.eventos];

        let html = '';
        data.eventos.forEach(ev => {
            let bgEstado = '#dcfce7';
            let colorEstado = '#166534';

            if (ev.estado_plazo === 'Terminado') {
                bgEstado = '#fee2e2';
                colorEstado = '#991b1b';
            } else if (ev.estado_plazo === 'Pendiente') {
                bgEstado = '#ffedd5';
                colorEstado = '#9a3412';
            }

            html += `
                <div style="border-left: 5px solid var(--accent); background: #f8fafc; border-radius: 8px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s;" 
                    onclick="verDetallesAgenda(${ev.id_seminario})" 
                    onmouseover="this.style.transform='translateX(8px)'" 
                    onmouseout="this.style.transform='translateX(0)'">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: var(--primary-dark); font-size: 1.1rem;">📅 ${escapeHTML(ev.fecha_bonita)} - ${escapeHTML(ev.hora)} hrs</strong>
                        <span style="background: ${bgEstado}; color: ${colorEstado}; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">${escapeHTML(ev.estado_plazo)}</span>
                    </div>
                    
                    <div style="font-size: 1.05rem; font-weight: bold; margin-bottom: 4px;">🎓 ${escapeHTML(ev.nombre_estudiante)}</div>
                    <div style="color: #4b5563; font-size: 0.95rem;"><strong>Programa:</strong> ${escapeHTML(ev.programa)} | <strong>Tipo:</strong> ${escapeHTML(ev.tipo_seminario)} | <strong>Lugar:</strong> ${escapeHTML(ev.lugar)}</div>
                </div>
                `;
        });

        contenedor.innerHTML += html;

        if (data.has_more) {
            contenedor.innerHTML += `
                    <button id="btn-cargar-mas-agenda" style="background: #f1f5f9; color: var(--primary); border: 1px solid var(--border); padding: 12px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%; transition: all 0.2s; margin-top: 10px;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">
                        ↓ Cargar más eventos ↓
                    </button>
                `;

            setTimeout(() => {
                const btn = document.getElementById('btn-cargar-mas-agenda');
                if (btn) {
                    btn.addEventListener('click', () => {
                        cargarAgendaBackend(paginaAgendaActual + 1, true);
                    });
                }
            }, 50);
        } else if (!data.has_more && data.total > 0) {
            contenedor.innerHTML += `<div style="text-align: center; color: #9ca3af; padding: 15px; font-size: 0.85rem; font-style: italic;">Se han mostrado todos los eventos (${data.total}).</div>`;
        }

    } catch (error) {
        document.getElementById(idCarga)?.remove();
        contenedor.innerHTML += `<div style="text-align: center; color: var(--error); padding: 20px; font-weight: bold;">Error de conexión.</div>`;
        console.error(error);
    } finally {
        cargandoAgenda = false;
    }
}

window.verDetallesAgenda = function (idSeminario) {
    const ev = eventosAgendaEnMemoria.find(e => e.id_seminario === idSeminario);
    if (!ev) return;

    const contenido = document.getElementById('contenidoDetallesAgenda');

    contenido.innerHTML = `
            <p style="margin-bottom: 8px;"><strong>🎓 Alumno:</strong> ${escapeHTML(ev.nombre_estudiante)}</p>
            <p style="margin-bottom: 8px;"><strong>🔖 No. Control:</strong> ${escapeHTML(ev.usuarioAlumno)}</p>
            <p style="margin-bottom: 8px;"><strong>📖 Programa:</strong> ${escapeHTML(ev.programa)}</p>
            <p style="margin-bottom: 8px;"><strong>📚 Proyecto:</strong> ${escapeHTML(ev.proyecto)}</p>
            <p style="margin-bottom: 8px;"><strong>🏷️ Tipo:</strong> ${escapeHTML(ev.tipo_seminario)}</p>
            <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 15px 0;">
            <p style="margin-bottom: 8px;"><strong>📅 Fecha y Hora:</strong> ${escapeHTML(ev.fecha_raw)} a las ${escapeHTML(ev.hora)}</p>
            <p style="margin-bottom: 8px;"><strong>📍 Lugar:</strong> ${escapeHTML(ev.lugar)} (${escapeHTML(ev.modalidad)})</p>

        ${(ev.presidente || ev.secretario || ev.vocal) ? `
        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin-bottom: 10px; color: var(--primary-dark);"><strong>🔑 Clave de seminario:</strong> <span style="font-family: monospace; font-size: 1.1rem; color: var(--primary); font-weight: bold; background: #e0e7ff; padding: 2px 6px; border-radius: 4px;">${escapeHTML(ev.clave_acceso)}</span></p>
            <p style="margin-bottom: 8px; font-size: 0.95rem; color: var(--primary-dark);"><strong>Comité evaluador:</strong></p>
            ${ev.presidente ? `<p style="margin-bottom: 4px; font-size: 0.9rem;"><strong>Presidente:</strong> <span style="font-family: monospace; font-weight: bold;">${escapeHTML(ev.presidente)}</span></p>` : ''}
            ${ev.secretario ? `<p style="margin-bottom: 4px; font-size: 0.9rem;"><strong>Secretario:</strong> <span style="font-family: monospace; font-weight: bold;">${escapeHTML(ev.secretario)}</span></p>` : ''}
            ${ev.vocal ? `<p style="margin-bottom: 0; font-size: 0.9rem;"><strong>Vocal:</strong> <span style="font-family: monospace; font-weight: bold;">${escapeHTML(ev.vocal)}</span></p>` : ''}
        </div>
        ` : `
        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin-bottom: 0; color: var(--primary-dark);"><strong>🔑 Clave de seminario:</strong> <span style="font-family: monospace; font-size: 1.1rem; color: var(--primary); font-weight: bold; background: #e0e7ff; padding: 2px 6px; border-radius: 4px;">${escapeHTML(ev.clave_acceso)}</span></p>
        </div>
        `}
            
            <div style="display: flex; gap: 10px; justify-content: flex-end; align-items: center; flex-wrap: wrap; margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 15px;">
                <button type="button" id="btnCopiarLinkDetallesAgenda" style="padding: 10px 15px; font-size: 0.95rem; border-radius: 6px; border: none; cursor: pointer; background: #059669; color: white; font-weight: bold;">🔗 Copiar enlace evaluador</button>
                <button type="button" onclick="document.getElementById('modalDetallesAgenda').classList.add('hidden')" style="padding: 10px 15px; border-radius: 6px; border: none; cursor: pointer; background: #6b7280; color: white; font-weight: bold;">Cerrar</button>
                <button onclick="document.getElementById('modalDetallesAgenda').classList.add('hidden'); abrirEdicionAlumno(${ev.id_seminario});" style="padding: 10px 15px; font-size: 0.95rem; border-radius: 6px; border: none; cursor: pointer; background: #d97706; color: white; font-weight: bold;">✏️ Editar Seminario</button>
            </div>
        `;
    document.getElementById('btnCopiarLinkDetallesAgenda').addEventListener('click', () => copiarLinkEvaluador(ev.clave_acceso));
    document.getElementById('modalDetallesAgenda').classList.remove('hidden');
}

function actualizarFiltrosFaseDinamicos(idSelectPrograma, idSelectFase) {
    const selectPrograma = document.getElementById(idSelectPrograma);
    const selectFase = document.getElementById(idSelectFase);

    if (!selectPrograma || !selectFase) return;

    const fasesMaestria = ["1.- Prototipo", "2.- Tutorial", "3.- Culminacion"];
    const fasesDoctorado = ["1.- Prototipo", "2.- Tutorial I", "3.- Avance 1", "4.- Predoctoral", "5.- Tutorial II", "6.- Avance 2", "7.- Tutorial III", "8.- Culminacion"];

    function renderizarOpciones() {
        const programa = selectPrograma.value;
        const valorActual = selectFase.value;

        selectFase.innerHTML = '<option value="todos">Todas las fases</option>';

        if (programa === 'todos') {
            selectFase.value = 'todos';
            selectFase.disabled = true;
            return;
        }

        selectFase.disabled = false;

        let fases = [];
        let etiqueta = '';

        if (programa === 'Maestría') {
            fases = fasesMaestria;
            etiqueta = 'Fases de Maestría';
        } else if (programa === 'Doctorado') {
            fases = fasesDoctorado;
            etiqueta = 'Fases de Doctorado';
        }

        if (fases.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = etiqueta;
            fases.forEach(f => optgroup.innerHTML += `<option value="${f}">${f}</option>`);
            selectFase.appendChild(optgroup);
        }

        if (Array.from(selectFase.options).some(opt => opt.value === valorActual)) {
            selectFase.value = valorActual;
        } else {
            selectFase.value = 'todos';
        }
    }

    renderizarOpciones();

    selectPrograma.addEventListener('change', renderizarOpciones);
}

document.addEventListener("DOMContentLoaded", () => {
    actualizarFiltrosFaseDinamicos('filtroProgramaAlumnos', 'filtroFaseAlumnos');
    actualizarFiltrosFaseDinamicos('filtroProgramaAgenda', 'filtroFaseAgenda');
});