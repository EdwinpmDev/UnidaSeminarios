const API_BASE = window.location.origin;
const AUTH = { token: null, user: null, get ok() { return !!this.token && !!this.user; } };

const vistaFormulario = document.getElementById('vista-formulario');
const vistaDirectorio = document.getElementById('vista-directorio');
const btnVerDirectorio = document.getElementById('btnVerDirectorio');
const btnVolverRegistro = document.getElementById('btnVolverRegistro');

// INTERCAMBIO DE PANTALLAS
if (btnVerDirectorio) {
    btnVerDirectorio.addEventListener('click', () => {
        vistaFormulario.classList.add('hidden');
        vistaDirectorio.classList.remove('hidden');
        cargarTablaEstudiantes();
    });
}

if (btnVolverRegistro) {
    btnVolverRegistro.addEventListener('click', () => {
        vistaDirectorio.classList.add('hidden');
        vistaFormulario.classList.remove('hidden');
    });
}

// DOM Elements - Login
const loginOverlay = document.getElementById('loginOverlay');
const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const btnDoLogin = document.getElementById('btnDoLogin');
const loginError = document.getElementById('loginError');

// DOM Elements - Form Steps
const fsPaso1 = document.getElementById('fsPaso1');
const fsPaso2 = document.getElementById('fsPaso2');
const btnSiguiente = document.getElementById('btnSiguientePaso');
const btnRegresar = document.getElementById('btnRegresarPaso');
const formSeminario = document.getElementById('formSeminario');

// DOM Elements - Admin Panel
const panelAdmin = document.getElementById('panelAdmin');
const btnCrearDocente = document.getElementById('btnCrearDocente');
const msgRegistro = document.getElementById('msgRegistroDocente');

// --- LOGIN LOGIC ---
// seleccionar alumno existente
const btnAbrirSeleccion = document.getElementById('btnAbrirSeleccion');
const btnBorrarSeleccion = document.getElementById('btnBorrarSeleccion');
const modalSeleccionAlumno = document.getElementById('modalSeleccionAlumno');
const buscadorSeleccion = document.getElementById('buscadorSeleccion');
const tablaSeleccionBody = document.getElementById('tablaSeleccionBody');

let timeoutBusquedaSimple = null;
let paginaBusquedaSimple = 1;
let cargandoMas = false;

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

