/* --- VARIABLES GLOBALES --- */

let cacheProfesionalesDisp = [];
let profesionalSeleccionadoId = null;

// exportacion global
window.cargarLogicaDisponibilidades = cargarLogicaDisponibilidades;
window.abrirModalDisponibilidad = abrirModalDisponibilidad;
window.cerrarModalDisponibilidad = cerrarModalDisponibilidad;
window.guardarDisponibilidad = guardarDisponibilidad;
window.eliminarDisponibilidad = eliminarDisponibilidad;
window.gestionarHorarios = gestionarHorarios;

/* --- INICIALIZACION DEL MODULO --- */
async function cargarLogicaDisponibilidades() {
  console.log("Iniciando módulo de disponibilidades...");
  await cargarDatosIniciales();
}

/* --- CARGA DE DATOS--- */
async function cargarDatosIniciales() {
  const tbody = document.getElementById("tabla-gestion-disponibilidades");
  if (tbody)
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center;">Cargando datos...</td></tr>';

  try {
    const empresaId = window.getEmpresaId();
    if (!empresaId) throw new Error("Sin sesión de empresa.");

    // rutas para filtrar por empresa
    const urlProf = `${API_BASE_URL}/empresa/${empresaId}/profesionales`;
    const urlDisp = `${API_BASE_URL}/empresa/${empresaId}/disponibilidades`;

    const [resProf, resDisp] = await Promise.all([
      fetch(urlProf, { headers: window.getAuthHeaders() }),
      fetch(urlDisp, { headers: window.getAuthHeaders() }),
    ]);

    if (resProf.status === 401 || resDisp.status === 401) {
      alert("Sesión expirada.");
      window.location.href = "login.html";
      return;
    }

    const profData = await resProf.json();
    const dispData = await resDisp.json();

    cacheProfesionalesDisp = Array.isArray(profData) ? profData : [];
    const todasDisponibilidades = Array.isArray(dispData) ? dispData : [];

    renderizarTablaPrincipal(todasDisponibilidades);
  } catch (error) {
    console.error("Error cargando disponibilidades:", error);
    if (tbody)
      tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color:red">Error: ${error.message}</td></tr>`;
  }
}
/* --- RENDERIZADO DE TABLA DE PROFESIONALES --- */
function renderizarTablaPrincipal(disponibilidades) {
  const tbody = document.getElementById("tabla-gestion-disponibilidades");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (cacheProfesionalesDisp.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="3" style="text-align:center;">No hay profesionales registrados.</td></tr>';
    return;
  }

  const diasSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];
  const frag = document.createDocumentFragment();

  cacheProfesionalesDisp.forEach((prof) => {
    const susHorarios = disponibilidades.filter(
      (d) => d.profesional_id == prof.id
    );

    let resumenHTML =
      '<span style="color:#999; font-style:italic;">Sin horarios asignados</span>';

    if (susHorarios.length > 0) {
      susHorarios.sort(
        (a, b) =>
          a.day_of_week - b.day_of_week ||
          (a.start_time || "").localeCompare(b.start_time || "")
      );
      const lineas = susHorarios.map((h) => {
        const dia = diasSemana[h.day_of_week] || `Día ${h.day_of_week}`;
        const inicio = (h.start_time || "").substring(0, 5);
        const fin = (h.end_time || "").substring(0, 5);
        return `<div style="font-size:0.9em; margin-bottom:2px;"><strong>${dia}:</strong> ${inicio} - ${fin}</div>`;
      });
      resumenHTML = lineas.join("");
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
            <td>
                <strong>${prof.name} ${prof.surname}</strong><br>
                <small style="color:#666">${
                  prof.matricula || prof.email || ""
                }</small>
            </td>
            <td>${resumenHTML}</td>
            <td>
                <button class="btn-primary btn-sm" onclick="gestionarHorarios(${
                  prof.id
                })">⚙️ Editar</button>
            </td>
        `;
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
}

/* --- GESTION DE HORARIOS POR PROFESIONAL (MODAL) --- */
async function gestionarHorarios(profId) {
  profesionalSeleccionadoId = profId;
  const prof = cacheProfesionalesDisp.find((p) => p.id == profId);

  const modal = document.getElementById("modalDisponibilidad");
  const titulo = document.getElementById("titleDisponibilidad");
  const inputHidden = document.getElementById("dispProfesionalId");

  if (titulo)
    titulo.innerText = `Gestionar: ${
      prof ? prof.name + " " + prof.surname : "Profesional"
    }`;
  if (inputHidden) inputHidden.value = profId;

  // limpiar inputs
  document.getElementById("dispInicio").value = "";
  document.getElementById("dispFin").value = "";

  await actualizarListaModal(profId);
  if (modal) modal.style.display = "flex";
}
/* --- ACTUALIZAR LISTA DE HORARIOS EN EL MODAL --- */
async function actualizarListaModal(profId) {
  const container = document.getElementById("lista-horarios-modal-container");
  if (!container) return;
  container.innerHTML =
    '<p style="padding:10px; text-align:center;">Consultando horarios...</p>';

  try {
    const empresaId = window.getEmpresaId();

    const url = `${API_BASE_URL}/empresa/${empresaId}/profesional/${profId}/disponibilidades`;

    const res = await fetch(url, { headers: window.getAuthHeaders() });

    if (!res.ok) throw new Error("Error obteniendo horarios");

    let horarios = await res.json();

    if (!Array.isArray(horarios) || horarios.length === 0) {
      container.innerHTML =
        '<p style="padding:10px; color:#777; text-align:center;">No tiene horarios cargados.</p>';
      return;
    }

    const diasSemana = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    horarios.sort(
      (a, b) =>
        a.day_of_week - b.day_of_week ||
        (a.start_time || "").localeCompare(b.start_time || "")
    );

    let html = '<table style="width:100%; border-collapse:collapse;"><tbody>';
    horarios.forEach((h) => {
      const dia = diasSemana[h.day_of_week] || `Día ${h.day_of_week}`;
      const inicio = (h.start_time || "").substring(0, 5);
      const fin = (h.end_time || "").substring(0, 5);
      html += `
                <tr style="border-bottom:1px solid #f0f0f0;">
                    <td style="padding:8px; font-size:0.9em;">${dia}</td>
                    <td style="padding:8px; font-size:0.9em;">${inicio} - ${fin}</td>
                    <td style="padding:8px; text-align:right;">
                        <button type="button" class="btn-sm btn-danger" onclick="eliminarDisponibilidad(${h.id})">🗑️</button>
                    </td>
                </tr>`;
    });
    html += "</tbody></table>";
    container.innerHTML = html;
  } catch (e) {
    console.error(e);
    container.innerHTML = `<p style="color:red; text-align:center;">${e.message}</p>`;
  }
}

/* --- ACCIONES (CRUD) DE DISPONIBILIDAD --- */
async function guardarDisponibilidad() {
  let profId =
    document.getElementById("dispProfesionalId").value ||
    profesionalSeleccionadoId;
  const dia = document.getElementById("dispDia").value;
  const inicio = document.getElementById("dispInicio").value;
  const fin = document.getElementById("dispFin").value;

  if (!profId || !inicio || !fin) {
    alert("Faltan datos obligatorios.");
    return;
  }

  if (inicio >= fin) {
    alert("La hora de inicio debe ser anterior a la hora de fin.");
    return;
  }

  const empresaId = window.getEmpresaId();
  if (!empresaId) {
    alert("Error de sesión: No se encuentra el ID de la empresa.");
    return;
  }

  const datos = {
    profesional_id: parseInt(profId),
    day_of_week: parseInt(dia),
    start_time: inicio + ":00",
    end_time: fin + ":00",
    empresa_id: parseInt(empresaId),
  };

  try {
    // POST /disponibilidad
    // nos aseguramos enviar id-empresa en headers
    const headers = {
      ...window.getAuthHeaders(),
      "id-empresa": empresaId.toString(),
    };
    const urlPost = `${API_BASE_URL}/disponibilidad`;

    const res = await fetch(urlPost, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(datos),
    });

    if (res.ok) {
      document.getElementById("dispInicio").value = "";
      document.getElementById("dispFin").value = "";

      await actualizarListaModal(profId);
      cargarLogicaDisponibilidades();
    } else {
      const err = await res.json().catch(() => ({}));
      alert(
        "Error: " + (err.message || JSON.stringify(err) || "No se pudo guardar")
      );
    }
  } catch (e) {
    console.error(e);
    alert("Error de conexión");
  }
}

async function eliminarDisponibilidad(id) {
  if (!confirm("¿Borrar este horario?")) return;
  try {
    const empresaId = window.getEmpresaId();

    const urlDelete = `${API_BASE_URL}/empresa/${empresaId}/disponibilidad/${id}`;

    const res = await fetch(urlDelete, {
      method: "DELETE",
      headers: window.getAuthHeaders(),
    });

    if (res.ok) {
      let profId =
        document.getElementById("dispProfesionalId").value ||
        profesionalSeleccionadoId;
      await actualizarListaModal(profId);
      cargarLogicaDisponibilidades();
    } else {
      const err = await res.json().catch(() => ({}));
      alert("Error al eliminar: " + (err.message || "Permiso denegado"));
    }
  } catch (e) {
    console.error(e);
    alert("Error de conexión");
  }
}
/* --- HANDLER DE MODAL --- */
function cerrarModalDisponibilidad() {
  document.getElementById("modalDisponibilidad").style.display = "none";
  profesionalSeleccionadoId = null;
  const container = document.getElementById("lista-horarios-modal-container");
  if (container) container.innerHTML = "";
}

function abrirModalDisponibilidad() {
  alert("Por favor, selecciona 'Editar' en la fila del profesional.");
}
