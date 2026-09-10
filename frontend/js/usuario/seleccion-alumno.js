import { API_BASE, apiFetch } from '../shared/api.js';
import { escapeHTML } from '../shared/dom.js';

const btnAbrirSeleccion = document.getElementById('btnAbrirSeleccion');
const btnBorrarSeleccion = document.getElementById('btnBorrarSeleccion');
const modalSeleccionAlumno = document.getElementById('modalSeleccionAlumno');
const buscadorSeleccion = document.getElementById('buscadorSeleccion');
const tablaSeleccionBody = document.getElementById('tablaSeleccionBody');

let timeoutBusquedaSimple = null;
let paginaBusquedaSimple = 1;
let cargandoMas = false;
let cacheAlumnosBusqueda = {};

if (btnAbrirSeleccion) {
    btnAbrirSeleccion.addEventListener('click', () => {
        modalSeleccionAlumno.classList.remove('hidden');
        buscadorSeleccion.value = ''; // Limpiar buscador al abrir
        paginaBusquedaSimple = 1; // Reiniciar página
        tablaSeleccionBody.innerHTML = ''; // Limpiar tabla
        buscarAlumnosSimple('', 1, false); // Traer los primeros 10
    });
}

if (btnBorrarSeleccion) {
    btnBorrarSeleccion.addEventListener('click', () => {
        ['usuarioAlumno', 'password_estudiante', 'nombre', 'correo', 'programa'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = '';
                el.readOnly = false;
                if (el.tagName === 'SELECT') {
                    el.style.pointerEvents = 'auto';
                }
                el.style.backgroundColor = '#fff';
                el.style.color = 'var(--text)';
                el.style.opacity = '1';
            }
        });

        const inputPass = document.getElementById('password_estudiante');
        if (inputPass) inputPass.required = true;

        const lblPass = document.getElementById('lbl_pass_est');
        if (lblPass) lblPass.textContent = 'Contraseña (AñoMesDía)';

        btnBorrarSeleccion.classList.add('hidden');
    });
}

if (buscadorSeleccion) {
    buscadorSeleccion.addEventListener('input', () => {
        clearTimeout(timeoutBusquedaSimple);
        timeoutBusquedaSimple = setTimeout(() => {
            paginaBusquedaSimple = 1;
            tablaSeleccionBody.innerHTML = '';
            buscarAlumnosSimple(buscadorSeleccion.value.trim(), 1, false);
        }, 300);
    });
}

