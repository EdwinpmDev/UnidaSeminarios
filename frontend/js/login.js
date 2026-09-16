import { API_BASE } from './shared/api.js';

function mostrarModalAviso(mensaje) {
    let overlay = document.getElementById('modalAvisoGlobal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalAvisoGlobal';
        overlay.className = 'modal-overlay hidden';
        overlay.innerHTML = `
            <div class="modal-content">
                <p id="modalAvisoMensaje" class="modal-aviso-texto"></p>
                <div class="modal-aviso-acciones">
                    <button type="button" id="btnAceptarAviso" class="btn-aceptar-modal">Aceptar</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#btnAceptarAviso').addEventListener('click', () => {
            overlay.classList.add('hidden');
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    }

    overlay.querySelector('#modalAvisoMensaje').textContent = mensaje;
    overlay.classList.remove('hidden');
}

function cambiarPestañaPrincipal(rolId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));

    document.getElementById('tab-' + rolId).classList.add('active');
    document.getElementById('btn-tab-' + rolId).classList.add('active');

    if (rolId === 'estudiante') {
        conmutarSubFormulario('estudiante');
    }
}

function conmutarSubFormulario(subRol) {
    document.querySelectorAll('.sub-form-content').forEach(sf => sf.classList.remove('active'));
    document.getElementById('sub-form-' + subRol).classList.add('active');
}

// Bloqueo temporal tras exceder intentos de login (HTTP 429)
function iniciarCuentaRegresivaBloqueo(segundosIniciales, btnSubmit, errorBox, textoBotonNormal) {
    let segundosRestantes = segundosIniciales;

    const actualizarMensaje = () => {
        errorBox.textContent = `⚠️ Demasiados intentos. Espera ${segundosRestantes} segundos...`;
        errorBox.classList.remove('hidden');
    };

    btnSubmit.disabled = true;
    actualizarMensaje();

    const intervalo = setInterval(() => {
        segundosRestantes--;
        if (segundosRestantes <= 0) {
            clearInterval(intervalo);
            errorBox.classList.add('hidden');
            btnSubmit.disabled = false;
            btnSubmit.textContent = textoBotonNormal;
        } else {
            actualizarMensaje();
        }
    }, 1000);
}

async function manejarLogin(e, destino) {
    e.preventDefault();
    const form = e.target;

    const user = form.querySelector('input[name="username"]').value.trim();
    const passInput = form.querySelector('#pass-profesor');
    const pass = passInput ? passInput.value.trim() : '';

    const btnSubmit = form.querySelector('.btn-submit');
    const errorBox = form.querySelector('.login-error');

    if (!user || !pass) {
        if (errorBox) {
            errorBox.textContent = '⚠️ Completa usuario y contraseña.';
            errorBox.classList.remove('hidden');
        }
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Iniciar Sesión';
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Validando...';
    if (errorBox) errorBox.classList.add('hidden');

    let enEsperaPorBloqueo = false;

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: user, password: pass })
        });

        if (response.status === 429) {
            enEsperaPorBloqueo = true;
            const segundos = parseInt(response.headers.get('Retry-After'), 10) || 60;
            if (errorBox) {
                iniciarCuentaRegresivaBloqueo(segundos, btnSubmit, errorBox, 'Iniciar Sesión');
            } else {
                mostrarModalAviso(`⚠️ Demasiados intentos. Espera ${segundos} segundos...`);
            }
            return;
        }

        const data = await response.json();

        if (data.success) {
            window.location.href = data.is_admin ? './usuario.html' : './dashboard-docente.html';
        } else {
            if (errorBox) {
                errorBox.textContent = '⚠️ ' + data.mensaje;
                errorBox.classList.remove('hidden');
            } else {
                mostrarModalAviso('⚠️ ' + data.mensaje);
            }
        }
    } catch (error) {
        if (errorBox) {
            errorBox.textContent = '⚠️ Error de conexión.';
            errorBox.classList.remove('hidden');
        } else {
            mostrarModalAviso('⚠️ Error de conexión.');
        }
    } finally {
        if (!enEsperaPorBloqueo) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Iniciar Sesión';
        }
    }
}

async function manejarLoginEstudiante(e, destino) {
    e.preventDefault();
    const form = e.target;

    const user = form.querySelector('input[name="username"]').value.trim();
    const passInput = form.querySelector('#pass-estudiante');
    const pass = passInput ? passInput.value.trim() : '';

    const btnSubmit = form.querySelector('.btn-submit');
    const errorBox = form.querySelector('.login-error');

    if (!user || !pass) {
        if (errorBox) {
            errorBox.textContent = '⚠️ Completa número de control y contraseña.';
            errorBox.classList.remove('hidden');
        }
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Ingresar al Portal';
        return;
    }

    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Validando...';
    if (errorBox) errorBox.classList.add('hidden');

    let enEsperaPorBloqueo = false;

    try {
        const response = await fetch(`${API_BASE}/login-estudiante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: user, password: pass })
        });

        if (response.status === 429) {
            enEsperaPorBloqueo = true;
            const segundos = parseInt(response.headers.get('Retry-After'), 10) || 60;
            if (errorBox) {
                iniciarCuentaRegresivaBloqueo(segundos, btnSubmit, errorBox, 'Ingresar al Portal');
            } else {
                mostrarModalAviso(`⚠️ Demasiados intentos. Espera ${segundos} segundos...`);
            }
            return;
        }

        const data = await response.json();

        if (data.success) {
            window.location.href = destino;
        } else {
            if (errorBox) {
                errorBox.textContent = '⚠️ ' + data.mensaje;
                errorBox.classList.remove('hidden');
            } else {
                mostrarModalAviso('⚠️ ' + data.mensaje);
            }
        }
    } catch (error) {
        if (errorBox) {
            errorBox.textContent = '⚠️ Error de conexión.';
            errorBox.classList.remove('hidden');
        } else {
            mostrarModalAviso('⚠️ Error de conexión.');
        }
    } finally {
        if (!enEsperaPorBloqueo) {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Ingresar al Portal';
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.tab-button[data-rol]').forEach(btn => {
        btn.addEventListener('click', () => cambiarPestañaPrincipal(btn.dataset.rol));
    });

    document.querySelectorAll('.btn-switch-link[data-subrol]').forEach(btn => {
        btn.addEventListener('click', () => conmutarSubFormulario(btn.dataset.subrol));
    });

    const formProfesor = document.querySelector('#tab-profesor form');
    if (formProfesor) {
        formProfesor.addEventListener('submit', (e) => manejarLogin(e, './usuario.html'));
    }

    const formEstudiante = document.querySelector('#sub-form-estudiante form');
    if (formEstudiante) {
        formEstudiante.addEventListener('submit', (e) => manejarLoginEstudiante(e, './portal-alumno.html'));
    }

    // Alumno evalúa a un compañero con su control + contraseña + clave del seminario
    const formAlumnoEvaluador = document.getElementById('form-alumno-evaluador');
    if (formAlumnoEvaluador) {
        formAlumnoEvaluador.addEventListener('submit', async (e) => {
            e.preventDefault();

            const control = document.getElementById('eval-control').value.trim();
            const password = document.getElementById('eval-pass').value.trim();
            const clave = document.getElementById('eval-clave').value.trim();

            const btnSubmit = formAlumnoEvaluador.querySelector('.btn-submit');
            const errorBox = document.getElementById('error-alumno-evaluador');

            if (!control || !password || !clave) {
                errorBox.textContent = '⚠️ Completa tu número de control, contraseña y la clave del seminario.';
                errorBox.classList.remove('hidden');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Validando...';
            errorBox.classList.add('hidden');

            try {
                const response = await fetch(`${API_BASE}/login-alumno-evaluador`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        usuarioAlumno: control,
                        password: password,
                        seminar_code: clave
                    })
                });
                const data = await response.json();

                if (data.success) {
                    window.location.href = './evaluacion.html';
                } else {
                    errorBox.textContent = '⚠️ ' + data.mensaje;
                    errorBox.classList.remove('hidden');
                }
            } catch (error) {
                errorBox.textContent = '⚠️ Error de conexión con el servidor.';
                errorBox.classList.remove('hidden');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Ingresar a evaluar';
            }
        });
    }

    const formEvaluador = document.querySelector('#tab-evaluador form');
    if (formEvaluador) {
        formEvaluador.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('code-evaluador').value.trim();
            const btnSubmit = formEvaluador.querySelector('.btn-submit');

            if (!code) {
                mostrarModalAviso('Por favor ingresa la clave de acceso al seminario.');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Validando...';

            try {
                const response = await fetch(`${API_BASE}/login-evaluador`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ seminar_code: code })
                });

                const data = await response.json();

                if (data.success) {
                    window.location.href = './evaluacion.html';
                } else {
                    mostrarModalAviso('⚠️ ' + data.mensaje);
                }
            } catch (error) {
                console.error(error);
                mostrarModalAviso('⚠️ Error de conexión con el servidor.');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Validar e Ingresar';
            }
        });
    }

    const formRegistro = document.getElementById('form-auto-registro');
    if (formRegistro) {
        // Mismos regex que usa el administrador al registrar alumnos
        const REGEX_NOMBRE = /^[A-Za-zÁÉÍÓÚáéíóúÑñÜü\s]+$/;
        const REGEX_CONTROL = /^\d{8,}$/;
        const REGEX_PASSWORD = /^\d{6,}$/;
        const REGEX_CORREO = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

        function validarRegistro(payload) {
            if (!REGEX_CONTROL.test(payload.usuarioAlumno)) {
                return 'El número de control debe contener mínimo 8 números (sin letras).';
            }
            if (!REGEX_NOMBRE.test(payload.nombre)) {
                return 'El nombre solo puede contener letras y espacios (sin números ni símbolos).';
            }
            if (!REGEX_CORREO.test(payload.correo)) {
                return 'El correo no es válido (falta un @ o un dominio, ej. .com).';
            }
            if (!payload.programa) {
                return 'Selecciona tu programa (Maestría o Doctorado).';
            }
            if (!REGEX_PASSWORD.test(payload.password_estudiante)) {
                return 'La contraseña debe tener al menos 6 números (sin letras).';
            }
            return null;
        }

        formRegistro.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnSubmit = document.getElementById('btn-submit-registro');
            const errorBox = document.getElementById('error-registro');
            const exitoBox = document.getElementById('exito-registro');

            errorBox.classList.add('hidden');
            exitoBox.classList.add('hidden');

            const payload = {
                usuarioAlumno: document.getElementById('reg-control').value.trim(),
                nombre: document.getElementById('reg-nombre').value.trim(),
                correo: document.getElementById('reg-correo').value.trim(),
                programa: document.getElementById('reg-programa').value,
                password_estudiante: document.getElementById('reg-pass').value.trim()
            };

            const errorValidacion = validarRegistro(payload);
            if (errorValidacion) {
                errorBox.textContent = '⚠️ ' + errorValidacion;
                errorBox.classList.remove('hidden');
                return;
            }

            btnSubmit.disabled = true;
            btnSubmit.textContent = 'Procesando...';

            let enEsperaPorBloqueo = false;

            try {
                const response = await fetch(`${API_BASE}/registro-publico`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (response.status === 429) {
                    enEsperaPorBloqueo = true;
                    const segundos = parseInt(response.headers.get('Retry-After'), 10) || 60;
                    iniciarCuentaRegresivaBloqueo(segundos, btnSubmit, errorBox, 'Registrarme');
                    return;
                }

                const data = await response.json();

                if (data.success) {
                    exitoBox.textContent = '✅ ' + data.mensaje;
                    exitoBox.classList.remove('hidden');
                    formRegistro.reset();
                    setTimeout(() => conmutarSubFormulario('estudiante'), 3000);
                } else {
                    errorBox.textContent = '⚠️ ' + data.mensaje;
                    errorBox.classList.remove('hidden');
                }
            } catch (error) {
                errorBox.textContent = '⚠️ Error de conexión con el servidor.';
                errorBox.classList.remove('hidden');
            } finally {
                if (!enEsperaPorBloqueo) {
                    btnSubmit.disabled = false;
                    btnSubmit.textContent = 'Registrarme';
                }
            }
        });
    }

    // Link directo, abre la pestaña de evaluador con el código listo
    const claveUrl = new URLSearchParams(window.location.search).get('clave');
    if (claveUrl) {
        cambiarPestañaPrincipal('evaluador');
        const inputClave = document.getElementById('code-evaluador');
        if (inputClave) inputClave.value = claveUrl.trim();
    }
});

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