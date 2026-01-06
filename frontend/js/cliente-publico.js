/* ==================== VISTA PARA CLIENTES AUTENTICADOS ==================== */

// Variables globales
let empresaIdSeleccionada = null;
let servicios = [];
let profesionales = [];
let empresaIdFromURL = null;
let clienteAutenticado = null;

// URLs de la API
const API_CLIENTE = {
    registro: `${API_BASE_URL}/cliente/registro`,
    login: `${API_BASE_URL}/cliente/login`,
    perfil: `${API_BASE_URL}/cliente/perfil`,
    empresas: `${API_BASE_URL}/publico/empresas`,
    servicios: (id) => `${API_BASE_URL}/cliente/empresa/${id}/servicios`,
    profesionales: (id) => `${API_BASE_URL}/cliente/empresa/${id}/profesionales`,
    disponibilidades: (id) => `${API_BASE_URL}/cliente/empresa/${id}/disponibilidades`,
    diasDisponibles: (id, profId) => `${API_BASE_URL}/cliente/empresa/${id}/profesional/${profId}/dias-disponibles`,
    horariosDisponibles: (id) => `${API_BASE_URL}/cliente/empresa/${id}/horarios-disponibles`,
    reservarTurno: (id) => `${API_BASE_URL}/cliente/empresa/${id}/reservar-turno`,
    misTurnos: (id) => `${API_BASE_URL}/cliente/empresa/${id}/mis-turnos`,
    cancelarTurno: (id, turnoId) => `${API_BASE_URL}/cliente/empresa/${id}/turno/${turnoId}/cancelar`,
    modificarTurno: (id, turnoId) => `${API_BASE_URL}/cliente/empresa/${id}/turno/${turnoId}/modificar`,
    todosMisTurnos: `${API_BASE_URL}/cliente/todos-mis-turnos`
};

// Headers de autenticación para cliente
function getClienteAuthHeaders() {
    const token = localStorage.getItem("clienteToken");
    return {
        "Content-Type": "application/json",
        "x-access-token-cliente": token || ""
    };
}

// Inicialización
document.addEventListener('DOMContentLoaded', () => {
    // Verificar si hay sesión activa
    const token = localStorage.getItem("clienteToken");
    const clienteData = localStorage.getItem("clienteData");
    
    if (token && clienteData) {
        clienteAutenticado = JSON.parse(clienteData);
        mostrarPanelPrincipal();
    } else {
        mostrarSeccionAuth();
    }
    
    // Verificar si hay empresa_id en la URL
    const urlParams = new URLSearchParams(window.location.search);
    empresaIdFromURL = urlParams.get('empresa_id');
    
    configurarEventos();
});

// Configurar eventos
function configurarEventos() {
    // Tabs de autenticación
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            cambiarTabAuth(tabName);
        });
    });
    
    // Formulario de login
    const loginForm = document.getElementById('loginForm');
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await loginCliente();
    });
    
    // Formulario de registro
    const registroForm = document.getElementById('registroForm');
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await registrarCliente();
    });
    
    // Validación de confirmación de contraseña
    document.getElementById('regPasswordConfirm').addEventListener('input', validarPasswordMatch);
    
    // Botón continuar empresa
    const btnContinuar = document.getElementById('btnContinuar');
    const selectEmpresa = document.getElementById('selectEmpresa');
    
    selectEmpresa.addEventListener('change', () => {
        btnContinuar.disabled = !selectEmpresa.value;
    });
    
    btnContinuar.addEventListener('click', continuarConEmpresa);
    
    // Navegación entre secciones
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            cambiarSeccion(section);
        });
    });
    
    // Formulario de reserva
    const formReservar = document.getElementById('formReservar');
    if (formReservar) {
        // Remover cualquier listener anterior para evitar duplicados
        const newForm = formReservar.cloneNode(true);
        formReservar.parentNode.replaceChild(newForm, formReservar);
        
        document.getElementById('formReservar').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btnReservar = document.getElementById('btnReservar');
            // Verificar si estamos en modo modificación
            if (btnReservar.dataset.modificando) {
                await modificarTurnoCliente(
                    parseInt(btnReservar.dataset.modificando),
                    parseInt(btnReservar.dataset.empresaId)
                );
            } else {
                await reservarTurno();
            }
        });
    }
    
    // Cambios en el formulario
    const selectProfesional = document.getElementById('selectProfesional');
    const fechaInput = document.getElementById('fechaTurno');
    
    if (selectProfesional) {
        selectProfesional.addEventListener('change', async () => {
            await actualizarInfoProfesional();
            if (fechaInput && fechaInput.value) {
                cargarHorariosDisponibles();
            }
        });
    }
    if (fechaInput) {
        fechaInput.addEventListener('change', cargarHorariosDisponibles);
        // Establecer fecha mínima (hoy)
        const hoy = new Date().toISOString().split('T')[0];
        fechaInput.min = hoy;
        fechaInput.addEventListener('change', validarFechaNoPasado);
    }
    
    // Validar que la hora seleccionada no sea en el pasado
    const selectHora = document.getElementById('horaTurno');
    if (selectHora) {
        selectHora.addEventListener('change', validarHoraNoPasado);
    }
}

