/* --- VARIABLES GLOBALES --- */

// caches y variables globales
let cacheTurnos = [];
let mapaProfesionales = {};
let mapaServicios = {};
let clientesExistentes = []; // Lista de clientes del historial
// Variables antiguas eliminadas - ahora se usa cargarHorariosDisponiblesAdmin

/* --- CARGA INICIAL DEL MODULO DE TURNOS --- */
async function cargarLogicaTurnos() {
  console.log("Iniciando módulo de turnos...");
  const formulario = document.getElementById("formTurno");
  if (formulario && !formulario.dataset.init) {
    formulario.addEventListener("submit", guardarTurno);
    formulario.dataset.init = "true";
  }
  await cargarListasDesplegables();
  await listarTurnos();
  await cargarClientesExistentes(); // Cargar lista de clientes
}

/* --- CARGAR CLIENTES EXISTENTES DESDE HISTORIAL --- */
async function cargarClientesExistentes() {
  try {
    const empresaId = window.getEmpresaId();
    const url = `${API_BASE_URL}/empresa/${empresaId}/turnos`;
    const respuesta = await fetch(url, { headers: window.getAuthHeaders() });
    
    if (!respuesta.ok) return;
    
    const turnos = await respuesta.json();
    const clientesSet = new Set();
    
    turnos.forEach((t) => {
      if (t.cliente_name && t.cliente_name.trim()) {
        clientesSet.add(t.cliente_name.trim());
      }
    });
    
    clientesExistentes = Array.from(clientesSet).sort();
  } catch (error) {
    console.error("Error cargando clientes:", error);
    clientesExistentes = [];
  }
}

/* --- BUSCAR CLIENTES EXISTENTES --- */
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

/* --- TOGGLE SIDEBAR EN MOBILE --- */
function toggleSidebar() {
  const sidebar = document.querySelector(".sidebar");
  if (sidebar) {
    sidebar.classList.toggle("active");
  }
}

// Cerrar sidebar al hacer clic fuera en mobile
if (typeof document !== 'undefined') {
  document.addEventListener("click", (e) => {
    const sidebar = document.querySelector(".sidebar");
    const menuToggle = document.getElementById("menuToggle");
    
    if (window.innerWidth <= 768 && sidebar && menuToggle) {
      if (sidebar.classList.contains("active") && !sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove("active");
      }
    }
  });

  // Mostrar/ocultar botón hamburguesa según tamaño de pantalla
  function ajustarMenuMobile() {
    const menuToggle = document.getElementById("menuToggle");
    if (menuToggle) {
      if (window.innerWidth <= 768) {
        menuToggle.style.display = "block";
      } else {
        menuToggle.style.display = "none";
        const sidebar = document.querySelector(".sidebar");
        if (sidebar) sidebar.classList.remove("active");
      }
    }
  }

  window.addEventListener("resize", ajustarMenuMobile);
  document.addEventListener("DOMContentLoaded", ajustarMenuMobile);
}

