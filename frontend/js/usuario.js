/* ==================== JS PRINCIPAL (sin exportación a Excel) ==================== */

// Estado simple de autenticación recibido del backend (token demo)
const AUTH = { token: null, user: null, get ok() { return !!this.token && !!this.user; } };

// Atajos de selección
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

// Referencias del formulario y UI
const nombre = $('#nombre'),
    titulo = $('#titulo'),
    programa = $('#programa'),
    fecha = $('#fecha'),
    hora = $('#hora');

const fsSeminario = $('#fsSeminario'),
    listaRadios = $('#listaRadios'),
    btnEnviar = $('#btnEnviar'),
    errPaso1 = $('#errPaso1'),
    errPaso2 = $('#errPaso2'),
    exito = $('#exito'),
    resumen = $('#resumen'),
    step1 = $('.step-1'),
    step2 = $('.step-2');

// Cambia visualmente el paso activo
function setSteps(i) { [step1, step2].forEach((el, idx) => el.classList.toggle('active', idx === i)); }

// Limpia mensajes de error en pantalla
function limpiarErrores() { [errPaso1, errPaso2].forEach(e => { e.textContent = ''; e.classList.add('hidden'); }); }

// Utilidad de validación de cadena no vacía
const isNonEmpty = (v, min = 1) => String(v ?? '').trim().length >= min;

// Elementos del overlay de login
const loginOverlay = $('#loginOverlay'),
    loginUser = $('#loginUser'),
    loginPass = $('#loginPass'),
    btnDoLogin = $('#btnDoLogin'),
    loginError = $('#loginError');

// Llama al backend de login y devuelve objeto de sesión
async function doLogin(user, pass) {
    const res = await fetch('http://127.0.0.1:5000/api/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'profesor', username: user, password: pass })
    });
    const data = await res.json();
    if (!data.ok || !data.token) { throw new Error('No fue posible iniciar sesión.'); }
    return data;
}
function showLogin() { loginOverlay.classList.remove('hidden'); }
function hideLogin() { loginOverlay.classList.add('hidden'); }

// Control del botón de ingreso (validación mínima)
btnDoLogin.addEventListener('click', async () => {
    loginError.textContent = ''; loginError.classList.add('hidden');
    const user = loginUser.value.trim();
    const pass = loginPass.value.trim();
    if (!isNonEmpty(user, 3) || !isNonEmpty(pass, 3)) {
        loginError.textContent = 'Completa usuario y contraseña.';
        loginError.classList.remove('hidden');
        return;
    }
    btnDoLogin.disabled = true;
    try {
        const data = await doLogin(user, pass);
        AUTH.token = data.token; AUTH.user = data.user;
        hideLogin();
        await cargarEvaluados(); // Poblado del datalist tras login
    } catch (e) {
        loginError.textContent = e.message; loginError.classList.remove('hidden');
    } finally {
        btnDoLogin.disabled = false;
    }
});

// Valida que nombre, título y programa estén capturados
function validarPaso1() {
    const okN = isNonEmpty(nombre.value, 2), okT = isNonEmpty(titulo.value, 3), okP = !!programa.value;
    if (!okN || !okT || !okP) {
        const msg = [];
        if (!okN) msg.push('• El nombre del estudiante es requerido.');
        if (!okT) msg.push('• El título del proyecto es requerido.');
        if (!okP) msg.push('• Selecciona el programa.');
        errPaso1.innerHTML = msg.join('<br>'); errPaso1.classList.remove('hidden'); return false;
    }
    errPaso1.classList.add('hidden'); return true;
}

// Muestra/oculta el Paso 2 en función de la validación del Paso 1
function togglePaso2() {
    if (validarPaso1()) {
        fsSeminario.classList.remove('hidden'); setSteps(1); poblarRadios(programa.value);
    } else {
        fsSeminario.classList.add('hidden'); btnEnviar.disabled = true;
        listaRadios.innerHTML = ''; setSteps(0);
    }
}

