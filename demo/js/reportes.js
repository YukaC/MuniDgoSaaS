/* --- MODULO DE REPORTES Y ESTADISTICAS --- */
async function cargarLogicaReportes() {
  try {
    console.log("📊 Iniciando módulo de reportes...");

    const empresaId = window.getEmpresaId();
    if (!empresaId) throw new Error("Empresa no definida en sesión.");
    const turnosUrl = `${API_BASE_URL}/empresa/${empresaId}/turnos`;

    let response;
    try {
      response = await fetch(turnosUrl, {
        headers: window.getAuthHeaders(),
      });
    } catch (netErr) {
      console.error("Error de red al intentar fetch de turnos:", netErr);
      return;
    }

    if (response.status === 401) {
      window.location.href = "login.html";
      return;
    }

    if (!response.ok) {
      console.error("Respuesta HTTP no OK:", response.status);
      return;
    }

    let turnos = await response.json();

    // normalizacion
    function normalizeTurnosResponse(payload) {
      if (!payload) return [];
      if (Array.isArray(payload)) return payload;
      return payload.data || payload.turnos || payload.results || [];
    }

    turnos = normalizeTurnosResponse(turnos);

    if (!Array.isArray(turnos)) {
      console.warn("La respuesta no es un array válido:", turnos);
      return;
    }

    /* --- CALCULOS Y ESTADISTICAS --- */
    calcularEstadisticas(turnos);

    try {
      renderRevenueByProfessional(turnos, 10);
      renderReservedTurnsChart(turnos);
    } catch (err) {
      console.error("Error renderizando gráficos:", err);
    }
  } catch (error) {
    console.error("Error loading reports:", error);
    mostrarErrorEnTablas();
  }
}

function mostrarErrorEnTablas() {
  const errorHTML =
    '<tr><td colspan="3" style="text-align:center; color:red">Error cargando datos</td></tr>';
  const tablaProf = document.getElementById("tabla-profesionales");
  if (tablaProf) tablaProf.innerHTML = errorHTML;
  const tablaCli = document.getElementById("tabla-clientes");
  if (tablaCli) tablaCli.innerHTML = errorHTML;
}

/* --- CALCULOS Y ESTADISTICAS --- */
function calcularEstadisticas(turnos) {
  const total = turnos.length;

  const completados = turnos.filter(
    (t) => (t.status || t.estado || "").toLowerCase() === "completado"
  ).length;
  const cancelados = turnos.filter(
    (t) => (t.status || t.estado || "").toLowerCase() === "cancelado"
  ).length;

  const completedPct = total ? Math.round((completados / total) * 100) : 0;
  const canceledPct = total ? Math.round((cancelados / total) * 100) : 0;

  updateStatDisplay("rep-ocupacion-pct", "bar-ocupacion", completedPct);
  updateStatDisplay("rep-cancelacion-pct", "bar-cancelacion", canceledPct);

  renderProfessionalsTable(turnos);
  renderClientsTable(turnos);
}

function updateStatDisplay(textId, barId, percentage) {
  const textElement = document.getElementById(textId);
  const barElement = document.getElementById(barId);

  if (textElement) textElement.innerText = `${percentage}%`;
  if (barElement) barElement.style.width = `${percentage}%`;
}

/* --- TABLA: RENDIMIENTO POR PROFESIONAL --- */
function renderProfessionalsTable(turnos) {
  const stats = {};

  turnos.forEach((t) => {
    let profName = "Desconocido";
    if (t.profesional_nombre) {
      profName = `${t.profesional_nombre} ${t.profesional_apellido}`;
    } else if (t.profesional_id) {
      profName = `ID: ${t.profesional_id}`;
    }

    if (!stats[profName]) {
      stats[profName] = { count: 0, revenue: 0 };
    }

    stats[profName].count++;

    if ((t.status || t.estado || "").toLowerCase() === "completado") {
      const precio = parseFloat(t.precio) || 0;
      stats[profName].revenue += precio;
    }
  });

  const tableBody = document.getElementById("tabla-profesionales");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  Object.entries(stats).forEach(([name, data]) => {
    tableBody.innerHTML += `
            <tr>
                <td>${name}</td>
                <td>${data.count} turnos</td>
                <td>$${data.revenue.toLocaleString("es-AR")}</td> 
            </tr>
        `;
  });
}

