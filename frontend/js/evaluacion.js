const bancoPreguntas = {
    1: "Planteamiento del problema, justificación y definición clara de objetivos.",
    2: "Dominio, rigor científico y profundidad conceptual del tema expuesto.",
    3: "Metodología utilizada, materiales, desarrollo y consistencia de la investigación.",
    4: "Resultados obtenidos, conclusiones alcanzadas o aportaciones esperadas.",
    5: "Uso correcto del tiempo asignado para la exposición oral.",
    6: "Claridad, fluidez, dicción y propiedad en la expresión oral.",
    7: "Calidad de las diapositivas, recursos audiovisuales y herramientas de apoyo.",
    8: "Organización, estructura y secuencia lógica de la presentación.",
    9: "Estructura formal del reporte escrito entregado previamente.",
    10: "Actualización, pertinencia y calidad de las referencias bibliográficas.",
    11: "Cumplimiento del plan de trabajo y cronograma establecido.",
    12: "Capacidad de respuesta y debate crítico ante las preguntas del sínodo."
};

let esEvaluadorAutenticado = false;
let contadorAlumnos = 3;

// Conmutador de roles dinámico
function conmutarModoRol() {
    const rolSeleccionado = document.querySelector('input[name="evaluador_rol"]:checked').value;
    const bloqueAdmin = document.getElementById('bloque-admin-captura');

    if (rolSeleccionado === "Evaluador") {
        if (!esEvaluadorAutenticado) {
            // Abrir modal de seguridad si no está logueado
            document.getElementById('modal-login').classList.remove('hidden');
            document.getElementById('mod_usuario').focus();
        } else {
            bloqueAdmin.classList.remove('hidden');
        }
    } else {
        bloqueAdmin.classList.add('hidden');
    }
    evaluarFlujoProgresivo();
}

// Validación simulada de Credenciales de Evaluador
function procesarLoginEvaluador() {
    const user = document.getElementById('mod_usuario').value.trim();
    const pass = document.getElementById('mod_password').value.trim();
    const errorMsg = document.getElementById('error-login');

    // Credenciales fijas de ejemplo (reemplazables por tu API/BD backend)
    if (user === "admin" && pass === "unida2026") {
        esEvaluadorAutenticado = true;
        errorMsg.classList.add('hidden');
        document.getElementById('modal-login').classList.add('hidden');
        document.getElementById('bloque-admin-captura').classList.remove('hidden');

        // Limpiar formulario modal
        document.getElementById('mod_usuario').value = '';
        document.getElementById('mod_password').value = '';
        evaluarFlujoProgresivo();
    } else {
        errorMsg.classList.remove('hidden');
    }
}

function cancelarLoginEvaluador() {
    // Regresar la selección al rol "Estudiante" por seguridad
    document.getElementById('rol-alumno').checked = true;
    document.getElementById('modal-login').classList.add('hidden');
    document.getElementById('error-login').classList.add('hidden');
    conmutarModoRol();
}

// Registro en caliente de estudiantes para la lista del paso 1
function registrarNuevoEstudianteEnLista() {
    const nombre = document.getElementById('reg_alumno_nombre').value.trim();
    const proyecto = document.getElementById('reg_alumno_proyecto').value.trim();
    const programa = document.getElementById('reg_alumno_programa').value;
    const selectEvaluado = document.getElementById('select-evaluado');

    if (!nombre || !proyecto) {
        alert("Por favor, capture el nombre del alumno y el título del proyecto completo.");
        return;
    }

    const nuevaOpcion = document.createElement('option');
    nuevaOpcion.value = `alumno_dinamico_${contadorAlumnos++}`;
    nuevaOpcion.setAttribute('data-proyecto', proyecto);
    nuevaOpcion.setAttribute('data-programa', programa);
    nuevaOpcion.textContent = `${nombre} — Proyecto: ${proyecto.substring(0, 45)}...`;

    selectEvaluado.appendChild(nuevaOpcion);

    // Limpiar campos de captura
    document.getElementById('reg_alumno_nombre').value = '';
    document.getElementById('reg_alumno_proyecto').value = '';

    alert(`¡Estudiante "${nombre}" registrado con éxito en la lista desplegable!`);
    evaluarFlujoProgresivo();
}

