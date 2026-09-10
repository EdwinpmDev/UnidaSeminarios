export function mostrarToast(mensaje, tipo = 'exito', duracionMs) {
    let contenedor = document.getElementById('toast-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-container';
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    contenedor.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('toast-visible'));

    const duracion = duracionMs || (tipo === 'error' ? 7000 : 3200);
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 300);
    }, duracion);
}

export function mostrarModalConfirmacion(mensaje, callbackAceptar) {
    let overlay = document.getElementById('modalConfirmacionGlobal');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'modalConfirmacionGlobal';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2000;display:flex;align-items:center;justify-content:center;padding:15px;';
        overlay.innerHTML = `
            <div style="background:#ffffff;padding:25px;border-radius:10px;width:100%;max-width:420px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.15);border-top:4px solid var(--primary);">
                <p id="modalConfirmacionMensaje" style="color:var(--text);font-size:0.95rem;line-height:1.5;margin-bottom:20px;white-space:pre-line;"></p>
                <div style="display:flex;justify-content:flex-end;gap:10px;">
                    <button type="button" id="btnCancelarConfirmacion" style="background:#4b5563;color:#ffffff;border:none;padding:10px 20px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:0.95rem;">Cancelar</button>
                    <button type="button" id="btnAceptarConfirmacion" style="background:var(--primary);color:#ffffff;border:none;padding:10px 20px;border-radius:6px;font-weight:bold;cursor:pointer;font-size:0.95rem;">Aceptar</button>
                </div>
            </div>
        `;
        overlay.classList.add('hidden');
        document.body.appendChild(overlay);

        overlay.querySelector('#btnCancelarConfirmacion').addEventListener('click', () => {
            overlay.classList.add('hidden');
        });
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.add('hidden');
        });
    }

    overlay.querySelector('#modalConfirmacionMensaje').textContent = mensaje;
    overlay.querySelector('#btnAceptarConfirmacion').onclick = () => {
        overlay.classList.add('hidden');
        callbackAceptar();
    };
    overlay.classList.remove('hidden');
}

// No se usa en ningún punto del sistema actual; se conserva sin cambios.
export function mostrarAlertaConfirmacion(mensaje, callbackAceptar) {
    mostrarModalConfirmacion(`⚠️ ${mensaje}\n\n¿Estás seguro de realizar estos cambios?`, callbackAceptar);
}
