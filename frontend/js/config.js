/* --- CONFIGURACION GLOBAL DE LA API --- */

// URL base del backend Flask
const API_BASE_URL = "http://127.0.0.1:5000";

// rutas base de la API
const API_ROUTES = {
  login: `${API_BASE_URL}/login`,
  registro: `${API_BASE_URL}/registro`,
  turnos: `${API_BASE_URL}/turnos`,
  servicios: `${API_BASE_URL}/servicios`,
  profesionales: `${API_BASE_URL}/profesionales`,
  empresas: `${API_BASE_URL}/empresas`,
  disponibilidades: `${API_BASE_URL}/disponibilidades`,
};

/**
 * funcion para generar los headers de seguridad
 * incluye: Content-Type, x-access-token, id-empresa
 */
window.getAuthHeaders = function () {
  const token = localStorage.getItem("authToken");
  const user = JSON.parse(localStorage.getItem("activeUser") || "{}");
  const empresaId = user.id ? user.id.toString() : "";

  return {
    "Content-Type": "application/json",
    "x-access-token": token || "",
    "id-empresa": empresaId,
  };
};

// helper para obtener el ID de empresa actual
window.getEmpresaId = function () {
  const user = JSON.parse(localStorage.getItem("activeUser") || "{}");
  return user.id || null;
};