// Llena las opciones de tipo de seminario según el programa
function poblarRadios(tipo) {
    listaRadios.innerHTML = '';
    const mae = [{ value: 'protocolo', label: 'Protocolo' }, { value: 'culminacion', label: 'Culminación' }];
    const doc = [{ value: 'protocolo', label: 'Protocolo' }, { value: 'primer_avance', label: 'Primer avance' }, { value: 'segundo_avance', label: 'Segundo avance' }, { value: 'culminacion', label: 'Culminación' }];
    (tipo === 'maestria' ? mae : doc).forEach(opt => {
        const id = `sem_${opt.value}`;
        const l = document.createElement('label'); l.className = 'radio-item'; l.setAttribute('for', id);
        const i = document.createElement('input'); i.type = 'radio'; i.name = 'seminario'; i.id = id; i.value = opt.value; i.required = true;
        const s = document.createElement('span'); s.textContent = opt.label;
        l.append(i, s); listaRadios.appendChild(l);
        i.addEventListener('change', () => { errPaso2.classList.add('hidden'); btnEnviar.disabled = false; setSteps(1); });
    });
    btnEnviar.disabled = true; setSteps(1);
}

// Envía el alta del evaluado y muestra un resumen (sin descarga de archivo)
document.getElementById('formSeminario').addEventListener('submit', async (e) => {
    e.preventDefault(); limpiarErrores();
    const ok = validarPaso1();
    const sel = $('input[name="seminario"]:checked');
    if (!ok) return;
    if (!sel) {
        errPaso2.textContent = 'Selecciona un tipo de seminario.';
        errPaso2.classList.remove('hidden');
        btnEnviar.disabled = true;
        return;
    }

    // Construye una fila de datos de resumen y para persistir en el backend
    const mapa = { protocolo: 'Protocolo', primer_avance: 'Primer avance', segundo_avance: 'Segundo avance', culminacion: 'Culminación' };
    const fila = {
        'Nombre del estudiante': nombre.value.trim(),
        'Título del proyecto': titulo.value.trim(),
        'Programa': programa.value === 'maestria' ? 'Maestría' : 'Doctorado',
        'Tipo de seminario': mapa[sel.value] ?? sel.value,
    };

    // Lee fecha/hora programadas; si existen, las envía para normalización en el backend
    const fechaVal = (fecha.value || '').trim();  // 'YYYY-MM-DD'
    const horaVal = (hora.value || '').trim();  // 'HH:MM'

    try {
        await fetch("http://127.0.0.1:5000/api/evaluado", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                nombre: fila['Nombre del estudiante'],
                proyecto: fila['Título del proyecto'],
                programa: fila['Programa'],
                seminario: fila['Tipo de seminario'],
                fecha: fechaVal || undefined,
                hora: horaVal || undefined
            })
        });
        console.log("Evaluado guardado en la base de datos");
    } catch (error) {
        console.error("Error enviando al servidor:", error);
        alert("No fue posible guardar en la base de datos.");
        return;
    }

    // Muestra un resumen en pantalla (sin acciones de descarga)
    resumen.innerHTML = `
    <dt>Nombre del estudiante</dt><dd>${fila['Nombre del estudiante']}</dd>
    <dt>Título del proyecto</dt><dd>${fila['Título del proyecto']}</dd>
    <dt>Programa</dt><dd>${fila['Programa']}</dd>
    <dt>Tipo de seminario</dt><dd>${fila['Tipo de seminario']}</dd>
    `;
    exito.classList.remove('hidden');
    resumen.classList.remove('hidden');
    resumen.scrollIntoView({ behavior: 'smooth' });
});

// Carga de evaluados al datalist tras login exitoso
async function cargarEvaluados() {
    try {
        const response = await fetch("http://127.0.0.1:5000/api/evaluados");
        const evaluados = await response.json();
        const lista = document.getElementById("listaEvaluados");
        lista.innerHTML = "";
        evaluados.forEach(e => {
            if (!e.nombre) return;
            const option = document.createElement("option");
            option.value = e.nombre;
            lista.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando evaluados:", error);
    }
}

// Hooks de validación incremental del Paso 1
nombre.addEventListener('input', togglePaso2);
titulo.addEventListener('input', togglePaso2);
programa.addEventListener('change', togglePaso2);

// Muestra overlay de login al cargar
document.addEventListener("DOMContentLoaded", showLogin);

// Estado inicial
togglePaso2();