/* --- LISTAR TURNOS DESDE LA API --- */
async function listarTurnos() {
  try {
    const empresaId = window.getEmpresaId();
    const url = `${API_BASE_URL}/empresa/${empresaId}/turnos`;

    const respuesta = await fetch(url, { headers: window.getAuthHeaders() });
    if (!respuesta.ok) throw new Error("Error API");

    const turnos = await respuesta.json();
    cacheTurnos = turnos || [];
    renderizarTabla(turnos);
  } catch (error) {
    console.error("Error al listar turnos:", error);
  }
}
/* --- CARGA DE LISTAS DESPLEGABLES --- */
async function cargarListasDesplegables() {
  try {
    const empresaId = window.getEmpresaId();
    // rutas según Profesionales.py y Servicios.py
    const urlProf = `${API_BASE_URL}/empresa/${empresaId}/profesionales`;
    const urlServ = `${API_BASE_URL}/empresa/${empresaId}/servicios`;

    const [resProf, resServ] = await Promise.all([
      fetch(urlProf, { headers: window.getAuthHeaders() }),
      fetch(urlServ, { headers: window.getAuthHeaders() }),
    ]);

    const profesionales = await resProf.json();
    const servicios = await resServ.json();

    // seleccionamos rofesionales
    const selectProf = document.getElementById("selectProfesional");
    if (selectProf) {
      mapaProfesionales = {};
      let html = '<option value="">Seleccione...</option>';
      profesionales.forEach((p) => {
        mapaProfesionales[p.id] = `${p.name} ${p.surname}`;
        html += `<option value="${p.id}">${p.name} ${p.surname}</option>`;
      });
      selectProf.innerHTML = html;

      selectProf.addEventListener("change", (e) => {
        delete cacheDisponibilidades[e.target.value];
        const fechaInput = document.getElementById("fechaTurno");
        if (fechaInput && fechaInput.value) {
          cargarHorariosDisponiblesAdmin();
        }
      });
    }

    // seleccionamos servicios
    const selectServ = document.getElementById("selectServicio");
    if (selectServ) {
      mapaServicios = {};
      let html = '<option value="">Seleccione...</option>';
      servicios.forEach((s) => {
        mapaServicios[s.id] = {
          nombre: s.name,
          precio: s.price,
          duration: s.duration_minutes || 30,
        };
        html += `<option value="${s.id}">${s.name} ($${s.price})</option>`;
      });
      selectServ.innerHTML = html;
      selectServ.addEventListener("change", () => {
        const fechaInput = document.getElementById("fechaTurno");
        if (fechaInput && fechaInput.value) {
          cargarHorariosDisponiblesAdmin();
        }
      });
    }

    const inputFecha = document.getElementById("fechaTurno");
    if (inputFecha) {
      // Establecer fecha mínima (hoy)
      const hoy = new Date();
      hoy.setDate(hoy.getDate());
      inputFecha.min = hoy.toISOString().split('T')[0];
      inputFecha.addEventListener("change", cargarHorariosDisponiblesAdmin);
    }
    
    const selectProfesional = document.getElementById("selectProfesional");
    if (selectProfesional) {
      selectProfesional.addEventListener("change", () => {
        const fechaInput = document.getElementById("fechaTurno");
        if (fechaInput && fechaInput.value) {
          cargarHorariosDisponiblesAdmin();
        }
      });
    }
  } catch (error) {
    console.error("Error cargando listas:", error);
  }
}
/* --- RENDERIZADO DE LA TABLA DE TURNOS --- */
function renderizarTabla(turnos) {
  const tbody = document.getElementById("tabla-gestion-turnos");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (turnos.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center">No hay turnos registrados</td></tr>';
    return;
  }

  const fragmento = document.createDocumentFragment();
  turnos.forEach((turno) => {
    const { fecha, hora } = formatearFechaHora(turno.start_datetime);
    const nombreCliente = turno.cliente_name || "Anónimo";
    const nombreProfesional =
      mapaProfesionales[turno.profesional_id] ||
      turno.profesional_nombre ||
      `ID: ${turno.profesional_id}`;
    const especialidad = turno.profesional_especialidad || turno.servicio_nombre || "Consulta General";
    const estado = turno.status || turno.estado || "Reservado";
    const observaciones = turno.observaciones || "-";

    let color = "#ffc107";
    if (estado.toLowerCase() === "completado") color = "#28a745";
    if (estado.toLowerCase() === "cancelado") color = "#dc3545";

    const fila = document.createElement("tr");
    fila.innerHTML = `
            <td><strong>${hora}</strong><br><small>${fecha}</small></td>
            <td>${nombreCliente}</td>
            <td>${nombreProfesional}<br><small style="color:#666">[${especialidad}]</small></td>
            <td><span class="badge" style="background-color: ${color}; color: white;">${estado}</span></td>
            <td><small>${observaciones}</small></td>
            <td>
                <button class="btn-action btn-sm" onclick="prepararEdicion(${turno.id})">✏️</button>
                <button class="btn-action btn-sm btn-danger" onclick="eliminarTurno(${turno.id})">🗑️</button>
            </td>
        `;
    fragmento.appendChild(fila);
  });
  tbody.appendChild(fragmento);
}

