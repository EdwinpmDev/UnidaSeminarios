import { API_BASE, apiFetch } from '../shared/api.js';
import { mostrarToast } from '../shared/toast.js';

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
        mostrarToast("No fue posible generar el reporte de Excel.", 'error');
    } finally {
        btnElement.textContent = textoOriginal;
        btnElement.disabled = false;
    }
}

const btnDescargarReporte = document.getElementById('btnDescargarReporte');
if (btnDescargarReporte) {
    btnDescargarReporte.addEventListener('click', () => {
        const prog = document.getElementById('filtroProgramaAlumnos') ? document.getElementById('filtroProgramaAlumnos').value : 'todos';
        const fase = document.getElementById('filtroFaseAlumnos') ? document.getElementById('filtroFaseAlumnos').value : 'todos';
        descargarExcel(`${API_BASE}/descargar-reporte?programa=${encodeURIComponent(prog)}&fase=${encodeURIComponent(fase)}`, 'Directorio_Alumnos.xlsx', btnDescargarReporte);
    });
}

const btnDescargarAgenda = document.getElementById('btnDescargarAgenda');
if (btnDescargarAgenda) {
    btnDescargarAgenda.addEventListener('click', () => {
        const mes = document.getElementById('filtroMesAgenda').value;
        const anio = document.getElementById('filtroAnioAgenda').value;
        const prog = document.getElementById('filtroProgramaAgenda') ? document.getElementById('filtroProgramaAgenda').value : 'todos';
        const fase = document.getElementById('filtroFaseAgenda') ? document.getElementById('filtroFaseAgenda').value : 'todos';

        descargarExcel(`${API_BASE}/descargar-agenda?mes=${mes}&anio=${anio}&programa=${encodeURIComponent(prog)}&fase=${encodeURIComponent(fase)}`, `Agenda_Seminarios_${mes}_${anio}.xlsx`, btnDescargarAgenda);
    });
}

const btnDescargarDocentes = document.getElementById('btnDescargarDocentes');
if (btnDescargarDocentes) {
    btnDescargarDocentes.addEventListener('click', () => {
        descargarExcel(`${API_BASE}/descargar-docentes`, 'Directorio_Docentes.xlsx', btnDescargarDocentes);
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const togglePasswordBtns = document.querySelectorAll('.btn-toggle-password');

    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const input = this.previousElementSibling;

            if (input.type === 'password') {
                input.type = 'text';
                this.textContent = '🔒';
                this.title = 'Ocultar contraseña';
            } else {
                input.type = 'password';
                this.textContent = '👁️';
                this.title = 'Mostrar contraseña';
            }
        });
    });
});

function validarContraseña(password) {
    if (!password || password.length === 0) {
        return { valida: true, mensaje: '' };
    }
    if (password.length < 8) {
        return {
            valida: false,
            mensaje: '⚠️ La contraseña debe tener al menos 8 caracteres.'
        };
    }
    return { valida: true, mensaje: '' };
}
