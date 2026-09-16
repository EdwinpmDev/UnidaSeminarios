import { API_BASE, apiFetch } from '../shared/api.js';
import { escapeHTML } from '../shared/dom.js';
import { mostrarToast, mostrarModalConfirmacion } from '../shared/toast.js';

const vistaFormulario = document.getElementById('vista-formulario');
const vistaDocentes = document.getElementById('vista-docentes');
const btnVerDocentes = document.getElementById('btnVerDocentes');
const btnVolverDocentes = document.getElementById('btnVolverDocentes');

// muestra la tabla de docentes al dar clic
if (btnVerDocentes) {
    btnVerDocentes.addEventListener('click', () => {
        vistaFormulario.classList.add('hidden');
        vistaDocentes.classList.remove('hidden');
        cargarTablaDocentes(paginaActualDocentes);
    });
}
// regresa al formulario principal
if (btnVolverDocentes) {
    btnVolverDocentes.addEventListener('click', () => {
        vistaDocentes.classList.add('hidden');
        vistaFormulario.classList.remove('hidden');
    });
}

let listaGlobalDocentes = [];
let paginaActualDocentes = 1;
let totalPaginasDocentesBackend = 1;
let timeoutBusquedaDocentes = null;
const docentesPorPagina = 10;

// pide la lista de docentes al backend con paginacion y busqueda
async function cargarTablaDocentes(pagina = 1) {
    paginaActualDocentes = pagina;
    const buscador = document.getElementById('buscadorDocentes');
    const textoBusqueda = buscador ? buscador.value.trim() : '';

    const tbody = document.getElementById('tablaDocentesBody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #6b7280; font-style: italic;">Cargando docentes...</td></tr>';

    try {
        const url = `${API_BASE}/docentes?page=${paginaActualDocentes}&search=${encodeURIComponent(textoBusqueda)}`;
        const res = await apiFetch(url, { cache: 'no-store' });

        if (res.status === 401) return;

        const data = await res.json();

        if (data.success) {
            listaGlobalDocentes = data.docentes;
            totalPaginasDocentesBackend = data.total_pages;
            paginaActualDocentes = data.current_page;
            renderizarTablaDocentes();
        }
    } catch (error) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--error); padding: 20px; font-weight: bold;">Error de conexión al cargar los docentes.</td></tr>';
        console.error(error);
    }
}

// dibuja las filas de la tabla con los datos ya cargados
function renderizarTablaDocentes() {
    const tbody = document.getElementById('tablaDocentesBody');
    const btnAnt = document.getElementById('btnPaginaAntDoc');
    const btnSig = document.getElementById('btnPaginaSigDoc');
    const textoPag = document.getElementById('textoPaginacionDoc');

    if (!tbody) return;

    tbody.innerHTML = '';
    if (listaGlobalDocentes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #6b7280; font-weight: bold;">No se encontraron docentes.</td></tr>';
    } else {
        listaGlobalDocentes.forEach(d => {
            // el badge de evaluaciones solo se muestra si el backend ya envía ese dato
            const badgeEvaluaciones = (d.total_evaluaciones !== undefined && d.total_evaluaciones !== null)
                ? `<span class="badge-evaluaciones">${escapeHTML(String(d.total_evaluaciones))} evaluaciones</span>`
                : '';

            tbody.innerHTML += `
                <tr>
                    <td class="docente-nombre">${escapeHTML(d.nombre_completo)}${badgeEvaluaciones ? ' ' + badgeEvaluaciones : ''}</td>
                    <td class="docente-usuario">${escapeHTML(d.usuario)}</td>
                    <td class="docente-acciones">
                        <button type="button" data-id="${d.id}" class="btn-editar-docente">Editar</button>
                        <button type="button" data-id="${d.id}" class="btn-eliminar-docente btn-danger">Eliminar</button>
                    </td>
                </tr>
            `;
        });
    }

    if (textoPag) textoPag.textContent = `Página ${paginaActualDocentes} de ${totalPaginasDocentesBackend}`;
    if (btnAnt) {
        btnAnt.disabled = (paginaActualDocentes === 1);
        btnAnt.style.opacity = (paginaActualDocentes === 1) ? '0.5' : '1';
        btnAnt.style.cursor = (paginaActualDocentes === 1) ? 'not-allowed' : 'pointer';
    }
    if (btnSig) {
        btnSig.disabled = (paginaActualDocentes >= totalPaginasDocentesBackend);
        btnSig.style.opacity = (paginaActualDocentes >= totalPaginasDocentesBackend) ? '0.5' : '1';
        btnSig.style.cursor = (paginaActualDocentes >= totalPaginasDocentesBackend) ? 'not-allowed' : 'pointer';
    }
}

