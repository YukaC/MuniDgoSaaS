/*
 * demo/js/mock-api.js — fake backend for the static demo.
 *
 * Load this file BEFORE js/config.js. It replaces window.fetch with an
 * in-browser implementation that answers the Flask API routes using
 * js/seed.json (generated from database/02_SEED_MUNI.sql) plus mutations
 * persisted in localStorage under the "turnos-demo:" prefix.
 *
 * Responses follow backend/api/routes/**: same status codes, same JSON shape,
 * same field names, same auth headers (x-access-token + id-empresa for the
 * admin panel, x-access-token-cliente for the citizen portal).
 *
 * === Covered routes ===
 * POST   /login
 * POST   /cliente/registro
 * POST   /cliente/login
 * GET    /publico/empresas
 * GET    /empresas  ·  GET /empresa/:empresaId
 * GET    /cliente/perfil  ·  PATCH|PUT /cliente/perfil
 * GET    /empresa/:empresaId/turnos
 * POST   /turno
 * PUT    /empresa/:empresaId/turno/:turnoId
 * DELETE /empresa/:empresaId/turno/:turnoId
 * GET    /empresa/:empresaId/horarios-disponibles
 * GET    /empresa/:empresaId/profesionales
 * POST   /profesional
 * PUT    /empresa/:empresaId/profesional/:profesionalId
 * DELETE /empresa/:empresaId/profesional/:profesionalId
 * GET    /empresa/:empresaId/profesional/:profesionalId/disponibilidades
 * GET    /empresa/:empresaId/profesionales/disponibilidades-resumen
 * GET    /empresa/:empresaId/servicios
 * POST   /servicio
 * PUT    /empresa/:empresaId/servicio/:servicioId
 * DELETE /empresa/:empresaId/servicio/:servicioId
 * GET    /empresa/:empresaId/disponibilidades
 * POST   /disponibilidad
 * PUT    /empresa/:empresaId/disponibilidad/:disponibilidadId
 * DELETE /empresa/:empresaId/disponibilidad/:disponibilidadId
 * GET    /empresa/:empresaId/clientes-todos
 * POST   /empresa/:empresaId/cliente
 * PUT    /empresa/:empresaId/cliente/:clienteId
 * DELETE /empresa/:empresaId/cliente/:clienteId
 * GET    /cliente/empresa/:empresaId/profesionales
 * GET    /cliente/empresa/:empresaId/servicios
 * GET    /cliente/empresa/:empresaId/disponibilidades
 * GET    /cliente/empresa/:empresaId/profesional/:profesionalId/disponibilidades
 * GET    /cliente/empresa/:empresaId/profesionales/disponibilidades-resumen
 * GET    /cliente/empresa/:empresaId/horarios-disponibles
 * POST   /cliente/empresa/:empresaId/reservar-turno
 * GET    /cliente/todos-mis-turnos
 * GET    /cliente/empresa/:empresaId/mis-turnos
 * PUT    /cliente/empresa/:empresaId/turno/:turnoId/cancelar
 * PUT    /cliente/empresa/:empresaId/turno/:turnoId/modificar
 *
 * Every other path answers 501 with an explicit message, so a missing route is
 * obvious in the UI instead of looking like an empty database.
 */
