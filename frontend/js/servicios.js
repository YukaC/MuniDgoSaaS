/* --- MODULO DE GESTION DE SERVICIOS (CRUD) --- */
let cacheServicios = [];

async function cargarLogicaServicios() {
  console.log("Iniciando módulo de servicios...");

  const form = document.getElementById("formServicio");
  if (form && !form.dataset.init) {
    form.addEventListener("submit", guardarServicio);
    form.dataset.init = "true";
  }
  await listarServicios();
}

/* --- CARGA DE SERVICIOS --- */
async function listarServicios() {
  try {
    const empresaId = window.getEmpresaId();
    const url = `${API_BASE_URL}/empresa/${empresaId}/servicios`;
    const respuesta = await fetch(url, { headers: window.getAuthHeaders() });
    if (!respuesta.ok) throw new Error("Error al conectar con la API");

    const servicios = await respuesta.json();
    cacheServicios = servicios || [];

    renderizarTablaServicios(servicios);
  } catch (error) {
    console.error("Error listando servicios:", error);
    const tbody = document.getElementById("tabla-gestion-servicios");
    if (tbody)
      tbody.innerHTML =
        '<tr><td colspan="5" style="text-align:center; color:red">Error cargando datos</td></tr>';
  }
}

/* --- RENDERIZADO DE LA INTERFAZ --- */
function renderizarTablaServicios(lista) {
  const tbody = document.getElementById("tabla-gestion-servicios");
  if (!tbody) return;

  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center">No hay servicios registrados.</td></tr>';
    return;
  }

  const frag = document.createDocumentFragment();
  lista.forEach((s) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
            <td><strong>${s.name}</strong></td>
            <td>${s.duration_minutes} min</td>
            <td>$${s.price}</td>
            <td>${s.description || "-"}</td>
            <td>
                <button class="btn-action btn-sm" onclick="editarServicio(${
                  s.id
                })">✏️</button>
                <button class="btn-action btn-sm btn-danger" onclick="eliminarServicio(${
                  s.id
                })">🗑️</button>
            </td>
        `;
    frag.appendChild(fila);
  });

  tbody.appendChild(frag);
}

/* --- GUARDAR NUEVO O EDITAR SERVICIO --- */
async function guardarServicio(e) {
  e.preventDefault();
  const id = document.getElementById("servId").value;
  const empresaId = window.getEmpresaId();

  const datos = {
    empresa_id: parseInt(empresaId),
    name: document.getElementById("servName").value,
    duration_minutes: parseInt(document.getElementById("servDuration").value),
    price: parseFloat(document.getElementById("servPrice").value),
    description: document.getElementById("servDesc").value,
  };

  let url, metodo;
  // IMPORTANTE: Header id-empresa requerido para el POST en backend
  const headers = {
    ...window.getAuthHeaders(),
    "id-empresa": empresaId.toString(),
  };

  if (id) {
    url = `${API_BASE_URL}/empresa/${empresaId}/servicio/${id}`;
    metodo = "PUT";
  } else {
    url = `${API_BASE_URL}/servicio`;
    metodo = "POST";
  }

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: headers,
      body: JSON.stringify(datos),
    });

    if (res.ok) {
      alert("Servicio guardado correctamente");
      cerrarModalServicio();
      listarServicios();
    } else {
      const error = await res.json();
      alert("Error: " + (error.message || "No se pudo guardar"));
    }
  } catch (err) {
    alert("Error de conexion");
  }
}

/* --- ELIMINAR --- */
async function eliminarServicio(id) {
  if (!confirm("¿Eliminar servicio? Esto podría afectar turnos pasados."))
    return;
  try {
    const empresaId = window.getEmpresaId();
    const url = `${API_BASE_URL}/empresa/${empresaId}/servicio/${id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: window.getAuthHeaders(),
    });
    if (res.ok) {
      listarServicios();
    } else {
      const err = await res.json();
      alert("Error: " + err.message);
    }
  } catch (e) {
    alert("Error al eliminar");
  }
}

/* --- HANDLER DE MODALES --- */
function abrirModalServicio() {
  const form = document.getElementById("formServicio");
  if (form) form.reset();
  document.getElementById("servId").value = "";
  document.getElementById("modalTitleServ").innerText = "Nuevo Servicio";
  document.getElementById("modalServicio").style.display = "flex";
}

function editarServicio(id) {
  const serv = cacheServicios.find((s) => s.id === id);
  if (!serv) return;
  document.getElementById("servId").value = serv.id;
  document.getElementById("servName").value = serv.name;
  document.getElementById("servDuration").value = serv.duration_minutes;
  document.getElementById("servPrice").value = serv.price;
  document.getElementById("servDesc").value = serv.description || "";
  document.getElementById("modalTitleServ").innerText = "Editar Servicio";
  document.getElementById("modalServicio").style.display = "flex";
}

function cerrarModalServicio() {
  document.getElementById("modalServicio").style.display = "none";
}

window.cargarLogicaServicios = cargarLogicaServicios;
window.abrirModalServicio = abrirModalServicio;
window.editarServicio = editarServicio;
window.eliminarServicio = eliminarServicio;
window.cerrarModalServicio = cerrarModalServicio;
