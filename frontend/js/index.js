/* Carga de logotipos con rutas alternativas y fallback SVG en memoria */
const FALLBACKS = {
    tecnm: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="48"><rect width="100%" height="100%" rx="8" ry="8" fill="#1B396A"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial" font-size="18">TecNM</text></svg>`),
    itv: 'data:image/svg+xml;utf8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="180" height="72"><rect width="100%" height="100%" rx="10" ry="10" fill="#132848"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#fff" font-family="Segoe UI, Arial" font-size="20">ITV</text></svg>`)
};
function resolveLogo(imgEl, candidates, fallbackKey) {
    let i = 0;
    const tryNext = () => {
        if (i >= candidates.length) { imgEl.src = FALLBACKS[fallbackKey]; return; }
        const url = candidates[i++];
        const t = new Image();
        t.onload = () => imgEl.src = url;
        t.onerror = () => tryNext();
        t.src = url;
    };
    tryNext();
}
window.addEventListener('DOMContentLoaded', () => {
    resolveLogo(document.getElementById('logoTecnm'), ['./assets/tecnm.png', './assets/tecnm.jpg', './tecnm.png', './tecnm.jpg'], 'tecnm');
    resolveLogo(document.getElementById('logoITV'), ['./assets/itv.png', './assets/itv.jpg', './itv.png', './itv.jpg'], 'itv');
});

/* Configuración de API base y estado de sesión local */
const USE_MOCK_API = false;
const API_BASE = 'http://127.0.0.1:5000/api';
const auth = { token: null, user: null, get isLogged() { return !!this.token && !!this.user; } };

/* Utilidades de DOM e interfaz */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');
const setSteps = i => [$('.step-0'), $('.step-1'), $('.step-2'), $('.step-3')].forEach((el, idx) => el.classList.toggle('active', idx === i));
const isNonEmpty = (v, min = 1) => String(v ?? '').trim().length >= min;

/* Referencias frecuentes de UI */
const errPaso0 = $('#errPaso0'), loginBox = $('#loginBox'), username = $('#username'), password = $('#password'), btnLogin = $('#btnLogin');
const sessionBox = $('#sessionBox'), sessionTxt = $('#sessionText'), btnLogout = $('#btnLogout');
const externoBox = $('#externoBox'), externoNombre = $('#externoNombre');
const evaluadoSelect = $('#evaluadoSelect'), evaluadoId = $('#evaluadoId');
const titulo = $('#titulo'), programa = $('#programa');
const errPaso1 = $('#errPaso1'), errPaso2 = $('#errPaso2'), errPaso3 = $('#errPaso3');
const fsSeminario = $('#fsSeminario'), fsPreguntas = $('#fsPreguntas'), listaRadios = $('#listaRadios'), qsGrid = $('#qsGrid');
const btnEnviar = $('#btnEnviar'), exito = $('#exito'), resumen = $('#resumen');
const calendarBox = document.getElementById('calendarBox'), calendarGrid = document.getElementById('calendarGrid');
const calDate = document.getElementById('calDate'), btnPrev = document.getElementById('btnPrev'), btnNext = document.getElementById('btnNext'), btnHoy = document.getElementById('btnHoy');

/* Botón de acceso a registro de evaluados (visible solo para Profesor autenticado) */
const actionsAboveCalendar = document.getElementById('actionsAboveCalendar');
const btnRegistrarEvaluados = document.getElementById('btnRegistrarEvaluados');

/* Control de fecha en el datepicker de la agenda */
function setCalDateTo(date) { const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; calDate.value = iso; }
function getCalDate() { return new Date(calDate.value + 'T00:00:00'); }

