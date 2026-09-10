import { AUTH, setManejadorSesionExpirada } from './api.js';

const loginOverlay = document.getElementById('loginOverlay');
const loginUser = document.getElementById('loginUser');
const loginError = document.getElementById('loginError');

export function showLogin(mensaje) {
    loginOverlay.classList.remove('hidden');
    if (mensaje) {
        loginError.textContent = mensaje;
        loginError.classList.remove('hidden');
    }
    loginUser.focus();
}

export function hideLogin() {
    loginOverlay.classList.add('hidden');
}

export function aplicarRestriccionesRol() {
    const esAdmin = !!(AUTH.user && AUTH.user.isAdmin);

    const panelAdmin = document.getElementById('panelAdmin');
    const vistaFormulario = document.getElementById('vista-formulario');
    const vistaDirectorio = document.getElementById('vista-directorio');
    const btnVerDirectorio = document.getElementById('btnVerDirectorio');
    const btnVolverRegistro = document.getElementById('btnVolverRegistro');

    if (panelAdmin) panelAdmin.classList.toggle('hidden', !esAdmin);

    if (!esAdmin) {
        if (vistaFormulario) vistaFormulario.classList.add('hidden');
        if (vistaDirectorio) vistaDirectorio.classList.remove('hidden');
    }
    if (btnVerDirectorio) btnVerDirectorio.classList.toggle('hidden', !esAdmin);
    if (btnVolverRegistro) btnVolverRegistro.classList.toggle('hidden', !esAdmin);

    const btnEditarAlumno = document.getElementById('btnEditarSoloAlumno');
    const btnEliminarAlumno = document.getElementById('btnEliminarAlumnoTotal');
    if (btnEditarAlumno) btnEditarAlumno.classList.toggle('hidden', !esAdmin);
    if (btnEliminarAlumno) btnEliminarAlumno.classList.toggle('hidden', !esAdmin);

    const nombreHeader = document.getElementById('nombre-usuario-header');
    if (nombreHeader && AUTH.user) {
        nombreHeader.textContent = AUTH.user.name;
    }
}

export function logout() {
    window.location.href = '/logout';
}

// apiFetch (en shared/api.js) no conoce el DOM de usuario.html;
// aquí se registra qué hacer exactamente cuando detecta un 401.
setManejadorSesionExpirada((mensaje) => {
    const panelAdmin = document.getElementById('panelAdmin');
    if (panelAdmin) panelAdmin.classList.add('hidden');
    showLogin(mensaje);
});