// Cambiar tab de autenticación
function cambiarTabAuth(tabName) {
    document.querySelectorAll('.auth-tab').forEach(tab => {
        tab.classList.remove('active');
        if (tab.dataset.tab === tabName) {
            tab.classList.add('active');
        }
    });
    
    document.getElementById('form-login').style.display = 
        tabName === 'login' ? 'block' : 'none';
    document.getElementById('form-registro').style.display = 
        tabName === 'registro' ? 'block' : 'none';
}

// Validar que las contraseñas coincidan
function validarPasswordMatch() {
    const password = document.getElementById('regPassword').value;
    const confirm = document.getElementById('regPasswordConfirm').value;
    const confirmInput = document.getElementById('regPasswordConfirm');
    
    if (confirm && password !== confirm) {
        confirmInput.setCustomValidity('Las contraseñas no coinciden');
    } else {
        confirmInput.setCustomValidity('');
    }
}

// Registrar cliente
async function registrarCliente() {
    const btnRegistro = document.getElementById('btnRegistro');
    btnRegistro.disabled = true;
    btnRegistro.textContent = 'Registrando...';
    
    const datos = {
        dni: document.getElementById('regDni').value.trim(),
        nombre: document.getElementById('regNombre').value.trim(),
        apellido: document.getElementById('regApellido').value.trim(),
        email: document.getElementById('regEmail').value.trim() || null,
        telefono: document.getElementById('regTelefono').value.trim() || null,
        password: document.getElementById('regPassword').value
    };
    
    // Validaciones
    if (!datos.dni || datos.dni.length < 7 || datos.dni.length > 8 || !/^\d+$/.test(datos.dni)) {
        mostrarMensaje('DNI inválido. Debe contener entre 7 y 8 dígitos numéricos', 'error');
        btnRegistro.disabled = false;
        btnRegistro.textContent = 'Registrarse';
        return;
    }
    
    if (datos.password.length < 6) {
        mostrarMensaje('La contraseña debe tener al menos 6 caracteres', 'error');
        btnRegistro.disabled = false;
        btnRegistro.textContent = 'Registrarse';
        return;
    }
    
    if (datos.password !== document.getElementById('regPasswordConfirm').value) {
        mostrarMensaje('Las contraseñas no coinciden', 'error');
        btnRegistro.disabled = false;
        btnRegistro.textContent = 'Registrarse';
        return;
    }
    
    try {
        const response = await fetch(API_CLIENTE.registro, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje('¡Registro exitoso! Ahora puedes iniciar sesión', 'exito');
            // Cambiar a tab de login
            cambiarTabAuth('login');
            // Limpiar formulario
            document.getElementById('registroForm').reset();
        } else {
            mostrarMensaje(data.message || 'Error al registrar', 'error');
        }
    } catch (error) {
        console.error('Error registrando:', error);
        mostrarMensaje('Error de conexión. Por favor intenta nuevamente.', 'error');
    } finally {
        btnRegistro.disabled = false;
        btnRegistro.textContent = 'Registrarse';
    }
}

