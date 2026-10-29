
let cacheClientes = [];

/* --- CARGA INICIAL DEL MODULO DE CLIENTES --- */
async function cargarLogicaClientes() {
    console.log("Iniciando módulo de clientes...");
    
    // Configurar formulario
    const form = document.getElementById("formCliente");
    if (form) {
        // Remover listener previo para evitar duplicados si se llama varias veces
        const newForm = form.cloneNode(true);
        form.parentNode.replaceChild(newForm, form);
        document.getElementById("formCliente").addEventListener("submit", guardarCliente);
    }
    
    await listarClientes();
}

/* --- LISTAR CLIENTES --- */
async function listarClientes() {
    try {
        const empresaId = window.getEmpresaId();
        const url = `${API_BASE_URL}/empresa/${empresaId}/clientes-todos`;
        
        const respuesta = await fetch(url, { headers: window.getAuthHeaders() });
        if (!respuesta.ok) throw new Error("Error obteniendo clientes");
        
        const clientes = await respuesta.json();
        cacheClientes = clientes || [];
        renderizarTablaClientes(clientes);
    } catch (error) {
        console.error("Error al listar clientes:", error);
    }
}

/* --- RENDERIZADO DE CLIENTES COMO CARDS --- */
function renderizarTablaClientes(clientes) {
    const container = document.getElementById("container-gestion-clientes");
    if (!container) return;
    container.innerHTML = "";

    if (!clientes || clientes.length === 0) {
        container.innerHTML = '<p class="help-text">No hay clientes registrados</p>';
        return;
    }

    clientes.forEach(cliente => {
        const card = document.createElement('div');
        card.className = 'item-card';
        
        card.innerHTML = `
            <div class="item-card-header">
                <h3>👤 ${cliente.nombre} ${cliente.apellido}</h3>
            </div>
            <div class="item-card-body">
                <div class="info-item">
                    <strong>DNI:</strong>
                    <span>${cliente.dni}</span>
                </div>
                <div class="info-item">
                    <strong>Email:</strong>
                    <span>${cliente.email || 'No registrado'}</span>
                </div>
                <div class="info-item">
                    <strong>Teléfono:</strong>
                    <span>${cliente.telefono || 'No registrado'}</span>
                </div>
            </div>
            <div class="item-card-footer">
                <button class="btn-primary btn-sm" onclick="editarCliente(${cliente.id})">✏️ Editar</button>
                <button class="btn-danger btn-sm" onclick="eliminarCliente(${cliente.id})">🗑️ Eliminar</button>
            </div>
        `;
        
        container.appendChild(card);
    });
}

/* --- MODALES --- */
function abrirModalCliente() {
    const form = document.getElementById("formCliente");
    if (form) form.reset();
    document.getElementById("clienteId").value = "";
    document.getElementById("modalTitleCliente").textContent = "Nuevo Cliente";
    document.getElementById("modalCliente").style.display = "flex";
}

function cerrarModalCliente() {
    document.getElementById("modalCliente").style.display = "none";
}

function editarCliente(id) {
    const cliente = cacheClientes.find(c => c.id === id);
    if (!cliente) return;

    document.getElementById("clienteId").value = cliente.id;
    document.getElementById("cliDni").value = cliente.dni;
    document.getElementById("cliNombre").value = cliente.nombre;
    document.getElementById("cliApellido").value = cliente.apellido;
    document.getElementById("cliEmail").value = cliente.email || "";
    document.getElementById("cliTelefono").value = cliente.telefono || "";
    document.getElementById("cliPassword").value = ""; // No mostrar password hash
    
    document.getElementById("modalTitleCliente").textContent = "Editar Cliente";
    document.getElementById("modalCliente").style.display = "flex";
}

async function eliminarCliente(id) {
    if (!confirm("¿Estás seguro de que deseas eliminar este cliente? Se mantendrá el historial de sus turnos pasados pero el registro del ciudadano será borrado.")) return;

    const empresaId = window.getEmpresaId();
    const url = `${API_BASE_URL}/empresa/${empresaId}/cliente/${id}`;

    try {
        const response = await fetch(url, {
            method: 'DELETE',
            headers: window.getAuthHeaders()
        });

        const data = await response.json();

        if (response.ok) {
            alert("Cliente eliminado exitosamente");
            listarClientes();
            if (window.cargarClientesExistentes) window.cargarClientesExistentes();
        } else {
            alert("Error: " + (data.message || "No se pudo eliminar"));
        }
    } catch (error) {
        console.error(error);
        alert("Error de conexión");
    }
}

/* --- GUARDAR CLIENTE --- */
async function guardarCliente(e) {
    e.preventDefault();
    
    const empresaId = window.getEmpresaId();
    const id = document.getElementById("clienteId").value;
    
    const datos = {
        dni: document.getElementById("cliDni").value,
        nombre: document.getElementById("cliNombre").value,
        apellido: document.getElementById("cliApellido").value,
        email: document.getElementById("cliEmail").value || null,
        telefono: document.getElementById("cliTelefono").value || null
    };

    const password = document.getElementById("cliPassword").value;
    if (password) {
        datos.password = password;
    }
    
    let url = `${API_BASE_URL}/empresa/${empresaId}/cliente`;
    let metodo = 'POST';

    if (id) {
        url = `${API_BASE_URL}/empresa/${empresaId}/cliente/${id}`;
        metodo = 'PUT';
    }
    
    try {
        const response = await fetch(url, {
            method: metodo,
            headers: window.getAuthHeaders(),
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert(id ? "Cliente actualizado exitosamente" : "Cliente registrado exitosamente");
            cerrarModalCliente();
            listarClientes();
            // Actualizar lista en el modal de turnos si está abierto 
            if (window.cargarClientesExistentes) window.cargarClientesExistentes(); 
        } else {
            alert("Error: " + (data.message || "No se pudo guardar"));
        }
    } catch (error) {
        console.error(error);
        alert("Error de conexión");
    }
}

// Exportar globalmente
window.cargarLogicaClientes = cargarLogicaClientes;
window.abrirModalCliente = abrirModalCliente;
window.cerrarModalCliente = cerrarModalCliente;
window.editarCliente = editarCliente;
window.eliminarCliente = eliminarCliente;
