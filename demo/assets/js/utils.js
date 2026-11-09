/**
 * Utilidades compartidas para el frontend
 * Aplicando principio DRY para evitar código duplicado entre módulos
 */

// ==================== FORMATEO DE FECHAS ====================

/**
 * Formatea un string de fecha/hora a formato legible
 * @param {string} datetimeStr - Fecha en formato ISO o 'YYYY-MM-DD HH:MM:SS'
 * @returns {object} - { fecha: 'DD/MM/YYYY', hora: 'HH:MM' }
 */
function formatearFechaHora(datetimeStr) {
    if (!datetimeStr) return { fecha: "-", hora: "-" };
    
    const fechaObj = new Date(datetimeStr.replace(" ", "T"));
    
    if (isNaN(fechaObj)) return { fecha: datetimeStr, hora: "" };
    
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

/**
 * Formatea fecha completa en español
 * @param {string} datetimeStr - Fecha en formato ISO
 * @returns {string} - "lunes, 15 de enero de 2024, 10:30"
 */
function formatearFechaCompleta(datetimeStr) {
    if (!datetimeStr) return "-";
    
    const fecha = new Date(datetimeStr);
    const opciones = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    return fecha.toLocaleDateString('es-ES', opciones);
}

// ==================== MOBILE SIDEBAR ====================

/**
 * Toggle del sidebar en dispositivos móviles
 */
function toggleSidebar() {
    const sidebar = document.querySelector(".sidebar");
    if (sidebar) {
        sidebar.classList.toggle("active");
    }
}

/**
 * Configura el menú móvil con cierre automático
 */
function setupMobileMenu() {
    // Cerrar sidebar al hacer clic fuera
    document.addEventListener("click", (e) => {
        const sidebar = document.querySelector(".sidebar");
        const menuToggle = document.getElementById("menuToggle");
        
        if (window.innerWidth <= 768 && sidebar && menuToggle) {
            if (sidebar.classList.contains("active") && 
                !sidebar.contains(e.target) && 
                !menuToggle.contains(e.target)) {
                sidebar.classList.remove("active");
            }
        }
    });
    
    // Mostrar/ocultar botón hamburguesa según tamaño
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
    ajustarMenuMobile();
}

// ==================== PROCESAMIENTO DE HORARIOS ====================

/**
 * Procesa y muestra horarios en un select
 * @param {Array} horarios - Lista de {hora: 'HH:MM', datetime: 'YYYY-MM-DD HH:MM:SS'}
 * @param {HTMLSelectElement} selectElement - Elemento select destino
 * @param {string|null} horaOriginal - Hora original del turno (para edición)
 * @param {boolean} filtrarPasados - Si debe filtrar horarios pasados
 */
function procesarHorarios(horarios, selectElement, horaOriginal = null, filtrarPasados = true) {
    if (!selectElement) return;
    
    if (!horarios || horarios.length === 0) {
        selectElement.innerHTML = '<option value="">No hay horarios disponibles</option>';
        selectElement.disabled = true;
        return;
    }
    
    selectElement.innerHTML = '<option value="">Selecciona una hora...</option>';
    const ahora = new Date();
    let originalIncluido = false;
    
    horarios.forEach(horario => {
        const fechaHoraHorario = new Date(horario.datetime);
        
        // Verificar si es la hora original
        if (horaOriginal && (
            horario.datetime === horaOriginal || 
            horario.datetime.replace(' ', 'T') === horaOriginal.replace(' ', 'T')
        )) {
            originalIncluido = true;
        }
        
        // Filtrar pasados si es necesario
        if (filtrarPasados && fechaHoraHorario <= ahora) {
            return;
        }
        
        const option = document.createElement('option');
        option.value = horario.datetime;
        option.textContent = horario.hora;
        selectElement.appendChild(option);
    });
    
    // Agregar horario original si no estaba
    if (horaOriginal && !originalIncluido) {
        const dateObj = new Date(horaOriginal.replace(' ', 'T'));
        const horaStr = dateObj.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        
        const option = document.createElement('option');
        option.value = horaOriginal;
        option.textContent = `${horaStr} (Horario actual)`;
        selectElement.prepend(option);
        selectElement.value = horaOriginal;
    }
    
    // Verificar si quedaron opciones
    if (selectElement.options.length <= 1) {
        selectElement.innerHTML = '<option value="">No hay horarios disponibles</option>';
        selectElement.disabled = true;
    } else {
        selectElement.disabled = false;
    }
}

/**
 * Muestra información del profesional (días y especialidad)
 * @param {string} profesionalId - ID del profesional
 * @param {object} mapaDiasDisponibles - Mapa de {id: [dias]}
 * @param {HTMLElement} selectProfesional - Select de profesionales
 * @param {HTMLElement|null} infoEspecialidad - Elemento para mostrar especialidad
 * @param {HTMLElement|null} infoDiasDisponibles - Elemento para mostrar días
 */
function mostrarInfoProfesional(
    profesionalId, 
    mapaDiasDisponibles, 
    selectProfesional, 
    infoEspecialidad = null, 
    infoDiasDisponibles = null
) {
    if (!selectProfesional) return;
    
    const option = selectProfesional.options[selectProfesional.selectedIndex];
    
    // Mostrar especialidad
    if (infoEspecialidad) {
        if (profesionalId && option && option.dataset.especialidad) {
            infoEspecialidad.textContent = `Especialidad: ${option.dataset.especialidad}`;
            infoEspecialidad.style.display = 'block';
        } else {
            infoEspecialidad.style.display = 'none';
        }
    }
    
    // Mostrar días disponibles
    if (infoDiasDisponibles) {
        if (profesionalId && mapaDiasDisponibles) {
            const dias = mapaDiasDisponibles[profesionalId];
            
            if (dias && dias.length > 0) {
                const diasNombres = dias.join(', ');
                infoDiasDisponibles.textContent = `Días de atención: ${diasNombres}`;
                infoDiasDisponibles.style.display = 'block';
                infoDiasDisponibles.style.cssText = `
                    display: block;
                    background: #e3f2fd;
                    color: #1976d2;
                    border-radius: 7px;
                    padding: 6px 12px;
                    margin-top: 8px;
                    font-weight: bold;
                `;
            } else {
                infoDiasDisponibles.textContent = "Sin días de atención configurados";
                infoDiasDisponibles.style.display = 'block';
                infoDiasDisponibles.style.color = '#dc3545';
            }
        } else {
            infoDiasDisponibles.style.display = 'none';
        }
    }
}

// ==================== API HELPERS ====================

/**
 * Carga el resumen de disponibilidades de una empresa
 * @param {string|number} empresaId - ID de la empresa
 * @param {function} getHeaders - Función que retorna headers de auth
 * @param {boolean} isCliente - Si es el portal de cliente (usa diferente URL)
 * @returns {Promise<object>} - Mapa de {profesional_id: [dias]}
 */
async function cargarResumenDisponibilidad(empresaId, getHeaders, isCliente = false) {
    try {
        const baseUrl = isCliente 
            ? `${API_BASE_URL}/cliente/empresa/${empresaId}/profesionales/disponibilidades-resumen`
            : `${API_BASE_URL}/empresa/${empresaId}/profesionales/disponibilidades-resumen`;
            
        const response = await fetch(baseUrl, { headers: getHeaders() });
        
        if (response.ok) {
            return await response.json();
        }
        return {};
    } catch (error) {
        console.error('Error cargando disponibilidad:', error);
        return {};
    }
}

/**
 * Carga horarios disponibles para un profesional en una fecha
 * @param {string|number} empresaId - ID de la empresa
 * @param {string|number} profesionalId - ID del profesional
 * @param {string} fecha - Fecha en formato 'YYYY-MM-DD'
 * @param {string|number|null} servicioId - ID del servicio (opcional)
 * @param {function} getHeaders - Función que retorna headers de auth
 * @param {boolean} isAdmin - Si es el panel de admin
 * @returns {Promise<Array>} - Lista de horarios disponibles
 */
async function cargarHorariosDisponibles(
    empresaId, 
    profesionalId, 
    fecha, 
    servicioId, 
    getHeaders, 
    isAdmin = false
) {
    if (!profesionalId || !fecha) return [];
    
    try {
        const baseUrl = isAdmin 
            ? `${API_BASE_URL}/empresa/${empresaId}/horarios-disponibles`
            : `${API_BASE_URL}/cliente/empresa/${empresaId}/horarios-disponibles`;
            
        let url = `${baseUrl}?profesional_id=${profesionalId}&fecha=${fecha}`;
        
        if (servicioId) {
            url += `&servicio_id=${servicioId}`;
        }
        
        const response = await fetch(url, { headers: getHeaders() });
        const data = await response.json();
        
        if (response.ok && data.horarios_disponibles) {
            return data.horarios_disponibles;
        }
        
        return [];
    } catch (error) {
        console.error('Error cargando horarios:', error);
        return [];
    }
}

// ==================== EXPORTAR GLOBALMENTE ====================

// Para uso en navegador sin modules
if (typeof window !== 'undefined') {
    window.formatearFechaHora = formatearFechaHora;
    window.formatearFechaCompleta = formatearFechaCompleta;
    window.toggleSidebar = toggleSidebar;
    window.setupMobileMenu = setupMobileMenu;
    window.procesarHorarios = procesarHorarios;
    window.mostrarInfoProfesional = mostrarInfoProfesional;
    window.cargarResumenDisponibilidad = cargarResumenDisponibilidad;
    window.cargarHorariosDisponiblesShared = cargarHorariosDisponibles;
}
