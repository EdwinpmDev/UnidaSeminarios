import { API_BASE, apiFetch } from '../shared/api.js';
import { escapeHTML } from '../shared/dom.js';
import { mostrarToast } from '../shared/toast.js';
import { cargarTablaEstudiantes } from './directorio-estudiantes.js';

const fsPaso1 = document.getElementById('fsPaso1');
const fsPaso2 = document.getElementById('fsPaso2');
const btnSiguiente = document.getElementById('btnSiguientePaso');
const btnRegresar = document.getElementById('btnRegresarPaso');
const formSeminario = document.getElementById('formSeminario');

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

// Link directo para el evaluador externo, con la clave ya incluida
function construirLinkEvaluador(clave) {
    return `${window.location.origin}/?clave=${encodeURIComponent(clave)}`;
}

window.copiarLinkEvaluador = async function (clave) {
    const link = construirLinkEvaluador(clave);
    try {
        await navigator.clipboard.writeText(link);
        mostrarToast('🔗 Enlace copiado al portapapeles', 'exito');
    } catch (error) {
        mostrarToast('No se pudo copiar automáticamente: ' + link, 'error');
    }
};

function mostrarModalSeminarioCreado(payload, clave) {
    const link = construirLinkEvaluador(clave);
    const contenido = document.getElementById('contenidoSeminarioCreado');

    contenido.innerHTML = `
        <p style="margin-bottom: 8px;"><strong>🎓 Alumno:</strong> ${escapeHTML(payload.nombre)}</p>
        <p style="margin-bottom: 8px;"><strong>🔖 No. Control:</strong> ${escapeHTML(payload.usuarioAlumno)}</p>
        <p style="margin-bottom: 8px;"><strong>📖 Programa:</strong> ${escapeHTML(payload.programa)}</p>
        <p style="margin-bottom: 8px;"><strong>📚 Proyecto:</strong> ${escapeHTML(payload.proyecto)}</p>
        <p style="margin-bottom: 8px;"><strong>🏷️ Tipo:</strong> ${escapeHTML(payload.tipo_seminario)}</p>
        <p style="margin-bottom: 8px;"><strong>📅 Fecha y Hora:</strong> ${escapeHTML(payload.fecha)} a las ${escapeHTML(payload.hora)}</p>
        <p style="margin-bottom: 15px;"><strong>📍 Lugar:</strong> ${escapeHTML(payload.lugar)} (${escapeHTML(payload.modalidad)})</p>

        <div style="background: #f8fafc; border: 1px solid var(--border); padding: 12px; border-radius: 8px; margin-bottom: 15px;">
            <p style="margin-bottom: 10px;"><strong>🔑 Clave de acceso:</strong> <span style="font-family: monospace; font-size: 1.1rem; font-weight: bold; background: #e0e7ff; color: var(--primary); padding: 2px 6px; border-radius: 4px;">${escapeHTML(clave)}</span></p>
            <p style="margin-bottom: 8px; font-size: 0.9rem;"><strong>Link para evaluadores externos:</strong></p>
            <p style="margin-bottom: 10px; word-break: break-all; font-size: 0.85rem; color: #4b5563;">${escapeHTML(link)}</p>
            <button type="button" id="btnCopiarLinkModalCreado" style="background: #059669; padding: 8px 14px; font-size: 0.9rem; border-radius: 6px; border: none; cursor: pointer; color: white; font-weight: bold;">🔗 Copiar enlace</button>
        </div>

        <p style="font-size: 0.85rem; color: #6b7280;">⏳ Plazo máximo de 72 horas para evaluar desde la hora de inicio. Este link también se puede volver a copiar más tarde desde la información del alumno o la agenda de eventos.</p>
    `;
    document.getElementById('btnCopiarLinkModalCreado').addEventListener('click', () => copiarLinkEvaluador(clave));
    document.getElementById('modalSeminarioCreado').classList.remove('hidden');
}

