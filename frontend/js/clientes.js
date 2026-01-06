/* --- MODULO DE GESTION DE CLIENTES --- */

async function cargarLogicaClientes() {
  console.log("👥 Iniciando módulo de clientes...");
  await listarClientesDesdeTurnos();
}

/**
 * procesamiento de datos e historial de clientes basado en turnos
 */
async function listarClientesDesdeTurnos() {
  const tbody = document.getElementById("tabla-gestion-clientes");
  if (tbody)
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center;">Cargando historial...</td></tr>';

  try {
    const empresaId = window.getEmpresaId();
    if (!empresaId) throw new Error("No se identificó la empresa.");
    const url = `${API_BASE_URL}/empresa/${empresaId}/turnos`;

    const respuesta = await fetch(url, {
      headers: window.getAuthHeaders(),
    });

    if (respuesta.status === 401) {
      window.location.href = "login.html";
      return;
    }

    if (!respuesta.ok)
      throw new Error("Error al conectar con la API de turnos");

    const turnos = await respuesta.json();

    const clientesMap = {};

    turnos.forEach((t) => {
      const nombre = t.cliente_name || "Anónimo";

      if (!clientesMap[nombre]) {
        clientesMap[nombre] = {
          nombre: nombre,
          visitas: 0,
          ultimaVisita: t.start_datetime,
          servicios: new Set(),
        };
      }

      const estado = (t.status || t.estado || "").toLowerCase();
      if (estado !== "cancelado") {
        clientesMap[nombre].visitas++;
      }

      if (t.start_datetime > clientesMap[nombre].ultimaVisita) {
        clientesMap[nombre].ultimaVisita = t.start_datetime;
      }

      const servNombre =
        t.servicio_nombre ||
        (t.servicio_id ? `Servicio ${t.servicio_id}` : null);
      if (servNombre) {
        clientesMap[nombre].servicios.add(servNombre);
      }
    });

    const clientesArray = Object.values(clientesMap);
    clientesArray.sort((a, b) => b.visitas - a.visitas);

    renderizarTablaClientes(clientesArray);
  } catch (error) {
    console.error("Error listando clientes:", error);
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="4" style="text-align:center; color:red">Error cargando datos</td></tr>';
  }
}
/* --- RENDERIZADO DE INTERFAZ --- */
function renderizarTablaClientes(clientes) {
  const tbody = document.getElementById("tabla-gestion-clientes");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (clientes.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="4" style="text-align:center">No se encontraron clientes en el historial.</td></tr>';
    return;
  }

  const fragmento = document.createDocumentFragment();

  clientes.forEach((c) => {
    const fechaObj = new Date(c.ultimaVisita);
    const fechaStr = !isNaN(fechaObj)
      ? fechaObj.toLocaleDateString("es-AR")
      : "-";
    const serviciosStr = Array.from(c.servicios).join(", ") || "Ninguno";

    const fila = document.createElement("tr");
    fila.innerHTML = `
            <td><strong>${c.nombre}</strong></td>
            <td>${c.visitas}</td>
            <td>${fechaStr}</td>
            <td><small>${serviciosStr}</small></td>
        `;
    fragmento.appendChild(fila);
  });

  tbody.appendChild(fragmento);
}

window.cargarLogicaClientes = cargarLogicaClientes;