/* --- GUARDAR Y VALIDAR TURNOS --- */
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
  
  const fechaSQL = horaSeleccionada; // Ya viene en formato YYYY-MM-DD HH:MM:SS

  // Validar que la fecha/hora no sea en el pasado (solo para nuevos turnos)
  // Si es edición, permitir cambiar el estado aunque el turno ya haya pasado
  if (!idTurno) {
    const fechaHoraSeleccionada = new Date(horaSeleccionada);
    const ahora = new Date();
    
    if (fechaHoraSeleccionada <= ahora) {
      alert("No se pueden agendar turnos en el pasado. Por favor selecciona una fecha y hora futura.");
      return;
    }
  } else {
    // Si es edición, permitir cambiar fecha/hora solo si el turno aún no pasó
    // Pero siempre permitir cambiar el estado
    const fechaHoraSeleccionada = new Date(horaSeleccionada);
    const ahora = new Date();
    const estadoSeleccionado = document.getElementById("selectEstado").value;
    
    // Si solo se está cambiando el estado, permitir incluso si el turno ya pasó
    const turnoOriginal = cacheTurnos.find(t => t.id === parseInt(idTurno));
    if (turnoOriginal) {
      const fechaOriginal = new Date(turnoOriginal.start_datetime);
      const mismaFechaHora = fechaHoraSeleccionada.getTime() === fechaOriginal.getTime();
      
      // Si se cambió la fecha/hora y es en el pasado, no permitir (excepto si solo se cambia el estado)
      if (!mismaFechaHora && fechaHoraSeleccionada <= ahora) {
        alert("No se pueden reprogramar turnos a fechas/horas pasadas. Puedes cambiar el estado del turno existente.");
        return;
      }
    }
  }

  const servicioId = document.getElementById("selectServicio").value;
  const observaciones = document.getElementById("observacionesTurno")?.value.trim() || null;
  
  const datos = {
    empresa_id: parseInt(empresaId),
    profesional_id: parseInt(
      document.getElementById("selectProfesional").value
    ),
    servicio_id: servicioId ? parseInt(servicioId) : null,  // Opcional
    cliente_name: document.getElementById("clienteName").value,
    observaciones: observaciones,  // Opcional
    start_datetime: fechaSQL,
    status: document.getElementById("selectEstado").value,
  };

  let url, metodo;
  // IMPORTANTE: Aseguramos el header 'id-empresa' para el backend
  const headers = {
    ...window.getAuthHeaders(),
    "id-empresa": empresaId.toString(),
  };

  if (idTurno) {
    url = `${API_BASE_URL}/empresa/${empresaId}/turno/${idTurno}`;
    metodo = "PUT";
  } else {
    url = `${API_BASE_URL}/turno`;
    metodo = "POST";
  }

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: headers,
      body: JSON.stringify(datos),
    });

    if (res.ok) {
      alert("Operación exitosa");
      cerrarModalTurno();
      listarTurnos();
    } else {
      const err = await res.json();
      alert("Error: " + (err.message || "Error al guardar"));
    }
  } catch (error) {
    alert("Error de conexión");
  }
}

