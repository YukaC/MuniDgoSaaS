/**
 * Módulo de Turnos - Panel de Administración
 * Refactorizado aplicando principio DRY
 */

// ==================== VARIABLES GLOBALES ====================

let cacheTurnos = [];
let mapaProfesionales = {};
let mapaServicios = {};
let clientesExistentes = [];
let cacheDisponibilidad = {};
let mapaDiasDisponibles = {};

// ==================== CARGA INICIAL ====================

async function cargarLogicaTurnos() {
    console.log("Iniciando módulo de turnos...");
    
    const formulario = document.getElementById("formTurno");
    if (formulario && !formulario.dataset.init) {
        formulario.addEventListener("submit", guardarTurno);
        formulario.dataset.init = "true";
    }
    
    await cargarListasDesplegables();
    await listarTurnos();
    await cargarClientesExistentes();
}

// ==================== CLIENTES EXISTENTES ====================

async function cargarClientesExistentes() {
    try {
        const empresaId = window.getEmpresaId();
        const url = `${API_BASE_URL}/empresa/${empresaId}/turnos`;
        const respuesta = await fetch(url, { headers: window.getAuthHeaders() });
        
        if (!respuesta.ok) return;
        
        const turnos = await respuesta.json();
        const clientesSet = new Set();
        
        turnos.forEach((t) => {
            if (t.cliente_name?.trim()) {
                clientesSet.add(t.cliente_name.trim());
            }
        });
        
        clientesExistentes = Array.from(clientesSet).sort();
    } catch (error) {
        console.error("Error cargando clientes:", error);
        clientesExistentes = [];
    }
}

function buscarClientesExistentes(busqueda) {
    const listaDiv = document.getElementById("clientesLista");
    const inputCliente = document.getElementById("clienteName");
    const helpText = document.getElementById("clienteHelpText");
    
    if (!listaDiv || !inputCliente) return;
    
    const busquedaLower = busqueda.toLowerCase().trim();
    
    if (busquedaLower.length < 2) {
        listaDiv.style.display = "none";
        if (helpText) {
            helpText.textContent = "Escribe al menos 2 caracteres para buscar clientes existentes";
        }
        return;
    }
    
    const clientesFiltrados = clientesExistentes.filter(cliente =>
        cliente.toLowerCase().includes(busquedaLower)
    );
    
    if (clientesFiltrados.length === 0) {
        listaDiv.style.display = "none";
        if (helpText) {
            helpText.textContent = "No se encontraron clientes. Se creará uno nuevo con este nombre.";
            helpText.style.color = "#666";
        }
        return;
    }
    
    // Mostrar lista de clientes encontrados
    listaDiv.innerHTML = "";
    clientesFiltrados.slice(0, 5).forEach(cliente => {
        const item = document.createElement("div");
        item.className = "clientes-lista-item";
        item.innerHTML = `<strong>${cliente}</strong>`;
        item.onclick = () => {
            inputCliente.value = cliente;
            listaDiv.style.display = "none";
            if (helpText) {
                helpText.textContent = `Cliente seleccionado: ${cliente}`;
                helpText.style.color = "green";
            }
        };
        listaDiv.appendChild(item);
    });
    
    listaDiv.style.display = "block";
    if (helpText) {
        helpText.textContent = `${clientesFiltrados.length} cliente(s) encontrado(s). Haz clic para seleccionar.`;
        helpText.style.color = "#007bff";
    }
}

// ==================== LISTAR TURNOS ====================

async function listarTurnos() {
    try {
        const empresaId = window.getEmpresaId();
        const url = `${API_BASE_URL}/empresa/${empresaId}/turnos`;
        
        const respuesta = await fetch(url, { headers: window.getAuthHeaders() });
        if (!respuesta.ok) throw new Error("Error API");
        
        const turnos = await respuesta.json();
        cacheTurnos = turnos || [];
        renderizarTurnos(turnos);
    } catch (error) {
        console.error("Error al listar turnos:", error);
    }
}