// Función principal de búsqueda
async function buscarAlumnosSimple(textoBusqueda, page, esCargarMas) {
    if (!tablaSeleccionBody || cargandoMas) return;
    
    cargandoMas = true;
    
    // Remover botón anterior de "Cargar más" si existe
    const filaCargarMasAntigua = document.getElementById('fila-cargar-mas');
    if (filaCargarMasAntigua) filaCargarMasAntigua.remove();

    // Mostrar indicador de carga
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
        
        // Agregar las nuevas filas
        data.estudiantes.forEach(est => {
            tablaSeleccionBody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td>${est.nombre}</td>
                    <td>${est.usuarioAlumno}</td>
                    <td style="text-align: right;"><button type="button" onclick="seleccionarAlumnoExistente('${est.usuarioAlumno}', '${est.nombre.replace(/'/g, "\\'")}', '${est.correo}', '${est.programa}')" style="padding: 6px 12px; font-size: 0.85rem; font-weight: bold; background: var(--ok); color: white; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#15803d'" onmouseout="this.style.background='var(--ok)'">Seleccionar</button></td>
                </tr>
            `;
        });

        // Agregar fila indicadora de estatus
        if (data.has_more) {
            tablaSeleccionBody.innerHTML += `
                <tr id="fila-cargar-mas">
                    <td colspan="3" style="text-align:center; padding: 15px;">
                        <button type="button" id="btn-cargar-mas" style="background: #f1f5f9; color: var(--primary); border: 1px solid var(--border); padding: 8px 20px; border-radius: 20px; font-weight: bold; cursor: pointer; width: 100%; transition: all 0.2s;" onmouseover="this.style.background='#e2e8f0'" onmouseout="this.style.background='#f1f5f9'">↓ Mostrar más alumnos ↓</button>
                    </td>
                </tr>
            `;
            // Asignar evento al nuevo botón
            document.getElementById('btn-cargar-mas').addEventListener('click', () => {
                paginaBusquedaSimple++;
                buscarAlumnosSimple(buscadorSeleccion.value.trim(), paginaBusquedaSimple, true);
            });
        } else {
            // Si ya no hay más, mostrar un mensaje de final
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

window.seleccionarAlumnoExistente = function(control, nombre, correo, programa) {
    document.getElementById('usuarioAlumno').value = control;
    document.getElementById('nombre').value = nombre;
    document.getElementById('correo').value = correo;
    document.getElementById('programa').value = programa;
    
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

function showLogin(mensaje) {
    loginOverlay.classList.remove('hidden');
    if (mensaje) {
        loginError.textContent = mensaje;
        loginError.classList.remove('hidden');
    }
    loginUser.focus();
}
function hideLogin() { loginOverlay.classList.add('hidden'); }

async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    if (res.status === 401) {
        let mensaje = 'Tu sesión expiró o cambió de rol en otra pestaña. Vuelve a iniciar sesión.';
        try {
            const data = await res.clone().json();
            if (data && data.mensaje) mensaje = data.mensaje;
        } catch (e) {}
        if (panelAdmin) panelAdmin.classList.add('hidden');
        showLogin(mensaje);
    }
    return res;
}

btnDoLogin.addEventListener('click', async () => {
    loginError.textContent = ''; 
    loginError.classList.add('hidden');
    const user = loginUser.value.trim();
    const pass = loginPass.value.trim();
    
    if (!user || !pass) {
        loginError.textContent = 'Completa usuario y contraseña.';
        loginError.classList.remove('hidden');
        return;
    }
    btnDoLogin.disabled = true;
    try {
        const res = await fetch(`${API_BASE}/login`, {
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: user, password: pass })
        });
        const data = await res.json();
        
        if (!res.ok || !data.success) { 
            throw new Error(data.mensaje || 'No fue posible iniciar sesión.'); 
        }

        AUTH.token = "sesion_activa"; 
        AUTH.user = { name: data.usuario, isAdmin: data.is_admin };
        hideLogin();
        
        cargarTablaEstudiantes();
        if (panelAdmin) panelAdmin.classList.toggle('hidden', !data.is_admin);
    } catch (e) {
        loginError.textContent = e.message; 
        loginError.classList.remove('hidden');
    } finally {
        btnDoLogin.disabled = false;
    }
});


// --- LÓGICA DE GENERACIÓN DE CLAVE ----
function generarClaveAleatoria() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let clave = '';
    for (let i = 0; i < 8; i++) {
        clave += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    const inputClave = document.getElementById('clave_acceso');
    if (inputClave) {
        inputClave.value = clave;
    }
}

const btnGenerarClave = document.getElementById('btnGenerarClave');
if (btnGenerarClave) {
    btnGenerarClave.addEventListener('click', generarClaveAleatoria);
}

const btnLimpiarClave = document.getElementById('btnLimpiarClave');
if (btnLimpiarClave) {
    btnLimpiarClave.addEventListener('click', () => {
        document.getElementById('clave_acceso').value = '';
        document.getElementById('clave_acceso').focus();
    });
}

// --- LÓGICA DE LUGAR ---
const lugarSelect = document.getElementById('lugar_select');
const lugarVirtual = document.getElementById('lugar_virtual');
const lugarPersonalizado = document.getElementById('lugar_personalizado');

function actualizarCampoLugar() {
    const valor = lugarSelect.value;
    lugarVirtual.classList.add('hidden');
    lugarPersonalizado.classList.add('hidden');
    lugarVirtual.required = false;
    lugarPersonalizado.required = false;

    if (valor === 'Virtual') {
        lugarVirtual.classList.remove('hidden');
        lugarVirtual.required = true;
    } else if (valor === 'Personalizado') {
        lugarPersonalizado.classList.remove('hidden');
        lugarPersonalizado.required = true;
    }
}
if (lugarSelect) {
    lugarSelect.addEventListener('change', actualizarCampoLugar);
}

function obtenerValorLugar() {
    const valor = lugarSelect.value;
    if (valor === 'Virtual') return lugarVirtual.value.trim();
    if (valor === 'Personalizado') return lugarPersonalizado.value.trim();
    return valor;
}

// --- LÓGICA DE DURACIÓN ---
const duracionSelect = document.getElementById('duracion_select');
const duracionPersonalizada = document.getElementById('duracion_personalizada');

function actualizarCampoDuracion() {
    const valor = duracionSelect.value;
    if (valor === 'Personalizado') {
        duracionPersonalizada.classList.remove('hidden');
        duracionPersonalizada.required = true;
    } else {
        duracionPersonalizada.classList.add('hidden');
        duracionPersonalizada.required = false;
    }
}
if (duracionSelect) {
    duracionSelect.addEventListener('change', actualizarCampoDuracion);
}

function obtenerValorDuracion() {
    const valor = duracionSelect.value;
    if (valor === 'Personalizado') return duracionPersonalizada.value.trim();
    return valor;
}

// --- STEP CONTROL LOGIC ---
btnSiguiente.addEventListener('click', () => {
    const camposPaso1 = ['usuarioAlumno', 'password_estudiante', 'nombre', 'titulo', 'programa', 'correo'];
    for (const idCampo of camposPaso1) {
        const el = document.getElementById(idCampo);
        if (el && !el.checkValidity()) {
            el.reportValidity();
            return;
        }
    }

    const inputClave = document.getElementById('clave_acceso');
    if (inputClave && !inputClave.value) {
        generarClaveAleatoria();
    }

    fsPaso1.classList.add('hidden');
    fsPaso2.classList.remove('hidden');
    
    document.querySelectorAll('.steps .step').forEach((step, index) => {
        step.classList.toggle('active', index === 1);
    });
});

btnRegresar.addEventListener('click', () => {
    fsPaso2.classList.add('hidden');
    fsPaso1.classList.remove('hidden');
    
    document.querySelectorAll('.steps .step').forEach((step, index) => {
        step.classList.toggle('active', index === 0);
    });
});

// --- SUBMIT LOGIC ---
formSeminario.addEventListener('submit', async (e) => {
    e.preventDefault(); 

    if (!formSeminario.checkValidity()) {
        const invalidElement = formSeminario.querySelector(':invalid');
        if (invalidElement) {
            if (document.getElementById('fsPaso1').contains(invalidElement)) {
                document.getElementById('fsPaso2').classList.add('hidden');
                document.getElementById('fsPaso1').classList.remove('hidden');
                document.querySelectorAll('.steps .step').forEach((step, index) => {
                    step.classList.toggle('active', index === 0);
                });
            }

            let nombreCampo = "un campo requerido";
            const label = document.querySelector(`label[for="${invalidElement.id}"]`);
            if (label) {
                nombreCampo = label.textContent.replace(" (Opcional)", "").replace(" (Editable)", "");
            }

            setTimeout(() => {
                invalidElement.focus();
                formSeminario.reportValidity();
                
                if (invalidElement.value.trim() === '') {
                    alert(`⚠️ Falta completar: ${nombreCampo}`);
                } else {
                    alert(`⚠️ Revisa el formato de: ${nombreCampo}`);
                }
            }, 100);
        }
        return;
    }

    const lugarValor = obtenerValorLugar();
    const duracionValor = obtenerValorDuracion();

    if (!lugarValor) {
        alert('⚠️ Indica el enlace virtual o el aula personalizada.');
        return;
    }
    if (!duracionValor) {
        alert('⚠️ Indica la duración personalizada del seminario.');
        return;
    }

    const payload = {
        usuarioAlumno: document.getElementById('usuarioAlumno').value.trim(),
        password_estudiante: document.getElementById('password_estudiante').value.trim(),
        nombre: document.getElementById('nombre').value.trim(),
        correo: document.getElementById('correo').value.trim(),
        programa: document.getElementById('programa').value,
        proyecto: document.getElementById('titulo').value.trim(),
        clave_acceso: document.getElementById('clave_acceso') ? document.getElementById('clave_acceso').value.trim() : "",
        tipo_seminario: document.getElementById('tipo_seminario').value,
        modalidad: document.getElementById('modalidad').value,
        lugar: lugarValor,
        duracion: duracionValor,
        fecha: document.getElementById('fecha').value,
        hora: document.getElementById('hora').value,
        presidente: document.getElementById('presidente').value.trim(),
        secretario: document.getElementById('secretario').value.trim(),
        vocal: document.getElementById('vocal').value.trim(),
        observaciones: document.getElementById('observaciones').value.trim()
    };

    const btnGuardar = document.getElementById('btnGuardarFinal');
    btnGuardar.disabled = true;

    try {
        const req = await apiFetch(`${API_BASE}/registrar-estudiante`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        if (req.status === 401) return;

        const res = await req.json();
        if(res.success) {
            alert(
                `✅ Seminario agendado correctamente.\n\n` +
                `Clave general de acceso: ${res.clave_acceso || payload.clave_acceso}\n\n` +
                `Códigos individuales de posición (uno por cada evaluador):\n` +
                `  Presidente: ${res.clave_presidente}\n` +
                `  Secretario: ${res.clave_secretario}\n` +
                `  Vocal: ${res.clave_vocal}\n\n` +
                `Entrega cada código solo a la persona correspondiente. Puedes volver a verlos en cualquier momento desde el botón "Retroalimentación" de este alumno.`
            );
            formSeminario.reset();
            if (document.getElementById('clave_acceso')) {
                document.getElementById('clave_acceso').value = '';
            }
            actualizarCampoLugar();
            actualizarCampoDuracion();
            fsPaso2.classList.add('hidden');
            fsPaso1.classList.remove('hidden');
            document.querySelectorAll('.steps .step').forEach((step, index) => {
                step.classList.toggle('active', index === 0);
            });
            cargarTablaEstudiantes(); 
        } else {
            alert("❌ Error: " + (res.mensaje || res.error || 'No fue posible guardar.'));
        }
    } catch (error) {
        console.error("Error enviando al servidor:", error);
        alert("No fue posible guardar en la base de datos.");
    } finally {
        btnGuardar.disabled = false;
    }
});

// --- LÓGICA DE DIRECTORIO: BÚSQUEDA Y PAGINACIÓN BACKEND ---
let listaGlobalEstudiantes = [];
let paginaActual = 1;
let totalPaginasBackend = 1;
let estudianteSeleccionado = null; 
let timeoutBusquedaDirectorio = null;

const vistaDetallesEstudiante = document.getElementById('vista-detalles-estudiante');
const btnVolverDirectorio = document.getElementById('btnVolverDirectorio');

if(btnVolverDirectorio) {
    btnVolverDirectorio.addEventListener('click', () => {
        vistaDetallesEstudiante.classList.add('hidden');
        vistaDirectorio.classList.remove('hidden');
        cargarTablaEstudiantes(paginaActual);
    });
}

async function cargarTablaEstudiantes(pagina = 1) {
    paginaActual = pagina;
    const buscador = document.getElementById('buscadorAlumnos');
    const textoBusqueda = buscador ? buscador.value.trim() : '';

    const tbody = document.getElementById('tablaEstudiantesBody');
    if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #6b7280; font-style: italic;">Cargando directorio...</td></tr>';

    try {
        const url = `${API_BASE}/estudiantes?page=${paginaActual}&search=${encodeURIComponent(textoBusqueda)}`;
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
        if(tbody) tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: var(--error);">Error al cargar los datos.</td></tr>';
    }
}

function renderizarTablaAlumnos() {
    const tbody = document.getElementById('tablaEstudiantesBody');
    const btnAnt = document.getElementById('btnPaginaAnt');
    const btnSig = document.getElementById('btnPaginaSig');
    const textoPag = document.getElementById('textoPaginacion');

    if(!tbody) return;

    tbody.innerHTML = '';
    if (listaGlobalEstudiantes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #6b7280; font-weight: bold;">No se encontraron resultados.</td></tr>';
    } else {
        listaGlobalEstudiantes.forEach(est => {
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td>${est.nombre}</td>
                    <td><strong>${est.usuarioAlumno}</strong></td>
                    <td><span style="background: #e0e7ff; color: var(--primary); padding: 4px 10px; border-radius: 12px; font-weight: bold;">${est.seminarios_activos} registrados</span></td>
                    <td>
                        <button type="button" onclick="abrirDetallesEstudiante(${est.id_estudiante})" style="background: var(--primary); color: white; padding: 6px 12px; border: none; border-radius: 6px; cursor: pointer; font-weight: bold;">Abrir seminarios</button>
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
            // Retraso para no saturar al servidor al escribir rápido
            clearTimeout(timeoutBusquedaDirectorio);
            timeoutBusquedaDirectorio = setTimeout(() => {
                cargarTablaEstudiantes(1); 
            }, 400); 
        });
    }
    
    const btnAnt = document.getElementById('btnPaginaAnt');
    if (btnAnt) btnAnt.addEventListener('click', () => { 
        if (paginaActual > 1) cargarTablaEstudiantes(paginaActual - 1); 
    });
    
    const btnSig = document.getElementById('btnPaginaSig');
    if (btnSig) btnSig.addEventListener('click', () => { 
        if (paginaActual < totalPaginasBackend) cargarTablaEstudiantes(paginaActual + 1); 
    });
});

// ABRIR PANEL DE DETALLES DEL ESTUDIANTE
window.abrirDetallesEstudiante = function(id_estudiante) {
    estudianteSeleccionado = listaGlobalEstudiantes.find(e => e.id_estudiante === id_estudiante);
    if(!estudianteSeleccionado) return;

    vistaDirectorio.classList.add('hidden');
    vistaDetallesEstudiante.classList.remove('hidden');

    document.getElementById('detalles-nombre').textContent = estudianteSeleccionado.nombre;
    document.getElementById('detalles-control').textContent = "Control: " + estudianteSeleccionado.usuarioAlumno;

    const semsActivos = estudianteSeleccionado.seminarios.filter(s => !s.es_evaluado);
    const contenedorActivos = document.getElementById('contenedor-seminarios-activos');
    
    if (semsActivos.length === 0) {
        contenedorActivos.innerHTML = '<p style="color: #6b7280; font-style: italic;">No hay seminarios activos pendientes de evaluación.</p>';
    } else {
        contenedorActivos.innerHTML = semsActivos.map(sem => `
            <div style="border-left: 4px solid var(--accent); background: white; border-radius: 8px; padding: 15px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); border: 1px solid var(--border);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 10px;">
                    <h4 style="margin:0; color: var(--primary); font-size: 1.15rem;">${sem.proyecto}</h4>
                    <span style="font-size: 0.85rem; font-family: monospace; background: #e0e7ff; color: var(--primary); padding: 3px 8px; border-radius: 4px; font-weight: bold; flex-shrink:0;">Clave: ${sem.clave_acceso}</span>
                </div>
                <p style="margin: 0 0 10px 0; font-size: 0.9rem; color: #4b5563;"><strong>Fase:</strong> ${sem.tipo_seminario} &nbsp;|&nbsp; <strong>Fecha:</strong> ${sem.fecha} a las ${sem.hora}</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                    <button type="button" onclick="abrirEdicionAlumno(${sem.id_seminario})" style="background: #d97706; padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Editar Seminario</button>
                    <button type="button" onclick="verRetroalimentacion(${sem.id_seminario}, '${estudianteSeleccionado.nombre.replace(/'/g, "\\'")}')" style="background: var(--primary); padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Retroalimentación</button>
                    <button type="button" onclick="eliminarSeminario(${sem.id_seminario})" class="btn-danger" style="padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Eliminar Seminario</button>
                </div>
            </div>
        `).join('');
    }
};

// BOTONES DEL PANEL DE DETALLES
document.getElementById('btnEliminarAlumnoTotal').addEventListener('click', async () => {
    if(!estudianteSeleccionado) return;
    if (!confirm("⚠️ ADVERTENCIA CRÍTICA: ¿Estás seguro de eliminar a este alumno? Se borrarán TODOS sus seminarios y calificaciones de forma permanente.")) return;
    
    try {
        const req = await apiFetch(`${API_BASE}/eliminar-estudiante/${estudianteSeleccionado.id_estudiante}`, { method: 'DELETE' });
        if (req.status === 401) return;
        const res = await req.json();
        if (res.success) {
            alert("🗑️ " + res.mensaje);
            document.getElementById('btnVolverDirectorio').click(); 
        } else {
            alert("❌ Error: " + res.mensaje);
        }
    } catch(e) { alert("Error de conexión"); }
});

window.eliminarSeminario = async function(id_seminario) {
    if (!confirm("⚠️ ¿Deseas eliminar únicamente este seminario?")) return;
    try {
        const req = await apiFetch(`${API_BASE}/eliminar-seminario/${id_seminario}`, { method: 'DELETE' });
        if (req.status === 401) return;
        const res = await req.json();
        if (res.success) {
            alert("🗑️ " + res.mensaje);
            await cargarTablaEstudiantes();
            abrirDetallesEstudiante(estudianteSeleccionado.id_estudiante); 
        } else {
            alert("❌ Error: " + res.mensaje);
        }
    } catch(e) { alert("Error de conexión"); }
};

// MODAL: HISTORIAL DE SEMINARIOS EVALUADOS
document.getElementById('btnHistorialSeminarios').addEventListener('click', () => {
    const semsEvaluados = estudianteSeleccionado.seminarios.filter(s => s.es_evaluado);
    const contenedor = document.getElementById('contenedor-historial-seminarios');
    
    if(semsEvaluados.length === 0) {
        contenedor.innerHTML = '<p style="color: #6b7280; text-align: center;">No hay seminarios evaluados aún.</p>';
    } else {
        contenedor.innerHTML = semsEvaluados.map((sem) => `
            <div style="border: 1px solid var(--border); border-radius: 8px; margin-bottom: 10px;">
                <div style="padding: 12px; background: #f8fafc; cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="document.getElementById('hist-${sem.id_seminario}').classList.toggle('hidden')">
                    <div style="flex:1;">
                        <span style="font-size: 0.8rem; background: var(--ok); color: white; padding: 2px 6px; border-radius: 4px; font-weight: bold; margin-bottom: 4px; display: inline-block;">${sem.fecha}</span>
                        <h4 style="margin: 0; color: var(--primary); font-size: 1.05rem;">${sem.tipo_seminario} - ${sem.calificacion}</h4>
                    </div>
                    <span style="font-size: 1.2rem; color: var(--primary);">▼</span>
                </div>
                <div id="hist-${sem.id_seminario}" class="hidden" style="padding: 15px; border-top: 1px solid var(--border);">
                    <p style="margin: 0 0 8px 0;"><strong>Proyecto:</strong> ${sem.proyecto}</p>
                    <p style="margin: 0 0 8px 0;"><strong>Lugar:</strong> ${sem.lugar} (${sem.modalidad})</p>
                    <button type="button" onclick="verRetroalimentacion(${sem.id_seminario}, '${estudianteSeleccionado.nombre.replace(/'/g, "\\'")}')" style="background: var(--primary); padding: 6px 12px; font-size: 0.85rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Ver Calificaciones y Retroalimentación</button>
                </div>
            </div>
        `).join('');
    }
    document.getElementById('modalHistorial').classList.remove('hidden');
});

document.getElementById('btnCerrarHistorial').addEventListener('click', () => document.getElementById('modalHistorial').classList.add('hidden'));


// --- LÓGICA PARA OPCIONES DE SEMINARIO DINÁMICAS ---
const programaSelect = document.getElementById('programa');
const tipoSeminarioSelect = document.getElementById('tipo_seminario');

if (programaSelect && tipoSeminarioSelect) {
    programaSelect.addEventListener('change', (e) => {
        const programaElegido = e.target.value;
        tipoSeminarioSelect.innerHTML = '';

        let opciones = [];
        
        if (programaElegido === 'Maestría') {
            opciones = [
                "1.- Prototipo", 
                "2.- Tutorial", 
                "3.- Culminacion"
            ];
        } else if (programaElegido === 'Doctorado') {
            opciones = [
                "1.- Prototipo", 
                "2.- Tutorial", 
                "3.- Avance 1", 
                "4.- Predoctoral", 
                "5.- Tutorial", 
                "6.- Avance 2", 
                "7.- Tutorial", 
                "8.- Culminacion"
            ];
        }

        opciones.forEach(op => {
            const optionElement = document.createElement('option');
            optionElement.value = op;
            optionElement.textContent = op;
            tipoSeminarioSelect.appendChild(optionElement);
        });
    });
}


// MODAL: EDITAR SOLO ESTUDIANTE
document.getElementById('btnEditarSoloAlumno').addEventListener('click', () => {
    document.getElementById('editSoloEstudianteId').value = estudianteSeleccionado.id_estudiante;
    document.getElementById('edit_solo_usuarioAlumno').value = estudianteSeleccionado.usuarioAlumno;
    document.getElementById('edit_solo_nombre').value = estudianteSeleccionado.nombre;
    document.getElementById('edit_solo_correo').value = estudianteSeleccionado.correo;
    document.getElementById('edit_solo_programa').value = estudianteSeleccionado.programa;
    document.getElementById('edit_solo_password').value = '';
    document.getElementById('modalEditarSoloEstudiante').classList.remove('hidden');
});

document.getElementById('btnCerrarEditarSoloEstudiante').addEventListener('click', () => document.getElementById('modalEditarSoloEstudiante').classList.add('hidden'));

document.getElementById('btnGuardarSoloEstudiante').addEventListener('click', async () => {
    const camposObligatorios = ['edit_solo_usuarioAlumno', 'edit_solo_nombre'];
        for (const idCampo of camposObligatorios) {
            const el = document.getElementById(idCampo);
            if (el && !el.checkValidity()) {
                el.reportValidity(); // Esto mostrará el globito rojo de error nativo
                return;
            }
        }

    const payload = {
        usuarioAlumno: document.getElementById('edit_solo_usuarioAlumno').value.trim(),
        nombre: document.getElementById('edit_solo_nombre').value.trim(),
        correo: document.getElementById('edit_solo_correo').value.trim(),
        programa: document.getElementById('edit_solo_programa').value,
        password_estudiante: document.getElementById('edit_solo_password').value.trim(),
    };

    if(!payload.usuarioAlumno || !payload.nombre) {
        alert("Control y nombre son obligatorios."); return;
    }

    try {
        const req = await apiFetch(`${API_BASE}/estudiante/${estudianteSeleccionado.id_estudiante}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (req.status === 401) return;
        const res = await req.json();
        
        if(res.success) {
            alert("✅ " + res.mensaje);
            document.getElementById('modalEditarSoloEstudiante').classList.add('hidden');
            
            // 1. Recargamos la tabla global desde el servidor
            await cargarTablaEstudiantes();
            
            // 2. Buscamos al estudiante con sus datos actualizados usando el control que acabamos de enviar
            const estudianteActualizado = listaGlobalEstudiantes.find(e => e.usuarioAlumno === payload.usuarioAlumno);
            
            // 3. Volvemos a inyectar la información en el panel de detalles
            if (estudianteActualizado) {
                abrirDetallesEstudiante(estudianteActualizado.id_estudiante); 
            } else {
                document.getElementById('btnVolverDirectorio').click();
            }
        } else {
            alert("❌ Error: " + res.mensaje);
        }
    } catch(e) { alert("Error de conexión."); }
});