/* --- ELIMINAR TURNOS --- */
async function eliminarTurno(id) {
  if (!confirm("¿Eliminar turno?")) return;
  try {
    const empresaId = window.getEmpresaId();
    // DELETE /empresa/<id>/turno/<id>
    const url = `${API_BASE_URL}/empresa/${empresaId}/turno/${id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: window.getAuthHeaders(),
    });
    if (res.ok) listarTurnos();
    else alert("Error al eliminar");
  } catch (error) {
    alert("Error al eliminar");
  }
}

/* --- HANDLER DE MODALES Y HELPERS --- */
function abrirModalTurno() {
  const form = document.getElementById("formTurno");
  
  // Limpiar formulario
  document.getElementById("turnoId").value = "";
  document.getElementById("clienteName").value = "";
  document.getElementById("selectProfesional").value = "";
  document.getElementById("selectServicio").value = "";
  document.getElementById("selectEstado").value = "Reservado";
  document.getElementById("observacionesTurno").value = "";
  document.getElementById("fechaTurno").value = "";
  document.getElementById("horaTurno").innerHTML = '<option value="">Primero selecciona fecha y profesional</option>';
  document.getElementById("horaTurno").disabled = true;
  
  // Ocultar lista de clientes
  const listaClientes = document.getElementById("clientesLista");
  if (listaClientes) listaClientes.style.display = "none";
  
  // Restaurar texto de ayuda
  const helpText = document.getElementById("clienteHelpText");
  if (helpText) {
    helpText.textContent = "Escribe para buscar clientes existentes o crea uno nuevo";
    helpText.style.color = "#666";
  }
  
  // Recargar lista de clientes
  cargarClientesExistentes();
  
  // Establecer fecha mínima (hoy) para el input de fecha
  const fechaInput = document.getElementById("fechaTurno");
  if (fechaInput) {
    const hoy = new Date();
    hoy.setDate(hoy.getDate());
    fechaInput.min = hoy.toISOString().split('T')[0];
  }
  if (form) form.reset();
  document.getElementById("turnoId").value = "";
  document.getElementById("modalTitle").innerText = "Nuevo Turno";

  // Limpiar selector de hora
  const selectHora = document.getElementById("horaTurno");
  if (selectHora) {
    selectHora.innerHTML = '<option value="">Primero selecciona fecha y profesional</option>';
    selectHora.disabled = true;
  }
  const btnSave = document.getElementById("btnSaveTurno");
  if (btnSave) btnSave.disabled = false;

  document.getElementById("turnoModal").style.display = "flex";
}

function prepararEdicion(id) {
  const turno = cacheTurnos.find((t) => t.id === id);
  if (!turno) return;

  document.getElementById("turnoId").value = turno.id;
  document.getElementById("clienteName").value = turno.cliente_name || "";
  document.getElementById("selectProfesional").value =
    turno.profesional_id || "";
  document.getElementById("selectServicio").value = turno.servicio_id || "";
  document.getElementById("selectEstado").value = turno.status || "Reservado";
  document.getElementById("observacionesTurno").value = turno.observaciones || "";
  document.getElementById("modalTitle").innerText = "Editar Turno";

  if (turno.start_datetime) {
    // Separar fecha y hora
    const fechaHora = new Date(turno.start_datetime);
    const fecha = fechaHora.toISOString().split('T')[0];
    document.getElementById("fechaTurno").value = fecha;
    
    // Cargar horarios disponibles y seleccionar la hora
    setTimeout(() => {
      cargarHorariosDisponiblesAdmin().then(() => {
        const horaSelect = document.getElementById("horaTurno");
        if (horaSelect) {
          // Buscar la opción que coincida con la hora del turno
          const horaFormato = fechaHora.toISOString().slice(0, 19).replace('T', ' ');
          for (let option of horaSelect.options) {
            if (option.value === horaFormato || option.value.startsWith(turno.start_datetime.substring(0, 16))) {
              horaSelect.value = option.value;
              break;
            }
          }
        }
      });
    }, 100);
  }
  document.getElementById("turnoModal").style.display = "flex";
  // Función eliminada - ahora se usa cargarHorariosDisponiblesAdmin
}

function cerrarModalTurno() {
  document.getElementById("turnoModal").style.display = "none";
}

function formatearFechaHora(fechaString) {
  if (!fechaString) return { fecha: "-", hora: "-" };
  const fechaObj = new Date(fechaString.replace(" ", "T"));
  const fecha = fechaObj.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const hora = fechaObj.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return { fecha, hora };
}

// Cargar horarios disponibles (sistema nuevo como en vista de clientes)
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
  
  // Validar que la fecha no sea en el pasado
  const fechaSeleccionada = new Date(fecha);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  
  if (fechaSeleccionada < hoy) {
    alert('No se pueden agendar turnos en fechas pasadas');
    fechaInput.value = '';
    selectHora.innerHTML = '<option value="">Selecciona una fecha válida</option>';
    selectHora.disabled = true;
    return;
  }
  
  selectHora.innerHTML = '<option value="">Cargando horarios...</option>';
  selectHora.disabled = true;
  
  try {
    const empresaId = window.getEmpresaId();
    const servicioId = document.getElementById("selectServicio")?.value || null;
    let url = `${API_BASE_URL}/empresa/${empresaId}/horarios-disponibles?profesional_id=${profesionalId}&fecha=${fecha}`;
    if (servicioId) {
      url += `&servicio_id=${servicioId}`;
    }
    
    const response = await fetch(url, {
      headers: window.getAuthHeaders()
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
      selectHora.innerHTML = '<option value="">Error al cargar horarios</option>';
      if (data.message) {
        console.error('Error:', data.message);
      }
    }
  } catch (error) {
    console.error('Error cargando horarios:', error);
    selectHora.innerHTML = '<option value="">Error de conexión</option>';
  }
}

// Funciones antiguas eliminadas - reemplazadas por cargarHorariosDisponiblesAdmin

// exportar globalmente
window.cargarLogicaTurnos = cargarLogicaTurnos;
window.abrirModalTurno = abrirModalTurno;
window.prepararEdicion = prepararEdicion;
window.cerrarModalTurno = cerrarModalTurno;
window.eliminarTurno = eliminarTurno;
window.buscarClientesExistentes = buscarClientesExistentes;
window.toggleSidebar = toggleSidebar;