function renderizarTurnos(turnos) {
    const container = document.getElementById("container-gestion-turnos");
    if (!container) return;
    
    container.innerHTML = "";
    
    if (turnos.length === 0) {
        container.innerHTML = '<p class="help-text">No hay turnos registrados</p>';
        return;
    }
    
    turnos.forEach((turno) => {
        const { fecha, hora } = window.formatearFechaHora(turno.start_datetime);
        const nombreCliente = turno.cliente_name || "Anónimo";
        const nombreProfesional = mapaProfesionales[turno.profesional_id] || 
                                  turno.profesional_nombre || 
                                  `ID: ${turno.profesional_id}`;
        const especialidad = turno.profesional_especialidad || turno.servicio_nombre || "Consulta General";
        const estado = turno.status || turno.estado || "Reservado";
        const observaciones = turno.observaciones || "";
        
        const card = document.createElement('div');
        card.className = 'item-card';
        
        // Destacar visualmente turnos pendientes de confirmación
        if (estado.toLowerCase().includes('pendiente de confirmaci')) {
            card.classList.add('turno-urgente');
        }
        
        card.innerHTML = `
            <div class="item-card-header">
                <h3>${especialidad}</h3>
                <span class="status ${estado.toLowerCase().replace(/ /g, '-')}">${estado}</span>
            </div>
            <div class="item-card-body">
                <div class="info-item">
                    <strong>📅 Fecha y Hora:</strong>
                    <span>${fecha} - ${hora}</span>
                </div>
                <div class="info-item">
                    <strong>👤 Cliente:</strong>
                    <span>${nombreCliente}</span>
                </div>
                <div class="info-item">
                    <strong>👨‍⚕️ Profesional:</strong>
                    <span>${nombreProfesional}</span>
                </div>
                ${observaciones ? `
                <div class="info-item">
                    <strong>📝 Observaciones:</strong>
                    <span>${observaciones}</span>
                </div>` : ''}
            </div>
            <div class="item-card-footer">
                <button class="btn-primary btn-sm" onclick="prepararEdicion(${turno.id})">✏️ Editar</button>
                <button class="btn-danger btn-sm" onclick="eliminarTurno(${turno.id})">🗑️ Eliminar</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// ==================== LISTAS DESPLEGABLES ====================

async function cargarListasDesplegables() {
    try {
        const empresaId = window.getEmpresaId();
        
        const [resProf, resServ, resDisp] = await Promise.all([
            fetch(`${API_BASE_URL}/empresa/${empresaId}/profesionales`, { headers: window.getAuthHeaders() }),
            fetch(`${API_BASE_URL}/empresa/${empresaId}/servicios`, { headers: window.getAuthHeaders() }),
            fetch(`${API_BASE_URL}/empresa/${empresaId}/profesionales/disponibilidades-resumen`, { headers: window.getAuthHeaders() })
        ]);
        
        const profesionales = await resProf.json();
        const servicios = await resServ.json();
        mapaDiasDisponibles = resDisp.ok ? await resDisp.json() : {};
        
        // Cargar profesionales
        const selectProf = document.getElementById("selectProfesional");
        if (selectProf) {
            mapaProfesionales = {};
            let html = '<option value="">Seleccione...</option>';
            profesionales.forEach((p) => {
                mapaProfesionales[p.id] = `${p.name} ${p.surname}`;
                const especialidad = p.especialidad || 'Consulta General';
                html += `<option value="${p.id}" data-especialidad="${especialidad}">${p.name} ${p.surname}</option>`;
            });
            selectProf.innerHTML = html;
            
            selectProf.addEventListener("change", onProfesionalChange);
        }
        
        // Cargar servicios
        const selectServ = document.getElementById("selectServicio");
        if (selectServ) {
            mapaServicios = {};
            let html = '<option value="">Seleccione...</option>';
            servicios.forEach((s) => {
                mapaServicios[s.id] = {
                    nombre: s.name,
                    precio: s.price,
                    duration: s.duration_minutes || 30
                };
                html += `<option value="${s.id}">${s.name} ($${s.price})</option>`;
            });
            selectServ.innerHTML = html;
            
            selectServ.addEventListener("change", onFechaServicioChange);
        }
        
        // Evento de fecha
        const inputFecha = document.getElementById("fechaTurno");
        if (inputFecha) {
            inputFecha.addEventListener("change", cargarHorariosDisponiblesAdmin);
        }
        
    } catch (error) {
        console.error("Error cargando listas:", error);
    }
}

async function onProfesionalChange() {
    // Actualizar caché de disponibilidad
    const empresaId = window.getEmpresaId();
    try {
        const res = await fetch(
            `${API_BASE_URL}/empresa/${empresaId}/profesionales/disponibilidades-resumen`,
            { headers: window.getAuthHeaders() }
        );
        mapaDiasDisponibles = res.ok ? await res.json() : {};
    } catch (err) {
        mapaDiasDisponibles = {};
    }
    
    cacheDisponibilidad = {};
    actualizarInfoProfesional();
    
    const fechaInput = document.getElementById("fechaTurno");
    if (fechaInput?.value) {
        cargarHorariosDisponiblesAdmin();
    }
}

function onFechaServicioChange() {
    const fechaInput = document.getElementById("fechaTurno");
    if (fechaInput?.value) {
        cargarHorariosDisponiblesAdmin();
    }
}

function actualizarInfoProfesional() {
    const selectProfesional = document.getElementById('selectProfesional');
    const infoEspecialidad = document.getElementById('infoEspecialidad');
    const infoDiasDisponibles = document.getElementById('infoDiasDisponibles');
    
    if (!selectProfesional) return;
    
    const profesionalId = selectProfesional.value;
    
    // Usar función compartida
    window.mostrarInfoProfesional(
        profesionalId,
        mapaDiasDisponibles,
        selectProfesional,
        infoEspecialidad,
        infoDiasDisponibles
    );
    
    // Intentar cargar horarios si hay fecha
    const fechaInput = document.getElementById("fechaTurno");
    if (fechaInput?.value) {
        cargarHorariosDisponiblesAdmin();
    }
}

// ==================== HORARIOS DISPONIBLES ====================

async function cargarHorariosDisponiblesAdmin() {
    const selectProfesional = document.getElementById("selectProfesional");
    const fechaInput = document.getElementById("fechaTurno");
    const selectHora = document.getElementById("horaTurno");
    
    if (!selectProfesional || !fechaInput || !selectHora) return;
    
    const profesionalId = selectProfesional.value;
    const fecha = fechaInput.value;
    
    if (!profesionalId || !fecha) {
        selectHora.innerHTML = '<option value="">Selecciona profesional y fecha</option>';
        selectHora.disabled = true;
        return;
    }
    
    selectHora.innerHTML = '<option value="">Cargando horarios...</option>';
    selectHora.disabled = true;
    
    try {
        const empresaId = window.getEmpresaId();
        const servicioId = document.getElementById("selectServicio")?.value || null;
        const cacheKey = `${profesionalId}_${fecha}_${servicioId || 'no-service'}`;
        
        // Verificar caché
        if (cacheDisponibilidad[cacheKey]) {
            procesarHorariosAdmin(cacheDisponibilidad[cacheKey]);
            return;
        }
        
        let url = `${API_BASE_URL}/empresa/${empresaId}/horarios-disponibles?profesional_id=${profesionalId}&fecha=${fecha}`;
        if (servicioId) url += `&servicio_id=${servicioId}`;
        
        const response = await fetch(url, { headers: window.getAuthHeaders() });
        const data = await response.json();
        
        if (response.ok && data.horarios_disponibles) {
            cacheDisponibilidad[cacheKey] = data.horarios_disponibles;
            procesarHorariosAdmin(data.horarios_disponibles);
        } else {
            selectHora.innerHTML = '<option value="">Error al cargar horarios</option>';
        }
    } catch (error) {
        console.error('Error cargando horarios:', error);
        selectHora.innerHTML = '<option value="">Error de conexión</option>';
    }
}

function procesarHorariosAdmin(horarios) {
    const selectHora = document.getElementById("horaTurno");
    if (!selectHora) return;
    
    // Obtener hora original si estamos editando
    const idTurno = document.getElementById("turnoId").value;
    let horaOriginal = null;
    
    if (idTurno) {
        const turno = cacheTurnos.find(t => t.id === parseInt(idTurno));
        if (turno) horaOriginal = turno.start_datetime;
    }
    
    // Usar función compartida con filtrado desactivado para admin
    window.procesarHorarios(horarios, selectHora, horaOriginal, false);
}

// ==================== GUARDAR TURNO ====================

async function guardarTurno(e) {
    e.preventDefault();
    
    const btnSave = document.getElementById("btnSaveTurno");
    if (btnSave.disabled) return;
    
    const idTurno = document.getElementById("turnoId").value;
    const empresaId = window.getEmpresaId();
    const horaSeleccionada = document.getElementById("horaTurno").value;
    
    if (!horaSeleccionada) {
        alert("Por favor selecciona una hora disponible.");
        return;
    }
    
    const servicioId = document.getElementById("selectServicio").value;
    const observaciones = document.getElementById("observacionesTurno")?.value.trim() || null;
    
    const datos = {
        empresa_id: parseInt(empresaId),
        profesional_id: parseInt(document.getElementById("selectProfesional").value),
        servicio_id: servicioId ? parseInt(servicioId) : null,
        cliente_name: document.getElementById("clienteName").value,
        observaciones: observaciones,
        start_datetime: horaSeleccionada,
        status: document.getElementById("selectEstado").value
    };
    
    const headers = {
        ...window.getAuthHeaders(),
        "id-empresa": empresaId.toString()
    };
    
    const url = idTurno 
        ? `${API_BASE_URL}/empresa/${empresaId}/turno/${idTurno}`
        : `${API_BASE_URL}/turno`;
    const metodo = idTurno ? "PUT" : "POST";
    
    try {
        const res = await fetch(url, {
            method: metodo,
            headers: headers,
            body: JSON.stringify(datos)
        });
        
        const data = await res.json();
        
        if (data.id || res.ok) {
            alert("Turno guardado con éxito");
            cacheDisponibilidad = {};
            cerrarModalTurno();
            listarTurnos();
        } else {
            alert("Error: " + (data.message || "Error al guardar"));
        }
    } catch (error) {
        console.error("Error guardando turno:", error);
        alert("Error de conexión: " + error.message);
    }
}

// ==================== ELIMINAR TURNO ====================

async function eliminarTurno(id) {
    if (!confirm("¿Eliminar turno?")) return;
    
    try {
        const empresaId = window.getEmpresaId();
        const url = `${API_BASE_URL}/empresa/${empresaId}/turno/${id}`;
        
        const res = await fetch(url, {
            method: "DELETE",
            headers: window.getAuthHeaders()
        });
        
        if (res.ok) {
            listarTurnos();
        } else {
            alert("Error al eliminar");
        }
    } catch (error) {
        alert("Error al eliminar");
    }
}

// ==================== MODALES ====================

function abrirModalTurno() {
    const form = document.getElementById("formTurno");
    
    // Limpiar formulario
    const campos = ["turnoId", "clienteName", "selectProfesional", "selectServicio", "observacionesTurno", "fechaTurno"];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    
    document.getElementById("selectEstado").value = "Reservado";
    document.getElementById("horaTurno").innerHTML = '<option value="">Primero selecciona fecha y profesional</option>';
    document.getElementById("horaTurno").disabled = true;
    
    // Ocultar lista de clientes y helper
    const listaClientes = document.getElementById("clientesLista");
    if (listaClientes) listaClientes.style.display = "none";
    
    const helpText = document.getElementById("clienteHelpText");
    if (helpText) {
        helpText.textContent = "Escribe para buscar clientes existentes o crea uno nuevo";
        helpText.style.color = "#666";
    }
    
    cargarClientesExistentes();
    
    if (form) form.reset();
    document.getElementById("turnoId").value = "";
    document.getElementById("modalTitle").innerText = "Nuevo Turno";
    
    const btnSave = document.getElementById("btnSaveTurno");
    if (btnSave) btnSave.disabled = false;
    
    // Recargar disponibilidad
    recargarDisponibilidadResumen();
    
    document.getElementById("turnoModal").style.display = "flex";
}

async function recargarDisponibilidadResumen() {
    const empresaId = window.getEmpresaId();
    try {
        const res = await fetch(
            `${API_BASE_URL}/empresa/${empresaId}/profesionales/disponibilidades-resumen`,
            { headers: window.getAuthHeaders() }
        );
        mapaDiasDisponibles = res.ok ? await res.json() : {};
    } catch (err) {
        console.error("Error recargando disponibilidades:", err);
    }
}

function prepararEdicion(id) {
    const turno = cacheTurnos.find((t) => t.id === id);
    if (!turno) return;
    
    document.getElementById("turnoId").value = turno.id;
    document.getElementById("clienteName").value = turno.cliente_name || "";
    document.getElementById("selectProfesional").value = turno.profesional_id || "";
    document.getElementById("selectServicio").value = turno.servicio_id || "";
    document.getElementById("selectEstado").value = turno.status || "Reservado";
    document.getElementById("observacionesTurno").value = turno.observaciones || "";
    document.getElementById("modalTitle").innerText = "Editar Turno";
    
    if (turno.start_datetime) {
        const fechaHora = new Date(turno.start_datetime);
        const fecha = fechaHora.toISOString().split('T')[0];
        document.getElementById("fechaTurno").value = fecha;
        
        setTimeout(async () => {
            await actualizarInfoProfesional();
            
            cargarHorariosDisponiblesAdmin().then(() => {
                const horaSelect = document.getElementById("horaTurno");
                if (horaSelect) {
                    // Buscar opción coincidente
                    const horaFormato = fechaHora.toISOString().slice(0, 19).replace('T', ' ');
                    let encontrada = false;
                    
                    for (let option of horaSelect.options) {
                        if (option.value === horaFormato || 
                            option.value.startsWith(turno.start_datetime.substring(0, 16))) {
                            horaSelect.value = option.value;
                            encontrada = true;
                            break;
                        }
                    }
                    
                    if (!encontrada) {
                        const option = document.createElement('option');
                        option.value = turno.start_datetime;
                        const horaLegible = fechaHora.toLocaleTimeString("es-AR", {hour: '2-digit', minute:'2-digit'});
                        option.textContent = `${horaLegible} (Actual)`;
                        option.selected = true;
                        horaSelect.appendChild(option);
                        horaSelect.value = turno.start_datetime;
                        horaSelect.disabled = false;
                    }
                }
            });
        }, 200);
    }
    
    document.getElementById("turnoModal").style.display = "flex";
}

function cerrarModalTurno() {
    document.getElementById("turnoModal").style.display = "none";
}

// ==================== CREAR CLIENTE (ALIAS) ====================

function crearNuevoClienteAdmin() {
    if (window.abrirModalCliente) {
        window.abrirModalCliente();
    } else {
        alert("El módulo de clientes no está cargado.");
    }
}

// ==================== INICIALIZACIÓN ====================

// Configurar menú móvil al cargar
if (typeof document !== 'undefined') {
    document.addEventListener("DOMContentLoaded", () => {
        if (window.setupMobileMenu) {
            window.setupMobileMenu();
        }
    });
}

// ==================== EXPORTAR GLOBALMENTE ====================

window.cargarLogicaTurnos = cargarLogicaTurnos;
window.abrirModalTurno = abrirModalTurno;
window.prepararEdicion = prepararEdicion;
window.cerrarModalTurno = cerrarModalTurno;
window.eliminarTurno = eliminarTurno;
window.buscarClientesExistentes = buscarClientesExistentes;
window.crearNuevoClienteAdmin = crearNuevoClienteAdmin;
