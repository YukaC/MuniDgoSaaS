/* --- VERIFICAR SESION AL INICIO --- */
const userLog = localStorage.getItem("activeUser");

if (!userLog || !localStorage.getItem("authToken")) {
  window.location.href = "login.html";
}

let usuarioData = {};
try {
  usuarioData = JSON.parse(userLog);
} catch (e) {
  localStorage.clear();
  window.location.href = "login.html";
}

/* --- LOGICA DEL DASHBOARD --- */
document.addEventListener("DOMContentLoaded", () => {
  const welcomeMsg = document.getElementById("welcome-message");
  if (welcomeMsg && usuarioData.nombre) {
    // Mostrar el nombre de la empresa/sector en lugar del nombre de usuario
    welcomeMsg.innerText = `Bienvenido - ${usuarioData.nombre}`;
  }

  configurarNavegacion();

  // cargar dashboard si existe el contenedor
  if (document.getElementById("dashboard")) {
    loadDashboard();
  }

  const btnLogout = document.getElementById("logout");
  if (btnLogout) {
    btnLogout.addEventListener("click", () => {
      localStorage.clear();
      window.location.href = "login.html";
    });
  }
});

/* --- CARGA Y PROCESO DE DATOS (DASHBOARD) --- */
async function loadDashboard() {
  try {
    console.log("Iniciando modulo principal...");

    const empresaId = window.getEmpresaId();
    if (!empresaId) return;
    const url = `${API_BASE_URL}/empresa/${empresaId}/turnos`;

    const response = await fetch(url, {
      headers: window.getAuthHeaders(),
    });

    if (response.status === 401) {
      alert("Su sesión ha expirado. Por favor ingrese nuevamente.");
      localStorage.clear();
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) throw new Error("Error al obtener datos del servidor");

    const turnos = await response.json();

    // ESTADISTICAS
    const total = turnos.length;
    const completados = turnos.filter(
      (t) => (t.status || t.estado || "").toLowerCase() === "completado"
    ).length;
    const cancelados = turnos.filter(
      (t) => (t.status || t.estado || "").toLowerCase() === "cancelado"
    ).length;

    const elTotal = document.getElementById("totalShift");
    const elCompleted = document.getElementById("completedShift");
    const elCanceled = document.getElementById("canceledShift");

    if (elTotal) elTotal.innerText = total;
    if (elCompleted) elCompleted.innerText = completados;
    if (elCanceled) elCanceled.innerText = cancelados;


    const tbody = document.getElementById("shifts-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    if (turnos.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center">No hay turnos registrados</td></tr>';
      return;
    }

    // ordenar por fecha mas reciente primero
    turnos.sort(
      (a, b) => new Date(b.start_datetime) - new Date(a.start_datetime)
    );

    turnos.forEach((turno) => {
      let stateColor = "var(--dark)";
      const estado = (
        turno.status ||
        turno.estado ||
        "reservado"
      ).toLowerCase();

      if (estado === "completado") stateColor = "var(--success)";
      if (estado === "cancelado") stateColor = "var(--danger)";
      if (estado === "reservado") stateColor = "var(--warning)";
      if (estado === "pendiente de confirmación" || estado === "pendiente de confirmacion") stateColor = "#ff9800"; // Naranja

      const { fechaFormateada, horaFormateada } = parseFechaHora(
        turno.start_datetime
      );

      // nombre profesional concatenado
      let profName = "Profesional no encontrado";
      if (turno.profesional_nombre) {
        profName = `${turno.profesional_nombre} ${turno.profesional_apellido}`;
      } else if (turno.profesional_id) {
        profName = `ID: ${turno.profesional_id}`;
      }

      // especialidad
      const especialidad = turno.profesional_especialidad || turno.servicio_nombre || "Consulta General";
      const observaciones = turno.observaciones || "-";
      const cliente = turno.cliente_name || "Anónimo";

      const fila = `
                <tr>
                    <td>
                        <strong>${horaFormateada}</strong>
                        <div style="font-size:0.8em; color:#777">${fechaFormateada}</div>
                    </td>
                    <td>${cliente}</td>
                    <td>
                        ${profName}<br>
                        <small style="color:#777">[${especialidad}]</small>
                    </td>
                    <td style="color: ${stateColor}; font-weight:bold; text-transform:capitalize;">
                        ${estado}
                    </td>
                    <td><small>${observaciones}</small></td>
                </tr>
            `;
      tbody.innerHTML += fila;
    });
  } catch (error) {
    console.error("Error cargando dashboard:", error);
    const tbody = document.getElementById("shifts-table-body");
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; color:red">Error cargando datos</td></tr>';
  }
}

/* --- UTILIDAD DE PARSEO DE FECHA Y HORA --- */
function parseFechaHora(datetimeStr) {
  if (!datetimeStr) return { fechaFormateada: "-", horaFormateada: "-" };
  const dateObj = new Date(datetimeStr.replace(" ", "T")); // Asegurar formato ISO

  if (isNaN(dateObj))
    return { fechaFormateada: datetimeStr, horaFormateada: "" };

  const fechaFormateada = dateObj.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const horaFormateada = dateObj.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return { fechaFormateada, horaFormateada };
}

/* --- SISTEMA DE NAVEGACION --- */
function configurarNavegacion() {
  const links = document.querySelectorAll(".main-nav a");

  links.forEach((link) => {
    link.addEventListener("click", (e) => {
      if (link.getAttribute("href") === "#") e.preventDefault();

      document.querySelector(".main-nav a.active")?.classList.remove("active");
      link.classList.add("active");

      const targetId = link.dataset.target;
      if (targetId) {
        cambiarVista(targetId);
      } else {
        console.log("Navegación sin target definido");
      }

      // Cerrar sidebar en mobile tras click
      if (window.innerWidth <= 768) {
        const sidebar = document.querySelector(".sidebar");
        if (sidebar) sidebar.classList.remove("active");
      }
    });
  });
}

