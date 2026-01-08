/* ==================== PORTAL CLIENTE - FLUJO SIMPLIFICADO ==================== */

// Variables globales
let empresaIdReserva = null;  // Empresa seleccionada para reservar turno
let clienteAutenticado = null;
let cacheDisponibilidad = {};
let mapaDiasDisponibles = {};

// URLs de la API
const API_CLIENTE = {
    registro: `${API_BASE_URL}/cliente/registro`,
    login: `${API_BASE_URL}/cliente/login`,
    perfil: `${API_BASE_URL}/cliente/perfil`,
    empresas: `${API_BASE_URL}/publico/empresas`,
    profesionales: (id) => `${API_BASE_URL}/cliente/empresa/${id}/profesionales`,
    disponibilidadesResumen: (id) => `${API_BASE_URL}/cliente/empresa/${id}/profesionales/disponibilidades-resumen`,
    horariosDisponibles: (id) => `${API_BASE_URL}/cliente/empresa/${id}/horarios-disponibles`,
    reservarTurno: (id) => `${API_BASE_URL}/cliente/empresa/${id}/reservar-turno`,
    todosMisTurnos: `${API_BASE_URL}/cliente/todos-mis-turnos`,
    cancelarTurno: (id, turnoId) => `${API_BASE_URL}/cliente/empresa/${id}/turno/${turnoId}/cancelar`,
    modificarTurno: (id, turnoId) => `${API_BASE_URL}/cliente/empresa/${id}/turno/${turnoId}/modificar`
};

// Headers de autenticación
function getClienteAuthHeaders() {
    const token = localStorage.getItem("clienteToken");
    return {
        "Content-Type": "application/json",
        "x-access-token-cliente": token || ""
    };
}

/* ==================== INICIALIZACIÓN ==================== */
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem("clienteToken");
    const clienteData = localStorage.getItem("clienteData");

    if (token && clienteData) {
        clienteAutenticado = JSON.parse(clienteData);
        mostrarDashboard();
    } else {
        mostrarSeccionAuth();
    }

    // Event listeners para forms
    document.getElementById('formLogin')?.addEventListener('submit', handleLogin);
    document.getElementById('formRegistro')?.addEventListener('submit', handleRegistro);
    document.getElementById('formReservar')?.addEventListener('submit', reservarTurno);
    document.getElementById('formPerfil')?.addEventListener('submit', guardarPerfil);
});

