const API_BASE = window.location.origin;

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

// Login para maestros y administradores
async function manejarLogin(e, destino) {
    e.preventDefault();
    const form = e.target;
    
    const user = form.querySelector('input[name="username"]').value.trim();
    const passInput = form.querySelector('#pass-profesor');
    const pass = passInput ? passInput.value.trim() : '';
    
    const btnSubmit = form.querySelector('.btn-submit');
    const errorBox = form.querySelector('.login-error');

    // Validación
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

    try {
        const response = await fetch(`${API_BASE}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: user, password: pass })
        });
        const data = await response.json();

        if (data.success) {
            window.location.href = destino;
        } else {
            if (errorBox) { 
                errorBox.textContent = '⚠️ ' + data.mensaje; 
                errorBox.classList.remove('hidden'); 
            } else {
                alert('⚠️ ' + data.mensaje);
            }
        }
    } catch (error) {
        if (errorBox) { 
            errorBox.textContent = '⚠️ Error de conexión.'; 
            errorBox.classList.remove('hidden'); 
        } else {
            alert('⚠️ Error de conexión.');
        }
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Iniciar Sesión';
    }
}

// Login exclusivo para estudiantes
async function manejarLoginEstudiante(e, destino) {
    e.preventDefault();
    const form = e.target;
    
    const user = form.querySelector('input[name="username"]').value.trim();
    const passInput = form.querySelector('#pass-estudiante');
    const pass = passInput ? passInput.value.trim() : '';
    
    const btnSubmit = form.querySelector('.btn-submit');
    const errorBox = form.querySelector('.login-error');

    // Validación
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

    try {
        const response = await fetch(`${API_BASE}/login-estudiante`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario: user, password: pass })
        });
        const data = await response.json();

        if (data.success) {
            window.location.href = destino;
        } else {
            if (errorBox) { 
                errorBox.textContent = '⚠️ ' + data.mensaje; 
                errorBox.classList.remove('hidden'); 
            } else {
                alert('⚠️ ' + data.mensaje);
            }
        }
    } catch (error) {
        if (errorBox) { 
            errorBox.textContent = '⚠️ Error de conexión.'; 
            errorBox.classList.remove('hidden'); 
        } else {
            alert('⚠️ Error de conexión.');
        }
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Ingresar al Portal';
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Evento profesor
    const formProfesor = document.querySelector('#tab-profesor form');
    if (formProfesor) {
        formProfesor.addEventListener('submit', (e) => manejarLogin(e, './usuario.html'));
    }

    // Evento estudiante (redirige a portal-alumno.html)
    const formEstudiante = document.querySelector('#sub-form-estudiante form');
    if (formEstudiante) {
        formEstudiante.addEventListener('submit', (e) => manejarLoginEstudiante(e, './portal-alumno.html'));
    }

    // Evento invitado (Mensaje de desarrollo)
    const formInvitado = document.querySelector('#sub-form-invitado form');
    if (formInvitado) {
        formInvitado.addEventListener('submit', (e) => {
            e.preventDefault();
            const code = document.getElementById('code-invitado').value.trim();
            if (!code) {
                alert('Por favor ingresa un código de invitación.');
                return;
            }
            alert('Código de invitación: ' + code + '\n(Sistema de códigos aún en desarrollo)');
        });
    }

    // Evento evaluador
    const formEvaluador = document.querySelector('#tab-evaluador form');
    if (formEvaluador) {
        formEvaluador.addEventListener('submit', async (e) => {
            e.preventDefault();
            const code = document.getElementById('code-evaluador').value.trim();
            const btnSubmit = formEvaluador.querySelector('.btn-submit');
            
            if (!code) {
                alert('Por favor ingresa la clave de acceso al seminario.');
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
                    // Si la clave es correcta, se manda a calificar
                    window.location.href = './evaluacion.html';
                } else {
                    alert('⚠️ ' + data.mensaje);
                }
            } catch (error) {
                console.error(error);
                alert('⚠️ Error de conexión con el servidor.');
            } finally {
                btnSubmit.disabled = false;
                btnSubmit.textContent = 'Validar e Ingresar';
            }
        });
    }
});


// VISIBILIDAD DE CONTRASEÑAS GLOBALES
document.addEventListener("DOMContentLoaded", () => {
    const togglePasswordBtns = document.querySelectorAll('.btn-toggle-password');

    togglePasswordBtns.forEach(btn => {
        btn.addEventListener('click', function() {
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