// --- MODAL DE RETROALIMENTACIÓN ----
const modalRetro = document.getElementById('modalRetro');
const retroContenido = document.getElementById('retroContenido');
const retroTitulo = document.getElementById('retroTitulo');
const btnCerrarRetro = document.getElementById('btnCerrarRetro');

window.verRetroalimentacion = async function(idSeminario, nombreEstudiante) {
    retroTitulo.textContent = `Retroalimentación — ${nombreEstudiante}`;
    retroContenido.innerHTML = 'Cargando...';
    modalRetro.classList.remove('hidden');

    try {
        const res = await apiFetch(`${API_BASE}/retroalimentacion/${idSeminario}`);
        if (res.status === 401) { modalRetro.classList.add('hidden'); return; }

        const data = await res.json();
        if (!data.success) {
            retroContenido.innerHTML = `<p style="color:#dc2626;">${data.mensaje || 'No fue posible cargar la retroalimentación.'}</p>`;
            return;
        }

        const codigosBloque = `
            <div style="background:#f8fafc; border:1px solid var(--border); border-radius:8px; padding:10px 12px; margin-bottom:14px; font-size:0.85rem;">
                <strong>Clave general:</strong> <span style="font-family:monospace;">${data.clave_acceso}</span><br>
                <strong>Códigos de posición pendientes:</strong>
                <ul style="margin: 6px 0 0 18px;">
                    ${["Presidente", "Secretario", "Vocal"].map(rol => {
                        const info = data.codigos_posicion[rol];
                        return info.codigo
                            ? `<li style="margin-bottom:4px;"><strong>${rol} (${info.nombre}):</strong> <span style="font-family:monospace; color: var(--primary); font-weight:bold; font-size: 1.05rem; background: #e0e7ff; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">${info.codigo}</span></li>`
                            : `<li style="margin-bottom:4px;"><strong>${rol} (${info.nombre}):</strong> ✅ ya evaluó</li>`;
                    }).join('')}
                </ul>
            </div>
        `;

        // APARTADO DE OBSERVACIONES
        const observacionesHTML = data.observaciones ? `
            <div style="margin-bottom: 15px; background: #fffbe0; border-left: 4px solid #f59e0b; padding: 10px; border-radius: 6px;">
                <strong style="color: #b45309; font-size: 0.9rem;">📝 Observaciones del registro:</strong>
                <div class="texto-scroll" style="margin-top: 6px; font-size: 0.9rem; color: #78350f;">${data.observaciones}</div>
            </div>
        ` : '';

        if (!data.evaluaciones.length) {
            retroContenido.innerHTML = codigosBloque + observacionesHTML + '<p>Todavía nadie ha evaluado este seminario.</p>';
            return;
        }

        retroContenido.innerHTML = codigosBloque + observacionesHTML + data.evaluaciones.map(ev => `
            <div style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                <div style="display:flex; justify-content: space-between; font-weight: bold;">
                    <span>${ev.rol} — ${ev.nombre || 'Sin nombre'}</span>
                    <span style="color: var(--primary);">${ev.calificacion} / 100</span>
                </div>
                <p class="texto-scroll" style="margin-top: 6px; color: #374151;">${ev.comentarios || 'Sin comentarios.'}</p>
            </div>
        `).join('');
    } catch (error) {
        retroContenido.innerHTML = '<p style="color:#dc2626;">Error de conexión al cargar la retroalimentación.</p>';
        console.error(error);
    }
};