/* Conversión HH:MM <-> minutos y utilidades de paso de 30 min */
function toMinutes(hhmm) { const [hh, mm] = String(hhmm || '00:00').split(':').map(n => parseInt(n, 10) || 0); return Math.max(0, Math.min(23, hh)) * 60 + Math.max(0, Math.min(59, mm)); }
function fromMinutes(m) { const hh = Math.floor(m / 60), mm = m % 60; return String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0'); }
function halfHourFloor(mins) { return Math.floor(mins / 30) * 30; }
function halfHourCeil(mins) { return Math.ceil(mins / 30) * 30; }

/* Llamadas a API */
async function authLogin(role, username, password) {
    const r = await fetch(`${API_BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, username, password }) });
    return r.json();
}
async function fetchAgendaByDate(token, isoDate) {
    const headers = auth.isLogged ? { 'Authorization': `Bearer ${auth.token}` } : {};
    const r = await fetch(`${API_BASE}/agenda?date=${encodeURIComponent(isoDate)}`, { headers });
    return r.json();
}
async function fetchHistorialById(token, id) {
    const headers = auth.isLogged ? { 'Authorization': `Bearer ${auth.token}` } : {};
    const r = await fetch(`${API_BASE}/historial?evaluadoId=${encodeURIComponent(id)}`, { headers });
    return r.json();
}

/* Visibilidad del botón “Registrar Evaluados” según rol y sesión */
function toggleRegistrarEvaluados() {
    const rol = document.querySelector('input[name="rol"]:checked')?.value;
    const puedeVer = (rol === 'profesor' && auth.isLogged === true);
    actionsAboveCalendar.style.display = puedeVer ? '' : 'none';
}
/* Redirección a la página de captura simplificada (usuario.html) */
btnRegistrarEvaluados?.addEventListener('click', () => { window.location.href = './usuario.html'; });

/* Render de agenda con intensidades de 30 min y soporte de horas no alineadas */
async function renderCalendarFor(date) {
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const res = await fetchAgendaByDate(auth.token, iso);
    const items = (res && res.ok) ? (res.items ?? []) : [];

    const timesMins = items.map(it => ({ ...it, _mins: toMinutes(it.hora || '00:00') })).sort((a, b) => a._mins - b._mins);

    let start = 8 * 60, end = 16 * 60;
    if (timesMins.length > 0) { start = halfHourFloor(timesMins[0]._mins); end = halfHourCeil(timesMins[timesMins.length - 1]._mins); }

    const slotsSet = new Set();
    for (let m = start; m <= end; m += 30) slotsSet.add(m);
    for (const it of timesMins) slotsSet.add(it._mins);

    const slots = Array.from(slotsSet).sort((a, b) => a - b);
    const html = slots.map(m => {
        const hhmm = fromMinutes(m);
        const enSlot = timesMins.filter(it => it._mins === m);
        const contenido = enSlot.length
            ? enSlot.map(it => (`
            <div class="cal-item cal-item--clickable" data-id="${it.id}" data-nombre="${it.participante}" data-programa="${it.programa}" data-tipo="${it.tipo}" data-titulo="${it.titulo}" tabindex="0" role="button" aria-label="Ver ${it.participante} — ${it.titulo}">
            <span class="cal-badge">${it.programa?.[0] ?? 'P'}</span>
            <strong>${it.participante}</strong> — ${it.titulo} — <span style="color:#1B396A;">${it.programa}</span>
            <span style="margin-left:auto;color:#6b7280;">${it.tipo}</span>
            </div>
        `)).join('')
            : `<div class="cal-empty">Sin eventos</div>`;
        return `
        <div class="cal-row">
        <div class="cal-hour">${hhmm}</div>
        <div class="cal-slot">${contenido}</div>
        </div>
        `;
    }).join('');

    calendarGrid.innerHTML = html || `
        <div class="cal-row">
        <div class="cal-hour">${fromMinutes(start)}</div>
        <div class="cal-slot"><div class="cal-empty">Sin eventos</div></div>
        </div>
    `;
}

/* Muestra/oculta la agenda según rol y sesión; sincroniza acción de registro */
function toggleCalendar() {
    const rol = $('input[name="rol"]:checked')?.value;
    const debeVer = ((rol === 'profesor' || rol === 'alumno') && auth.isLogged);
    if (debeVer) {
        show(calendarBox);
        if (!calDate.value) { setCalDateTo(new Date()); }
        renderCalendarFor(getCalDate());
    } else {
        hide(calendarBox);
    }
    toggleRegistrarEvaluados();
}

/* Navegación por fechas en la agenda */
btnPrev.addEventListener('click', () => { const d = getCalDate(); d.setDate(d.getDate() - 1); setCalDateTo(d); renderCalendarFor(d); });
btnNext.addEventListener('click', () => { const d = getCalDate(); d.setDate(d.getDate() + 1); setCalDateTo(d); renderCalendarFor(d); });
btnHoy.addEventListener('click', () => { const d = new Date(); setCalDateTo(d); renderCalendarFor(d); });
calDate.addEventListener('change', () => { renderCalendarFor(getCalDate()); });

/* Activación por click/teclado de items en agenda para abrir historial y prefijar evaluado */
calendarGrid.addEventListener('click', onCalItemActivate);
calendarGrid.addEventListener('keydown', (e) => { if (e.key === 'Enter') onCalItemActivate(e); });
async function onCalItemActivate(e) {
    const itemEl = e.target.closest('.cal-item--clickable');
    if (!itemEl) return;
    const id = String(itemEl.dataset.id ?? '');
    const opt = [...evaluadoSelect.options].find(o => o.value === id);
    if (opt) { evaluadoSelect.value = id; evaluadoSelect.dispatchEvent(new Event('change', { bubbles: true })); setSteps(1); }
    const evaluadoNombre = itemEl.dataset.nombre ?? '';
    const hist = await fetchHistorialById(auth.token, id);
    renderHistorialModal(evaluadoNombre, hist?.items ?? []);
    openHistModal();
}

/* Cambio de rol y reconfiguración de elementos dependientes */
$$('input[name="rol"]').forEach(r => r.addEventListener('change', onRolChange));
function onRolChange() {
    const rol = $('input[name="rol"]:checked')?.value;
    if (rol === 'profesor' || rol === 'alumno') { show(loginBox); hide(externoBox); }
    else if (rol === 'externo') { hide(loginBox); show(externoBox); }
    toggleEvaluadoSelect(); togglePaso2(); toggleCalendar(); toggleComentariosEvaluador(); bindComentariosCounter();
    toggleRegistrarEvaluados();
}

/* Autenticación, actualización de estado de sesión y elementos dependientes */
btnLogin.addEventListener('click', async () => {
    errPaso0.textContent = ''; hide(errPaso0);
    const rol = $('input[name="rol"]:checked')?.value;
    const user = username.value.trim();
    const pass = password.value.trim();
    const msg = [];
    if (!rol) msg.push('• Selecciona tu rol.');
    if (!isNonEmpty(user, 3)) msg.push('• Escribe tu usuario/correo.');
    if (!isNonEmpty(pass, 3)) msg.push('• Escribe tu contraseña.');
    if (msg.length) { errPaso0.innerHTML = msg.join('<br>'); show(errPaso0); return; }
    btnLogin.disabled = true;
    try {
        const res = await authLogin(rol, user, pass);
        if (!res.ok) throw new Error(res.error ?? 'No fue posible iniciar sesión.');
        auth.token = res.token; auth.user = res.user;
        sessionTxt.textContent = `Sesión: ${auth.user.name} (${auth.user.role})`;
        show(sessionBox);
        toggleRegistrarEvaluados();
    } catch (e) { errPaso0.textContent = e.message; show(errPaso0); }
    finally { btnLogin.disabled = false; }
    togglePaso2(); toggleEvaluadoSelect(); toggleCalendar(); toggleComentariosEvaluador(); bindComentariosCounter();
});

/* Cierre de sesión y limpieza de estado/visibilidad */
btnLogout.addEventListener('click', () => {
    auth.token = null; auth.user = null; hide(sessionBox); username.value = ''; password.value = '';
    resetPaso1(); toggleEvaluadoSelect(); togglePaso2(); hide(calendarBox); setSteps(0); toggleComentariosEvaluador();
    toggleRegistrarEvaluados();
});

/* Activación de entrada de nombre para externos y reconfiguración asociada */
externoNombre.addEventListener('input', () => {
    if (isNonEmpty(externoNombre.value, 3)) { hide(errPaso0); errPaso0.textContent = ''; }
    toggleEvaluadoSelect(); toggleComentariosEvaluador(); bindComentariosCounter();
});

/* Prefill del selector de evaluados con la agenda del día actual */
async function prefillListForDaySelect() {
    const now = new Date();
    const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const res = await fetchAgendaByDate(auth.token, iso);
    if (res.ok) {
        const items = (res.items ?? []).slice(0, 50);
        evaluadoSelect.innerHTML = `<option value="">Elija un nombre de la lista</option>` + items.map(it => `<option value="${it.id}" data-nombre="${it.participante}" data-programa="${it.programa}" data-tipo="${it.tipo}" data-titulo="${it.titulo}">${it.participante} — ${it.titulo}</option>`).join('');
    }
}

/* Selección de evaluado desde el combo y llenado de datos asociados */
evaluadoSelect.addEventListener('change', () => {
    const opt = evaluadoSelect.selectedOptions[0];
    if (!opt || !opt.value) { evaluadoId.value = ''; return; }
    evaluadoId.value = String(opt.value);
    const data = { id: Number(opt.value), participante: opt.dataset.nombre, programa: opt.dataset.programa, tipo: opt.dataset.tipo, titulo: opt.dataset.titulo };
    prefillFromItem(data); togglePaso2();
});

/* Asignación de título, programa y preselección de tipo de seminario según item */
function prefillFromItem(item) {
    if (!item) return;
    titulo.value = item.titulo ?? '';
    programa.value = (/maestr/i.test(item.programa) ? 'maestria' : 'doctorado');
    const map = { 'Protocolo': 'protocolo', 'Primer avance': 'primer_avance', 'Segundo avance': 'segundo_avance', 'Culminación': 'culminacion', 'Culminacion': 'culminacion' };
    poblarRadios(programa.value);
    const val = map[item.tipo] ?? '';
    if (val) { const r = document.getElementById(`sem_${val}`); if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); } }
}

/* Banco de preguntas con escalas */
const PREGUNTAS = [
    { texto: 'Comprensión del tema', escala: 10 },
    { texto: 'Organización de la presentación', escala: 10 },
    { texto: 'Profundidad y cobertura del tema', escala: 10 },
    { texto: 'Calidad, contenido y estilo del resumen', escala: 10 },
    { texto: 'Manejo de preguntas', escala: 10 },
    { texto: 'Capacidad analítica y sintética', escala: 10 },
    { texto: 'Integración de resultados al proyecto', escala: 10 },
    { texto: 'Nivel de discusión de resultados', escala: 10 },
    { texto: 'Calidad de los audiovisuales', escala: 5 },
    { texto: 'Claridad de la presentación', escala: 5 },
    { texto: 'Pronunciación y gramática', escala: 5 },
    { texto: 'Tiempo utilizado', escala: 5 }
];

/* Render dinámico de preguntas y enlaces de eventos a la validación */
function renderPreguntas() {
    qsGrid.innerHTML = '';
    PREGUNTAS.forEach((p, idx) => {
        const num = idx + 1;
        const wrap = document.createElement('div');
        wrap.className = 'scale-question';
        let inputs = '';
        for (let n = 1; n <= p.escala; n++) {
            const id = `q${num}_${n}`;
            inputs += `<input type="radio" id="${id}" name="q${num}" value="${n}"><label for="${id}">${n}</label>`;
        }
        wrap.innerHTML = `<h4>${num}. ${p.texto} <span style="color:#6b7280;font-weight:500;">(1–${p.escala})</span></h4><div class="scale" role="radiogroup" aria-label="${p.texto}">${inputs}</div>`;
        qsGrid.appendChild(wrap);
    });
    $$('input[type="radio"]', qsGrid).forEach(r => r.addEventListener('change', verificarListoParaEnviar));
}

/* Utilidades de bloqueo/validación del Paso 1 */
const preguntasCompletas = () => PREGUNTAS.every((_, i) => !!document.querySelector(`input[name="q${i + 1}"]:checked`));
function lockStep1Fields() { titulo.readOnly = true; programa.disabled = true; }
function resetPaso1() { evaluadoSelect.value = ''; evaluadoId.value = ''; titulo.value = ''; programa.value = ''; lockStep1Fields(); }
function isIdentificado() { const rol = $('input[name="rol"]:checked')?.value; if (rol === 'profesor' || rol === 'alumno') return auth.isLogged === true; if (rol === 'externo') return isNonEmpty(externoNombre.value, 3); return false; }
function toggleEvaluadoSelect() { const identificado = isIdentificado(); evaluadoSelect.disabled = !identificado; if (!identificado) { resetPaso1(); } }
lockStep1Fields();

/* Validación de identificación y datos mínimos del evaluado */
function validarPaso0() {
    const rol = $('input[name="rol"]:checked')?.value;
    if (rol === 'profesor' || rol === 'alumno') {
        if (!auth.isLogged) { errPaso0.textContent = 'Inicia sesión para continuar.'; show(errPaso0); return false; }
        hide(errPaso0); return true;
    }
    if (rol === 'externo') {
        if (!isNonEmpty(externoNombre.value, 3)) { errPaso0.textContent = 'Escribe tu nombre para continuar (Externo).'; show(errPaso0); return false; }
        hide(errPaso0); return true;
    }
    errPaso0.textContent = 'Selecciona tu rol.'; show(errPaso0); return false;
}
function validarPaso1() {
    const okId = isNonEmpty(evaluadoId.value, 1);
    const okProg = !!programa.value;
    if (!okId || !okProg) {
        const msg = []; if (!okId) msg.push('• Selecciona un nombre de la lista.'); if (!okProg) msg.push('• Selecciona el programa.');
        errPaso1.innerHTML = msg.join('<br>'); show(errPaso1); return false;
    }
    hide(errPaso1); return true;
}

/* Apertura/cierre de bloques según validación de pasos previos */
function togglePaso2() {
    if (validarPaso0() && validarPaso1()) {
        show(fsSeminario); setSteps(1); if (programa.value) poblarRadios(programa.value);
    } else { hide(fsSeminario); hide(fsPreguntas); btnEnviar.disabled = true; listaRadios.innerHTML = ''; setSteps(0); }
    toggleEvaluadoSelect();
}

/* Construcción de radios de tipo de seminario, conexión con el paso de preguntas */
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
        i.addEventListener('change', () => { hide(errPaso2); mostrarPreguntas(); });
    });
    hide(fsPreguntas); btnEnviar.disabled = true; setSteps(1);
}

/* Presentación de preguntas, contador de comentarios y habilitación de envío */
function mostrarPreguntas() { show(fsPreguntas); setSteps(2); renderPreguntas(); toggleComentariosEvaluador(); bindComentariosCounter(); verificarListoParaEnviar(); }
function verificarListoParaEnviar() { const ok = preguntasCompletas(); btnEnviar.disabled = !ok; if (ok) hide(errPaso3); }

/* Comentarios visibles solo si hay identificación válida */
const evalComentariosEl = document.getElementById('evalComentarios');
const evalComentariosCount = document.getElementById('evalComentariosCount');
let comentariosBound = false;
function toggleComentariosEvaluador() { const identificado = isIdentificado(); const box = document.getElementById('evalComentariosBox'); if (!box) return; if (identificado) { show(box); } else { hide(box); } }
function bindComentariosCounter() { if (!evalComentariosEl || !evalComentariosCount || comentariosBound) return; comentariosBound = true; const handler = () => { let v = evalComentariosEl.value ?? ''; if (v.length > 50) { v = v.slice(0, 50); evalComentariosEl.value = v; } evalComentariosCount.textContent = `${v.length}/50`; }; evalComentariosEl.addEventListener('input', handler); handler(); }

/* Envío de evaluación calculada a la API, con armado de resumen en pantalla */
document.getElementById('formSeminario').addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok0 = validarPaso0(), ok1 = validarPaso1();
    const sel = document.querySelector('input[name="seminario"]:checked');
    if (!ok0 || !ok1) return;
    if (!sel) { errPaso2.textContent = 'Selecciona un tipo de seminario.'; show(errPaso2); hide(fsPreguntas); btnEnviar.disabled = true; return; }
    if (!preguntasCompletas()) { errPaso3.textContent = 'Responde todas las preguntas.'; show(errPaso3); btnEnviar.disabled = true; return; }

    const rolSel = document.querySelector('input[name="rol"]:checked')?.value ?? '';
    const mapa = { protocolo: 'Protocolo', primer_avance: 'Primer avance', segundo_avance: 'Segundo avance', culminacion: 'Culminación' };
    const evalName = (rolSel === 'externo') ? externoNombre.value.trim() : (auth.isLogged ? (auth.user?.name ?? '') : '');

    const fila = {
        'Evaluador - Rol': (rolSel ?? '').replace(/^./, c => c.toUpperCase()),
        'Evaluador - Nombre': evalName,
        'Evaluado - ID': evaluadoId.value ?? '',
        'Evaluado - Nombre': evaluadoSelect.selectedOptions[0]?.dataset.nombre ?? '',
        'Título del proyecto': titulo.value.trim(),
        'Programa': programa.value === 'maestria' ? 'Maestría' : 'Doctorado',
        'Tipo de seminario': mapa[sel.value] ?? sel.value
    };
    PREGUNTAS.forEach((p, idx) => { const v = Number(document.querySelector(`input[name="q${idx + 1}"]:checked`).value); fila[`P${idx + 1} ${p.texto}`] = v; });

    try {
        const headers = { 'Content-Type': 'application/json' };
        if (auth.isLogged) headers['Authorization'] = `Bearer ${auth.token}`;
        const resp = await fetch(`${API_BASE}/evaluaciones`, { method: 'POST', headers, body: JSON.stringify({ fila, comentarios: (document.getElementById('evalComentarios')?.value ?? '').slice(0, 50) }) });
        const data = await resp.json();
        if (!resp.ok || !data.ok) { throw new Error(data?.error || 'No se pudo guardar.'); }
    } catch (err) { alert('Error al guardar en la base de datos: ' + err.message); return; }

    const lista = PREGUNTAS.map((p, idx) => `<dt>${idx + 1}. ${p.texto}</dt><dd>${fila[`P${idx + 1} ${p.texto}`]} / ${p.escala}</dd>`).join('');
    resumen.innerHTML = `<dt>Evaluador</dt><dd>${fila['Evaluador - Nombre']} (${fila['Evaluador - Rol']})</dd><dt>Evaluado</dt><dd>#${fila['Evaluado - ID']} — ${fila['Evaluado - Nombre']}</dd><dt>Título del proyecto</dt><dd>${fila['Título del proyecto']}</dd><dt>Programa</dt><dd>${fila['Programa']}</dd><dt>Tipo de seminario</dt><dd>${fila['Tipo de seminario']}</dd>` + lista;
    let c = document.getElementById('evalComentarios')?.value?.trim();
    if (c) { c = c.slice(0, 50); const dt = document.createElement('dt'); dt.textContent = 'Comentarios del Evaluador'; const dd = document.createElement('dd'); dd.textContent = c; resumen.append(dt, dd); }
    show(exito); show(resumen); resumen.scrollIntoView({ behavior: 'smooth' });
});

/* Modal de historial: apertura, cierre y pintado de registros */
const histModal = document.getElementById('histModal');
const btnCloseHist = document.getElementById('btnCloseHist');
const histBody = document.getElementById('histBody');
const histEmpty = document.getElementById('histEmpty');
function openHistModal() { histModal.classList.add('show'); btnCloseHist.focus(); }
function closeHistModal() { histModal.classList.remove('show'); }
btnCloseHist.addEventListener('click', closeHistModal);
histModal.addEventListener('click', (e) => { if (e.target === histModal) closeHistModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && histModal.classList.contains('show')) closeHistModal(); });