// Login cliente
async function loginCliente() {
    const btnLogin = document.getElementById('btnLogin');
    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando sesión...';
    
    const datos = {
        dni: document.getElementById('loginDni').value.trim(),
        password: document.getElementById('loginPassword').value
    };
    
    if (!datos.dni || !datos.password) {
        mostrarMensaje('Por favor completa todos los campos', 'error');
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
        return;
    }
    
    try {
        const response = await fetch(API_CLIENTE.login, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Guardar token y datos del cliente
            localStorage.setItem('clienteToken', data.token);
            localStorage.setItem('clienteData', JSON.stringify(data.cliente));
            clienteAutenticado = data.cliente;
            
            mostrarMensaje(`¡Bienvenido ${data.cliente.nombre} ${data.cliente.apellido}!`, 'exito');
            setTimeout(() => {
                mostrarPanelPrincipal();
            }, 1000);
        } else {
            mostrarMensaje(data.message || 'DNI o contraseña incorrectos', 'error');
        }
    } catch (error) {
        console.error('Error en login:', error);
        mostrarMensaje('Error de conexión. Por favor intenta nuevamente.', 'error');
    } finally {
        btnLogin.disabled = false;
        btnLogin.textContent = 'Iniciar Sesión';
    }
}

// Mostrar sección de autenticación
function mostrarSeccionAuth() {
    document.getElementById('seccion-auth').style.display = 'block';
    document.getElementById('seccion-empresa').style.display = 'none';
    document.getElementById('panel-principal').style.display = 'none';
}

// Mostrar panel principal
async function mostrarPanelPrincipal() {
    document.getElementById('seccion-auth').style.display = 'none';
    document.getElementById('seccion-empresa').style.display = 'block';
    document.getElementById('panel-principal').style.display = 'none';
    
    // Actualizar nombre del cliente en ambas navegaciones
    const clienteNombreNav = document.getElementById('clienteNombreNav');
    const clienteNombreNavSeleccion = document.getElementById('clienteNombreNavSeleccion');
    
    if (clienteAutenticado) {
        const nombreCompleto = `👤 ${clienteAutenticado.nombre} ${clienteAutenticado.apellido}`;
        if (clienteNombreNav) {
            clienteNombreNav.textContent = nombreCompleto;
        }
        if (clienteNombreNavSeleccion) {
            clienteNombreNavSeleccion.textContent = nombreCompleto;
        }
    }
    
    // Cargar empresas
    await cargarEmpresas();
    
    // Si hay empresa_id en la URL, seleccionarla automáticamente
    if (empresaIdFromURL) {
        const selectEmpresa = document.getElementById('selectEmpresa');
        selectEmpresa.value = empresaIdFromURL;
        continuarConEmpresa();
    }
}

// Cargar lista de empresas
async function cargarEmpresas() {
    const selectEmpresa = document.getElementById('selectEmpresa');
    
    try {
        const response = await fetch(API_CLIENTE.empresas);
        const data = await response.json();
        
        if (response.ok && Array.isArray(data)) {
            selectEmpresa.innerHTML = '<option value="">Selecciona un sector...</option>';
            data.forEach(empresa => {
                const option = document.createElement('option');
                option.value = empresa.id;
                option.textContent = empresa.nombre;
                selectEmpresa.appendChild(option);
            });
            
            // Cargar turnos de todas las áreas
            await cargarTurnosTodasAreas();
        } else {
            selectEmpresa.innerHTML = '<option value="">Error al cargar sectores</option>';
        }
    } catch (error) {
        console.error('Error cargando empresas:', error);
        selectEmpresa.innerHTML = '<option value="">Error de conexión</option>';
    }
}

// Volver al seleccionador de área
function volverASeleccionarArea() {
    empresaIdSeleccionada = null;
    document.getElementById('seccion-empresa').style.display = 'block';
    document.getElementById('panel-principal').style.display = 'none';
    cargarTurnosTodasAreas();
}

