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
  } else {
    console.warn(`No se encontro el div con id: ${idVista}`);
  }
}

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