function renderHistorialModal(nombre, items) {
    document.getElementById('histTitle').textContent = `Historial de calificaciones — ${nombre}`;
    histBody.innerHTML = '';
    if (!items || items.length === 0) { histEmpty.style.display = ''; return; }
    histEmpty.style.display = 'none';
    items.forEach((it) => {
        const row = document.createElement('div');
        row.className = 'row';
        row.innerHTML = `
        <div><strong>${it.tipo}</strong> — <span class="muted">${it.fecha}</span></div>
        <div>Calificación: <strong>${Number(it.calificacion).toFixed(1)}</strong></div>
        <div class="muted">${it.comentarios ?? ''}</div>
        `;
        histBody.appendChild(row);
    });
}

/* Exportación de historial: captura último conjunto mostrado para habilitar exportación */
let LAST_HIST = { nombre: '', items: [] };
(function () {
    const btn = document.getElementById('btnDownloadHist');
    if (btn) {
        btn.addEventListener('click', async () => {
            if (!LAST_HIST.items || LAST_HIST.items.length === 0) { alert('Sin registros para exportar.'); return; }
            await exportarHistorialVertical(LAST_HIST.nombre, LAST_HIST.items);
        });
    }
})();
(function () {
    const _orig = window.renderHistorialModal;
    window.renderHistorialModal = function (nombre, items) {
        LAST_HIST = { nombre: String(nombre || ''), items: Array.isArray(items) ? items : [] };
        const btn = document.getElementById('btnDownloadHist');
        if (btn) {
            if (LAST_HIST.items.length > 0) btn.removeAttribute('disabled');
            else btn.setAttribute('disabled', '');
        }
        if (typeof _orig === 'function') _orig(nombre, items);
    };
})();