async function buscarAlumnosSimple(textoBusqueda, page, esCargarMas) {
    if (!tablaSeleccionBody || cargandoMas) return;

    cargandoMas = true;

    const filaCargarMasAntigua = document.getElementById('fila-cargar-mas');
    if (filaCargarMasAntigua) filaCargarMasAntigua.remove();

    const idCarga = 'indicador-carga-' + Date.now();
    tablaSeleccionBody.innerHTML += `<tr id="${idCarga}"><td colspan="3" style="text-align:center; padding: 15px; color: #6b7280; font-style: italic;">Cargando estudiantes...</td></tr>`;

    try {
        const url = `${API_BASE}/buscar-alumnos-simple?search=${encodeURIComponent(textoBusqueda)}&page=${page}`;
        const response = await apiFetch(url, { cache: 'no-store' });

        document.getElementById(idCarga)?.remove();

        if (response.status === 401) return;
        const data = await response.json();

        if (!data.success || (data.estudiantes.length === 0 && page === 1)) {
            tablaSeleccionBody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #6b7280; font-weight: bold;">No se encontraron alumnos con esos datos.</td></tr>';
            cargandoMas = false;
            return;
        }

        data.estudiantes.forEach(est => {
            cacheAlumnosBusqueda[est.usuarioAlumno] = est;
            tablaSeleccionBody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px 8px; vertical-align: middle;">${escapeHTML(est.nombre)}</td>
                    <td style="padding: 10px 8px; vertical-align: middle; font-weight: 600;">${escapeHTML(est.usuarioAlumno)}</td>
                    <td style="padding: 10px 8px; text-align: center; vertical-align: middle;">
                        <button type="button" 
                            onclick="seleccionarAlumnoExistente('${est.usuarioAlumno}')" 
                            style="padding: 6px 12px; font-size: 0.85rem; font-weight: bold; background: #16a34a; color: white; border: none; border-radius: 6px; cursor: pointer; min-width: 100px; transition: background 0.2s;" 
                            onmouseover="this.style.background='#15803d'" 
                            onmouseout="this.style.background='#16a34a'">
                            Seleccionar
                        </button>
                    </td>
                </tr>
            `;
        });

        if (data.has_more) {
            tablaSeleccionBody.innerHTML += `
                <tr id="fila-cargar-mas">
                    <td colspan="3" style="text-align:center; padding: 15px;">
                        <button type="button" id="btn-cargar-mas" style="background: #f1f5f9; color: var(--primary); border: 1px solid var(--border); padding: 8px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">↓ Mostrar más alumnos ↓</button>
                    </td>
                </tr>
            `;
            document.getElementById('btn-cargar-mas').addEventListener('click', () => {
                paginaBusquedaSimple++;
                buscarAlumnosSimple(buscadorSeleccion.value.trim(), paginaBusquedaSimple, true);
            });
        } else {
            if (data.total > 0) {
                tablaSeleccionBody.innerHTML += `
                    <tr id="fila-cargar-mas">
                        <td colspan="3" style="text-align:center; padding: 15px; color: #9ca3af; font-size: 0.85rem; font-style: italic;">
                            Has llegado al final de la lista (${data.total} alumnos).
                        </td>
                    </tr>
                `;
            }
        }
    } catch (error) {
        document.getElementById(idCarga)?.remove();
        tablaSeleccionBody.innerHTML += '<tr><td colspan="3" style="text-align:center; padding: 15px; color: var(--error); font-weight: bold;">Error de conexión al buscar.</td></tr>';
    } finally {
        cargandoMas = false;
    }
}

window.seleccionarAlumnoExistente = function (control, nombre, correo, programa) {
    if (nombre === undefined) {
        const est = cacheAlumnosBusqueda[control];
        if (!est) return;
        nombre = est.nombre;
        correo = est.correo;
        programa = est.programa;
    }
    document.getElementById('usuarioAlumno').value = control;
    document.getElementById('nombre').value = nombre;
    document.getElementById('correo').value = correo;
    document.getElementById('programa').value = programa;

    const programaSelect = document.getElementById('programa');
    if (programaSelect) {
        programaSelect.dispatchEvent(new Event('change'));
    }

    const inputPass = document.getElementById('password_estudiante');
    if (inputPass) {
        inputPass.value = '';
        inputPass.required = false;
        inputPass.readOnly = true;
        inputPass.style.backgroundColor = '#e2e8f0';
        inputPass.style.color = '#475569';
        inputPass.style.opacity = '0.55';
    }

    const lblPass = document.getElementById('lbl_pass_est');
    if (lblPass) lblPass.textContent = 'Contraseña (AñoMesDía)';

    ['usuarioAlumno', 'nombre', 'correo', 'programa'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.readOnly = true;
            if (el.tagName === 'SELECT') {
                el.style.pointerEvents = 'none';
            }
            el.style.backgroundColor = '#e2e8f0';
            el.style.color = '#475569';
            el.style.opacity = '0.55';
        }
    });

    modalSeleccionAlumno.classList.add('hidden');
    btnBorrarSeleccion.classList.remove('hidden');
};

const modalAlumnoDuplicado = document.getElementById('modalAlumnoDuplicado');
const btnCerrarAlumnoDuplicado = document.getElementById('btnCerrarAlumnoDuplicado');
const btnDupCancelar = document.getElementById('btnDupCancelar');
const btnDupUsarDatos = document.getElementById('btnDupUsarDatos');

function ocultarModalAlumnoDuplicado() {
    if (modalAlumnoDuplicado) modalAlumnoDuplicado.classList.add('hidden');
}

// El número de control ya existe, así que se cancela y se limpia el formulario
function cancelarPorAlumnoDuplicado() {
    ['usuarioAlumno', 'password_estudiante', 'nombre', 'correo', 'programa'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    ocultarModalAlumnoDuplicado();
    inputUsuarioAlumno?.focus();
}

if (btnCerrarAlumnoDuplicado) btnCerrarAlumnoDuplicado.addEventListener('click', ocultarModalAlumnoDuplicado);
if (btnDupCancelar) btnDupCancelar.addEventListener('click', cancelarPorAlumnoDuplicado);

function mostrarModalAlumnoDuplicado(control, nombre, correo, programa) {
    if (!modalAlumnoDuplicado) return;

    document.getElementById('dupAlumnoNombre').textContent = nombre;
    document.getElementById('dupAlumnoControl').textContent = control;
    document.getElementById('dupAlumnoCorreo').textContent = correo || 'Sin correo registrado';
    document.getElementById('dupAlumnoPrograma').textContent = programa || 'Sin programa registrado';

    if (btnDupUsarDatos) {
        btnDupUsarDatos.onclick = () => {
            seleccionarAlumnoExistente(control, nombre, correo, programa);
            ocultarModalAlumnoDuplicado();
        };
    }

    modalAlumnoDuplicado.classList.remove('hidden');
}

const inputUsuarioAlumno = document.getElementById('usuarioAlumno');
if (inputUsuarioAlumno) {
    inputUsuarioAlumno.addEventListener('blur', async () => {
        const control = inputUsuarioAlumno.value.trim();
        if (!control || inputUsuarioAlumno.readOnly) return;

        try {
            const response = await apiFetch(`${API_BASE}/api/verificar-estudiante/${encodeURIComponent(control)}`, { cache: 'no-store' });
            if (response.status === 401) return;
            if (response.status === 404) return;

            const data = await response.json();
            if (!data.success) return;

            mostrarModalAlumnoDuplicado(control, data.nombre, data.correo, data.programa);
        } catch (error) {
        }
    });
}
