// Control de las tres pestañas principales del folder
function cambiarPestañaPrincipal(rolId) {
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));

    document.getElementById('tab-' + rolId).classList.add('active');
    document.getElementById('btn-tab-' + rolId).classList.add('active');

    // Si vuelves a la pestaña de estudiante, asegura restablecer al subformulario de estudiante primero
    if (rolId === 'estudiante') {
        conmutarSubFormulario('estudiante');
    }
}

// Intercambio rápido de formularios internos en la pestaña de estudiante
function conmutarSubFormulario(subRol) {
    document.querySelectorAll('.sub-form-content').forEach(sf => sf.classList.remove('active'));
    document.getElementById('sub-form-' + subRol).classList.add('active');
}