if (btnCerrarRetro) {
    btnCerrarRetro.addEventListener('click', () => modalRetro.classList.add('hidden'));
}
if (modalRetro) {
    modalRetro.addEventListener('click', (e) => {
        if (e.target === modalRetro) modalRetro.classList.add('hidden');
    });
}

// --- INIT ---
document.addEventListener("DOMContentLoaded", async () => {
    actualizarCampoLugar();
    actualizarCampoDuracion();

    // BLOQUEO DE FECHAS EN EL PASADO
    const hoy = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    const hoyFormato = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, '0') + "-" + String(hoy.getDate()).padStart(2, '0');
    const inputFecha = document.getElementById('fecha');
    const editFecha = document.getElementById('edit_fecha');
    if (inputFecha) inputFecha.setAttribute('min', hoyFormato);
    if (editFecha) editFecha.setAttribute('min', hoyFormato);

    // GENERAR AÑOS DINÁMICAMENTE PARA EL FILTRO DE AGENDA
    const selectAnioAgenda = document.getElementById('filtroAnioAgenda');
    const selectMesAgenda = document.getElementById('filtroMesAgenda');
    if (selectAnioAgenda) {
        const anioActual = hoy.getFullYear();
        for (let i = 0; i <= 4; i++) { // Genera el año actual + 4 años a futuro
            const anio = anioActual + i;
            const opcion = document.createElement('option');
            opcion.value = anio;
            opcion.textContent = anio;
            selectAnioAgenda.appendChild(opcion);
        }
    //Seleccionar mes y año actual automáticamente al cargar
    const mesActual = String(hoy.getMonth() + 1).padStart(2, '0');
    if (selectMesAgenda) selectMesAgenda.value = mesActual;
    selectAnioAgenda.value = anioActual;
    }

    try {
        const res = await fetch(`${API_BASE}/verificar-sesion`);
        const data = await res.json();

        if (data.logueado) {
            AUTH.token = "sesion_activa";
            AUTH.user = { name: data.usuario, isAdmin: data.is_admin };
            hideLogin();
            cargarTablaEstudiantes();
            if (panelAdmin) panelAdmin.classList.toggle('hidden', !data.is_admin);
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
});

// --- LÓGICA DE CIERRE DE SESIÓN ----
const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        window.location.href = '/logout';
    });
}