/* ==================== AUTENTICACIÓN ==================== */
function mostrarTab(tab) {
    document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    if (tab === 'login') {
        document.getElementById('tab-login').style.display = 'block';
        document.querySelectorAll('.tab-btn')[0].classList.add('active');
    } else {
        document.getElementById('tab-registro').style.display = 'block';
        document.querySelectorAll('.tab-btn')[1].classList.add('active');
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const dni = document.getElementById('loginDni').value;
    const password = document.getElementById('loginPassword').value;

    try {
        const response = await fetch(API_CLIENTE.login, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dni, password })
        });

        const data = await response.json();

        if (response.ok) {
            localStorage.setItem('clienteToken', data.token);
            localStorage.setItem('clienteData', JSON.stringify(data.cliente));
            clienteAutenticado = data.cliente;
            mostrarDashboard();
        } else {
            mostrarMensaje(data.message || 'Error al iniciar sesión', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

async function handleRegistro(e) {
    e.preventDefault();
    
    const datos = {
        dni: document.getElementById('regDni').value,
        password: document.getElementById('regPassword').value,
        nombre: document.getElementById('regNombre').value,
        apellido: document.getElementById('regApellido').value,
        email: document.getElementById('regEmail').value || null,
        telefono: document.getElementById('regTelefono').value || null
    };

    try {
        const response = await fetch(API_CLIENTE.registro, {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(datos)
        });

        const data = await response.json();

        if (response.ok) {
            mostrarMensaje('Cuenta creada exitosamente. Por favor inicia sesión.', 'exito');
            mostrarTab('login');
            document.getElementById('formRegistro').reset();
        } else {
            mostrarMensaje(data.message || 'Error al crear cuenta', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

function cerrarSesion() {
    localStorage.removeItem('clienteToken');
    localStorage.removeItem('clienteData');
    clienteAutenticado = null;
    window.location.reload();
}

/* ==================== NAVEGACIÓN ==================== */
function mostrarSeccionAuth() {
    document.getElementById('seccion-auth').style.display = 'block';
    document.getElementById('dashboard-principal').style.display = 'none';
    document.getElementById('panel-reserva').style.display = 'none';
    document.getElementById('seccion-perfil').style.display = 'none';
    document.getElementById('nav-global').style.display = 'none';
}

async function mostrarDashboard() {
    // Ocultar auth y mostrar dashboard
    document.getElementById('seccion-auth').style.display = 'none';
    document.getElementById('dashboard-principal').style.display = 'block';
    document.getElementById('panel-reserva').style.display = 'none';
    document.getElementById('seccion-perfil').style.display = 'none';
    
    // Mostrar navegación
    document.getElementById('nav-global').style.display = 'flex';
    document.getElementById('btn-volver').style.display = 'none';
    
    // Actualizar nombre
    if (clienteAutenticado) {
        document.getElementById('clienteNombreNavGlobal').textContent = 
            `👤 ${clienteAutenticado.nombre} ${clienteAutenticado.apellido}`;
    }
    
    // Cargar todos los turnos
    await cargarTodosLosTurnos();
}

function volverADashboard() {
    empresaIdReserva = null;
    cacheDisponibilidad = {};
    mapaDiasDisponibles = {};
    mostrarDashboard();
}

/* ==================== RESERVA DE TURNOS ==================== */
async function iniciarReserva() {
    document.getElementById('dashboard-principal').style.display = 'none';
    document.getElementById('panel-reserva').style.display = 'block';
    document.getElementById('btn-volver').style.display = 'inline-block';
    
    // Cargar empresas
    await cargarEmpresasParaReserva();
}

function cancelarReserva() {
    document.getElementById('formReservar').reset();
    document.getElementById('selectProfesional').innerHTML = '<option value="">Primero selecciona un sector...</option>';
    empresaIdReserva = null;
    volverADashboard();
}

async function cargarEmpresasParaReserva() {
    try {
        const response = await fetch(API_CLIENTE.empresas);
        const empresas = await response.json();

        const select = document.getElementById('selectEmpresaReserva');
        select.innerHTML = '<option value="">Selecciona un sector...</option>';
        
        empresas.forEach(emp => {
            const option = document.createElement('option');
            option.value = emp.id;
            option.textContent = emp.nombre;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando empresas:', error);
    }
}

async function cambiarEmpresaReserva() {
    const selectEmpresa = document.getElementById('selectEmpresaReserva');
    empresaIdReserva = selectEmpresa.value;
    
    if (!empresaIdReserva) {
        document.getElementById('selectProfesional').innerHTML = '<option value="">Primero selecciona un sector...</option>';
        return;
    }
    
    // Limpiar caches
    cacheDisponibilidad = {};
    mapaDiasDisponibles = {};
    
    // Cargar profesionales y disponibilidad
    await Promise.all([
        cargarProfesionalesParaReserva(),
        cargarResumenDisponibilidadCliente()
    ]);
}

async function cargarProfesionalesParaReserva() {
    try {
        const response = await fetch(API_CLIENTE.profesionales(empresaIdReserva), {
            headers: getClienteAuthHeaders()
        });
        const profesionales = await response.json();

        const select = document.getElementById('selectProfesional');
        select.innerHTML = '<option value="">Selecciona un profesional...</option>';
        
        profesionales.forEach(prof => {
            const option = document.createElement('option');
            option.value = prof.id;
            option.textContent = `${prof.name} ${prof.surname}`;
            option.dataset.especialidad = prof.especialidad || 'General';
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error cargando profesionales:', error);
    }
}

async function cargarResumenDisponibilidadCliente() {
    if (!empresaIdReserva) return;
    
    try {
        // Usar función compartida de utils.js (isCliente = true)
        if (window.cargarResumenDisponibilidad) {
            mapaDiasDisponibles = await window.cargarResumenDisponibilidad(
                empresaIdReserva, 
                getClienteAuthHeaders,
                true  // isCliente = true para usar URL de cliente
            );
        } else {
            // Fallback si utils.js no cargó
            const response = await fetch(API_CLIENTE.disponibilidadesResumen(empresaIdReserva), {
                headers: getClienteAuthHeaders()
            });
            if (response.ok) {
                mapaDiasDisponibles = await response.json();
            }
        }
    } catch (error) {
        console.error('Error cargando disponibilidad:', error);
    }
}

async function actualizarInfoProfesional() {
    const selectProfesional = document.getElementById('selectProfesional');
    const infoEspecialidad = document.getElementById('infoEspecialidad');
    const infoDiasDisponibles = document.getElementById('infoDiasDisponibles');
    
    if (!selectProfesional) return;
    
    const profesionalId = selectProfesional.value;
    
    // Usar función compartida de utils.js
    if (window.mostrarInfoProfesional) {
        window.mostrarInfoProfesional(
            profesionalId,
            mapaDiasDisponibles,
            selectProfesional,
            infoEspecialidad,
            infoDiasDisponibles
        );
    }
}

async function cargarHorariosDisponibles() {
    const selectProfesional = document.getElementById('selectProfesional');
    const fechaInput = document.getElementById('fechaTurno');
    const selectHora = document.getElementById('horaTurno');
    
    if (!selectProfesional || !fechaInput || !selectHora) return;
    
    const profesionalId = selectProfesional.value;
    const fecha = fechaInput.value;
    
    if (!profesionalId || !fecha) {
        selectHora.innerHTML = '<option value="">Selecciona profesional y fecha</option>';
        selectHora.disabled = true;
        return;
    }
    
    // Verificar cache
    const cacheKey = `${profesionalId}_${fecha}`;
    if (cacheDisponibilidad[cacheKey]) {
        // Usar función compartida para procesar horarios
        if (window.procesarHorarios) {
            window.procesarHorarios(cacheDisponibilidad[cacheKey], selectHora, null, true);
        }
        return;
    }

    selectHora.innerHTML = '<option value="">Cargando horarios...</option>';
    selectHora.disabled = true;
    
    try {
        const url = `${API_CLIENTE.horariosDisponibles(empresaIdReserva)}?profesional_id=${profesionalId}&fecha=${fecha}`;
        const response = await fetch(url, {
            headers: getClienteAuthHeaders()
        });
        const data = await response.json();
        
        if (response.ok && data.horarios_disponibles) {
            cacheDisponibilidad[cacheKey] = data.horarios_disponibles;
            // Usar función compartida para procesar horarios
            if (window.procesarHorarios) {
                window.procesarHorarios(data.horarios_disponibles, selectHora, null, true);
            } else {
                // Fallback
                selectHora.innerHTML = '<option value="">Selecciona una hora...</option>';
                data.horarios_disponibles.forEach(h => {
                    const opt = document.createElement('option');
                    opt.value = h.datetime;
                    opt.textContent = h.hora;
                    selectHora.appendChild(opt);
                });
                selectHora.disabled = false;
            }
        } else {
            selectHora.innerHTML = '<option value="">Error al cargar horarios</option>';
        }
    } catch (error) {
        console.error('Error:', error);
        selectHora.innerHTML = '<option value="">Error de conexión</option>';
    }
}

async function reservarTurno(e) {
    e.preventDefault();
    
    const datos = {
        profesional_id: parseInt(document.getElementById('selectProfesional').value),
        start_datetime: document.getElementById('horaTurno').value,
        observaciones: document.getElementById('observacionesTurno').value.trim() || null
    };
    
    if (!empresaIdReserva) {
        mostrarMensaje('Error: No se ha seleccionado un sector', 'error');
        return;
    }
    
    try {
        const response = await fetch(API_CLIENTE.reservarTurno(empresaIdReserva), {
            method: 'POST',
            headers: getClienteAuthHeaders(),
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje('¡Turno reservado exitosamente!', 'exito');
            
            // Limpiar cache
            const cacheKey = `${datos.profesional_id}_${document.getElementById('fechaTurno').value}`;
            delete cacheDisponibilidad[cacheKey];
            
            // Volver al dashboard
            document.getElementById('formReservar').reset();
            setTimeout(() => volverADashboard(), 1500);
        } else {
            mostrarMensaje(data.message || 'Error al reservar turno', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

/* ==================== GESTIÓN DE TURNOS ==================== */
async function cargarTodosLosTurnos() {
    const container = document.getElementById('resultados-turnos-todas-areas');
    
    try {
        const response = await fetch(API_CLIENTE.todosMisTurnos, {
            headers: getClienteAuthHeaders()
        });
        const turnos = await response.json();
        
        if (response.ok && Array.isArray(turnos)) {
            mostrarTurnos(turnos, container);
        } else {
            container.innerHTML = '<p class="help-text">No se pudieron cargar los turnos</p>';
        }
    } catch (error) {
        console.error('Error:', error);
        container.innerHTML = '<p class="mensaje-error">Error de conexión</p>';
    }
}

function mostrarTurnos(turnos, container) {
    container.innerHTML = '';
    
    if (!turnos || turnos.length === 0) {
        container.innerHTML = '<p class="help-text">No tienes turnos programados</p>';
        return;
    }
    
    turnos.forEach(turno => {
        const card = document.createElement('div');
        card.className = 'turno-card';
        
        const fechaFormateada = formatearFecha(turno.start_datetime);
        const especialidad = turno.profesional_especialidad || turno.servicio_nombre || 'Consulta General';
        const fechaHoraTurno = new Date(turno.start_datetime);
        const ahora = new Date();
        const puedeModificar = turno.status !== 'Cancelado' && turno.status !== 'Completado' && fechaHoraTurno > ahora;
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h3 style="margin: 0;">${especialidad}</h3>
                <span class="status ${turno.status.toLowerCase()}">${turno.status}</span>
            </div>
            <div class="turno-info">
                <div class="info-item">
                    <strong>Sector:</strong>
                    <span>${turno.empresa_nombre || 'No especificado'}</span>
                </div>
                <div class="info-item">
                    <strong>Profesional:</strong>
                    <span>${turno.profesional_nombre || ''} ${turno.profesional_apellido || ''}</span>
                </div>
                <div class="info-item">
                    <strong>Fecha y Hora:</strong>
                    <span>${fechaFormateada}</span>
                </div>
                ${turno.observaciones ? `
                <div class="info-item">
                    <strong>Observaciones:</strong>
                    <span>${turno.observaciones}</span>
                </div>
                ` : ''}
            </div>
            ${puedeModificar ? `
            <div style="margin-top: 1rem;">
                <button class="btn-danger btn-sm" onclick="cancelarTurnoCliente(${turno.id}, ${turno.empresa_id})">
                    🗑️ Cancelar Turno
                </button>
            </div>
            ` : ''}
        `;
        
        container.appendChild(card);
    });
}

async function cancelarTurnoCliente(turnoId, empresaId) {
    if (!confirm('¿Estás seguro de que deseas cancelar este turno?')) {
        return;
    }
    
    try {
        const response = await fetch(API_CLIENTE.cancelarTurno(empresaId, turnoId), {
            method: 'PUT',
            headers: getClienteAuthHeaders()
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje('Turno cancelado exitosamente', 'exito');
            cargarTodosLosTurnos();
        } else {
            mostrarMensaje(data.message || 'Error al cancelar', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

/* ==================== PERFIL ==================== */
function verPerfilGlobal() {
    document.getElementById('dashboard-principal').style.display = 'none';
    document.getElementById('panel-reserva').style.display = 'none';
    document.getElementById('seccion-perfil').style.display = 'block';
    document.getElementById('btn-volver').style.display = 'inline-block';
    
    cargarPerfil();
}

async function cargarPerfil() {
    try {
        const response = await fetch(API_CLIENTE.perfil, {
            headers: getClienteAuthHeaders()
        });
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('perfilNombre').value = data.nombre || '';
            document.getElementById('perfilApellido').value = data.apellido || '';
            document.getElementById('perfilEmail').value = data.email || '';
            document.getElementById('perfilTelefono').value = data.telefono || '';
            document.getElementById('perfilDni').value = data.dni || '';
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

async function guardarPerfil(e) {
    e.preventDefault();
    
    const datos = {
        nombre: document.getElementById('perfilNombre').value,
        apellido: document.getElementById('perfilApellido').value,
        email: document.getElementById('perfilEmail').value,
        telefono: document.getElementById('perfilTelefono').value,
        password: document.getElementById('perfilPassword').value,
        dni: document.getElementById('perfilDni').value
    };
    
    try {
        const response = await fetch(API_CLIENTE.perfil, {
            method: 'PUT',
            headers: getClienteAuthHeaders(),
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje('Perfil actualizado correctamente', 'exito');
            document.getElementById('perfilPassword').value = '';
            
            if (clienteAutenticado) {
                clienteAutenticado.nombre = datos.nombre;
                clienteAutenticado.apellido = datos.apellido;
                localStorage.setItem('clienteData', JSON.stringify(clienteAutenticado));
                
                document.getElementById('clienteNombreNavGlobal').textContent = 
                    `👤 ${datos.nombre} ${datos.apellido}`;
            }
        } else {
            mostrarMensaje(data.message || 'Error al actualizar perfil', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarMensaje('Error de conexión', 'error');
    }
}

/* ==================== UTILIDADES ==================== */
function formatearFecha(datetimeStr) {
    // Usar función compartida de utils.js si está disponible
    if (window.formatearFechaCompleta) {
        return window.formatearFechaCompleta(datetimeStr);
    }
    // Fallback por si utils.js no cargó
    const fecha = new Date(datetimeStr);
    const opciones = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    return fecha.toLocaleDateString('es-ES', opciones);
}

function mostrarMensaje(mensaje, tipo = 'info') {
    const modal = document.getElementById('modalConfirmacion');
    const modalTitulo = document.getElementById('modalTitulo');
    const modalMensaje = document.getElementById('modalMensaje');
    
    modalTitulo.textContent = tipo === 'exito' ? '¡Éxito!' : tipo === 'error' ? 'Error' : 'Información';
    modalMensaje.textContent = mensaje;
    modalMensaje.className = '';
    if (tipo === 'exito') {
        modalMensaje.classList.add('mensaje-exito');
    } else if (tipo === 'error') {
        modalMensaje.classList.add('mensaje-error');
    }
    modal.style.display = 'flex';
}

function cerrarModal() {
    document.getElementById('modalConfirmacion').style.display = 'none';
}
