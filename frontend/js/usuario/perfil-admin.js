import { API_BASE, apiFetch } from '../shared/api.js';
import { mostrarToast, mostrarModalConfirmacion } from '../shared/toast.js';

const btnEditarMiPerfilAdmin = document.getElementById('btnEditarMiPerfilAdmin');
const modalEditarAdmin = document.getElementById('modalEditarAdmin');
const btnCerrarEditarAdmin = document.getElementById('btnCerrarEditarAdmin');
const btnGuardarEditarAdmin = document.getElementById('btnGuardarEditarAdmin');
const msgEditarAdmin = document.getElementById('msgEditarAdmin');

if (btnEditarMiPerfilAdmin) {
    btnEditarMiPerfilAdmin.addEventListener('click', () => {
        document.getElementById('editAdminUsuario').value = '';
        document.getElementById('editAdminPass').value = '';
        msgEditarAdmin.textContent = '';
        modalEditarAdmin.classList.remove('hidden');
    });
}

if (btnCerrarEditarAdmin) {
    btnCerrarEditarAdmin.addEventListener('click', () => modalEditarAdmin.classList.add('hidden'));
}

if (modalEditarAdmin) {
    modalEditarAdmin.addEventListener('click', (e) => {
        if (e.target === modalEditarAdmin) modalEditarAdmin.classList.add('hidden');
    });
}

if (btnGuardarEditarAdmin) {
    btnGuardarEditarAdmin.addEventListener('click', async () => {
        const usuario = document.getElementById('editAdminUsuario').value.trim();
        const password = document.getElementById('editAdminPass').value.trim();

        if (!usuario && !password) {
            msgEditarAdmin.style.color = 'red';
            msgEditarAdmin.textContent = '⚠️ Escribe al menos un dato para actualizar.';
            return;
        }

        if (password && password.length < 8) {
            msgEditarAdmin.style.color = 'red';
            msgEditarAdmin.textContent = '⚠️ La contraseña debe tener al menos 8 caracteres.';
            return;
        }

        let mensajeConfirmacion = '¿Estás seguro de actualizar tus datos de administrador?';
        if (usuario && password) {
            mensajeConfirmacion += '\n\nSe actualizarán tanto el usuario como la contraseña.';
        } else if (usuario) {
            mensajeConfirmacion += '\n\nSe actualizará el usuario.';
        } else if (password) {
            mensajeConfirmacion += '\n\nSe actualizará la contraseña.';
        }

        mostrarModalConfirmacion(`⚠️ ${mensajeConfirmacion}`, async () => {
            btnGuardarEditarAdmin.disabled = true;
            btnGuardarEditarAdmin.textContent = "Guardando...";

            try {
                const res = await apiFetch(`${API_BASE}/editar-perfil-admin`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ usuario, password })
                });

                if (res.status === 401) return;
                const data = await res.json();

                if (data.success) {
                    msgEditarAdmin.style.color = 'green';
                    msgEditarAdmin.textContent = '✅ ' + data.mensaje;

                    setTimeout(() => {
                        modalEditarAdmin.classList.add('hidden');
                        mostrarToast("Tus datos han sido actualizados. Por seguridad, deberás iniciar sesión nuevamente con tus credenciales.", 'exito');
                        setTimeout(() => { window.location.href = '/logout'; }, 1500);
                    }, 1500);
                } else {
                    msgEditarAdmin.style.color = 'red';
                    msgEditarAdmin.textContent = '❌ ' + (data.mensaje || 'No fue posible guardar.');
                }
            } catch (error) {
                msgEditarAdmin.style.color = 'red';
                msgEditarAdmin.textContent = '⚠️ Error de conexión con el servidor.';
            } finally {
                btnGuardarEditarAdmin.disabled = false;
                btnGuardarEditarAdmin.textContent = "Guardar cambios";
            }
        });
    });
}