/* --- TABLA: CLIENTES MAS ACTIVOS --- */
function renderClientsTable(turnos) {
  const stats = {};

  turnos.forEach((t) => {
    const cli = t.cliente_name || "Anónimo";

    if (!stats[cli]) {
      stats[cli] = { count: 0, lastVisit: "" };
    }

    if ((t.status || t.estado || "").toLowerCase() === "completado") {
      stats[cli].count++;
    }

    if (t.start_datetime > stats[cli].lastVisit) {
      stats[cli].lastVisit = t.start_datetime;
    }
  });

  const tableBody = document.getElementById("tabla-clientes");
  if (!tableBody) return;
  tableBody.innerHTML = "";

  const sortedClients = Object.entries(stats).sort(
    (a, b) => b[1].count - a[1].count
  );

  sortedClients.forEach(([name, data]) => {
    let fechaMostrar = "-";
    if (data.lastVisit) {
      const fechaObj = new Date(data.lastVisit);
      fechaMostrar = fechaObj.toLocaleDateString("es-AR");
    }
    if (data.count > 0 || data.lastVisit !== "") {
      tableBody.innerHTML += `
                <tr>
                    <td>${name}</td>
                    <td>${data.count}</td>
                    <td>${fechaMostrar}</td>
                </tr>
            `;
    }
  });
}

/* --- GRAFICOS VISUALES DE ECHARTS --- */
function renderRevenueByProfessional(turnos, topN = 10) {
  const map = {};

  const getProfName = (t) => {
    if (t.profesional_nombre)
      return `${t.profesional_nombre} ${t.profesional_apellido}`;
    return `ID: ${t.profesional_id || "-"}`;
  };

  turnos.forEach((t) => {
    const status = (t.status || t.estado || "").toLowerCase();
    if (status !== "completado") return;

    const nombre = getProfName(t);
    const precio = parseFloat(t.precio) || 0;

    map[nombre] = (map[nombre] || 0) + precio;
  });

  const items = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN);
  const labels = items.map((i) => i[0]);
  const values = items.map((i) => i[1]);

  const container = document.getElementById("chart-revenue-prof");
  if (!container) return;

  if (values.length === 0 || values.every((v) => v === 0)) {
    container.innerHTML =
      '<div style="text-align:center; color:#666; padding:40px; font-size:0.9em;">No hay ingresos registrados aún.</div>';
    return;
  }

  const chart = echarts.init(container);
  const option = {
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      formatter: (params) =>
        `${params[0].name}<br/>Ingresos: $${(
          params[0].value || 0
        ).toLocaleString("es-AR")}`,
    },
    grid: { left: "10%", right: "5%", top: 20, bottom: 30 },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: labels, inverse: true },
    series: [
      {
        type: "bar",
        data: values,
        itemStyle: { color: "#28a745" },
        barMaxWidth: 30,
      },
    ],
  };

  chart.setOption(option);
  window.addEventListener("resize", () => chart.resize());
}

function renderReservedTurnsChart(turnos) {
  const days = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const occupied = Array(7).fill(0);
  const reserved = Array(7).fill(0);
  const cancelled = Array(7).fill(0);

  const parseDate = (raw) => {
    if (!raw) return null;
    const d = new Date(raw.replace(" ", "T"));
    return isNaN(d) ? null : d;
  };

  turnos.forEach((t) => {
    const dt = parseDate(t.start_datetime);
    if (!dt) return;

    const d = dt.getDay(); // 0-6
    const st = (t.status || t.estado || "").toLowerCase();

    if (st === "cancelado") cancelled[d]++;
    else if (st === "completado") occupied[d]++;
    else reserved[d]++;
  });

  const container = document.getElementById("chart-turns-week");
  if (!container) return;

  const hasData = [...occupied, ...reserved, ...cancelled].some((v) => v > 0);
  if (!hasData) {
    container.innerHTML =
      '<div style="text-align:center; color:#666; padding:40px; font-size:0.9em;">No hay turnos registrados esta semana.</div>';
    return;
  }

  const chart = echarts.init(container);
  const option = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { bottom: 0 },
    grid: {
      left: "5%",
      right: "5%",
      top: "10%",
      bottom: "25%",
      containLabel: true,
    },
    xAxis: { type: "category", data: days.slice(1).concat(days[0]) }, // Lun-Dom
    yAxis: { type: "value" },
    series: [
      {
        name: "Completados",
        type: "bar",
        stack: "total",
        data: occupied.slice(1).concat(occupied[0]),
        itemStyle: { color: "#28a745" },
      },
      {
        name: "Reservados",
        type: "bar",
        stack: "total",
        data: reserved.slice(1).concat(reserved[0]),
        itemStyle: { color: "#ffc107" },
      },
      {
        name: "Cancelados",
        type: "bar",
        stack: "total",
        data: cancelled.slice(1).concat(cancelled[0]),
        itemStyle: { color: "#dc3545" },
      },
    ],
  };

  chart.setOption(option);
  window.addEventListener("resize", () => chart.resize());
}