// --- DIRECTORIO DE DOCENTES (solo admin) ---
const vistaDocentes = document.getElementById('vista-docentes');
const btnVerDocentes = document.getElementById('btnVerDocentes');
const btnVolverDocentes = document.getElementById('btnVolverDocentes');
const tablaDocentesBody = document.getElementById('tablaDocentesBody');

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

// --- LÓGICA DE DIRECTORIO DOCENTES: BÚSQUEDA Y PAGINACIÓN BACKEND ---
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
    if(tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #6b7280; font-style: italic;">Cargando docentes...</td></tr>';

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
        if(tbody) tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color: var(--error); padding: 20px; font-weight: bold;">Error de conexión al cargar los docentes.</td></tr>';
        console.error(error);
    }
}

function renderizarTablaDocentes() {
    const tbody = document.getElementById('tablaDocentesBody');
    const btnAnt = document.getElementById('btnPaginaAntDoc');
    const btnSig = document.getElementById('btnPaginaSigDoc');
    const textoPag = document.getElementById('textoPaginacionDoc');

    if(!tbody) return;

    tbody.innerHTML = '';
    if (listaGlobalDocentes.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding: 20px; color: #6b7280; font-weight: bold;">No se encontraron docentes.</td></tr>';
    } else {
        listaGlobalDocentes.forEach(d => {
            tbody.innerHTML += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td>${d.nombre_completo}</td>
                    <td>${d.usuario}</td>
                    <td style="display:flex; gap:5px;">
                        <button type="button" onclick="abrirEdicionDocente(${d.id}, '${d.nombre_completo.replace(/'/g, "\\'")}', '${d.usuario.replace(/'/g, "\\'")}')" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: none; cursor: pointer; background: #d97706; color: white;">Editar</button>
                        <button type="button" onclick="eliminarDocente(${d.id}, '${d.nombre_completo.replace(/'/g, "\\'")}')" class="btn-danger" style="padding: 4px 8px; font-size: 0.8rem; border-radius: 4px; border: none; cursor: pointer; color: white;">Eliminar</button>
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
            // Retraso de 400ms para evitar múltiples peticiones
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

window.eliminarDocente = async function(id, nombre) {
    if (!confirm(`⚠️ ¿Eliminar al docente "${nombre}"? Ya no podrá iniciar sesión.`)) return;
    try {
        const res = await apiFetch(`${API_BASE}/eliminar-docente/${id}`, { method: 'DELETE' });
        if (res.status === 401) return;
        const data = await res.json();
        if (data.success) {
            alert('🗑️ ' + data.mensaje);
            cargarTablaDocentes();
        } else {
            alert('❌ Error: ' + (data.mensaje || 'No fue posible eliminar.'));
        }
    } catch (error) {
        alert('Ocurrió un error de conexión al intentar eliminar.');
        console.error(error);
    }
};

// ----- MODAL DE EDICION DE DOCENTE ----
const modalEditarDocente = document.getElementById('modalEditarDocente');
const btnCerrarEditarDocente = document.getElementById('btnCerrarEditarDocente');
const btnGuardarEditarDocente = document.getElementById('btnGuardarEditarDocente');
const msgEditarDocente = document.getElementById('msgEditarDocente');

window.abrirEdicionDocente = function(id, nombre, usuario) {
    document.getElementById('editDocenteId').value = id;
    document.getElementById('editDocenteNombre').value = nombre;
    document.getElementById('editDocenteUsuario').value = usuario;
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
}

// ---- ALUMNO Y SEMINARIO ----
const modalEditarAlumno = document.getElementById('modalEditarAlumno');
const btnCerrarEditarAlumno = document.getElementById('btnCerrarEditarAlumno');
const btnGuardarEditarAlumno = document.getElementById('btnGuardarEditarAlumno');
const msgEditarAlumno = document.getElementById('msgEditarAlumno');

const editLugarSelect = document.getElementById('edit_lugar_select');
const editLugarVirtual = document.getElementById('edit_lugar_virtual');
const editLugarPersonalizado = document.getElementById('edit_lugar_personalizado');

function actualizarEditCampoLugar() {
    const valor = editLugarSelect.value;
    editLugarVirtual.classList.add('hidden');
    editLugarPersonalizado.classList.add('hidden');
    editLugarVirtual.required = false;
    editLugarPersonalizado.required = false;
    if (valor === 'Virtual') {
        editLugarVirtual.classList.remove('hidden');
        editLugarVirtual.required = true;
    } else if (valor === 'Personalizado') {
        editLugarPersonalizado.classList.remove('hidden');
        editLugarPersonalizado.required = true;
    }
}
if (editLugarSelect) editLugarSelect.addEventListener('change', actualizarEditCampoLugar);

function obtenerEditValorLugar() {
    const valor = editLugarSelect.value;
    if (valor === 'Virtual') return editLugarVirtual.value.trim();
    if (valor === 'Personalizado') return editLugarPersonalizado.value.trim();
    return valor;
}

const editDuracionSelect = document.getElementById('edit_duracion_select');
const editDuracionPersonalizada = document.getElementById('edit_duracion_personalizada');

function actualizarEditCampoDuracion() {
    const valor = editDuracionSelect.value;
    if (valor === 'Personalizado') {
        editDuracionPersonalizada.classList.remove('hidden');
        editDuracionPersonalizada.required = true;
    } else {
        editDuracionPersonalizada.classList.add('hidden');
        editDuracionPersonalizada.required = false;
    }
}
if (editDuracionSelect) editDuracionSelect.addEventListener('change', actualizarEditCampoDuracion);

function obtenerEditValorDuracion() {
    const valor = editDuracionSelect.value;
    if (valor === 'Personalizado') return editDuracionPersonalizada.value.trim();
    return valor;
}

function precargarCampoLugar(valorGuardado, modalidadGuardada) {
    const opcionesFijas = ['Raúl Limón', 'Fermín Carrillo'];
    if (opcionesFijas.includes(valorGuardado)) {
        editLugarSelect.value = valorGuardado;
    } else if (modalidadGuardada === 'Virtual') {
        editLugarSelect.value = 'Virtual';
        editLugarVirtual.value = valorGuardado;
    } else {
        editLugarSelect.value = 'Personalizado';
        editLugarPersonalizado.value = valorGuardado;
    }
}

function precargarCampoDuracion(valorGuardado) {
    const opcionesFijas = ['30 min', '40 min', '60 min'];
    if (opcionesFijas.includes(valorGuardado)) {
        editDuracionSelect.value = valorGuardado;
    } else {
        editDuracionSelect.value = 'Personalizado';
        editDuracionPersonalizada.value = valorGuardado;
    }
}

window.abrirEdicionAlumno = async function(idSeminario) {
    msgEditarAlumno.textContent = '';
    modalEditarAlumno.classList.remove('hidden');
    try {
        const res = await apiFetch(`${API_BASE}/seminario/${idSeminario}`, { cache: 'no-store' });
        if (res.status === 401) { modalEditarAlumno.classList.add('hidden'); return; }
        const data = await res.json();
        if (!data.success) {
            msgEditarAlumno.style.color = 'red';
            msgEditarAlumno.textContent = '❌ ' + (data.mensaje || 'No fue posible cargar la información.');
            return;
        }
        const d = data.datos;
        document.getElementById('editSeminarioId').value = d.id_seminario;
        document.getElementById('edit_id_estudiante').value = d.id_estudiante; 
        
        // Carga exclusiva de datos del seminario (ya no buscamos los del alumno aquí)
        document.getElementById('edit_titulo').value = d.proyecto;
        document.getElementById('edit_tipo_seminario').value = d.tipo_seminario;
        document.getElementById('edit_modalidad').value = d.modalidad || 'Presencial';
        document.getElementById('edit_fecha').value = d.fecha;
        document.getElementById('edit_hora').value = d.hora;
        document.getElementById('edit_presidente').value = d.presidente;
        document.getElementById('edit_secretario').value = d.secretario;
        document.getElementById('edit_vocal').value = d.vocal;
        document.getElementById('edit_observaciones').value = d.observaciones || '';

        precargarCampoLugar(d.lugar, d.modalidad);
        actualizarEditCampoLugar();

        precargarCampoDuracion(d.duracion);
        actualizarEditCampoDuracion();
    } catch (error) {
        msgEditarAlumno.style.color = 'red';
        msgEditarAlumno.textContent = '⚠️ Error de conexión con el servidor.';
        console.error(error);
    }
};

if (btnCerrarEditarAlumno) {
    btnCerrarEditarAlumno.addEventListener('click', () => modalEditarAlumno.classList.add('hidden'));
}
if (modalEditarAlumno) {
    modalEditarAlumno.addEventListener('click', (e) => {
        if (e.target === modalEditarAlumno) modalEditarAlumno.classList.add('hidden');
    });
}



if (btnGuardarEditarAlumno) {
    btnGuardarEditarAlumno.addEventListener('click', async () => {
        const camposObligatorios = [
            'edit_titulo', 'edit_fecha', 'edit_hora', 'edit_presidente', 'edit_secretario', 'edit_vocal'
        ];
        for (const idCampo of camposObligatorios) {
            const el = document.getElementById(idCampo);
            if (el && !el.checkValidity()) {
                el.reportValidity();
                return;
            }
        }

        const lugarValor = obtenerEditValorLugar();
        const duracionValor = obtenerEditValorDuracion();
        if (!lugarValor) { alert('Indica el enlace virtual o el aula personalizada.'); return; }
        if (!duracionValor) { alert('Indica la duración personalizada del seminario.'); return; }

        const idSeminario = document.getElementById('editSeminarioId').value;
        const payload = {
            proyecto: document.getElementById('edit_titulo').value.trim(),
            tipo_seminario: document.getElementById('edit_tipo_seminario').value,
            modalidad: document.getElementById('edit_modalidad').value,
            lugar: lugarValor,
            duracion: duracionValor,
            fecha: document.getElementById('edit_fecha').value,
            hora: document.getElementById('edit_hora').value,
            presidente: document.getElementById('edit_presidente').value.trim(),
            secretario: document.getElementById('edit_secretario').value.trim(),
            vocal: document.getElementById('edit_vocal').value.trim(),
            observaciones: document.getElementById('edit_observaciones').value.trim()
        };

        btnGuardarEditarAlumno.disabled = true;
        try {
            const res = await apiFetch(`${API_BASE}/seminario/${idSeminario}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.status === 401) return;
            const data = await res.json();
            
            if (data.success) {
                msgEditarAlumno.style.color = 'green';
                msgEditarAlumno.textContent = '✅ ' + data.mensaje;
                
                // Recargar información en la interfaz
                await cargarTablaEstudiantes();

                // Detectar qué vista está activa para saber qué recargar
                const vistaAgenda = document.getElementById('vista-agenda');
                if (!vistaAgenda.classList.contains('hidden')) {
                    // Si estamos en la agenda, recargamos la agenda
                    renderizarAgenda();
                } else {
                    const estudianteId = parseInt(document.getElementById('edit_id_estudiante').value);
                    const estudianteActualizado = listaGlobalEstudiantes.find(e => e.id_estudiante === estudianteId);
                    if (estudianteActualizado) {
                        abrirDetallesEstudiante(estudianteActualizado.id_estudiante);
                    }
                }

                setTimeout(() => modalEditarAlumno.classList.add('hidden'), 800);
            } else {
                msgEditarAlumno.style.color = 'red';
                msgEditarAlumno.textContent = '❌ ' + (data.mensaje || data.error || 'No fue posible guardar.');
            }
        } catch (error) {
            msgEditarAlumno.style.color = 'red';
            msgEditarAlumno.textContent = '⚠️ Error de conexión con el servidor.';
            console.error(error);
        } finally {
            btnGuardarEditarAlumno.disabled = false;
        }
    });
}

if (btnCrearDocente) {
    btnCrearDocente.addEventListener('click', async () => {
        const nombre = document.getElementById('nuevoDocenteNombre').value.trim();
        const usuario = document.getElementById('nuevoDocenteUsuario').value.trim();
        const password = document.getElementById('nuevoDocentePass').value.trim();

        if (!nombre || !usuario || !password) {
            msgRegistro.style.color = "red";
            msgRegistro.textContent = "⚠️ Todos los campos son obligatorios.";
            return;
        }

        btnCrearDocente.disabled = true;
        btnCrearDocente.textContent = "Registrando...";

        try {
            const response = await apiFetch(`${API_BASE}/registrar-docente`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nombre_completo: nombre, usuario: usuario, password: password })
            });
            if (response.status === 401) return; 

            const data = await response.json();

            if (data.success) {
                msgRegistro.style.color = "green";
                msgRegistro.textContent = "✅ " + data.mensaje;
                document.getElementById('nuevoDocenteNombre').value = '';
                document.getElementById('nuevoDocenteUsuario').value = '';
                document.getElementById('nuevoDocentePass').value = '';
            } else {
                msgRegistro.style.color = "red";
                msgRegistro.textContent = "❌ " + data.mensaje;
            }
        } catch (error) {
            msgRegistro.style.color = "red";
            msgRegistro.textContent = "⚠️ Error de conexión con el servidor.";
        } finally {
            btnCrearDocente.disabled = false;
            btnCrearDocente.textContent = "Registrar Docente";
        }
    });

    // --- LÓGICA DE LA AGENDA (CALENDARIO) ---
    const vistaAgenda = document.getElementById('vista-agenda');
    const btnVerAgenda = document.getElementById('btnVerAgenda');
    const btnVolverRegistroDesdeAgenda = document.getElementById('btnVolverRegistroDesdeAgenda');
    const modalDetallesAgenda = document.getElementById('modalDetallesAgenda');
    const btnCerrarDetallesAgenda = document.getElementById('btnCerrarDetallesAgenda');
    const filtroMesAgenda = document.getElementById('filtroMesAgenda');
    const filtroAnioAgenda = document.getElementById('filtroAnioAgenda');

    // Control de vistas
    if (btnVerAgenda) {
        btnVerAgenda.addEventListener('click', async() => {
            vistaFormulario.classList.add('hidden');
            if (vistaDirectorio) vistaDirectorio.classList.add('hidden');
            if (vistaDocentes) vistaDocentes.classList.add('hidden');
            vistaAgenda.classList.remove('hidden');
            // Al abrir la agenda por primera vez, carga la página 1
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

    let paginaAgendaActual = 1;
    let cargandoAgenda = false;
    let eventosAgendaEnMemoria = []; 

    // Función principal para cargar la agenda
    async function cargarAgendaBackend(page = 1, esCargarMas = false) {
        const contenedor = document.getElementById('contenedorAgenda');
        if (!contenedor || cargandoAgenda) return;
        
        cargandoAgenda = true;
        paginaAgendaActual = page;

        const mesFiltro = filtroMesAgenda ? filtroMesAgenda.value : 'todos';
        const anioFiltro = filtroAnioAgenda ? filtroAnioAgenda.value : 'todos';

        if (!esCargarMas) {
            contenedor.innerHTML = '';
            eventosAgendaEnMemoria = [];
        }

        const botonAnterior = document.getElementById('btn-cargar-mas-agenda');
        if (botonAnterior) botonAnterior.remove();

        const idCarga = 'indicador-carga-agenda-' + Date.now();
        contenedor.innerHTML += `<div id="${idCarga}" style="text-align: center; color: #6b7280; padding: 20px; font-style: italic;">Consultando agenda...</div>`;

        try {
            const url = `${API_BASE}/agenda-paginada?mes=${mesFiltro}&anio=${anioFiltro}&page=${page}`;
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

            // Renderizar las tarjetas
            let html = '';
            data.eventos.forEach(ev => {
                html += `
                <div style="border-left: 5px solid var(--accent); background: #f8fafc; border-radius: 8px; padding: 18px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); cursor: pointer; transition: transform 0.2s;" 
                    onclick="verDetallesAgenda(${ev.id_seminario})" 
                    onmouseover="this.style.transform='translateX(8px)'" 
                    onmouseout="this.style.transform='translateX(0)'">
                    
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                        <strong style="color: var(--primary-dark); font-size: 1.1rem;">📅 ${ev.fecha_bonita} - ${ev.hora} hrs</strong>
                        <span style="background: #e0e7ff; color: var(--primary); padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; font-weight: bold;">${ev.modalidad}</span>
                    </div>
                    
                    <div style="font-size: 1.05rem; font-weight: bold; margin-bottom: 4px;">🎓 ${ev.nombre_estudiante}</div>
                    <div style="color: #4b5563; font-size: 0.95rem;"><strong>Programa:</strong> ${ev.programa} | <strong>Tipo:</strong> ${ev.tipo_seminario} | <strong>Lugar:</strong> ${ev.lugar}</div>
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

    // Modal de Detalles
    window.verDetallesAgenda = function(idSeminario) {
        const ev = eventosAgendaEnMemoria.find(e => e.id_seminario === idSeminario);
        if(!ev) return;
        
        const contenido = document.getElementById('contenidoDetallesAgenda');
        
        contenido.innerHTML = `
            <p style="margin-bottom: 8px;"><strong>🎓 Alumno:</strong> ${ev.nombre_estudiante}</p>
            <p style="margin-bottom: 8px;"><strong>🔖 No. Control:</strong> ${ev.usuarioAlumno}</p>
            <p style="margin-bottom: 8px;"><strong>📖 Programa:</strong> ${ev.programa}</p>
            <p style="margin-bottom: 8px;"><strong>📚 Proyecto:</strong> ${ev.proyecto}</p>
            <p style="margin-bottom: 8px;"><strong>🏷️ Tipo:</strong> ${ev.tipo_seminario}</p>
            <hr style="border: 0; border-top: 1px dashed #cbd5e1; margin: 15px 0;">
            <p style="margin-bottom: 8px;"><strong>📅 Fecha y Hora:</strong> ${ev.fecha_raw} a las ${ev.hora}</p>
            <p style="margin-bottom: 8px;"><strong>📍 Lugar:</strong> ${ev.lugar} (${ev.modalidad})</p>

        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin-bottom: 10px; color: var(--primary-dark);"><strong>🔑 Clave General:</strong> <span style="font-family: monospace; font-size: 1.1rem; color: var(--primary); font-weight: bold; background: #e0e7ff; padding: 2px 6px; border-radius: 4px;">${ev.clave_acceso}</span></p>
            <p style="margin-bottom: 4px; font-size: 0.9rem;"><strong>Presidente:</strong> <span style="font-family: monospace; font-weight: bold;">${ev.presidente || 'N/A'}</span></p>
            <p style="margin-bottom: 4px; font-size: 0.9rem;"><strong>Secretario:</strong> <span style="font-family: monospace; font-weight: bold;">${ev.secretario || 'N/A'}</span></p>
            <p style="margin-bottom: 0; font-size: 0.9rem;"><strong>Vocal:</strong> <span style="font-family: monospace; font-weight: bold;">${ev.vocal || 'N/A'}</span></p>
        </div>
            
            <div style="text-align: right;">
                <button onclick="document.getElementById('modalDetallesAgenda').classList.add('hidden'); abrirEdicionAlumno(${ev.id_seminario});" style="padding: 10px 15px; font-size: 0.95rem; border-radius: 6px; border: none; cursor: pointer; background: #d97706; color: white; font-weight: bold;">✏️ Editar Seminario</button>
            </div>
        `;
        document.getElementById('modalDetallesAgenda').classList.remove('hidden');
    }


    // ---- DESCARGAS DE EXCEL en: ".XLSX" ---

    async function descargarExcel(urlParams, nombreArchivo, btnElement) {
        const textoOriginal = btnElement.textContent;
        btnElement.textContent = "Generando...";
        btnElement.disabled = true;

        try {
            const res = await apiFetch(urlParams);
            if (res.status === 401) return;

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = nombreArchivo;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            console.error("Error al descargar:", error);
            alert("No fue posible generar el reporte de Excel.");
        } finally {
            btnElement.textContent = textoOriginal;
            btnElement.disabled = false;
        }
    }

    // 1.- Botón alumnos
    const btnDescargarReporte = document.getElementById('btnDescargarReporte');
    if (btnDescargarReporte) {
        btnDescargarReporte.addEventListener('click', () => {
            descargarExcel(`${API_BASE}/descargar-reporte`, 'Directorio_Alumnos.xlsx', btnDescargarReporte);
        });
    }

    // 2.- Botón agenda
    const btnDescargarAgenda = document.getElementById('btnDescargarAgenda');
    if (btnDescargarAgenda) {
        btnDescargarAgenda.addEventListener('click', () => {
            const mes = document.getElementById('filtroMesAgenda').value;
            const anio = document.getElementById('filtroAnioAgenda').value;
            descargarExcel(`${API_BASE}/descargar-agenda?mes=${mes}&anio=${anio}`, `Agenda_Seminarios_${mes}_${anio}.xlsx`, btnDescargarAgenda);
        });
    }

    // 3.- Botón docentes
    const btnDescargarDocentes = document.getElementById('btnDescargarDocentes');
    if (btnDescargarDocentes) {
        btnDescargarDocentes.addEventListener('click', () => {
            descargarExcel(`${API_BASE}/descargar-docentes`, 'Directorio_Docentes.xlsx', btnDescargarDocentes);
        });
    }
}