// Desbloqueo incremental
function evaluarFlujoProgresivo() {
    const nombreEvaluador = document.getElementById('evaluador_nombre').value.trim();
    document.getElementById('sec-paso1').classList.toggle('disabled', nombreEvaluador.length < 4);
}

// Autocompletado del estudiante seleccionado
function cargarDatosAlumnoAutomático() {
    const select = document.getElementById('select-evaluado');
    const opcionSeleccionada = select.options[select.selectedIndex];

    const campoProyecto = document.getElementById('proyecto_titulo');
    const campoPrograma = document.getElementById('proyecto_programa');

    const proyecto = opcionSeleccionada.getAttribute('data-proyecto');
    const programa = opcionSeleccionada.getAttribute('data-programa');

    campoProyecto.value = proyecto;
    campoPrograma.value = programa;

    renderSeminariosDinamicos(programa);
    document.getElementById('sec-paso2').classList.remove('disabled');
}

// Render condicional del seminario
function renderSeminariosDinamicos(programa) {
    const contenedor = document.getElementById('contenedor-seminarios-dinamicos');
    contenedor.innerHTML = '';

    let opciones = programa === "Maestría"
        ? [{ id: "sem-proto", label: "Protocolo" }, { id: "sem-culmi", label: "Culminación" }]
        : [{ id: "sem-proto", label: "Protocolo" }, { id: "sem-av1", label: "Primer avance" }, { id: "sem-av2", label: "Segundo avance" }, { id: "sem-culmi", label: "Culminación" }];

    opciones.forEach(opt => {
        contenedor.innerHTML += `
            <div class="radio-btn">
            <input type="radio" id="${opt.id}" name="tipo_seminario" value="${opt.label}" required onchange="desbloquearPaso3()">
            <label for="${opt.id}">${opt.label}</label>
            </div>`;
    });
}

function desbloquearPaso3() {
    document.getElementById('sec-paso3').classList.remove('disabled');
    validarComentarios();
}

// Inyección de preguntas
function construirQuest(containerId, min, max, maxEscala) {
    const container = document.getElementById(containerId);
    for (let i = min; i <= max; i++) {
        let optionsHtml = '';
        for (let j = 1; j <= maxEscala; j++) {
            optionsHtml += `
            <div class="scale-box">
            <input type="radio" id="P${i}-${j}" name="P${i}" value="${j}" required onchange="validarComentarios()">
            <label for="P${i}-${j}">${j}</label>
        </div>`;
        }
        container.innerHTML += `
            <div class="quest-card">
            <div class="quest-header">P${i}. ${bancoPreguntas[i]}</div>
            <div class="scale-row">${optionsHtml}</div>
            </div>`;
    }
}
construirQuest('quest-container-10', 1, 8, 10);
construirQuest('quest-container-5', 9, 12, 5);

// Validación de comentarios obligatorios
function validarComentarios() {
    const texto = document.getElementById('txt-comentarios').value.trim();
    const info = document.getElementById('comentarios-info');
    const formValido = document.getElementById('evalForm').checkValidity();

    info.textContent = `${texto.length} / 50 caracteres`;

    if (texto.length >= 50 && formValido) {
        info.className = "char-counter valid";
        document.getElementById('btn-enviar-todo').disabled = false;
    } else {
        info.className = "char-counter";
        document.getElementById('btn-enviar-todo').disabled = true;
    }
}

function enviarEvaluacionCompleta(event) {
    event.preventDefault();
    alert("¡Evaluación de Seminario registrada de manera exitosa!");
}