import { API_BASE, apiFetch } from '../shared/api.js';
import { escapeHTML } from '../shared/dom.js';
import { mostrarToast, mostrarModalConfirmacion } from '../shared/toast.js';

const vistaFormulario = document.getElementById('vista-formulario');
const vistaDocentes = document.getElementById('vista-docentes');
const btnVerDocentes = document.getElementById('btnVerDocentes');
const btnVolverDocentes = document.getElementById('btnVolverDocentes');

if (btnVerDocentes) {
    btnVerDocentes.addEventListener('click', () => {
        vistaFormulario.classList.add('hidden');
        vistaDocentes.classList.remove('hidden');
        cargarTablaDocentes(paginaActualDocentes);
    });
}
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
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td>${escapeHTML(d.nombre_completo)}</td>
                    <td>${escapeHTML(d.usuario)}</td>
                    <td style="display:flex; gap:5px;">
                        <button type="button" onclick="abrirEdicionDocente(${d.id})" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: none; cursor: pointer; background: #d97706; color: white;">Editar</button>
                        <button type="button" onclick="eliminarDocente(${d.id})" class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Eliminar</button>
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

window.eliminarDocente = function (id) {
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
};

const modalEditarDocente = document.getElementById('modalEditarDocente');
const btnCerrarEditarDocente = document.getElementById('btnCerrarEditarDocente');
const btnGuardarEditarDocente = document.getElementById('btnGuardarEditarDocente');
const msgEditarDocente = document.getElementById('msgEditarDocente');

window.abrirEdicionDocente = function (id) {
    const docente = listaGlobalDocentes.find(d => d.id === id);
    if (!docente) return;
    document.getElementById('editDocenteId').value = docente.id;
    document.getElementById('editDocenteNombre').value = docente.nombre_completo;
    document.getElementById('editDocenteUsuario').value = docente.usuario;
    document.getElementById('editDocentePass').value = '';
    msgEditarDocente.textContent = '';
    modalEditarDocente.classList.remove('hidden');
};

if (btnCerrarEditarDocente) {
    btnCerrarEditarDocente.addEventListener('click', () => modalEditarDocente.classList.add('hidden'));
}
if (modalEditarDocente) {
    modalEditarDocente.addEventListener('click', (e) => {
        if (e.target === modalEditarDocente) modalEditarDocente.classList.add('hidden');
    });
}

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