// Cargar turnos de todas las áreas
async function cargarTurnosTodasAreas() {
    const resultadosDiv = document.getElementById('resultados-turnos-todas-areas');
    const seccionTurnos = document.getElementById('turnos-todas-areas');
    
    if (!resultadosDiv || !seccionTurnos) return;
    
    resultadosDiv.innerHTML = '<div class="loading">Buscando tus turnos...</div>';
    seccionTurnos.style.display = 'block';
    
    try {
        // Obtener todas las empresas primero
        const responseEmpresas = await fetch(API_CLIENTE.empresas);
        const empresas = await responseEmpresas.json();
        
        if (!responseEmpresas.ok || !Array.isArray(empresas)) {
            resultadosDiv.innerHTML = '<p class="help-text">No se pudieron cargar los sectores.</p>';
            return;
        }
        
        // Obtener turnos de cada empresa
        const todosLosTurnos = [];
        for (const empresa of empresas) {
            try {
                const response = await fetch(API_CLIENTE.misTurnos(empresa.id), {
                    headers: getClienteAuthHeaders()
                });
                const data = await response.json();
                
                if (response.ok && Array.isArray(data)) {
                    // Agregar información de la empresa a cada turno
                    data.forEach(turno => {
                        turno.empresa_nombre = empresa.nombre;
                        turno.empresa_id = empresa.id;
                    });
                    todosLosTurnos.push(...data);
                }
            } catch (error) {
                console.error(`Error cargando turnos de empresa ${empresa.id}:`, error);
            }
        }
        
        // Ordenar por fecha
        todosLosTurnos.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
        
        if (todosLosTurnos.length === 0) {
            resultadosDiv.innerHTML = '<p class="help-text">No tienes turnos reservados en ningún sector.</p>';
        } else {
            mostrarTurnosTodasAreas(todosLosTurnos, resultadosDiv);
        }
    } catch (error) {
        console.error('Error consultando turnos:', error);
        resultadosDiv.innerHTML = '<p class="mensaje-error">Error de conexión. Por favor intenta nuevamente.</p>';
    }
}