// delega los clics de editar/eliminar de la tabla, generada dinamicamente
const tablaDocentesBody = document.getElementById('tablaDocentesBody');
if (tablaDocentesBody) {
    tablaDocentesBody.addEventListener('click', (e) => {
        const btnEditar = e.target.closest('.btn-editar-docente');
        if (btnEditar) {
            abrirEdicionDocente(parseInt(btnEditar.dataset.id, 10));
            return;
        }
        const btnEliminar = e.target.closest('.btn-eliminar-docente');
        if (btnEliminar) {
            eliminarDocente(parseInt(btnEliminar.dataset.id, 10));
        }
    });
}

// engancha buscador y botones de paginacion al cargar la pagina
document.addEventListener("DOMContentLoaded", () => {
    const buscadorDoc = document.getElementById('buscadorDocentes');
    if (buscadorDoc) {
        buscadorDoc.addEventListener('input', () => {
                clearTimeout(timeoutBusquedaDocentes);
            timeoutBusquedaDocentes = setTimeout(() => {
                cargarTablaDocentes(1);
            }, 400);
        });
    }

    const btnAntDoc = document.getElementById('btnPaginaAntDoc');
    if (btnAntDoc) {
        btnAntDoc.addEventListener('click', () => {
            if (paginaActualDocentes > 1) cargarTablaDocentes(paginaActualDocentes - 1);
        });
    }

    const btnSigDoc = document.getElementById('btnPaginaSigDoc');
    if (btnSigDoc) {
        btnSigDoc.addEventListener('click', () => {
            if (paginaActualDocentes < totalPaginasDocentesBackend) cargarTablaDocentes(paginaActualDocentes + 1);
        });
    }
});

// borra un docente tras confirmar en el modal
function eliminarDocente(id) {
    const docente = listaGlobalDocentes.find(d => d.id === id);
    const nombre = docente ? docente.nombre_completo : '';
    mostrarModalConfirmacion(`⚠️ ¿Eliminar al docente "${nombre}"? Ya no podrá iniciar sesión.`, async () => {
        try {
            const res = await apiFetch(`${API_BASE}/eliminar-docente/${id}`, { method: 'DELETE' });
            if (res.status === 401) return;
            const data = await res.json();
            if (data.success) {
                mostrarToast('🗑️ ' + data.mensaje, 'exito');
                cargarTablaDocentes();
            } else {
                mostrarToast('❌ Error: ' + (data.mensaje || 'No fue posible eliminar.'), 'error');
            }
        } catch (error) {
            mostrarToast('Ocurrió un error de conexión al intentar eliminar.', 'error');
            console.error(error);
        }
    });
}

// registra un docente nuevo con los datos del panel de admin
const btnCrearDocente = document.getElementById('btnCrearDocente');
const msgRegistroDocente = document.getElementById('msgRegistroDocente');

