// Manejo de eventos de teclado para compatibilidad de formularios legacy.
(function () {
    const patronA = [
        'ArrowUp', 'ArrowDown', 'ArrowUp',
        'ArrowRight', 'ArrowLeft',
        'KeyA', 'KeyI', 'KeyA', 'KeyS'
    ];
    let pasoA = 0;

    const recursoA = './assets/audio/notify.mp3';
    const reproductorA = new Audio(recursoA);
    reproductorA.volume = 0.5;
    reproductorA.preload = 'auto';

    document.addEventListener('keydown', (e) => {
        if (e.code === patronA[pasoA]) {
            pasoA++;
            if (pasoA === patronA.length) {
                mostrarCapaA();
                pasoA = 0;
            }
        } else {
            pasoA = (e.code === patronA[0]) ? 1 : 0;
        }
    });

    function tocarA() {
        try {
            reproductorA.currentTime = 0;
            reproductorA.play().catch(() => {
            });
        } catch (err) {
        }
    }

    let audioCtx;
    function obtenerCtx() {
        if (!audioCtx) {
            const AC = window.AudioContext || window.webkitAudioContext;
            if (AC) audioCtx = new AC();
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        return audioCtx;
    }

    function beep(freqInicio = 440, dur = 0.05, tipo = 'square', vol = 0.045, freqFin = null) {
        const ctx = obtenerCtx();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = tipo;
        osc.frequency.setValueAtTime(freqInicio, ctx.currentTime);
        if (freqFin !== null) {
            osc.frequency.linearRampToValueAtTime(freqFin, ctx.currentTime + dur);
        }
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
        osc.stop(ctx.currentTime + dur + 0.02);
    }

    function stutter(notas, gap = 0.035, tipo = 'square', vol = 0.035, dur = 0.03) {
        notas.forEach((freq, i) => {
            setTimeout(() => beep(freq, dur, tipo, vol), Math.round(i * gap * 1000));
        });
    }

    function sonidoCierre() {
        beep(200, 0.045, 'square', 0.13);
        beep(90, 0.045, 'square', 0.11);
        beep(380, 0.4, 'sawtooth', 0.1, 55);
        beep(380, 0.4, 'triangle', 0.09, 55);
        beep(760, 0.4, 'sawtooth', 0.05, 110);
    }

    function generarEtiqueta() {
        return '0x' + Math.floor(Math.random() * 0xFFFFFF).toString(16).toUpperCase().padStart(6, '0');
    }

    function esperar(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    async function escribir(el, texto, cps = 55) {
        el.textContent = '';
        el.classList.add('cx-typing');
        for (let i = 0; i < texto.length; i++) {
            el.textContent += texto[i];
            await esperar(1000 / cps);
        }
        el.classList.remove('cx-typing');
    }

    const LINEAS_BOOT = [
        { texto: '> Estableciendo enlace con el Bunker...' },
        { texto: '> Verificando credenciales de unidad YoRHa...' },
        { texto: '> Sincronizando con la red neuronal...' },
        { texto: '> Recuperando caja negra...' },
        { texto: 'PROTOCOLO ANÓMALO ACEPTADO', ok: true }
    ];

    async function ejecutarBootLog(contenedor) {
        for (const linea of LINEAS_BOOT) {
            const fila = document.createElement('div');
            fila.className = 'cx-log-line';
            contenedor.appendChild(fila);

            if (linea.ok) {
                const marca = document.createElement('span');
                marca.className = 'cx-ok';
                fila.appendChild(marca);
                await escribir(marca, '> ' + linea.texto, 65);
                stutter([659, 988], 0.09, 'square', 0.05, 0.1);
            } else {
                await escribir(fila, linea.texto, 60);
                stutter([720 + Math.random() * 200, 480 + Math.random() * 150], 0.028, 'square', 0.028, 0.02);
            }
            await esperar(110);
        }
    }

    function iniciarGlitchLoop(panel) {
        const id = setInterval(() => {
            if (Math.random() < 0.3) {
                panel.classList.add('cx-glitch');
                setTimeout(() => panel.classList.remove('cx-glitch'), 100 + Math.random() * 150);
                if (Math.random() < 0.5) {
                    stutter([
                        260 + Math.random() * 220,
                        140 + Math.random() * 120,
                        380 + Math.random() * 180
                    ], 0.022, 'sawtooth', 0.022, 0.025);
                }
            }
        }, 850);
        return id;
    }

    function mostrarCapaA() {
        tocarA();
        document.body.classList.add('cx-flash');
        setTimeout(() => document.body.classList.remove('cx-flash'), 900);

        const idUnidad = 'YoRHa-E09';

        const overlay = document.createElement('div');
        overlay.className = 'cx-overlay';
        overlay.innerHTML = `
            <div class="cx-panel">
                <div class="cx-corner cx-corner-tl"></div>
                <div class="cx-corner cx-corner-tr"></div>
                <div class="cx-corner cx-corner-bl"></div>
                <div class="cx-corner cx-corner-br"></div>
                <div class="cx-lines"></div>

                <div class="cx-bar">
                    <span class="cx-bar-left"><span class="cx-emblem"></span>YoRHa</span>
                    <span>SYS::${generarEtiqueta()}</span>
                    <span>ACCESO ▸ CONCEDIDO</span>
                </div>

                <div class="cx-body">
                    <div class="cx-log"></div>

                    <h2 class="cx-title" data-text="REGISTRO DE DATOS RECUPERADO">REGISTRO DE DATOS RECUPERADO</h2>
                    <hr class="cx-divider">
                    <p class="cx-sub">Gloria a la humanidad</p>

                    <div class="cx-id">
                        <div class="cx-id-row">
                            <span class="cx-id-label">Unidad</span>
                            <span class="cx-id-value">EDWIN ZO<span class="cx-cursor">_</span></span>
                        </div>
                        <div class="cx-id-row">
                            <span class="cx-id-label">Modelo</span>
                            <span class="cx-id-value">POD DE DESARROLLO</span>
                        </div>
                        <div class="cx-id-row">
                            <span class="cx-id-label">Afiliación</span>
                            <span class="cx-id-value">YoRHa</span>
                        </div>
                        <div class="cx-id-row">
                            <span class="cx-id-label">N.º de unidad</span>
                            <span class="cx-id-value">${idUnidad}</span>
                        </div>
                    </div>

                    <div class="cx-blackbox">
                        <span class="cx-blackbox-dot"></span>
                        <span>CAJA NEGRA RECUPERADA · ${new Date().getFullYear()}</span>
                    </div>

                    <button type="button" class="cx-btn">&lt; CERRAR ENLACE &gt;</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const panel = overlay.querySelector('.cx-panel');
        const cuerpo = overlay.querySelector('.cx-body');
        const logEl = overlay.querySelector('.cx-log');
        let glitchId = null;

        ejecutarBootLog(logEl).then(() => {
            cuerpo.classList.add('cx-revelado');
            stutter([523, 659, 784], 0.075, 'square', 0.045, 0.09);
            glitchId = iniciarGlitchLoop(panel);
        });

        const cerrar = () => {
            if (glitchId) clearInterval(glitchId);
            sonidoCierre();
            overlay.classList.remove('visible');
            reproductorA.pause();
            reproductorA.currentTime = 0;
            setTimeout(() => overlay.remove(), 350);
        };
        overlay.querySelector('.cx-btn').addEventListener('click', cerrar);
        overlay.addEventListener('click', (ev) => { if (ev.target === overlay) cerrar(); });
    }
})();

(function () {
    const patronB = ['KeyB', 'KeyO', 'KeyC', 'KeyC', 'KeyH', 'KeyI', 'KeyF', 'KeyA', 'KeyD', 'KeyE'];
    let pasoB = 0;

    const recursoB = './assets/audio/transition.mp3';
    const reproductorB = new Audio(recursoB);
    reproductorB.volume = 0.6;
    reproductorB.preload = 'auto';

    let activoB = false;

    document.addEventListener('keydown', (e) => {
        if (e.code === patronB[pasoB]) {
            pasoB++;
            if (pasoB === patronB.length) {
                ejecutarCapaB();
                pasoB = 0;
            }
        } else {
            pasoB = (e.code === patronB[0]) ? 1 : 0;
        }
    });

    function tocarB() {
        try {
            reproductorB.currentTime = 0;
            reproductorB.play().catch(() => {
            });
        } catch (err) {
        }
    }

    function romperEnBloques(el) {
        if (!el || el.dataset.bfIdo) return;
        const rect = el.getBoundingClientRect();
        if (rect.width < 6 || rect.height < 6) {
            el.classList.add('bf-fade-out');
            return;
        }
        el.dataset.bfIdo = '1';

        const filas = 2 + Math.floor(Math.random() * 2);
        const columnas = 2 + Math.floor(Math.random() * 2);

        const envoltorio = document.createElement('div');
        envoltorio.className = 'bf-shatter-wrap';
        envoltorio.style.left = rect.left + 'px';
        envoltorio.style.top = rect.top + 'px';
        envoltorio.style.width = rect.width + 'px';
        envoltorio.style.height = rect.height + 'px';

        for (let f = 0; f < filas; f++) {
            for (let c = 0; c < columnas; c++) {
                const pieza = el.cloneNode(true);
                pieza.className = 'bf-shard';
                pieza.style.width = rect.width + 'px';
                pieza.style.height = rect.height + 'px';

                const x0 = (c / columnas) * 100, x1 = ((c + 1) / columnas) * 100;
                const y0 = (f / filas) * 100, y1 = ((f + 1) / filas) * 100;
                pieza.style.clipPath = `inset(${y0}% ${100 - x1}% ${100 - y1}% ${x0}%)`;

                const dx = (Math.random() - 0.5) * 180;
                const dy = 220 + Math.random() * 260;
                const rot = (Math.random() - 0.5) * 260;
                const retardo = Math.random() * 140;

                pieza.style.setProperty('--bf-dx', dx.toFixed(0) + 'px');
                pieza.style.setProperty('--bf-dy', dy.toFixed(0) + 'px');
                pieza.style.setProperty('--bf-rot', rot.toFixed(0) + 'deg');
                pieza.style.animationDelay = retardo.toFixed(0) + 'ms';

                envoltorio.appendChild(pieza);
            }
        }

        el.style.visibility = 'hidden';
        document.body.appendChild(envoltorio);
        setTimeout(() => envoltorio.remove(), 1500);
    }

    function dispararFuera(el) {
        if (!el || el.dataset.bfIdo) return;
        el.dataset.bfIdo = '1';

        const dir = Math.random() < 0.5 ? -1 : 1;
        const dx = dir * (420 + Math.random() * 520);
        const dy = (Math.random() - 0.65) * 260;
        const rot = dir * (160 + Math.random() * 300);

        el.style.setProperty('--bf-dx', dx.toFixed(0) + 'px');
        el.style.setProperty('--bf-dy', dy.toFixed(0) + 'px');
        el.style.setProperty('--bf-rot', rot.toFixed(0) + 'deg');
        el.classList.add('bf-shot');
    }

    function desvanecer(el) {
        if (!el || el.dataset.bfIdo) return;
        el.dataset.bfIdo = '1';
        el.classList.add('bf-fade-out');
    }

    function efectoAleatorio(el, opciones) {
        const lista = opciones || [desvanecer, romperEnBloques, dispararFuera];
        const fn = lista[Math.floor(Math.random() * lista.length)];
        fn(el);
    }

    function ejecutarCapaB() {
        if (activoB) return;

        const contenedor = document.querySelector('.folder-container') || document.querySelector('main');
        if (!contenedor) return;

        activoB = true;
        tocarB();

        const TOTAL_MS = 41000;

        const secundarios = [];
        const tabs = document.querySelector('.folder-tabs');
        document.querySelectorAll('.tab-button').forEach((el) => secundarios.push(el));

        const activo = document.querySelector('.tab-content.active');
        if (activo) {
            const titulo = activo.querySelector('h3');
            if (titulo) secundarios.push(titulo);

            const subtitulo = activo.querySelector('.form-subtitle');
            if (subtitulo) secundarios.push(subtitulo);

            activo.querySelectorAll('.form-hint').forEach((el) => secundarios.push(el));
        }

        const pie = document.querySelector('footer');
        if (pie) secundarios.push(pie);

        secundarios.forEach((el, i) => {
            setTimeout(() => efectoAleatorio(el), 6500 + i * 900 + Math.random() * 400);
        });

        if (activo) {
            activo.querySelectorAll('.input-group').forEach((el, i) => {
                setTimeout(() => {
                    efectoAleatorio(el, [desvanecer, romperEnBloques]);
                }, 19000 + i * 1600 + Math.random() * 500);
            });

            const botonesActivo = [];
            const boton = activo.querySelector('.btn-submit');
            if (boton) botonesActivo.push(boton);
            activo.querySelectorAll('.btn-switch-link, .btn-toggle-password').forEach((el) => botonesActivo.push(el));
            botonesActivo.forEach((el, i) => {
                setTimeout(() => {
                    el.classList.add('bf-parpadeo');
                    setTimeout(() => {
                        el.classList.remove('bf-parpadeo');
                        efectoAleatorio(el, [desvanecer, dispararFuera]);
                    }, 260 + Math.random() * 260);
                }, 21000 + i * 1200 + Math.random() * 400);
            });
        }

        [22500, 26800, 29500].forEach((momento) => {
            setTimeout(() => {
                contenedor.classList.add('bf-glitch');
                setTimeout(() => contenedor.classList.remove('bf-glitch'), 180);
            }, momento + Math.random() * 400);
        });

        const header = document.querySelector('header');
        setTimeout(() => { if (header) dispararFuera(header); }, 31500);
        setTimeout(() => { if (tabs) efectoAleatorio(tabs, [desvanecer, romperEnBloques]); }, 34000);

        setTimeout(() => {
            contenedor.classList.add('bf-fade-final');
        }, 40200);

        setTimeout(() => { activoB = false; }, TOTAL_MS + 5000);
    }
})();