// Mostrar turnos de todas las áreas
function mostrarTurnosTodasAreas(turnos, container) {
    container.innerHTML = '';
    
    turnos.forEach(turno => {
        const card = document.createElement('div');
        card.className = 'turno-card';
        
        const fechaFormateada = formatearFecha(turno.start_datetime);
        const especialidad = turno.profesional_especialidad || turno.servicio_nombre || 'Consulta General';
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
                <h3 style="margin: 0;">${especialidad}</h3>
                <span class="badge" style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 0.85em;">${turno.empresa_nombre || 'N/A'}</span>
            </div>
            <div class="turno-info">
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
            <span class="status ${turno.status.toLowerCase()}">${turno.status}</span>
        `;
        
        container.appendChild(card);
    });
}

// Continuar con la empresa seleccionada
async function continuarConEmpresa() {
    const selectEmpresa = document.getElementById('selectEmpresa');
    empresaIdSeleccionada = selectEmpresa.value;
    
    if (!empresaIdSeleccionada) {
        mostrarMensaje('Por favor selecciona un sector', 'error');
        return;
    }
    
    // Ocultar sección de selección de empresa
    document.getElementById('seccion-empresa').style.display = 'none';
    
    // Mostrar panel principal
    document.getElementById('panel-principal').style.display = 'block';
    
    // Cargar profesionales (ya no necesitamos servicios)
    await cargarProfesionales();
}

// Actualizar información del profesional seleccionado
async function actualizarInfoProfesional() {
    const selectProfesional = document.getElementById('selectProfesional');
    const infoEspecialidad = document.getElementById('infoEspecialidad');
    const infoDiasDisponibles = document.getElementById('infoDiasDisponibles');
    
    if (!selectProfesional || !infoEspecialidad) return;
    
    const option = selectProfesional.options[selectProfesional.selectedIndex];
    
    if (option.value && option.dataset.especialidad) {
        infoEspecialidad.textContent = `Especialidad: ${option.dataset.especialidad}`;
        infoEspecialidad.style.display = 'block';
        
        // Cargar días disponibles
        if (empresaIdSeleccionada) {
            try {
                const response = await fetch(API_CLIENTE.diasDisponibles(empresaIdSeleccionada, option.value), {
                    headers: getClienteAuthHeaders()
                });
                const data = await response.json();
                
                if (response.ok && data.dias_disponibles && data.dias_disponibles.length > 0) {
                    const diasNombres = data.dias_disponibles.map(d => d.dia_nombre).join(', ');
                    if (infoDiasDisponibles) {
                        infoDiasDisponibles.textContent = `Días de atención: ${diasNombres}`;
                        infoDiasDisponibles.style.display = 'block';
                    } else {
                        // Crear elemento si no existe
                        const nuevoElemento = document.createElement('small');
                        nuevoElemento.id = 'infoDiasDisponibles';
                        nuevoElemento.className = 'form-text';
                        nuevoElemento.textContent = `Días de atención: ${diasNombres}`;
                        nuevoElemento.style.display = 'block';
                        nuevoElemento.style.color = '#666';
                        infoEspecialidad.parentNode.insertBefore(nuevoElemento, infoEspecialidad.nextSibling);
                    }
                } else {
                    if (infoDiasDisponibles) {
                        infoDiasDisponibles.style.display = 'none';
                    }
                }
            } catch (error) {
                console.error('Error cargando días disponibles:', error);
                if (infoDiasDisponibles) {
                    infoDiasDisponibles.style.display = 'none';
                }
            }
        }
    } else {
        infoEspecialidad.style.display = 'none';
        if (infoDiasDisponibles) {
            infoDiasDisponibles.style.display = 'none';
        }
    }
}

// Cargar profesionales
async function cargarProfesionales() {
    const selectProfesional = document.getElementById('selectProfesional');
    if (!selectProfesional) return;
    
    selectProfesional.innerHTML = '<option value="">Cargando profesionales...</option>';
    selectProfesional.disabled = true;
    
    try {
        const response = await fetch(API_CLIENTE.profesionales(empresaIdSeleccionada), {
            headers: getClienteAuthHeaders()
        });
        const data = await response.json();
        
        if (response.ok && Array.isArray(data)) {
            profesionales = data;
            selectProfesional.innerHTML = '<option value="">Selecciona un profesional...</option>';
            data.forEach(profesional => {
                const option = document.createElement('option');
                option.value = profesional.id;
                const especialidad = profesional.especialidad || 'Consulta General';
                option.textContent = `${profesional.name} ${profesional.surname} [${especialidad}]`;
                option.dataset.especialidad = especialidad;
                selectProfesional.appendChild(option);
            });
            selectProfesional.disabled = false;
        } else {
            if (response.status === 401) {
                mostrarMensaje('Sesión expirada. Por favor inicia sesión nuevamente', 'error');
                cerrarSesion();
            } else {
                selectProfesional.innerHTML = '<option value="">Error al cargar profesionales</option>';
            }
        }
    } catch (error) {
        console.error('Error cargando profesionales:', error);
        selectProfesional.innerHTML = '<option value="">Error de conexión</option>';
    }
}

// Función eliminada - ya no se necesita actualizar info de servicio

// Validar que la fecha no sea en el pasado
function validarFechaNoPasado() {
    const fechaInput = document.getElementById('fechaTurno');
    if (!fechaInput || !fechaInput.value) return;
    
    const fechaSeleccionada = new Date(fechaInput.value);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaSeleccionada < hoy) {
        mostrarMensaje('No se pueden agendar turnos en fechas pasadas', 'error');
        fechaInput.value = '';
        fechaInput.focus();
    }
}

// Validar que la hora seleccionada no sea en el pasado
function validarHoraNoPasado() {
    const fechaInput = document.getElementById('fechaTurno');
    const selectHora = document.getElementById('horaTurno');
    
    if (!fechaInput || !fechaInput.value || !selectHora || !selectHora.value) return;
    
    const fechaHoraSeleccionada = new Date(selectHora.value);
    const ahora = new Date();
    
    if (fechaHoraSeleccionada < ahora) {
        mostrarMensaje('No se pueden agendar turnos en horarios pasados', 'error');
        selectHora.value = '';
        selectHora.focus();
    }
}

// Cargar horarios disponibles
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
    
    // Validar que la fecha no sea en el pasado
    const fechaSeleccionada = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);
    
    if (fechaSeleccionada < hoy) {
        mostrarMensaje('No se pueden agendar turnos en fechas pasadas', 'error');
        fechaInput.value = '';
        selectHora.innerHTML = '<option value="">Selecciona una fecha válida</option>';
        selectHora.disabled = true;
        return;
    }
    
    selectHora.innerHTML = '<option value="">Cargando horarios...</option>';
    selectHora.disabled = true;
    
    try {
        // Ya no enviamos servicio_id, se usa consulta general automática
        const url = `${API_CLIENTE.horariosDisponibles(empresaIdSeleccionada)}?profesional_id=${profesionalId}&fecha=${fecha}`;
        const response = await fetch(url, {
            headers: getClienteAuthHeaders()
        });
        const data = await response.json();
        
        if (response.ok && data.horarios_disponibles) {
            const horarios = data.horarios_disponibles;
            
            if (horarios.length === 0) {
                selectHora.innerHTML = '<option value="">No hay horarios disponibles</option>';
            } else {
                selectHora.innerHTML = '<option value="">Selecciona una hora...</option>';
                const ahora = new Date();
                
                horarios.forEach(horario => {
                    const fechaHoraHorario = new Date(horario.datetime);
                    // Solo mostrar horarios que no sean en el pasado
                    if (fechaHoraHorario > ahora) {
                        const option = document.createElement('option');
                        option.value = horario.datetime;
                        option.textContent = horario.hora;
                        selectHora.appendChild(option);
                    }
                });
                
                // Si no quedaron horarios válidos después del filtro
                if (selectHora.options.length === 1) {
                    selectHora.innerHTML = '<option value="">No hay horarios disponibles (todos están en el pasado)</option>';
                } else {
                    selectHora.disabled = false;
                }
            }
        } else {
            if (response.status === 401) {
                mostrarMensaje('Sesión expirada. Por favor inicia sesión nuevamente', 'error');
                cerrarSesion();
            } else {
                selectHora.innerHTML = '<option value="">Error al cargar horarios</option>';
            }
        }
    } catch (error) {
        console.error('Error cargando horarios:', error);
        selectHora.innerHTML = '<option value="">Error de conexión</option>';
    }
}

// Reservar turno
async function reservarTurno() {
    const form = document.getElementById('formReservar');
    const btnReservar = document.getElementById('btnReservar');
    
    const datos = {
        profesional_id: parseInt(document.getElementById('selectProfesional').value),
        start_datetime: document.getElementById('horaTurno').value,
        observaciones: document.getElementById('observacionesTurno').value.trim() || null
    };
    
    // Validaciones
    if (!datos.profesional_id || !datos.start_datetime) {
        mostrarMensaje('Por favor selecciona profesional, fecha y hora', 'error');
        return;
    }
    
    // Validar que la fecha/hora no sea en el pasado
    const fechaHoraSeleccionada = new Date(datos.start_datetime);
    const ahora = new Date();
    
    if (fechaHoraSeleccionada <= ahora) {
        mostrarMensaje('No se pueden agendar turnos en el pasado. Por favor selecciona una fecha y hora futura', 'error');
        return;
    }
    
    btnReservar.disabled = true;
    btnReservar.textContent = 'Reservando...';
    
    try {
        const response = await fetch(API_CLIENTE.reservarTurno(empresaIdSeleccionada), {
            method: 'POST',
            headers: getClienteAuthHeaders(),
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje(`¡Turno reservado exitosamente! Tu cita es el ${formatearFecha(datos.start_datetime)}`, 'exito');
            form.reset();
            document.getElementById('infoEspecialidad').style.display = 'none';
            // Recargar horarios por si acaso
            if (document.getElementById('fechaTurno').value) {
                cargarHorariosDisponibles();
            }
        } else {
            if (response.status === 401) {
                mostrarMensaje('Sesión expirada. Por favor inicia sesión nuevamente', 'error');
                cerrarSesion();
            } else {
                mostrarMensaje(data.message || 'Error al reservar el turno', 'error');
            }
        }
    } catch (error) {
        console.error('Error reservando turno:', error);
        const mensajeError = error.message || 'Error de conexión';
        mostrarMensaje(`Error: ${mensajeError}. Por favor verifica tu conexión e intenta nuevamente.`, 'error');
    } finally {
        btnReservar.disabled = false;
        btnReservar.textContent = 'Confirmar Reserva';
    }
}

// Consultar mis turnos
async function consultarMisTurnos() {
    const resultadosDiv = document.getElementById('resultados-turnos');
    
    resultadosDiv.innerHTML = '<div class="loading">Buscando tus turnos</div>';
    
    try {
        const url = API_CLIENTE.misTurnos(empresaIdSeleccionada);
        const response = await fetch(url, {
            headers: getClienteAuthHeaders()
        });
        const data = await response.json();
        
        if (response.ok && Array.isArray(data)) {
            if (data.length === 0) {
                resultadosDiv.innerHTML = '<p class="help-text">No tienes turnos reservados.</p>';
            } else {
                mostrarTurnos(data, resultadosDiv);
            }
        } else {
            if (response.status === 401) {
                mostrarMensaje('Sesión expirada. Por favor inicia sesión nuevamente', 'error');
                cerrarSesion();
            } else {
                resultadosDiv.innerHTML = '<p class="mensaje-error">Error al consultar turnos.</p>';
            }
        }
    } catch (error) {
        console.error('Error consultando turnos:', error);
        resultadosDiv.innerHTML = '<p class="mensaje-error">Error de conexión. Por favor intenta nuevamente.</p>';
    }
}

// Mostrar turnos en la lista
function mostrarTurnos(turnos, container) {
    container.innerHTML = '';
    
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
            <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
                <button class="btn-secondary btn-sm" onclick="abrirModalModificarTurno(${turno.id}, ${turno.empresa_id})" style="flex: 1;">
                    ✏️ Modificar
                </button>
                <button class="btn-danger btn-sm" onclick="cancelarTurnoCliente(${turno.id}, ${turno.empresa_id})" style="flex: 1;">
                    🗑️ Cancelar
                </button>
            </div>
            ` : ''}
        `;
        
        container.appendChild(card);
    });
}

// Cambiar sección
function cambiarSeccion(section) {
    // Actualizar botones de navegación
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.section === section) {
            btn.classList.add('active');
        }
    });
    
    // Mostrar/ocultar secciones
    document.getElementById('seccion-reservar').style.display = 
        section === 'reservar' ? 'block' : 'none';
    document.getElementById('seccion-mis-turnos').style.display = 
        section === 'mis-turnos' ? 'block' : 'none';
    
    // Si cambia a mis-turnos, cargar automáticamente
    if (section === 'mis-turnos') {
        consultarMisTurnos();
    }
}

// Formatear fecha
function formatearFecha(datetimeStr) {
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

// Mostrar mensaje
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

// Cerrar modal
function cerrarModal() {
    document.getElementById('modalConfirmacion').style.display = 'none';
}

// Cerrar sesión
function cerrarSesion() {
    localStorage.removeItem('clienteToken');
    localStorage.removeItem('clienteData');
    clienteAutenticado = null;
    mostrarSeccionAuth();
}

// Cancelar turno
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
            consultarMisTurnos();
            if (empresaIdSeleccionada) {
                cargarTurnosTodasAreas();
            }
        } else {
            mostrarMensaje(data.message || 'Error al cancelar el turno', 'error');
        }
    } catch (error) {
        console.error('Error cancelando turno:', error);
        mostrarMensaje('Error de conexión. Por favor intenta nuevamente.', 'error');
    }
}

// Abrir modal para modificar turno
let turnoActualModificando = null;
async function abrirModalModificarTurno(turnoId, empresaId) {
    // Obtener datos del turno
    try {
        const response = await fetch(API_CLIENTE.misTurnos(empresaId), {
            headers: getClienteAuthHeaders()
        });
        const turnos = await response.json();
        
        if (response.ok && Array.isArray(turnos)) {
            const turno = turnos.find(t => t.id === turnoId);
            if (!turno) {
                mostrarMensaje('Turno no encontrado', 'error');
                return;
            }
            
            turnoActualModificando = turno;
            
            // Llenar el formulario de reserva con los datos del turno
            document.getElementById('selectProfesional').value = turno.profesional_id;
            await actualizarInfoProfesional();
            
            const fechaHora = new Date(turno.start_datetime);
            document.getElementById('fechaTurno').value = fechaHora.toISOString().split('T')[0];
            
            // Cargar horarios y luego seleccionar la hora
            await cargarHorariosDisponibles();
            setTimeout(() => {
                const selectHora = document.getElementById('horaTurno');
                const horaFormato = fechaHora.toISOString().slice(0, 19).replace('T', ' ');
                for (let option of selectHora.options) {
                    if (option.value === horaFormato || option.value.startsWith(turno.start_datetime.substring(0, 16))) {
                        selectHora.value = option.value;
                        break;
                    }
                }
            }, 500);
            
            if (turno.observaciones) {
                document.getElementById('observacionesTurno').value = turno.observaciones;
            }
            
            // Cambiar a sección de reservar y modificar el botón
            cambiarSeccion('reservar');
            const btnReservar = document.getElementById('btnReservar');
            btnReservar.textContent = 'Guardar Cambios';
            btnReservar.dataset.modificando = turnoId;
            btnReservar.dataset.empresaId = empresaId;
        }
    } catch (error) {
        console.error('Error cargando turno:', error);
        mostrarMensaje('Error al cargar el turno', 'error');
    }
}

// Modificar turno
async function modificarTurnoCliente(turnoId, empresaId) {
    const form = document.getElementById('formReservar');
    const btnReservar = document.getElementById('btnReservar');
    
    const datos = {
        profesional_id: parseInt(document.getElementById('selectProfesional').value),
        start_datetime: document.getElementById('horaTurno').value,
        observaciones: document.getElementById('observacionesTurno').value.trim() || null
    };
    
    // Validaciones
    if (!datos.profesional_id || !datos.start_datetime) {
        mostrarMensaje('Por favor completa todos los campos requeridos', 'error');
        return;
    }
    
    // Validar que la fecha/hora no sea en el pasado
    const fechaHoraSeleccionada = new Date(datos.start_datetime);
    const ahora = new Date();
    
    if (fechaHoraSeleccionada <= ahora) {
        mostrarMensaje('No se pueden agendar turnos en el pasado. Por favor selecciona una fecha y hora futura', 'error');
        return;
    }
    
    btnReservar.disabled = true;
    btnReservar.textContent = 'Guardando...';
    
    try {
        const response = await fetch(API_CLIENTE.modificarTurno(empresaId, turnoId), {
            method: 'PUT',
            headers: getClienteAuthHeaders(),
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            mostrarMensaje('Turno modificado exitosamente', 'exito');
            form.reset();
            document.getElementById('infoEspecialidad').style.display = 'none';
            document.getElementById('infoDiasDisponibles').style.display = 'none';
            
            // Restaurar botón
            btnReservar.textContent = 'Confirmar Reserva';
            btnReservar.removeAttribute('data-modificando');
            btnReservar.removeAttribute('data-empresa-id');
            
            // Recargar turnos
            consultarMisTurnos();
            cargarTurnosTodasAreas();
        } else {
            mostrarMensaje(data.message || 'Error al modificar el turno', 'error');
        }
    } catch (error) {
        console.error('Error modificando turno:', error);
        mostrarMensaje('Error de conexión. Por favor intenta nuevamente.', 'error');
    } finally {
        btnReservar.disabled = false;
        // Solo restaurar el texto si no estamos en modo modificación
        if (!btnReservar.dataset.modificando) {
            btnReservar.textContent = 'Confirmar Reserva';
        } else {
            btnReservar.textContent = 'Guardar Cambios';
        }
    }
}

// Exportar funciones globales
window.consultarMisTurnos = consultarMisTurnos;
window.cargarHorariosDisponibles = cargarHorariosDisponibles;
window.cerrarModal = cerrarModal;
window.actualizarInfoProfesional = actualizarInfoProfesional;
window.volverASeleccionarArea = volverASeleccionarArea;
window.cancelarTurnoCliente = cancelarTurnoCliente;
window.abrirModalModificarTurno = abrirModalModificarTurno;
