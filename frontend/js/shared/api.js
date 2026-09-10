export const API_BASE = window.location.origin;

export const AUTH = {
    token: null,
    user: null,
    get ok() { return !!this.token && !!this.user; }
};

let manejarSesionExpirada = null;

// Permite que auth.js reaccione a un 401 sin que este archivo dependa de elementos de una página en especifico
export function setManejadorSesionExpirada(fn) {
    manejarSesionExpirada = fn;
}

function obtenerCookie(nombre) {
    const match = document.cookie.match(new RegExp('(?:^|; )' + nombre + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
}

export function csrfHeaders(headers = {}) {
    const token = obtenerCookie('unida_csrf');
    return token ? { ...headers, 'X-CSRF-Token': token } : headers;
}

export async function apiFetch(url, options = {}) {
    const metodo = (options.method || 'GET').toUpperCase();
    const necesitaCsrf = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(metodo);
    const opciones = necesitaCsrf
        ? { ...options, headers: csrfHeaders(options.headers) }
        : options;
    const res = await fetch(url, opciones);
    if (res.status === 401) {
        let mensaje = 'Tu sesión expiró o cambió de rol en otra pestaña. Vuelve a iniciar sesión.';
        try {
            const data = await res.clone().json();
            if (data && data.mensaje) mensaje = data.mensaje;
        } catch (e) { }
        if (manejarSesionExpirada) manejarSesionExpirada(mensaje);
    }
    if (!res.ok && !res.headers.get('content-type')?.includes('application/json')) {
        throw new Error('El servidor no respondió correctamente. Intenta de nuevo más tarde.');
    }
    return res;
}