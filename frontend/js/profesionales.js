/* --- CONTROL DE INICIO Y EVENTOS --- */
let cacheProfesionales = [];

async function cargarLogicaProfesionales() {
  console.log("Iniciando módulo de profesionales...");
  const form = document.getElementById("formProfesional");
  if (form && !form.dataset.init) {
    form.addEventListener("submit", guardarProfesional);
    form.dataset.init = "true";
  }
  await listarProfesionales();
}

/* --- CONSULTA DE PROFESIONALES A LA API --- */
async function listarProfesionales() {
  try {
    const empresaId = window.getEmpresaId();
    const url = `${API_BASE_URL}/empresa/${empresaId}/profesionales`;
    const respuesta = await fetch(url, { headers: window.getAuthHeaders() });
    if (respuesta.status === 401) return (window.location.href = "login.html");
    if (!respuesta.ok) throw new Error("Error API");

    const profesionales = await respuesta.json();
    cacheProfesionales = profesionales || [];
    renderizarTablaProfesionales(profesionales);
  } catch (error) {
    console.error("Error:", error);
  }
}

/* --- ACTUALIZACION DE LA INTERFAZ --- */
function renderizarTablaProfesionales(lista) {
  const tbody = document.getElementById("tabla-gestion-profesionales");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (lista.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" style="text-align:center">No hay profesionales registrados.</td></tr>';
    return;
  }

  const frag = document.createDocumentFragment();
  lista.forEach((p) => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
            <td><strong>${p.name} ${p.surname}</strong><br><small style="color:#666">${p.especialidad || "Consulta General"}</small></td>
            <td>${p.matricula || "-"}</td>
            <td>${p.dni || "-"}</td>
            <td>${p.email || "-"}</td>
            <td>
                <button class="btn-action btn-sm" onclick="editarProfesional(${
                  p.id
                })">✏️</button>
                <button class="btn-action btn-sm btn-danger" onclick="eliminarProfesional(${
                  p.id
                })">🗑️</button>
            </td>
        `;
    frag.appendChild(fila);
  });

  tbody.appendChild(frag);
}

/* --- GUARDAR NUEVO O EDITAR PROFESIONAL --- */
async function guardarProfesional(e) {
  e.preventDefault();
  const id = document.getElementById("profId").value;
  const empresaId = window.getEmpresaId();

  const datos = {
    empresa_id: empresaId,
    name: document.getElementById("profName").value,
    surname: document.getElementById("profSurname").value,
    especialidad: document.getElementById("profEspecialidad").value || "Consulta General",
    matricula: document.getElementById("profMatricula").value,
    dni: document.getElementById("profDni").value,
    email: document.getElementById("profEmail").value,
  };

  let url, metodo;

  // IMPORTANTE: Header id-empresa requerido para el POST en backend
  const headers = {
    ...window.getAuthHeaders(),
    "id-empresa": empresaId.toString(),
  };

  if (id) {
    url = `${API_BASE_URL}/empresa/${empresaId}/profesional/${id}`;
    metodo = "PUT";
  } else {
    url = `${API_BASE_URL}/profesional`;
    metodo = "POST";
  }

  try {
    const res = await fetch(url, {
      method: metodo,
      headers: headers,
      body: JSON.stringify(datos),
    });

    if (res.ok) {
      alert("Profesional guardado.");
      cerrarModalProfesional();
      listarProfesionales();
    } else {
      const error = await res.json();
      alert("Error: " + (error.message || "Error al guardar"));
    }
  } catch (err) {
    alert("Error de conexión");
  }
}

/* --- ELIMINAR PROFESIONAL --- */
async function eliminarProfesional(id) {
  if (
    !confirm(
      "¿Eliminar profesional? Esto borrará también sus turnos asociados."
    )
  )
    return;
  try {
    const empresaId = window.getEmpresaId();
    const url = `${API_BASE_URL}/empresa/${empresaId}/profesional/${id}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: window.getAuthHeaders(),
    });

    if (res.ok) {
      listarProfesionales();
    } else {
      const err = await res.json();
      alert("Error: " + err.message);
    }
  } catch (e) {
    alert("Error al eliminar");
  }
}

/* --- HANDLER DE MODALES --- */
function abrirModalProfesional() {
  const form = document.getElementById("formProfesional");
  if (form) form.reset();
  document.getElementById("profId").value = "";
  document.getElementById("modalTitleProf").innerText = "Nuevo Profesional";
  document.getElementById("modalProfesional").style.display = "flex";
}

function editarProfesional(id) {
  const prof = cacheProfesionales.find((p) => p.id === id);
  if (!prof) return;
  document.getElementById("profId").value = prof.id;
  document.getElementById("profName").value = prof.name;
  document.getElementById("profSurname").value = prof.surname;
  document.getElementById("profEspecialidad").value = prof.especialidad || "Consulta General";
  document.getElementById("profMatricula").value = prof.matricula;
  document.getElementById("profDni").value = prof.dni;
  document.getElementById("profEmail").value = prof.email;
  document.getElementById("modalTitleProf").innerText = "Editar Profesional";
  document.getElementById("modalProfesional").style.display = "flex";
}

function cerrarModalProfesional() {
  document.getElementById("modalProfesional").style.display = "none";
}

window.cargarLogicaProfesionales = cargarLogicaProfesionales;
window.abrirModalProfesional = abrirModalProfesional;
window.editarProfesional = editarProfesional;
window.eliminarProfesional = eliminarProfesional;
window.cerrarModalProfesional = cerrarModalProfesional;
