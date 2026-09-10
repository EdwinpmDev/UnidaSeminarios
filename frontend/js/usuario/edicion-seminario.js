import { API_BASE, apiFetch } from '../shared/api.js';
import { mostrarToast } from '../shared/toast.js';
import { cargarTablaEstudiantes, abrirDetallesEstudiante, listaGlobalEstudiantes, estudianteSeleccionado } from './directorio-estudiantes.js';
import { actualizarOpcionesSeminario } from './registro-seminario.js';
import { cargarAgendaBackend, paginaAgendaActual } from './agenda.js';

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
            el.reportValidity();
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

    if (!payload.usuarioAlumno || !payload.nombre) {
        mostrarToast("Control y nombre son obligatorios.", 'error'); return;
    }

    try {
        const req = await apiFetch(`${API_BASE}/estudiante/${estudianteSeleccionado.id_estudiante}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (req.status === 401) return;
        const res = await req.json();

        if (res.success) {
            mostrarToast(res.mensaje, 'exito');
            document.getElementById('modalEditarSoloEstudiante').classList.add('hidden');

            await cargarTablaEstudiantes();

            const estudianteActualizado = listaGlobalEstudiantes.find(e => e.usuarioAlumno === payload.usuarioAlumno);

            if (estudianteActualizado) {
                abrirDetallesEstudiante(estudianteActualizado.id_estudiante);
            } else {
                document.getElementById('btnVolverDirectorio').click();
            }
        } else {
            mostrarToast(res.mensaje, 'error');
        }
    } catch (e) { mostrarToast("Error de conexión.", 'error'); }
});

// ALUMNO Y SEMINARIO
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
    if (valor === 'Personalizado') return Number(editDuracionPersonalizada.value);
    return Number(valor);
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
    const opcionesFijas = [30, 40, 60];
    if (opcionesFijas.includes(valorGuardado)) {
        editDuracionSelect.value = valorGuardado;
    } else {
        editDuracionSelect.value = 'Personalizado';
        editDuracionPersonalizada.value = valorGuardado;
    }
}

window.abrirEdicionAlumno = async function (idSeminario) {
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

        actualizarOpcionesSeminario(d.programa)

        // Carga exclusiva de datos del seminario
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
            'edit_titulo', 'edit_fecha', 'edit_hora'
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
        if (!lugarValor) { mostrarToast('Indica el enlace virtual o el aula personalizada.', 'error'); return; }
        if (!duracionValor) { mostrarToast('Indica la duración personalizada del seminario.', 'error'); return; }

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

                await cargarTablaEstudiantes();

                const vistaAgenda = document.getElementById('vista-agenda');
                if (!vistaAgenda.classList.contains('hidden')) {
                    cargarAgendaBackend(paginaAgendaActual, false);
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

document.addEventListener("DOMContentLoaded", () => {
    const hoy = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Mexico_City" }));
    const hoyFormato = hoy.getFullYear() + "-" + String(hoy.getMonth() + 1).padStart(2, '0') + "-" + String(hoy.getDate()).padStart(2, '0');
    const editFecha = document.getElementById('edit_fecha');
    if (editFecha) editFecha.setAttribute('min', hoyFormato);
});