(function () {
  "use strict";

  const STORAGE_PREFIX = "turnos-demo:";
  const STATE_KEY = `${STORAGE_PREFIX}state`;
  const SEED_URL = "js/seed.json";

  // Credentials of the demo. The real backend stores pbkdf2 hashes; the demo
  // cannot verify them, so it accepts this documented password instead.
  const DEMO_PASSWORD = "123456";

  const ADMIN_TOKEN_PREFIX = "demo-token:empresa:";
  const CLIENT_TOKEN_PREFIX = "demo-cliente-token:";

  // Same defaults as backend/api/config.py (when no env vars are set).
  const DEFAULT_SERVICE_DURATION = 60;
  const DURATION_SHORT = 30;
  const DURATION_MEDIUM = 45;
  const DURATION_LONG = 60;
  const SLOT_STEP_MINUTES = 10;

  const DAY_NAMES = {
    0: "Domingo",
    1: "Lunes",
    2: "Martes",
    3: "Miércoles",
    4: "Jueves",
    5: "Viernes",
    6: "Sábado",
  };

  const realFetch = window.fetch.bind(window);

  let db = null;
  const ready = loadState();

  // ======================================================= state (localStorage)

  async function loadState() {
    const stored = localStorage.getItem(STATE_KEY);
    if (stored) {
      try {
        db = JSON.parse(stored);
        return;
      } catch (error) {
        console.warn("[mock-api] stored demo state is corrupt, rebuilding from seed", error);
      }
    }

    const response = await realFetch(SEED_URL, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`[mock-api] cannot load ${SEED_URL} (${response.status})`);
    }
    const seed = await response.json();

    db = {
      empresas: seed.empresas,
      profesionales: seed.profesionales,
      servicios: seed.servicios,
      disponibilidades: seed.disponibilidades,
      clientes: seed.clientes.map((cliente) => ({
        ...cliente,
        // The seed JSON has no hashes; every seeded citizen uses the demo password.
        password: DEMO_PASSWORD,
        activo: cliente.activo !== false,
      })),
      turnos: seed.turnos,
    };
    persist();
  }

  function persist() {
    localStorage.setItem(STATE_KEY, JSON.stringify(db));
  }

  /** Restores the initial seed data (used by the README instructions). */
  window.turnosDemoReset = function turnosDemoReset() {
    localStorage.removeItem(STATE_KEY);
    window.location.reload();
  };

  // ============================================================ fetch plumbing

  window.fetch = async function mockFetch(input, init = {}) {
    await ready;

    const url = typeof input === "string" ? input : (input && input.url) || String(input);
    const { path, query } = splitUrl(url);
    const method = (init.method || (input && input.method) || "GET").toUpperCase();
    const headers = normalizeHeaders(init.headers || (input && input.headers));
    const body = parseJsonBody(init.body);

    const route = matchRoute(method, path);
    if (!route) {
      console.warn(`[mock-api] route not covered by the demo: ${method} ${path}`);
      return fail(
        501,
        `La ruta ${method} ${path} no está incluida en la demo (mock). ` +
          "Revisá demo/js/mock-api.js para ver las rutas cubiertas."
      );
    }

    try {
      return await route.handler({ params: route.params, query, headers, body });
    } catch (error) {
      console.error(`[mock-api] ${method} ${path} failed`, error);
      return fail(500, `Error interno de la demo: ${error.message}`);
    }
  };

  function splitUrl(url) {
    const withoutOrigin = String(url).replace(/^[a-z]+:\/\/[^/]+/i, "");
    const [rawPath, rawQuery = ""] = withoutOrigin.split("?");
    return {
      path: rawPath || "/",
      query: new URLSearchParams(rawQuery),
    };
  }

  function normalizeHeaders(rawHeaders) {
    const store = new Map();
    if (!rawHeaders) {
      return { get: (name) => (store.has(name.toLowerCase()) ? store.get(name.toLowerCase()) : null) };
    }
    if (typeof rawHeaders.forEach === "function" && typeof rawHeaders.get === "function") {
      rawHeaders.forEach((value, name) => store.set(String(name).toLowerCase(), String(value)));
    } else {
      for (const name of Object.keys(rawHeaders)) {
        if (rawHeaders[name] !== undefined && rawHeaders[name] !== null) {
          store.set(name.toLowerCase(), String(rawHeaders[name]));
        }
      }
    }
    return { get: (name) => (store.has(name.toLowerCase()) ? store.get(name.toLowerCase()) : null) };
  }

  function parseJsonBody(body) {
    if (body === undefined || body === null || body === "") return null;
    if (typeof body !== "string") return body;
    try {
      return JSON.parse(body);
    } catch (error) {
      return null;
    }
  }

  /** Turns "/empresa/:empresaId/turnos" into a regexp plus its parameter names. */
  function compilePathTemplate(template) {
    const names = [];
    const pattern = template
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:(\w+)/g, (_, name) => {
        names.push(name);
        return "([^/]+)";
      });
    return { pattern: new RegExp(`^${pattern}$`), names };
  }

  function matchRoute(method, path) {
    for (const route of ROUTES) {
      if (route.method !== method) continue;
      const found = route.pattern.exec(path);
      if (!found) continue;
      const params = {};
      route.names.forEach((name, index) => {
        params[name] = decodeURIComponent(found[index + 1]);
      });
      return { handler: route.handler, params };
    }
    return null;
  }

  function ok(payload, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json", ...extraHeaders },
    });
  }

  function fail(status, message) {
    return ok({ message }, status);
  }

  // ================================================================= helpers

  function nextId(rows) {
    return rows.reduce((max, row) => Math.max(max, row.id), 0) + 1;
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function nowSql() {
    return formatSqlDateTime(new Date());
  }

  function formatSqlDateTime(date) {
    return (
      `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
      `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    );
  }

  /** Parses 'YYYY-MM-DD HH:MM:SS' (the only format the API accepts). */
  function parseSqlDateTime(text) {
    const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
      String(text || "").trim()
    );
    if (!match) return null;
    return new Date(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      Number(match[6] || 0)
    );
  }

  function timeToMinutes(text) {
    const [hours, minutes] = String(text).split(":");
    return Number(hours) * 60 + Number(minutes);
  }

  function minutesToHhMm(minutes) {
    return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
  }

  function dateAtMinutes(fecha, minutes) {
    const [year, month, day] = fecha.split("-").map(Number);
    return new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0);
  }

  /** Decodes Basic auth credentials (ASCII only, like the demo usernames). */
  function decodeBase64(value) {
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let binary = "";
    let buffer = 0;
    let bits = 0;
    for (const char of String(value).replace(/[^A-Za-z0-9+/=]/g, "")) {
      if (char === "=") break;
      const index = alphabet.indexOf(char);
      if (index < 0) continue;
      buffer = (buffer << 6) | index;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        binary += String.fromCharCode((buffer >> bits) & 0xff);
      }
    }
    return binary;
  }

  const empresaById = (id) => db.empresas.find((empresa) => empresa.id === Number(id)) || null;
  const profesionalById = (id) =>
    db.profesionales.find((profesional) => profesional.id === Number(id)) || null;
  const servicioById = (id) =>
    db.servicios.find((servicio) => servicio.id === Number(id)) || null;

  // ================================================================ auth

  /** Mirrors backend/api/utils/seguridad.py::requiere_token. */
  function requireAdmin(ctx) {
    const token = ctx.headers.get("x-access-token");
    if (token === null) return fail(401, "No contiene el header x-access-token");
    if (!token) return fail(401, "Contiene el header x-access-token, pero esta vacio");

    let empresaId = ctx.params.empresaId;
    if (empresaId === undefined) {
      const headerEmpresa = ctx.headers.get("id-empresa");
      if (headerEmpresa === null) return fail(401, "No contiene el header id-empresa");
      if (!headerEmpresa) return fail(401, "Contiene el header id-empresa, pero está vacio");
      empresaId = headerEmpresa;
    }

    const match = new RegExp(`^${ADMIN_TOKEN_PREFIX}(\\d+)$`).exec(token);
    if (!match) return fail(401, "Token inválido");
    if (Number(match[1]) !== Number(empresaId)) {
      return fail(401, "No coincide id del token con el del header");
    }
    return null;
  }

  /** Mirrors backend/api/utils/seguridad_clientes.py::requiere_token_cliente. */
  function requireClient(ctx) {
    const token = ctx.headers.get("x-access-token-cliente");
    if (token === null) return { error: fail(401, "No contiene el header x-access-token-cliente") };
    if (!token) return { error: fail(401, "Token de cliente vacío") };

    const match = new RegExp(`^${CLIENT_TOKEN_PREFIX}(\\d+)$`).exec(token);
    if (!match) return { error: fail(401, "Token inválido") };

    const cliente = db.clientes.find((item) => item.id === Number(match[1]));
    if (!cliente) return { error: fail(404, "Cliente no encontrado") };
    if (cliente.activo === false) return { error: fail(403, "Cuenta desactivada") };
    return { cliente };
  }

  function clienteName(cliente) {
    return `${cliente.nombre} ${cliente.apellido}`;
  }

  // ============================================================ serializers

  function clienteJson(cliente) {
    return {
      id: cliente.id,
      dni: cliente.dni,
      nombre: cliente.nombre,
      apellido: cliente.apellido,
      email: cliente.email ?? null,
      telefono: cliente.telefono ?? null,
    };
  }

  function profesionalJson(profesional) {
    return {
      id: profesional.id,
      empresa_id: profesional.empresa_id,
      name: profesional.name,
      surname: profesional.surname,
      email: profesional.email ?? null,
      dni: profesional.dni,
      matricula: profesional.matricula,
      especialidad: profesional.especialidad || "Consulta General",
      created_at: profesional.created_at || nowSql(),
    };
  }

  function servicioJson(servicio) {
    return {
      id: servicio.id,
      empresa_id: servicio.empresa_id,
      name: servicio.name,
      duration_minutes: servicio.duration_minutes,
      price: servicio.price,
      description: servicio.description ?? null,
      created_at: servicio.created_at || nowSql(),
    };
  }

  function disponibilidadJson(disponibilidad) {
    return {
      id: disponibilidad.id,
      profesional_id: disponibilidad.profesional_id,
      empresa_id: disponibilidad.empresa_id,
      day_of_week: disponibilidad.day_of_week,
      start_time: disponibilidad.start_time,
      end_time: disponibilidad.end_time,
      created_at: disponibilidad.created_at || nowSql(),
    };
  }

  /** Same shape as backend/api/utils/formatters.py::format_turno_row. */
  function turnoJson(turno) {
    const profesional = profesionalById(turno.profesional_id);
    const servicio = turno.servicio_id ? servicioById(turno.servicio_id) : null;
    const empresa = empresaById(turno.empresa_id);
    return {
      id: turno.id,
      empresa_id: turno.empresa_id,
      profesional_id: turno.profesional_id,
      servicio_id: turno.servicio_id ?? null,
      cliente_name: turno.cliente_name,
      observaciones: turno.observaciones ?? null,
      start_datetime: turno.start_datetime,
      status: turno.status,
      created_at: turno.created_at,
      profesional_nombre: profesional ? profesional.name : null,
      profesional_apellido: profesional ? profesional.surname : null,
      profesional_especialidad: (profesional && profesional.especialidad) || "Consulta General",
      servicio_nombre:
        (servicio && servicio.name) ||
        (profesional && profesional.especialidad) ||
        "Consulta General",
      precio: (servicio && servicio.price) || 0,
      empresa_nombre: empresa ? empresa.nombre : null,
    };
  }

  /** Base turno row (no joins), as returned by Turno.to_json after a write. */
  function turnoRow(turno) {
    return {
      id: turno.id,
      empresa_id: turno.empresa_id,
      profesional_id: turno.profesional_id,
      servicio_id: turno.servicio_id ?? null,
      cliente_name: turno.cliente_name,
      observaciones: turno.observaciones ?? null,
      start_datetime: turno.start_datetime,
      status: turno.status,
      created_at: turno.created_at,
    };
  }

  // ========================================================= availability

  function duracionPorEspecialidad(especialidad) {
    if (!especialidad) return DURATION_SHORT;
    if (especialidad.includes("Cardiología") || especialidad.includes("Psiquiatría")) {
      return DURATION_MEDIUM;
    }
    if (especialidad.includes("Cirugía")) return DURATION_LONG;
    return DURATION_SHORT;
  }

  /** Mirrors the private _get_duracion_servicio helpers in the Flask routes. */
  function duracionServicio(servicioId, empresaId, especialidad, fallback) {
    if (servicioId) {
      const servicio = servicioById(servicioId);
      if (servicio && Number(servicio.empresa_id) === Number(empresaId)) {
        return servicio.duration_minutes;
      }
    }
    if (fallback !== undefined) return fallback;
    return duracionPorEspecialidad(especialidad);
  }

  function turnosOcupados(profesionalId, fecha) {
    return db.turnos
      .filter(
        (turno) =>
          Number(turno.profesional_id) === Number(profesionalId) &&
          String(turno.start_datetime).slice(0, 10) === fecha &&
          turno.status !== "Cancelado"
      )
      .map((turno) => {
        const start = parseSqlDateTime(turno.start_datetime);
        const servicio = turno.servicio_id ? servicioById(turno.servicio_id) : null;
        const duration = (servicio && servicio.duration_minutes) || DURATION_SHORT;
        return [start, new Date(start.getTime() + duration * 60000)];
      });
  }

  /**
   * Replicates _calcular_horarios_disponibles: walk every availability block of
   * the professional for that weekday, step 10 minutes, skip taken slots.
   */
  function calcularHorarios(profesionalId, fecha, duracion, { onlyFuture }) {
    const fechaDate = parseSqlDateTime(`${fecha} 00:00:00`);
    if (!fechaDate) throw new Error("Formato de fecha inválido");

    const dayOfWeek = fechaDate.getDay(); // 0 = Sunday, same as day_of_week
    const bloques = db.disponibilidades.filter(
      (disponibilidad) =>
        Number(disponibilidad.profesional_id) === Number(profesionalId) &&
        Number(disponibilidad.day_of_week) === dayOfWeek
    );
    if (bloques.length === 0) return [];

    const ocupados = turnosOcupados(profesionalId, fecha);
    const ahora = new Date();
    const horarios = [];

    for (const bloque of bloques) {
      const inicio = timeToMinutes(bloque.start_time);
      const fin = timeToMinutes(bloque.end_time);

      for (let minuto = inicio; minuto + duracion <= fin; minuto += SLOT_STEP_MINUTES) {
        const slotStart = dateAtMinutes(fecha, minuto);
        const slotEnd = new Date(slotStart.getTime() + duracion * 60000);
        const ocupado = ocupados.some(([start, end]) => slotStart < end && slotEnd > start);
        if (!ocupado && (!onlyFuture || slotStart > ahora)) {
          horarios.push({ hora: minutesToHhMm(minuto), datetime: formatSqlDateTime(slotStart) });
        }
      }
    }
    return horarios;
  }

  function resumenDisponibilidades(empresaId) {
    const resumen = {};
    const filas = db.disponibilidades
      .filter((disponibilidad) => Number(disponibilidad.empresa_id) === Number(empresaId))
      .sort(
        (a, b) =>
          Number(a.profesional_id) - Number(b.profesional_id) ||
          Number(a.day_of_week) - Number(b.day_of_week)
      );

    for (const fila of filas) {
      const key = String(fila.profesional_id);
      if (!resumen[key]) resumen[key] = [];
      const nombre = DAY_NAMES[fila.day_of_week];
      if (nombre && !resumen[key].includes(nombre)) resumen[key].push(nombre);
    }
    return resumen;
  }

  /** Mirrors backend/api/utils/db_helpers.py::check_turno_overlap. */
  function haySuperposicion(profesionalId, startDatetime, duracion, excludeTurnoId = null) {
    const nuevoInicio = parseSqlDateTime(startDatetime);
    const nuevoFin = new Date(nuevoInicio.getTime() + duracion * 60000);
    return db.turnos.some((turno) => {
      if (turno.status === "Cancelado") return false;
      if (excludeTurnoId !== null && Number(turno.id) === Number(excludeTurnoId)) return false;
      if (Number(turno.profesional_id) !== Number(profesionalId)) return false;
      const start = parseSqlDateTime(turno.start_datetime);
      const servicio = turno.servicio_id ? servicioById(turno.servicio_id) : null;
      const end = new Date(
        start.getTime() + ((servicio && servicio.duration_minutes) || DURATION_SHORT) * 60000
      );
      return nuevoInicio < end && nuevoFin > start;
    });
  }

  // ========================================================== route handlers

  function adminLogin(ctx) {
    const authorization = ctx.headers.get("authorization") || "";
    const encoded = authorization.replace(/^Basic\s+/i, "").trim();
    if (!encoded) return fail(401, "No se recibieron las credenciales");

    const decoded = decodeBase64(encoded);
    const separator = decoded.indexOf(":");
    if (separator < 0) return fail(401, "No se recibieron las credenciales");

    const username = decoded.slice(0, separator);
    const password = decoded.slice(separator + 1);

    const empresa = db.empresas.find((item) => item.username === username);
    if (!empresa) return fail(401, "No existe el usuario");
    if (password !== DEMO_PASSWORD) return fail(401, "No coincide la contraseña");

    return ok({
      token: `${ADMIN_TOKEN_PREFIX}${empresa.id}`,
      nombre: empresa.nombre,
      id: empresa.id,
    });
  }

  function listarEmpresas() {
    const empresas = db.empresas
      .map((empresa) => ({ id: empresa.id, nombre: empresa.nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    return ok(empresas);
  }

  function listarEmpresasCompletas() {
    return ok(
      db.empresas.map((empresa) => ({
        id: empresa.id,
        nombre: empresa.nombre,
        username: empresa.username,
        email: empresa.email ?? null,
        created_at: empresa.created_at ?? null,
      }))
    );
  }

  function obtenerEmpresa(ctx) {
    const empresa = empresaById(ctx.params.empresaId);
    if (!empresa) return fail(404, "Empresa no encontrada");
    return ok({
      id: empresa.id,
      nombre: empresa.nombre,
      username: empresa.username,
      email: empresa.email ?? null,
      created_at: empresa.created_at ?? null,
    });
  }

  // ------------------------------------------------------------- citizen auth

  function clienteRegistro(ctx) {
    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");

    const dni = String(body.dni ?? "").trim();
    const nombre = String(body.nombre ?? "").trim();
    const apellido = String(body.apellido ?? "").trim();
    const password = String(body.password ?? "");
    const email = body.email ? String(body.email).trim() : null;
    const telefono = body.telefono ? String(body.telefono).trim() : null;

    if (!dni || !nombre || !apellido || !password) {
      return fail(400, "DNI, nombre, apellido y contraseña son requeridos");
    }
    if (!/^\d{7,8}$/.test(dni)) {
      return fail(400, "DNI inválido. Debe contener entre 7 y 8 dígitos numéricos");
    }
    if (password.length < 6) {
      return fail(400, "La contraseña debe tener al menos 6 caracteres");
    }
    if (db.clientes.some((cliente) => cliente.dni === dni)) {
      return fail(400, "No se pudo completar el registro. Verifique los datos ingresados.");
    }
    if (email && db.clientes.some((cliente) => cliente.email === email)) {
      return fail(400, "No se pudo completar el registro. Verifique los datos ingresados.");
    }

    const cliente = {
      id: nextId(db.clientes),
      dni,
      nombre,
      apellido,
      email,
      telefono,
      password,
      activo: true,
      created_at: nowSql(),
      updated_at: nowSql(),
    };
    db.clientes.push(cliente);
    persist();

    return ok({ message: "Cliente registrado exitosamente", cliente: clienteJson(cliente) }, 201);
  }

  function clienteLogin(ctx) {
    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");

    const dni = String(body.dni ?? "").trim();
    const password = String(body.password ?? "");
    if (!dni || !password) return fail(400, "DNI y contraseña son requeridos");

    const cliente = db.clientes.find((item) => item.dni === dni);
    if (!cliente) return fail(401, "DNI o contraseña incorrectos");
    if (cliente.activo === false) {
      return fail(401, "Cuenta desactivada. Contacte al administrador");
    }
    if (cliente.password !== password) return fail(401, "DNI o contraseña incorrectos");

    return ok({
      token: `${CLIENT_TOKEN_PREFIX}${cliente.id}`,
      cliente: clienteJson(cliente),
    });
  }

  function obtenerPerfil(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;
    return ok(clienteJson(session.cliente));
  }

  function actualizarPerfil(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;

    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");

    const cliente = session.cliente;
    if ("email" in body && body.email && db.clientes.some((item) => item.email === body.email && item.id !== cliente.id)) {
      return fail(400, "No se pudo actualizar. Verifique los datos ingresados.");
    }

    for (const field of ["nombre", "apellido", "email", "telefono"]) {
      if (field in body) cliente[field] = body[field] === null ? null : String(body[field]);
    }
    if (body.password) cliente.password = String(body.password);
    cliente.updated_at = nowSql();
    persist();

    return ok({ message: "Perfil actualizado correctamente" });
  }

  // ------------------------------------------------------------------ turnos

  function ordenarTurnosAdmin(turnos) {
    const statusOrder = { "Pendiente de Confirmación": 0, Reservado: 1 };
    return turnos.slice().sort((a, b) => {
      const orderA = statusOrder[a.status] ?? 2;
      const orderB = statusOrder[b.status] ?? 2;
      if (orderA !== orderB) return orderA - orderB;
      return a.start_datetime.localeCompare(b.start_datetime);
    });
  }

  function listarTurnosEmpresa(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const turnos = ordenarTurnosAdmin(
      db.turnos.filter((turno) => Number(turno.empresa_id) === Number(ctx.params.empresaId))
    ).map(turnoJson);

    return ok(turnos, 200, {
      "X-Total-Count": String(turnos.length),
      "X-Truncated": "false",
    });
  }

  function listarTurnosTodos(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    const turnos = ordenarTurnosAdmin(db.turnos).map(turnoJson);
    return ok(turnos, 200, { "X-Total-Count": String(turnos.length), "X-Truncated": "false" });
  }

  function crearTurno(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");

    const empresaId = Number(ctx.headers.get("id-empresa"));
    const profesionalId = Number(body.profesional_id);
    const servicioId = body.servicio_id ? Number(body.servicio_id) : null;
    const clienteName = String(body.cliente_name ?? "").trim();
    const startDatetime = String(body.start_datetime ?? "").trim();
    const status = String(body.status ?? "Reservado");

    if (!profesionalId || !clienteName || !parseSqlDateTime(startDatetime)) {
      return fail(400, "Datos inválidos");
    }

    const profesional = profesionalById(profesionalId);
    if (!profesional || Number(profesional.empresa_id) !== empresaId) {
      return fail(400, "Profesional no encontrado o no pertenece a la empresa");
    }
    if (servicioId) {
      const servicio = servicioById(servicioId);
      if (!servicio || Number(servicio.empresa_id) !== empresaId) {
        return fail(400, "Servicio no encontrado o no pertenece a la empresa");
      }
    }

    const duracion = duracionServicio(servicioId, empresaId, profesional.especialidad);
    if (haySuperposicion(profesionalId, startDatetime, duracion)) {
      return fail(400, "El profesional ya tiene un turno asignado en ese horario");
    }

    const turno = {
      id: nextId(db.turnos),
      empresa_id: empresaId,
      profesional_id: profesionalId,
      servicio_id: servicioId,
      cliente_name: clienteName,
      observaciones: body.observaciones ? String(body.observaciones) : null,
      start_datetime: startDatetime,
      status,
      created_at: nowSql(),
    };
    db.turnos.push(turno);
    persist();
    return ok(turnoRow(turno), 201);
  }

  function actualizarTurno(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const turno = db.turnos.find((item) => Number(item.id) === Number(ctx.params.turnoId));
    if (!turno) return fail(404, "No existe el turno");

    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");

    const empresaId = Number(ctx.params.empresaId);
    const profesionalId = body.profesional_id ? Number(body.profesional_id) : turno.profesional_id;
    const servicioId =
      body.servicio_id === undefined || body.servicio_id === null
        ? turno.servicio_id
        : Number(body.servicio_id);
    const startDatetime = body.start_datetime
      ? String(body.start_datetime).trim()
      : turno.start_datetime;

    if (!parseSqlDateTime(startDatetime)) return fail(400, "Formato de fecha/hora inválido");

    const profesional = profesionalById(profesionalId);
    if (!profesional || Number(profesional.empresa_id) !== empresaId) {
      return fail(400, "Profesional no encontrado o no pertenece a la empresa");
    }
    if (servicioId) {
      const servicio = servicioById(servicioId);
      if (!servicio || Number(servicio.empresa_id) !== empresaId) {
        return fail(400, "Servicio no encontrado o no pertenece a la empresa");
      }
    }

    const duracion = duracionServicio(servicioId, empresaId, profesional.especialidad);
    if (haySuperposicion(profesionalId, startDatetime, duracion, turno.id)) {
      return fail(400, "El profesional ya tiene un turno asignado en ese horario");
    }

    turno.empresa_id = empresaId;
    turno.profesional_id = profesionalId;
    turno.servicio_id = servicioId;
    turno.cliente_name = body.cliente_name ? String(body.cliente_name) : turno.cliente_name;
    turno.observaciones = body.observaciones ? String(body.observaciones) : null;
    turno.start_datetime = startDatetime;
    turno.status = body.status ? String(body.status) : turno.status;
    persist();

    return ok(turnoRow(turno));
  }

  function eliminarTurno(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const index = db.turnos.findIndex((item) => Number(item.id) === Number(ctx.params.turnoId));
    if (index < 0) return fail(404, "No existe el turno");

    const [turno] = db.turnos.splice(index, 1);
    persist();
    return ok(turnoRow(turno));
  }

  // ------------------------------------------------------------- profesionales

  function listarProfesionales(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    return ok(
      db.profesionales
        .filter((profesional) => Number(profesional.empresa_id) === Number(ctx.params.empresaId))
        .map(profesionalJson)
    );
  }

  function listarProfesionalesPublico(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;
    return ok(
      db.profesionales
        .filter((profesional) => Number(profesional.empresa_id) === Number(ctx.params.empresaId))
        .map(profesionalJson)
    );
  }

  function crearProfesional(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");

    const empresaId = Number(ctx.headers.get("id-empresa"));
    const dni = String(body.dni ?? "").trim();
    const matricula = String(body.matricula ?? "").trim();
    if (!body.name || !body.surname || !dni || !matricula) return fail(400, "Datos inválidos");
    if (db.profesionales.some((item) => item.dni === dni || item.matricula === matricula)) {
      return fail(400, "Ya existe un profesional con ese DNI o matrícula");
    }

    const profesional = {
      id: nextId(db.profesionales),
      empresa_id: empresaId,
      name: String(body.name),
      surname: String(body.surname),
      email: body.email ? String(body.email) : null,
      dni,
      matricula,
      especialidad: body.especialidad ? String(body.especialidad) : "Consulta General",
      created_at: nowSql(),
    };
    db.profesionales.push(profesional);
    persist();
    return ok(profesionalJson(profesional), 201);
  }

  function actualizarProfesional(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const profesional = db.profesionales.find(
      (item) => Number(item.id) === Number(ctx.params.profesionalId)
    );
    if (!profesional) return fail(404, "Profesional no encontrado");

    const body = ctx.body || {};
    for (const field of ["name", "surname", "email", "dni", "matricula", "especialidad"]) {
      if (field in body) {
        profesional[field] = body[field] === null ? null : String(body[field]);
      }
    }
    profesional.empresa_id = Number(ctx.params.empresaId);
    persist();
    return ok(profesionalJson(profesional));
  }

  function eliminarProfesional(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const index = db.profesionales.findIndex(
      (item) => Number(item.id) === Number(ctx.params.profesionalId)
    );
    if (index < 0) return fail(404, "Profesional no encontrado");

    const [profesional] = db.profesionales.splice(index, 1);
    db.disponibilidades = db.disponibilidades.filter(
      (item) => Number(item.profesional_id) !== Number(profesional.id)
    );
    persist();
    return ok(profesionalJson(profesional));
  }

  function listarDisponibilidadesProfesional(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    return ok(
      db.disponibilidades
        .filter(
          (item) => Number(item.profesional_id) === Number(ctx.params.profesionalId)
        )
        .map(disponibilidadJson)
    );
  }

  function listarDisponibilidadesProfesionalPublico(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;

    const profesional = profesionalById(ctx.params.profesionalId);
    if (!profesional || Number(profesional.empresa_id) !== Number(ctx.params.empresaId)) {
      return fail(404, "Profesional no encontrado");
    }
    return ok(
      db.disponibilidades
        .filter((item) => Number(item.profesional_id) === Number(profesional.id))
        .map(disponibilidadJson)
    );
  }

  // ---------------------------------------------------------------- servicios

  function listarServicios(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    return ok(
      db.servicios
        .filter((servicio) => Number(servicio.empresa_id) === Number(ctx.params.empresaId))
        .map(servicioJson)
    );
  }

  function listarServiciosPublico(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;
    return ok(
      db.servicios
        .filter((servicio) => Number(servicio.empresa_id) === Number(ctx.params.empresaId))
        .map(servicioJson)
    );
  }

  function crearServicio(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const body = ctx.body;
    if (!body || !body.name) return fail(400, "Datos inválidos");

    const servicio = {
      id: nextId(db.servicios),
      empresa_id: Number(ctx.headers.get("id-empresa")),
      name: String(body.name),
      duration_minutes: Number(body.duration_minutes) || DURATION_SHORT,
      price: Number(body.price) || 0,
      description: body.description ? String(body.description) : null,
      created_at: nowSql(),
    };
    db.servicios.push(servicio);
    persist();
    return ok(servicioJson(servicio), 201);
  }

  function actualizarServicio(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const servicio = db.servicios.find((item) => Number(item.id) === Number(ctx.params.servicioId));
    if (!servicio) return fail(404, "Servicio no encontrado");

    const body = ctx.body || {};
    if ("name" in body) servicio.name = String(body.name);
    if ("duration_minutes" in body) servicio.duration_minutes = Number(body.duration_minutes);
    if ("price" in body) servicio.price = Number(body.price);
    if ("description" in body) servicio.description = body.description ? String(body.description) : null;
    servicio.empresa_id = Number(ctx.params.empresaId);
    persist();
    return ok(servicioJson(servicio));
  }

  function eliminarServicio(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const index = db.servicios.findIndex(
      (item) => Number(item.id) === Number(ctx.params.servicioId)
    );
    if (index < 0) return fail(404, "Servicio no encontrado");

    const [servicio] = db.servicios.splice(index, 1);
    for (const turno of db.turnos) {
      if (Number(turno.servicio_id) === Number(servicio.id)) turno.servicio_id = null;
    }
    persist();
    return ok(servicioJson(servicio));
  }

  // ---------------------------------------------------------- disponibilidades

  function listarDisponibilidades(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const disponibilidades = db.disponibilidades
      .filter((item) => Number(item.empresa_id) === Number(ctx.params.empresaId))
      .sort(
        (a, b) =>
          Number(a.day_of_week) - Number(b.day_of_week) ||
          String(a.start_time).localeCompare(String(b.start_time))
      )
      .map((item) => {
        const profesional = profesionalById(item.profesional_id);
        return {
          ...disponibilidadJson(item),
          profesional_nombre: profesional ? profesional.name : null,
          profesional_apellido: profesional ? profesional.surname : null,
        };
      });
    return ok(disponibilidades);
  }

  function listarDisponibilidadesPublico(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;
    return ok(
      db.disponibilidades
        .filter((item) => Number(item.empresa_id) === Number(ctx.params.empresaId))
        .map(disponibilidadJson)
    );
  }

  function resumenDisponibilidadesAdmin(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    return ok(resumenDisponibilidades(ctx.params.empresaId));
  }

  function resumenDisponibilidadesPublico(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;
    return ok(resumenDisponibilidades(ctx.params.empresaId));
  }

  function crearDisponibilidad(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const body = ctx.body;
    if (!body || !body.profesional_id || body.day_of_week === undefined || !body.start_time || !body.end_time) {
      return fail(400, "Datos inválidos");
    }

    const empresaId = Number(ctx.headers.get("id-empresa"));
    const profesionalId = Number(body.profesional_id);
    const dayOfWeek = Number(body.day_of_week);
    const startTime = String(body.start_time);
    const endTime = String(body.end_time);

    if (haySuperposicionDisponibilidad(profesionalId, dayOfWeek, startTime, endTime)) {
      return fail(400, "El profesional ya tiene disponibilidad asignada en ese horario");
    }

    const disponibilidad = {
      id: nextId(db.disponibilidades),
      profesional_id: profesionalId,
      empresa_id: empresaId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      created_at: nowSql(),
    };
    db.disponibilidades.push(disponibilidad);
    persist();
    return ok(disponibilidadJson(disponibilidad), 201);
  }

  function actualizarDisponibilidad(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const disponibilidad = db.disponibilidades.find(
      (item) => Number(item.id) === Number(ctx.params.disponibilidadId)
    );
    if (!disponibilidad) return fail(404, "No existe la disponibilidad");

    const body = ctx.body || {};
    const profesionalId = Number(body.profesional_id ?? disponibilidad.profesional_id);
    const dayOfWeek = Number(body.day_of_week ?? disponibilidad.day_of_week);
    const startTime = String(body.start_time ?? disponibilidad.start_time);
    const endTime = String(body.end_time ?? disponibilidad.end_time);

    if (
      haySuperposicionDisponibilidad(profesionalId, dayOfWeek, startTime, endTime, disponibilidad.id)
    ) {
      return fail(400, "El profesional ya tiene disponibilidad asignada en ese horario");
    }

    disponibilidad.profesional_id = profesionalId;
    disponibilidad.empresa_id = Number(ctx.params.empresaId);
    disponibilidad.day_of_week = dayOfWeek;
    disponibilidad.start_time = startTime;
    disponibilidad.end_time = endTime;
    persist();
    return ok(disponibilidadJson(disponibilidad));
  }

  function eliminarDisponibilidad(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const index = db.disponibilidades.findIndex(
      (item) => Number(item.id) === Number(ctx.params.disponibilidadId)
    );
    if (index < 0) return fail(404, "No existe la disponibilidad");

    const [disponibilidad] = db.disponibilidades.splice(index, 1);
    persist();
    return ok(disponibilidadJson(disponibilidad));
  }

  function haySuperposicionDisponibilidad(profesionalId, dayOfWeek, startTime, endTime, excludeId) {
    return db.disponibilidades.some((item) => {
      if (Number(item.profesional_id) !== Number(profesionalId)) return false;
      if (Number(item.day_of_week) !== Number(dayOfWeek)) return false;
      if (excludeId !== undefined && Number(item.id) === Number(excludeId)) return false;
      return item.start_time < endTime && item.end_time > startTime;
    });
  }

  // -------------------------------------------------------------- horarios

  function horariosAdmin(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;
    return horariosResponse(ctx, { onlyFuture: false, defaultDuration: undefined });
  }

  function horariosPublico(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;
    return horariosResponse(ctx, {
      onlyFuture: true,
      defaultDuration: DEFAULT_SERVICE_DURATION,
    });
  }

  function horariosResponse(ctx, { onlyFuture, defaultDuration }) {
    const empresaId = Number(ctx.params.empresaId);
    const profesionalId = Number(ctx.query.get("profesional_id"));
    const fecha = ctx.query.get("fecha");
    const servicioId = ctx.query.get("servicio_id");

    if (!profesionalId || !fecha) return fail(400, "Se requiere profesional_id y fecha");

    const profesional = profesionalById(profesionalId);
    if (!profesional || Number(profesional.empresa_id) !== empresaId) {
      return fail(404, "Profesional no encontrado");
    }

    const duracion = servicioId
      ? duracionServicio(Number(servicioId), empresaId, profesional.especialidad)
      : defaultDuration !== undefined
        ? defaultDuration
        : duracionPorEspecialidad(profesional.especialidad);

    const horarios_disponibles = calcularHorarios(profesionalId, fecha, duracion, { onlyFuture });
    return ok({ horarios_disponibles });
  }

  // ------------------------------------------------------- clientes del panel

  function listarClientesAdmin(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const clientes = db.clientes
      .slice()
      .sort(
        (a, b) =>
          String(a.apellido).localeCompare(String(b.apellido), "es") ||
          String(a.nombre).localeCompare(String(b.nombre), "es")
      )
      .map(clienteJson);
    return ok(clientes);
  }

  function crearClienteAdmin(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const body = ctx.body || {};
    const dni = String(body.dni ?? "").trim();
    const nombre = String(body.nombre ?? "").trim();
    const apellido = String(body.apellido ?? "").trim();
    if (!dni || !nombre || !apellido) {
      return fail(400, "Faltan datos obligatorios (DNI, Nombre, Apellido)");
    }

    const email = body.email ? String(body.email).trim() : null;
    if (db.clientes.some((cliente) => cliente.dni === dni || (email && cliente.email === email))) {
      return fail(400, "No se pudo completar el registro. Verifique los datos ingresados.");
    }

    const cliente = {
      id: nextId(db.clientes),
      dni,
      nombre,
      apellido,
      email,
      telefono: body.telefono ? String(body.telefono).trim() : null,
      password: body.password ? String(body.password) : dni,
      activo: true,
      created_at: nowSql(),
      updated_at: nowSql(),
    };
    db.clientes.push(cliente);
    persist();
    return ok(
      {
        message: "Cliente registrado exitosamente",
        id: cliente.id,
        nombre: `${cliente.nombre} ${cliente.apellido}`,
      },
      201
    );
  }

  function actualizarClienteAdmin(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const cliente = db.clientes.find(
      (item) => Number(item.id) === Number(ctx.params.clienteId)
    );
    if (!cliente) return fail(404, "Cliente no encontrado");

    const body = ctx.body || {};
    const dni = body.dni ? String(body.dni).trim() : cliente.dni;
    const email = body.email ? String(body.email).trim() : null;
    const duplicated = db.clientes.some(
      (item) =>
        item.id !== cliente.id &&
        (item.dni === dni || (email && item.email === email))
    );
    if (duplicated) {
      return fail(400, "No se pudo actualizar. Verifique los datos ingresados.");
    }

    cliente.dni = dni;
    if ("nombre" in body) cliente.nombre = String(body.nombre);
    if ("apellido" in body) cliente.apellido = String(body.apellido);
    if ("email" in body) cliente.email = email;
    if ("telefono" in body) cliente.telefono = body.telefono ? String(body.telefono) : null;
    if (body.password) cliente.password = String(body.password);
    cliente.updated_at = nowSql();
    persist();
    return ok({ message: "Cliente actualizado correctamente" });
  }

  function eliminarClienteAdmin(ctx) {
    const denied = requireAdmin(ctx);
    if (denied) return denied;

    const index = db.clientes.findIndex(
      (item) => Number(item.id) === Number(ctx.params.clienteId)
    );
    if (index < 0) return fail(404, "Cliente no encontrado");

    db.clientes.splice(index, 1);
    persist();
    return ok({ message: "Cliente eliminado exitosamente" });
  }

  // ---------------------------------------------------------- citizen bookings

  function misTurnosEmpresa(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;

    const name = clienteName(session.cliente);
    const turnos = db.turnos
      .filter(
        (turno) =>
          Number(turno.empresa_id) === Number(ctx.params.empresaId) &&
          turno.cliente_name === name &&
          ["Reservado", "Completado"].includes(turno.status)
      )
      .sort((a, b) => b.start_datetime.localeCompare(a.start_datetime))
      .map(turnoJson);
    return ok(turnos);
  }

  function todosMisTurnos(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;

    const name = clienteName(session.cliente);
    const turnos = db.turnos
      .filter(
        (turno) =>
          turno.cliente_name === name && ["Reservado", "Completado"].includes(turno.status)
      )
      .sort((a, b) => b.start_datetime.localeCompare(a.start_datetime))
      .map(turnoJson);
    return ok(turnos);
  }

  function reservarTurno(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;

    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");
    if (!body.profesional_id || !body.start_datetime) {
      return fail(400, "Se requiere profesional_id y start_datetime");
    }

    const empresaId = Number(ctx.params.empresaId);
    const profesionalId = Number(body.profesional_id);
    const startDatetime = String(body.start_datetime).trim();

    const start = parseSqlDateTime(startDatetime);
    if (!start) return fail(400, "Formato de fecha/hora inválido");
    if (start <= new Date()) return fail(400, "No se pueden agendar turnos en el pasado");

    const profesional = profesionalById(profesionalId);
    if (!profesional || Number(profesional.empresa_id) !== empresaId) {
      return fail(404, "Profesional no encontrado");
    }

    const servicioId = body.servicio_id ? Number(body.servicio_id) : null;
    if (servicioId) {
      const servicio = servicioById(servicioId);
      if (!servicio || Number(servicio.empresa_id) !== empresaId) {
        return fail(404, "Servicio no encontrado");
      }
    }

    const duracion = duracionServicio(servicioId, empresaId, profesional.especialidad);
    if (haySuperposicion(profesionalId, startDatetime, duracion)) {
      return fail(400, "El profesional ya tiene un turno asignado en ese horario");
    }

    const turno = {
      id: nextId(db.turnos),
      empresa_id: empresaId,
      profesional_id: profesionalId,
      servicio_id: servicioId,
      cliente_name: clienteName(session.cliente),
      observaciones: body.observaciones ? String(body.observaciones) : null,
      start_datetime: startDatetime,
      status: "Reservado",
      created_at: nowSql(),
    };
    db.turnos.push(turno);
    persist();
    return ok(turnoRow(turno), 201);
  }

  function cancelarTurnoCliente(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;

    const name = clienteName(session.cliente);
    const turno = db.turnos.find(
      (item) =>
        Number(item.id) === Number(ctx.params.turnoId) &&
        Number(item.empresa_id) === Number(ctx.params.empresaId) &&
        item.cliente_name === name
    );
    if (!turno) return fail(404, "Turno no encontrado o no tienes permiso");
    if (turno.status === "Cancelado") return fail(400, "El turno ya está cancelado");
    if (turno.status === "Completado") {
      return fail(400, "No se pueden cancelar turnos completados");
    }

    turno.status = "Cancelado";
    persist();
    return ok(turnoRow(turno));
  }

  function modificarTurnoCliente(ctx) {
    const session = requireClient(ctx);
    if (session.error) return session.error;

    const body = ctx.body;
    if (!body) return fail(400, "Se requiere un cuerpo JSON");

    const name = clienteName(session.cliente);
    const turno = db.turnos.find(
      (item) =>
        Number(item.id) === Number(ctx.params.turnoId) &&
        Number(item.empresa_id) === Number(ctx.params.empresaId) &&
        item.cliente_name === name
    );
    if (!turno) return fail(404, "Turno no encontrado o no tienes permiso");
    if (["Cancelado", "Completado"].includes(turno.status)) {
      return fail(400, `No se pueden modificar turnos ${turno.status.toLowerCase()}s`);
    }

    let startDatetime = turno.start_datetime;
    if ("start_datetime" in body) {
      startDatetime = String(body.start_datetime).trim();
      const start = parseSqlDateTime(startDatetime);
      if (!start) return fail(400, "Formato de fecha/hora inválido");
      if (start <= new Date()) return fail(400, "No se pueden agendar turnos en el pasado");
    }

    const profesionalId = body.profesional_id
      ? Number(body.profesional_id)
      : turno.profesional_id;
    const profesional = profesionalById(profesionalId);
    if (!profesional || Number(profesional.empresa_id) !== Number(ctx.params.empresaId)) {
      return fail(404, "Profesional no encontrado");
    }

    const duracion = duracionServicio(
      turno.servicio_id,
      ctx.params.empresaId,
      profesional.especialidad
    );
    if (haySuperposicion(profesionalId, startDatetime, duracion, turno.id)) {
      return fail(400, "El profesional ya tiene un turno asignado en ese horario");
    }

    turno.profesional_id = profesionalId;
    turno.start_datetime = startDatetime;
    if ("observaciones" in body) {
      turno.observaciones = body.observaciones ? String(body.observaciones) : null;
    }
    persist();
    return ok(turnoRow(turno));
  }

  // ================================================================= routes

  const ROUTES = [
    { method: "POST", path: "/login", handler: adminLogin },
    { method: "POST", path: "/cliente/registro", handler: clienteRegistro },
    { method: "POST", path: "/cliente/login", handler: clienteLogin },
    { method: "GET", path: "/publico/empresas", handler: listarEmpresas },
    { method: "GET", path: "/empresas", handler: listarEmpresasCompletas },
    { method: "GET", path: "/empresa/:empresaId", handler: obtenerEmpresa },
    { method: "GET", path: "/cliente/perfil", handler: obtenerPerfil },
    { method: "PATCH", path: "/cliente/perfil", handler: actualizarPerfil },
    // The original portal sends PUT here while the Flask route only defines
    // PATCH; the demo accepts both so "Mi Perfil" works.
    { method: "PUT", path: "/cliente/perfil", handler: actualizarPerfil },

    { method: "GET", path: "/turnos", handler: listarTurnosTodos },
    { method: "GET", path: "/empresa/:empresaId/turnos", handler: listarTurnosEmpresa },
    { method: "POST", path: "/turno", handler: crearTurno },
    { method: "PUT", path: "/empresa/:empresaId/turno/:turnoId", handler: actualizarTurno },
    { method: "DELETE", path: "/empresa/:empresaId/turno/:turnoId", handler: eliminarTurno },

    { method: "GET", path: "/empresa/:empresaId/profesionales", handler: listarProfesionales },
    { method: "POST", path: "/profesional", handler: crearProfesional },
    {
      method: "PUT",
      path: "/empresa/:empresaId/profesional/:profesionalId",
      handler: actualizarProfesional,
    },
    {
      method: "DELETE",
      path: "/empresa/:empresaId/profesional/:profesionalId",
      handler: eliminarProfesional,
    },
    {
      method: "GET",
      path: "/empresa/:empresaId/profesional/:profesionalId/disponibilidades",
      handler: listarDisponibilidadesProfesional,
    },
    {
      method: "GET",
      path: "/empresa/:empresaId/profesionales/disponibilidades-resumen",
      handler: resumenDisponibilidadesAdmin,
    },
    { method: "GET", path: "/empresa/:empresaId/servicios", handler: listarServicios },
    { method: "POST", path: "/servicio", handler: crearServicio },
    { method: "PUT", path: "/empresa/:empresaId/servicio/:servicioId", handler: actualizarServicio },
    { method: "DELETE", path: "/empresa/:empresaId/servicio/:servicioId", handler: eliminarServicio },

    {
      method: "GET",
      path: "/empresa/:empresaId/disponibilidades",
      handler: listarDisponibilidades,
    },
    { method: "POST", path: "/disponibilidad", handler: crearDisponibilidad },
    {
      method: "PUT",
      path: "/empresa/:empresaId/disponibilidad/:disponibilidadId",
      handler: actualizarDisponibilidad,
    },
    {
      method: "DELETE",
      path: "/empresa/:empresaId/disponibilidad/:disponibilidadId",
      handler: eliminarDisponibilidad,
    },

    { method: "GET", path: "/empresa/:empresaId/clientes-todos", handler: listarClientesAdmin },
    { method: "POST", path: "/empresa/:empresaId/cliente", handler: crearClienteAdmin },
    {
      method: "PUT",
      path: "/empresa/:empresaId/cliente/:clienteId",
      handler: actualizarClienteAdmin,
    },
    {
      method: "DELETE",
      path: "/empresa/:empresaId/cliente/:clienteId",
      handler: eliminarClienteAdmin,
    },

    { method: "GET", path: "/empresa/:empresaId/horarios-disponibles", handler: horariosAdmin },

    {
      method: "GET",
      path: "/cliente/empresa/:empresaId/profesionales",
      handler: listarProfesionalesPublico,
    },
    { method: "GET", path: "/cliente/empresa/:empresaId/servicios", handler: listarServiciosPublico },
    {
      method: "GET",
      path: "/cliente/empresa/:empresaId/disponibilidades",
      handler: listarDisponibilidadesPublico,
    },
    {
      method: "GET",
      path: "/cliente/empresa/:empresaId/profesional/:profesionalId/disponibilidades",
      handler: listarDisponibilidadesProfesionalPublico,
    },
    {
      method: "GET",
      path: "/cliente/empresa/:empresaId/profesionales/disponibilidades-resumen",
      handler: resumenDisponibilidadesPublico,
    },
    {
      method: "GET",
      path: "/cliente/empresa/:empresaId/horarios-disponibles",
      handler: horariosPublico,
    },
    {
      method: "POST",
      path: "/cliente/empresa/:empresaId/reservar-turno",
      handler: reservarTurno,
    },
    { method: "GET", path: "/cliente/todos-mis-turnos", handler: todosMisTurnos },
    { method: "GET", path: "/cliente/empresa/:empresaId/mis-turnos", handler: misTurnosEmpresa },
    {
      method: "PUT",
      path: "/cliente/empresa/:empresaId/turno/:turnoId/cancelar",
      handler: cancelarTurnoCliente,
    },
    {
      method: "PUT",
      path: "/cliente/empresa/:empresaId/turno/:turnoId/modificar",
      handler: modificarTurnoCliente,
    },
  ].map((route) => ({ ...route, ...compilePathTemplate(route.path) }));

  window.__turnosDemo = {
    storagePrefix: STORAGE_PREFIX,
    routes: ROUTES.map((route) => `${route.method} ${route.path}`),
  };
})();