if (btnCrearDocente) {
    btnCrearDocente.addEventListener('click', () => {
        const nombre_completo = document.getElementById('nuevoDocenteNombre').value.trim();
        const usuario = document.getElementById('nuevoDocenteUsuario').value.trim();
        const password = document.getElementById('nuevoDocentePass').value.trim();

        if (!nombre_completo || !usuario) {
            msgRegistroDocente.style.color = 'red';
            msgRegistroDocente.textContent = '⚠️ Nombre y usuario son obligatorios.';
            return;
        }

        if (password.length < 8) {
            msgRegistroDocente.style.color = 'red';
            msgRegistroDocente.textContent = '⚠️ La contraseña debe tener al menos 8 caracteres.';
            return;
        }

        mostrarModalConfirmacion(`⚠️ ¿Registrar al docente "${nombre_completo}"?`, async () => {
            btnCrearDocente.disabled = true;
            try {
                const res = await apiFetch(`${API_BASE}/registrar-docente`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre_completo, usuario, password })
                });
                if (res.status === 401) return;
                const data = await res.json();
                if (data.success) {
                    msgRegistroDocente.style.color = 'green';
                    msgRegistroDocente.textContent = '✅ ' + data.mensaje;
                    document.getElementById('nuevoDocenteNombre').value = '';
                    document.getElementById('nuevoDocenteUsuario').value = '';
                    document.getElementById('nuevoDocentePass').value = '';
                } else {
                    msgRegistroDocente.style.color = 'red';
                    msgRegistroDocente.textContent = '❌ ' + (data.mensaje || 'No fue posible registrar.');
                }
            } catch (error) {
                msgRegistroDocente.style.color = 'red';
                msgRegistroDocente.textContent = '⚠️ Error de conexión con el servidor.';
                console.error(error);
            } finally {
                btnCrearDocente.disabled = false;
            }
        });
    });
}

const modalEditarDocente = document.getElementById('modalEditarDocente');
const btnCerrarEditarDocente = document.getElementById('btnCerrarEditarDocente');
const btnGuardarEditarDocente = document.getElementById('btnGuardarEditarDocente');
const msgEditarDocente = document.getElementById('msgEditarDocente');

// llena el modal de edicion con los datos del docente elegido
function abrirEdicionDocente(id) {
    const docente = listaGlobalDocentes.find(d => d.id === id);
    if (!docente) return;
    document.getElementById('editDocenteId').value = docente.id;
    document.getElementById('editDocenteNombre').value = docente.nombre_completo;
    document.getElementById('editDocenteUsuario').value = docente.usuario;
    document.getElementById('editDocentePass').value = '';
    msgEditarDocente.textContent = '';
    modalEditarDocente.classList.remove('hidden');
}

if (btnCerrarEditarDocente) {
    btnCerrarEditarDocente.addEventListener('click', () => modalEditarDocente.classList.add('hidden'));
}
if (modalEditarDocente) {
    modalEditarDocente.addEventListener('click', (e) => {
        if (e.target === modalEditarDocente) modalEditarDocente.classList.add('hidden');
    });
}

// guarda los cambios de edicion en el backend
if (btnGuardarEditarDocente) {
    btnGuardarEditarDocente.addEventListener('click', async () => {
        const id = document.getElementById('editDocenteId').value;
        const nombre_completo = document.getElementById('editDocenteNombre').value.trim();
        const usuario = document.getElementById('editDocenteUsuario').value.trim();
        const password = document.getElementById('editDocentePass').value.trim();

        if (!nombre_completo || !usuario) {
            msgEditarDocente.style.color = 'red';
            msgEditarDocente.textContent = '⚠️ Nombre y usuario son obligatorios.';
            return;
        }

        if (password && password.length < 8) {
            msgEditarDocente.style.color = 'red';
            msgEditarDocente.textContent = '⚠️ La contraseña debe tener al menos 8 caracteres.';
            return;
        }

        let mensajeConfirmacion = `¿Estás seguro de editar al docente "${nombre_completo}"?`;
        if (password) {
            mensajeConfirmacion += `\n\nSe actualizará la contraseña.`;
        }
        mostrarModalConfirmacion(`⚠️ ${mensajeConfirmacion}`, async () => {
            btnGuardarEditarDocente.disabled = true;
            try {
                const res = await apiFetch(`${API_BASE}/editar-docente/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nombre_completo, usuario, password })
                });
                if (res.status === 401) return;
                const data = await res.json();
                if (data.success) {
                    msgEditarDocente.style.color = 'green';
                    msgEditarDocente.textContent = '✅ ' + data.mensaje;
                    cargarTablaDocentes(paginaActualDocentes);
                    setTimeout(() => modalEditarDocente.classList.add('hidden'), 800);
                } else {
                    msgEditarDocente.style.color = 'red';
                    msgEditarDocente.textContent = '❌ ' + (data.mensaje || 'No fue posible guardar.');
                }
            } catch (error) {
                msgEditarDocente.style.color = 'red';
                msgEditarDocente.textContent = '⚠️ Error de conexión con el servidor.';
            } finally {
                btnGuardarEditarDocente.disabled = false;
            }
        });
    });
}