function cambiarVista(idVista) {
  document
    .querySelectorAll(".page-content")
    .forEach((div) => (div.style.display = "none"));

  const divDestino = document.getElementById(idVista);
  if (divDestino) {
    divDestino.style.display = "block";
    ejecutarLogicaModulo(idVista);
    
    // Mostrar/ocultar barra de búsqueda según la sección
    actualizarBarraBusqueda(idVista);
    
  } else {
    console.warn(`No se encontro el div con id: ${idVista}`);
  }
}

// Secciones donde se muestra la barra de búsqueda
const seccionesConBusqueda = ['view-shifts', 'view-clients', 'view-professional', 'view-services', 'view-availability'];

// Variable para trackear la sección activa
let seccionActivaActual = 'dashboard';

// Actualiza placeholder y visibilidad de la barra según la sección
function actualizarBarraBusqueda(idVista) {
  seccionActivaActual = idVista;
  const searchContainer = document.getElementById('searchBarContainer');
  const searchInput = document.getElementById('globalSearchInput');
  
  if (!searchContainer || !searchInput) return;
  
  // Limpiar búsqueda al cambiar de sección
  limpiarBusqueda();
  
  if (seccionesConBusqueda.includes(idVista)) {
    searchContainer.style.display = 'flex';
    
    // Personalizar placeholder según sección
    const placeholders = {
      'view-shifts': 'Buscar turnos por cliente, profesional...',
      'view-clients': 'Buscar clientes por nombre, DNI...',
      'view-professional': 'Buscar profesionales por nombre, especialidad...',
      'view-services': 'Buscar servicios...',
      'view-availability': 'Buscar disponibilidades...'
    };
    searchInput.placeholder = placeholders[idVista] || 'Buscar...';
  } else {
    searchContainer.style.display = 'none';
  }
}

// Filtra el contenido activo según el texto de búsqueda
function filtrarContenido(texto) {
    const busqueda = texto.toLowerCase().trim();

    // Encontrar la sección activa por ID
    const seccionActiva = document.getElementById(seccionActivaActual);
    if (!seccionActiva) return;

    // Buscar todos los contenedores de cards/items
    const containers = seccionActiva.querySelectorAll(
        '#container-gestion-turnos, #container-gestion-profesionales, #container-gestion-clientes, #container-gestion-servicios, #container-gestion-disponibilidades, .turnos-container, .items-container'
    );

    let totalEncontrados = 0;

    containers.forEach(container => {
        if (!container) return;

        // CORRECCIÓN 1: Usar 'children' para obtener solo las tarjetas directas
        // y evitar seleccionar elementos internos (hijos) que rompen el diseño.
        const cards = Array.from(container.children);

        cards.forEach(card => {
            // Validamos que sea un elemento visual relevante (opcional)
            if(card.tagName === 'SCRIPT' || card.tagName === 'STYLE') return;

            const textoCard = card.textContent.toLowerCase();

            // CORRECCIÓN 2: Eliminamos la lógica de 'style.order'.
            // Solo quitamos o ponemos la clase.
            if (busqueda === '' || textoCard.includes(busqueda)) {
                card.classList.remove('search-hidden');
                totalEncontrados++;
            } else {
                card.classList.add('search-hidden');
            }
        });
    });

    // Búsqueda en tablas (si existen en la vista)
    const filas = seccionActiva.querySelectorAll('tbody tr');
    filas.forEach(fila => {
        const textoFila = fila.textContent.toLowerCase();
        if (busqueda === '' || textoFila.includes(busqueda)) {
            fila.classList.remove('search-hidden');
            totalEncontrados++;
        } else {
            fila.classList.add('search-hidden');
        }
    });

    // Mostrar mensaje si no hay resultados
    mostrarMensajeNoResultados(seccionActiva, busqueda !== '' && totalEncontrados === 0);
}

function mostrarMensajeNoResultados(seccion, mostrar) {
  let mensaje = seccion.querySelector('.no-results-message');
  
  if (mostrar) {
    if (!mensaje) {
      mensaje = document.createElement('div');
      mensaje.className = 'no-results-message';
      mensaje.textContent = '🔍 No se encontraron resultados para tu búsqueda';
      seccion.appendChild(mensaje);
    }
    mensaje.style.display = 'block';
  } else if (mensaje) {
    mensaje.style.display = 'none';
  }
}

function limpiarBusqueda() {
  const searchInput = document.getElementById('globalSearchInput');
  if (searchInput) {
    searchInput.value = '';
    filtrarContenido('');
  }
}

// Exportar funciones globalmente
window.filtrarContenido = filtrarContenido;
window.limpiarBusqueda = limpiarBusqueda;

/* --- HANDLER DE MODULOS Y MODALES--- */
function ejecutarLogicaModulo(idVista) {
  const acciones = {
    reports: () =>
      typeof cargarLogicaReportes === "function" && cargarLogicaReportes(),
    dashboard: () => loadDashboard(),
    "view-shifts": () =>
      typeof cargarLogicaTurnos === "function" && cargarLogicaTurnos(),
    "view-clients": () =>
      typeof cargarLogicaClientes === "function" && cargarLogicaClientes(),
    "view-professional": () =>
      typeof cargarLogicaProfesionales === "function" &&
      cargarLogicaProfesionales(),
    "view-availability": () =>
      typeof cargarLogicaDisponibilidades === "function" &&
      cargarLogicaDisponibilidades(),
    "view-services": () =>
      typeof cargarLogicaServicios === "function" && cargarLogicaServicios(),
  };
  if (acciones[idVista]) acciones[idVista]();
}