/* Estado inicial */
setSteps(0);
onRolChange();
prefillListForDaySelect();
toggleRegistrarEvaluados();


// --------------------------------------------------------------------------------------- //


/* Hoja de estilos y utilidades para exportar historial a Excel con layout vertical */
const BLUE_DARK = 'FF1B396A';
const BLUE_ROW_1 = 'FFE6EEF8';
const BLUE_ROW_2 = 'FFD3DDF2';
const BORDER_CLR = BLUE_DARK;

function ajustarAnchosVertical(ws, pares) {
    const maxCampo = Math.max(...pares.map(([c]) => String(c).length), 'Campo'.length);
    const maxValor = Math.max(...pares.map(([, v]) => String(v ?? '').length), 'Valor'.length);
    ws.getColumn(1).width = Math.min(60, Math.max(18, Math.ceil(maxCampo * 1.15) + 6));
    ws.getColumn(2).width = Math.min(75, Math.max(20, Math.ceil(maxValor * 1.05) + 8));
}
function estilizarTablaVertical(ws, rowHead, rowEnd) {
    ['A', 'B'].forEach(col => {
        const cell = ws.getCell(`${col}${rowHead}`);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_DARK } };
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = { top: { style: 'thin', color: { argb: BORDER_CLR } }, left: { style: 'thin', color: { argb: BORDER_CLR } }, bottom: { style: 'thin', color: { argb: BORDER_CLR } }, right: { style: 'thin', color: { argb: BORDER_CLR } } };
    });
    for (let r = rowHead + 1; r <= rowEnd; r++) {
        const useBand1 = ((r - (rowHead + 1)) % 2 === 0);
        ['A', 'B'].forEach(col => {
            const cell = ws.getCell(`${col}${r}`);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: useBand1 ? BLUE_ROW_1 : BLUE_ROW_2 } };
            cell.border = { top: { style: 'thin', color: { argb: BORDER_CLR } }, left: { style: 'thin', color: { argb: BORDER_CLR } }, bottom: { style: 'thin', color: { argb: BORDER_CLR } }, right: { style: 'thin', color: { argb: BORDER_CLR } } };
            cell.alignment = { vertical: 'middle', horizontal: col === 'A' ? 'left' : 'center', wrapText: true };
        });
    }
}
async function loadImageBase64(url) {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.readAsDataURL(blob); });
    const base64 = String(dataUrl).split(',')[1];
    const mime = blob.type || '';
    const extension = mime.includes('jpeg') ? 'jpeg' : (mime.includes('png') ? 'png' : 'png');
    return { base64, extension };
}
function fechaStamp() { const d = new Date(), pad = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`; }

async function exportarHistorialVertical(nombre, items) {
    if (!window.ExcelJS || !window.saveAs) { alert('No está disponible la exportación.'); return; }
    const wb = new ExcelJS.Workbook();
    wb.creator = 'TecNM - Registro de Seminario';
    wb.created = new Date();
    const ws = wb.addWorksheet('Historial', { views: [{ state: 'frozen', ySplit: 4 }] });

    const fechaMx = new Date().toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
    const tituloExcel = `Historial de calificaciones — ${nombre} — ${fechaMx}`;
    ws.mergeCells('A1:F1');
    const cTitle = ws.getCell('A1');
    cTitle.value = tituloExcel;
    cTitle.alignment = { horizontal: 'center', vertical: 'middle' };
    cTitle.font = { name: 'Calibri', size: 16, bold: true, color: { argb: BLUE_DARK } };
    cTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
    ws.getRow(1).height = 28;

    ws.addRow([]); ws.addRow([]);

    const ROW_HEAD = 4;
    ws.getCell(`A${ROW_HEAD}`).value = 'Campo';
    ws.getCell(`B${ROW_HEAD}`).value = 'Valor';

    const pares = [];
    pares.push(['Evaluado', nombre ?? '']);
    if (Array.isArray(items)) {
        items.forEach((it, idx) => {
            const n = idx + 1;
            pares.push([`Registro ${n} — Tipo`, String(it.tipo ?? '')]);
            pares.push([`Registro ${n} — Fecha`, String(it.fecha ?? '')]);
            pares.push([`Registro ${n} — Calificación`, String(Number(it.calificacion ?? 0).toFixed(1))]);
            const c = String(it.comentarios ?? '').trim();
            if (c) pares.push([`Registro ${n} — Comentarios`, c]);
        });
    }

    let r = ROW_HEAD + 1;
    pares.forEach(([campo, valor]) => { ws.getCell(`A${r}`).value = String(campo); ws.getCell(`B${r}`).value = valor; r++; });
    const ROW_END = r - 1;

    ws.autoFilter = { from: { row: ROW_HEAD, column: 1 }, to: { row: ROW_HEAD, column: 2 } };
    ajustarAnchosVertical(ws, pares);
    estilizarTablaVertical(ws, ROW_HEAD, ROW_END);

    try { const tec = await loadImageBase64('tecnm.jpg'); const tecId = wb.addImage({ base64: tec.base64, extension: tec.extension }); ws.addImage(tecId, 'A2:B3'); } catch (e) { console.warn('No se pudo cargar tecnm.jpg', e); }
    try { const itv = await loadImageBase64('itv.png'); const itvId = wb.addImage({ base64: itv.base64, extension: itv.extension }); ws.addImage(itvId, 'D2:E3'); } catch (e) { console.warn('No se pudo cargar itv.png', e); }

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `historial_calificaciones_${fechaStamp()}.xlsx`);
}