const btnCerrarSeminarioCreado = document.getElementById('btnCerrarSeminarioCreado');
if (btnCerrarSeminarioCreado) {
    btnCerrarSeminarioCreado.addEventListener('click', () => {
        document.getElementById('modalSeminarioCreado').classList.add('hidden');
    });
}
const modalSeminarioCreado = document.getElementById('modalSeminarioCreado');
if (modalSeminarioCreado) {
    modalSeminarioCreado.addEventListener('click', (e) => {
        if (e.target === modalSeminarioCreado) modalSeminarioCreado.classList.add('hidden');
    });
}

// LÓGICA DE LUGAR
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

// LÓGICA DE DURACIÓN
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
    if (valor === 'Personalizado') return Number(duracionPersonalizada.value);
    return Number(valor);
}

// STEP CONTROL LOGIC
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

// SUBMIT LOGIC
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
                    mostrarToast(`⚠️ Falta completar: ${nombreCampo}`, 'error');
                } else {
                    mostrarToast(`⚠️ Revisa el formato de: ${nombreCampo}`, 'error');
                }
            }, 100);
        }
        return;
    }

    const lugarValor = obtenerValorLugar();
    const duracionValor = obtenerValorDuracion();

    if (!lugarValor) {
        mostrarToast('⚠️ Indica el enlace virtual o el aula personalizada.', 'error');
        return;
    }
    if (!duracionValor) {
        mostrarToast('⚠️ Indica la duración personalizada del seminario.', 'error');
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
        if (res.success) {
            const claveGenerada = res.clave_acceso || payload.clave_acceso;
            mostrarModalSeminarioCreado(payload, claveGenerada);
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
            mostrarToast("❌ Error: " + (res.mensaje || res.error || 'No fue posible guardar.'), 'error');
        }
    } catch (error) {
        console.error("Error enviando al servidor:", error);
        mostrarToast("No fue posible guardar en la base de datos.", 'error');
    } finally {
        btnGuardar.disabled = false;
    }
});

// LÓGICA PARA OPCIONES DE SEMINARIO DINÁMICAS
const programaSelect = document.getElementById('programa');
const tipoSeminarioSelect = document.getElementById('tipo_seminario');
const editTipoSeminarioSelect = document.getElementById('edit_tipo_seminario');

export function actualizarOpcionesSeminario(programaElegido) {
    if (tipoSeminarioSelect) tipoSeminarioSelect.innerHTML = '';
    if (editTipoSeminarioSelect) editTipoSeminarioSelect.innerHTML = '';

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
            "2.- Tutorial I",
            "3.- Avance 1",
            "4.- Predoctoral",
            "5.- Tutorial II",
            "6.- Avance 2",
            "7.- Tutorial III",
            "8.- Culminacion"
        ];
    }

    opciones.forEach(op => {
        if (tipoSeminarioSelect) {
            const optionElement = document.createElement('option');
            optionElement.value = op;
            optionElement.textContent = op;
            tipoSeminarioSelect.appendChild(optionElement);
        }
        if (editTipoSeminarioSelect) {
            const optionElement2 = document.createElement('option');
            optionElement2.value = op;
            optionElement2.textContent = op;
            editTipoSeminarioSelect.appendChild(optionElement2);
        }
    });
}
window.actualizarOpcionesSeminario = actualizarOpcionesSeminario;

if (programaSelect) {
    programaSelect.addEventListener('change', (e) => {
        actualizarOpcionesSeminario(e.target.value);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    actualizarCampoLugar();
    actualizarCampoDuracion();

    const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const hoyFormato = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, '0') + "-" + String(hoy.getDate()).padStart(2, '0');
    const inputFecha = document.getElementById('fecha');
    if (inputFecha) inputFecha.setAttribute('min', hoyFormato);

    const programaInicial = document.getElementById('programa')?.value;
    if (programaInicial) {
        const sel = document.getElementById('programa');
        if (sel) {
            sel.dispatchEvent(new Event('change'));
        }
    }
});