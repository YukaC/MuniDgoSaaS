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
    const container = document.getElementById("container-gestion-servicios");
    if (container)
      container.innerHTML = '<p class="help-text" style="color:red">Error cargando datos</p>';
  }
}

/* --- RENDERIZADO DE LA INTERFAZ COMO CARDS --- */
function renderizarTablaServicios(lista) {
  const container = document.getElementById("container-gestion-servicios");
  if (!container) return;

  container.innerHTML = "";

  if (lista.length === 0) {
    container.innerHTML = '<p class="help-text">No hay servicios registrados.</p>';
    return;
  }

  lista.forEach((s) => {
    const card = document.createElement('div');
    card.className = 'item-card';
    
    card.innerHTML = `
      <div class="item-card-header">
        <h3>💼 ${s.name}</h3>
        <span class="badge-precio">$${s.price}</span>
      </div>
      <div class="item-card-body">
        <div class="info-item">
          <strong>Duración:</strong>
          <span>${s.duration_minutes} minutos</span>
        </div>
        <div class="info-item">
          <strong>Descripción:</strong>
          <span>${s.description || 'Sin descripción'}</span>
        </div>
      </div>
      <div class="item-card-footer">
        <button class="btn-primary btn-sm" onclick="editarServicio(${s.id})">✏️ Editar</button>
        <button class="btn-danger btn-sm" onclick="eliminarServicio(${s.id})">🗑️ Eliminar</button>
      </div>
    `;
    
    container.appendChild(card);
  });
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
