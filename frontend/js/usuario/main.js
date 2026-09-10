import { API_BASE, AUTH } from '../shared/api.js';
import { showLogin, hideLogin, aplicarRestriccionesRol, logout } from '../shared/auth.js';

import './seleccion-alumno.js';
import './registro-seminario.js';
import { cargarTablaEstudiantes } from './directorio-estudiantes.js';
import './edicion-seminario.js';
import './retroalimentacion.js';
import './docentes.js';
import './perfil-admin.js';
import './agenda.js';
import './exportaciones.js';

const vistaFormulario = document.getElementById('vista-formulario');
const vistaDirectorio = document.getElementById('vista-directorio');
const btnVerDirectorio = document.getElementById('btnVerDirectorio');
const btnVolverRegistro = document.getElementById('btnVolverRegistro');

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

const loginUser = document.getElementById('loginUser');
const loginPass = document.getElementById('loginPass');
const btnDoLogin = document.getElementById('btnDoLogin');
const loginError = document.getElementById('loginError');

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

        if (!res.ok && !res.headers.get('content-type')?.includes('application/json')) {
            throw new Error('El servidor no respondió correctamente. Intenta de nuevo más tarde.');
        }

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.mensaje || 'No fue posible iniciar sesión.');
        }

        AUTH.token = "sesion_activa";
        AUTH.user = { name: data.nombre_completo, usuario: data.usuario, isAdmin: data.is_admin };
        hideLogin();

        cargarTablaEstudiantes();
        aplicarRestriccionesRol();
    } catch (e) {
        loginError.textContent = e.message;
        loginError.classList.remove('hidden');
    } finally {
        btnDoLogin.disabled = false;
    }
});

const btnLogout = document.getElementById('btnLogout');
if (btnLogout) {
    btnLogout.addEventListener('click', logout);
}

document.addEventListener("DOMContentLoaded", async () => {
    try {
        const res = await fetch(`${API_BASE}/verificar-sesion`);
        const data = await res.json();

        if (data.logueado) {
            AUTH.token = "sesion_activa";
            AUTH.user = { name: data.nombre_completo, usuario: data.usuario, isAdmin: data.is_admin };
            hideLogin();
            cargarTablaEstudiantes();
            aplicarRestriccionesRol();
        } else {
            showLogin();
        }
    } catch (error) {
        showLogin();
    }
});
