/**
 * Behaviour tests for js/mock-api.js.
 *
 * The mock is loaded in a VM sandbox that mimics a browser (window, localStorage,
 * fetch) and the tests only talk to it through the public fetch interface, exactly
 * like the real frontend does.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import vm from "node:vm";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SEED_PATH = join(DEMO_ROOT, "js", "seed.json");

function loadSeed() {
  if (!existsSync(SEED_PATH)) {
    execFileSync(process.execPath, [join(DEMO_ROOT, "scripts", "build-seed.mjs")], {
      cwd: DEMO_ROOT,
      encoding: "utf8",
    });
  }
  return JSON.parse(readFileSync(SEED_PATH, "utf8"));
}

const SEED = loadSeed();
const STORAGE_PREFIX = "turnos-demo:";

function createStorage(backing) {
  return {
    getItem: (key) => (backing.has(key) ? backing.get(key) : null),
    setItem: (key, value) => backing.set(key, String(value)),
    removeItem: (key) => backing.delete(key),
    clear: () => backing.clear(),
    key: (index) => [...backing.keys()][index] ?? null,
    get length() {
      return backing.size;
    },
  };
}

/**
 * Boots the mock in a fresh sandbox. Passing the same `storage` Map to two
 * sandboxes simulates a page reload: same localStorage, new page context.
 */
function createDemo({ storage = new Map() } = {}) {
  const seedFetch = async (input) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input);
    if (url.includes("seed.json")) {
      return new Response(JSON.stringify(SEED), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    throw new Error(`mock must not reach the network: ${url}`);
  };

  const sandbox = {
    console,
    Response,
    Headers,
    Request,
    URL,
    URLSearchParams,
    localStorage: createStorage(storage),
    fetch: seedFetch,
    setTimeout,
    clearTimeout,
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(join(DEMO_ROOT, "js", "mock-api.js"), "utf8"), sandbox, {
    filename: "demo/js/mock-api.js",
  });

  return { fetch: sandbox.fetch, storage };
}

async function call(fetchImpl, path, init = {}) {
  const response = await fetchImpl(path, init);
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: response.status, headers: response.headers, json, text };
}

function jsonBody(payload, headers = {}) {
  return {
    method: headers.method || "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(payload),
  };
}

async function adminLogin(env, username = "hospital_muni", password = "123456") {
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  return call(env.fetch, "/login", {
    method: "POST",
    headers: { Authorization: `Basic ${credentials}` },
  });
}

const adminHeaders = (token, empresaId = 1) => ({
  "Content-Type": "application/json",
  "x-access-token": token,
  "id-empresa": String(empresaId),
});

const clientHeaders = (token) => ({
  "Content-Type": "application/json",
  "x-access-token-cliente": token,
});

async function clientLogin(env, dni = "12345678", password = "123456") {
  return call(env.fetch, "/cliente/login", jsonBody({ dni, password }));
}

/** Finds the first future slot for a professional using only the public API. */
async function firstAvailableSlot(env, token, empresaId, profesionalId) {
  for (let offset = 1; offset <= 21; offset += 1) {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const fecha = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
      day.getDate()
    ).padStart(2, "0")}`;
    const res = await call(
      env.fetch,
      `/cliente/empresa/${empresaId}/horarios-disponibles?profesional_id=${profesionalId}&fecha=${fecha}`,
      { headers: clientHeaders(token) }
    );
    assert.equal(res.status, 200);
    if (res.json.horarios_disponibles.length > 0) {
      return { fecha, slot: res.json.horarios_disponibles[0] };
    }
  }
  throw new Error("seed has no availability in the next 21 days");
}

// ------------------------------------------------------------------ routing

test("unmocked API routes answer 501 instead of an empty payload", async () => {
  const env = createDemo();
  const res = await call(env.fetch, "/empresa/1/turnos-pendientes", { headers: adminHeaders("x") });

  assert.equal(res.status, 501);
  assert.match(res.json.message, /no está incluida en la demo/i);
  assert.match(res.json.message, /turnos-pendientes/);
});

// --------------------------------------------------------------------- admin

test("admin login issues a demo token accepted by getAuthHeaders-style headers", async () => {
  const env = createDemo();

  const ok = await adminLogin(env);
  assert.equal(ok.status, 200);
  assert.equal(ok.json.id, 1);
  assert.equal(ok.json.nombre, "Hospital Municipal Coronel Dorrego");
  assert.equal(typeof ok.json.token, "string");

  const wrongPassword = await adminLogin(env, "hospital_muni", "nope");
  assert.equal(wrongPassword.status, 401);
  assert.equal(wrongPassword.json.message, "No coincide la contraseña");

  const unknown = await adminLogin(env, "no_existe", "123456");
  assert.equal(unknown.status, 401);
  assert.equal(unknown.json.message, "No existe el usuario");

  const noToken = await call(env.fetch, "/empresa/1/turnos");
  assert.equal(noToken.status, 401);
  assert.equal(noToken.json.message, "No contiene el header x-access-token");

  const wrongEmpresa = await call(env.fetch, "/empresa/2/turnos", {
    headers: adminHeaders(ok.json.token, 2),
  });
  assert.equal(wrongEmpresa.status, 401);
  assert.equal(wrongEmpresa.json.message, "No coincide id del token con el del header");
});

test("admin listings read the seed with the same shape as the Flask routes", async () => {
  const env = createDemo();
  const { json: session } = await adminLogin(env);
  const headers = adminHeaders(session.token);

  const turnos = await call(env.fetch, "/empresa/1/turnos", { headers });
  assert.equal(turnos.status, 200);
  assert.equal(turnos.headers.get("x-total-count"), String(turnos.json.length));
  const turno = turnos.json.find((t) => t.cliente_name === "Ana Martinez");
  assert.ok(turno, "seed booking is listed");
  for (const field of [
    "id",
    "empresa_id",
    "profesional_id",
    "servicio_id",
    "cliente_name",
    "observaciones",
    "start_datetime",
    "status",
    "created_at",
    "profesional_nombre",
    "profesional_apellido",
    "profesional_especialidad",
    "servicio_nombre",
    "precio",
    "empresa_nombre",
  ]) {
    assert.ok(field in turno, `turno exposes ${field}`);
  }
  assert.match(turno.start_datetime, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

  const profesionales = await call(env.fetch, "/empresa/1/profesionales", { headers });
  assert.equal(profesionales.status, 200);
  assert.equal(profesionales.json.length, 83);
  assert.deepEqual(Object.keys(profesionales.json[0]).sort(), [
    "created_at",
    "dni",
    "email",
    "empresa_id",
    "especialidad",
    "id",
    "matricula",
    "name",
    "surname",
  ]);

  const { json: vialidadSession } = await adminLogin(env, "vialidad_muni", "123456");
  const servicios = await call(env.fetch, "/empresa/2/servicios", {
    headers: adminHeaders(vialidadSession.token, 2),
  });
  assert.equal(servicios.status, 200);
  assert.equal(servicios.json[0].name, "Trámite Licencia de Conducir");
  assert.equal(servicios.json[0].duration_minutes, 30);

  const disponibilidades = await call(env.fetch, "/empresa/1/disponibilidades", { headers });
  assert.equal(disponibilidades.status, 200);
  assert.ok(disponibilidades.json.length > 0);
  // Ordered like the Flask model: day_of_week, then start_time.
  assert.equal(disponibilidades.json[0].start_time, "08:00:00");
  assert.equal(disponibilidades.json[0].day_of_week, 1);
  assert.equal(typeof disponibilidades.json[0].profesional_nombre, "string");

  const resumen = await call(env.fetch, "/empresa/1/profesionales/disponibilidades-resumen", {
    headers,
  });
  assert.equal(resumen.status, 200);
  assert.deepEqual(resumen.json["1"], ["Lunes", "Miércoles"]);

  const clientes = await call(env.fetch, "/empresa/1/clientes-todos", { headers });
  assert.equal(clientes.status, 200);
  assert.equal(clientes.json.length, 8);
  // Ordered by apellido, nombre (same as the Flask query).
  assert.equal(clientes.json[0].apellido, "Fernandez");
  assert.ok(clientes.json.some((cliente) => cliente.dni === "12345678"));
  assert.ok(!("password" in clientes.json[0]));
});

test("admin availability calculation mirrors the Flask slot generator", async () => {
  const env = createDemo();
  const { json: session } = await adminLogin(env);
  const headers = adminHeaders(session.token);

  // Professional 1 works Monday and Wednesday 09:00-13:00.
  const fecha = nextWeekdayDate(1); // next Monday
  const res = await call(
    env.fetch,
    `/empresa/1/horarios-disponibles?profesional_id=1&fecha=${fecha}`,
    { headers }
  );

  assert.equal(res.status, 200);
  const horarios = res.json.horarios_disponibles;
  assert.ok(horarios.length > 0);
  assert.equal(horarios[0].hora, "09:00");
  assert.equal(horarios[0].datetime, `${fecha} 09:00:00`);
  assert.ok(horarios.every((h) => h.datetime.startsWith(fecha)));

  const missing = await call(env.fetch, "/empresa/1/horarios-disponibles?profesional_id=1", {
    headers,
  });
  assert.equal(missing.status, 400);
  assert.equal(missing.json.message, "Se requiere profesional_id y fecha");
});

test("admin can create, edit and delete a turno", async () => {
  const env = createDemo();
  const { json: session } = await adminLogin(env);
  const headers = adminHeaders(session.token);
  const { slot } = await firstAvailableSlotForAdmin(env, headers, 1);

  const creado = await call(
    env.fetch,
    "/turno",
    jsonBody(
      {
        empresa_id: 1,
        profesional_id: 1,
        servicio_id: 1,
        cliente_name: "Cliente Mostrador",
        observaciones: "Alta desde el panel",
        start_datetime: slot.datetime,
        status: "Reservado",
      },
      headers
    )
  );
  assert.equal(creado.status, 201);
  assert.equal(creado.json.cliente_name, "Cliente Mostrador");
  assert.equal(creado.json.status, "Reservado");

  const listado = await call(env.fetch, "/empresa/1/turnos", { headers });
  assert.ok(listado.json.some((t) => t.id === creado.json.id));

  const editado = await call(
    env.fetch,
    `/empresa/1/turno/${creado.json.id}`,
    jsonBody({ ...creado.json, observaciones: "Reprogramado", status: "Completado" }, {
      ...headers,
      method: "PUT",
    })
  );
  assert.equal(editado.status, 200);
  assert.equal(editado.json.observaciones, "Reprogramado");
  assert.equal(editado.json.status, "Completado");

  const borrado = await call(env.fetch, `/empresa/1/turno/${creado.json.id}`, {
    method: "DELETE",
    headers,
  });
  assert.equal(borrado.status, 200);

  const despues = await call(env.fetch, "/empresa/1/turnos", { headers });
  assert.ok(!despues.json.some((t) => t.id === creado.json.id));

  const inexistente = await call(env.fetch, "/empresa/1/turno/9999", {
    method: "DELETE",
    headers,
  });
  assert.equal(inexistente.status, 404);
});

async function firstAvailableSlotForAdmin(env, headers, empresaId) {
  const profesionales = await call(env.fetch, `/empresa/${empresaId}/profesionales`, { headers });
  const resumen = await call(
    env.fetch,
    `/empresa/${empresaId}/profesionales/disponibilidades-resumen`,
    { headers }
  );
  const profesional = profesionales.json[0];
  const dias = resumen.json[String(profesional.id)] || [];

  for (let offset = 1; offset <= 21; offset += 1) {
    const day = new Date();
    day.setDate(day.getDate() + offset);
    const fecha = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
      day.getDate()
    ).padStart(2, "0")}`;
    const res = await call(
      env.fetch,
      `/empresa/${empresaId}/horarios-disponibles?profesional_id=${profesional.id}&fecha=${fecha}`,
      { headers }
    );
    if (res.status === 200 && res.json.horarios_disponibles.length > 0) {
      return { fecha, slot: res.json.horarios_disponibles[0], profesional, dias };
    }
  }
  throw new Error("seed has no availability in the next 21 days");
}

test("admin CRUD on servicios, profesionales and disponibilidades", async () => {
  const env = createDemo();
  const { json: session } = await adminLogin(env);
  const headers = adminHeaders(session.token);

  const servicio = await call(
    env.fetch,
    "/servicio",
    jsonBody(
      { empresa_id: 1, name: "Consulta Demo", duration_minutes: 15, price: 100, description: "Demo" },
      headers
    )
  );
  assert.equal(servicio.status, 201);
  assert.equal(servicio.json.name, "Consulta Demo");

  const servicioEditado = await call(
    env.fetch,
    `/empresa/1/servicio/${servicio.json.id}`,
    jsonBody({ ...servicio.json, price: 250 }, { ...headers, method: "PUT" })
  );
  assert.equal(servicioEditado.status, 200);
  assert.equal(servicioEditado.json.price, 250);

  const profesional = await call(
    env.fetch,
    "/profesional",
    jsonBody(
      {
        empresa_id: 1,
        name: "Ana",
        surname: "Demo",
        especialidad: "Clínica General",
        matricula: "DEM-001",
        dni: "99999999",
        email: "ana.demo@coroneldorrego.gob.ar",
      },
      headers
    )
  );
  assert.equal(profesional.status, 201);
  assert.equal(profesional.json.empresa_id, 1);

  const disponibilidad = await call(
    env.fetch,
    "/disponibilidad",
    jsonBody(
      {
        profesional_id: profesional.json.id,
        day_of_week: 2,
        start_time: "08:00:00",
        end_time: "12:00:00",
        empresa_id: 1,
      },
      headers
    )
  );
  assert.equal(disponibilidad.status, 201);
  assert.equal(disponibilidad.json.day_of_week, 2);

  const duplicada = await call(
    env.fetch,
    "/disponibilidad",
    jsonBody(
      {
        profesional_id: profesional.json.id,
        day_of_week: 2,
        start_time: "08:00:00",
        end_time: "12:00:00",
        empresa_id: 1,
      },
      headers
    )
  );
  assert.equal(duplicada.status, 400);
  assert.equal(
    duplicada.json.message,
    "El profesional ya tiene disponibilidad asignada en ese horario"
  );

  const borrada = await call(
    env.fetch,
    `/empresa/1/disponibilidad/${disponibilidad.json.id}`,
    { method: "DELETE", headers }
  );
  assert.equal(borrada.status, 200);

  const borradoProfesional = await call(env.fetch, `/empresa/1/profesional/${profesional.json.id}`, {
    method: "DELETE",
    headers,
  });
  assert.equal(borradoProfesional.status, 200);

  const borradoServicio = await call(env.fetch, `/empresa/1/servicio/${servicio.json.id}`, {
    method: "DELETE",
    headers,
  });
  assert.equal(borradoServicio.status, 200);
});

// ------------------------------------------------------------------- citizen

test("citizen can register and log in against the demo backend", async () => {
  const env = createDemo();

  const registro = await call(
    env.fetch,
    "/cliente/registro",
    jsonBody({
      dni: "30111222",
      nombre: "Lucia",
      apellido: "Demo",
      password: "secreta",
      email: "lucia.demo@example.com",
      telefono: "2914000000",
    })
  );
  assert.equal(registro.status, 201);
  assert.equal(registro.json.message, "Cliente registrado exitosamente");
  assert.equal(registro.json.cliente.dni, "30111222");

  const duplicado = await call(
    env.fetch,
    "/cliente/registro",
    jsonBody({ dni: "30111222", nombre: "Lucia", apellido: "Demo", password: "secreta" })
  );
  assert.equal(duplicado.status, 400);

  const dniCorto = await call(
    env.fetch,
    "/cliente/registro",
    jsonBody({ dni: "123", nombre: "A", apellido: "B", password: "secreta" })
  );
  assert.equal(dniCorto.status, 400);
  assert.equal(dniCorto.json.message, "DNI inválido. Debe contener entre 7 y 8 dígitos numéricos");

  const login = await clientLogin(env, "30111222", "secreta");
  assert.equal(login.status, 200);
  assert.equal(login.json.cliente.nombre, "Lucia");
  assert.equal(typeof login.json.token, "string");

  const malPassword = await clientLogin(env, "30111222", "incorrecta");
  assert.equal(malPassword.status, 401);
  assert.equal(malPassword.json.message, "DNI o contraseña incorrectos");

  const perfil = await call(env.fetch, "/cliente/perfil", {
    headers: clientHeaders(login.json.token),
  });
  assert.equal(perfil.status, 200);
  assert.equal(perfil.json.dni, "30111222");
});

test("citizen booking flow persists across a page reload", async () => {
  const storage = new Map();
  const env = createDemo({ storage });

  const { json: session } = await clientLogin(env);
  const token = session.token;

  const empresas = await call(env.fetch, "/publico/empresas");
  assert.equal(empresas.status, 200);
  assert.equal(empresas.json.length, 4);
  assert.deepEqual(Object.keys(empresas.json[0]).sort(), ["id", "nombre"]);

  const profesionales = await call(env.fetch, "/cliente/empresa/1/profesionales", {
    headers: clientHeaders(token),
  });
  assert.equal(profesionales.status, 200);
  assert.equal(profesionales.json[0].name, "Santiago");

  const resumen = await call(
    env.fetch,
    "/cliente/empresa/1/profesionales/disponibilidades-resumen",
    { headers: clientHeaders(token) }
  );
  assert.equal(resumen.status, 200);
  assert.ok(Array.isArray(resumen.json["1"]));

  const { slot } = await firstAvailableSlot(env, token, 1, 1);

  const reserva = await call(
    env.fetch,
    "/cliente/empresa/1/reservar-turno",
    jsonBody(
      { profesional_id: 1, start_datetime: slot.datetime, observaciones: "Primera consulta" },
      clientHeaders(token)
    )
  );
  assert.equal(reserva.status, 201);
  assert.equal(reserva.json.cliente_name, "Juan Perez");
  assert.equal(reserva.json.status, "Reservado");
  assert.equal(reserva.json.observaciones, "Primera consulta");

  const misTurnos = await call(env.fetch, "/cliente/todos-mis-turnos", {
    headers: clientHeaders(token),
  });
  assert.equal(misTurnos.status, 200);
  assert.ok(misTurnos.json.some((t) => t.id === reserva.json.id));

  // The slot is gone from the availability list.
  const otraVez = await call(
    env.fetch,
    `/cliente/empresa/1/horarios-disponibles?profesional_id=1&fecha=${slot.datetime.slice(0, 10)}`,
    { headers: clientHeaders(token) }
  );
  assert.ok(!otraVez.json.horarios_disponibles.some((h) => h.datetime === slot.datetime));

  // Simulate a page reload: new sandbox, same localStorage.
  const reloaded = createDemo({ storage });
  const despuesDelReload = await call(reloaded.fetch, "/cliente/todos-mis-turnos", {
    headers: clientHeaders(token),
  });
  assert.equal(despuesDelReload.status, 200);
  assert.ok(
    despuesDelReload.json.some((t) => t.id === reserva.json.id),
    "booking survives a reload"
  );

  // Everything the mock persists lives under the documented key prefix.
  for (const key of storage.keys()) {
    assert.ok(key.startsWith(STORAGE_PREFIX), `unexpected storage key: ${key}`);
  }
});

test("citizen cannot book the same slot twice or a past slot", async () => {
  const env = createDemo();
  const { json: session } = await clientLogin(env);
  const token = session.token;
  const { slot } = await firstAvailableSlot(env, token, 1, 1);

  const primera = await call(
    env.fetch,
    "/cliente/empresa/1/reservar-turno",
    jsonBody({ profesional_id: 1, start_datetime: slot.datetime }, clientHeaders(token))
  );
  assert.equal(primera.status, 201);

  const segunda = await call(
    env.fetch,
    "/cliente/empresa/1/reservar-turno",
    jsonBody({ profesional_id: 1, start_datetime: slot.datetime }, clientHeaders(token))
  );
  assert.equal(segunda.status, 400);
  assert.equal(segunda.json.message, "El profesional ya tiene un turno asignado en ese horario");

  const pasado = await call(
    env.fetch,
    "/cliente/empresa/1/reservar-turno",
    jsonBody({ profesional_id: 1, start_datetime: "2020-01-01 09:00:00" }, clientHeaders(token))
  );
  assert.equal(pasado.status, 400);
  assert.equal(pasado.json.message, "No se pueden agendar turnos en el pasado");

  const sinToken = await call(
    env.fetch,
    "/cliente/empresa/1/reservar-turno",
    jsonBody({ profesional_id: 1, start_datetime: slot.datetime })
  );
  assert.equal(sinToken.status, 401);
  assert.equal(sinToken.json.message, "No contiene el header x-access-token-cliente");
});

test("citizen can cancel and reprogram a booking", async () => {
  const env = createDemo();
  const { json: session } = await clientLogin(env);
  const token = session.token;
  const { slot } = await firstAvailableSlot(env, token, 1, 1);

  const reserva = await call(
    env.fetch,
    "/cliente/empresa/1/reservar-turno",
    jsonBody({ profesional_id: 1, start_datetime: slot.datetime }, clientHeaders(token))
  );
  assert.equal(reserva.status, 201);

  const { slot: otroSlot } = await firstAvailableSlot(env, token, 1, 1);
  const reprogramado = await call(
    env.fetch,
    `/cliente/empresa/1/turno/${reserva.json.id}/modificar`,
    jsonBody({ start_datetime: otroSlot.datetime }, { ...clientHeaders(token), method: "PUT" })
  );
  assert.equal(reprogramado.status, 200);
  assert.equal(reprogramado.json.start_datetime, otroSlot.datetime);

  const enPasado = await call(
    env.fetch,
    `/cliente/empresa/${reserva.json.empresa_id}/turno/${reserva.json.id}/modificar`,
    jsonBody({ start_datetime: "2020-01-01 09:00:00" }, { ...clientHeaders(token), method: "PUT" })
  );
  assert.equal(enPasado.status, 400);
  assert.equal(enPasado.json.message, "No se pueden agendar turnos en el pasado");

  const cancelado = await call(
    env.fetch,
    `/cliente/empresa/${reserva.json.empresa_id}/turno/${reserva.json.id}/cancelar`,
    { method: "PUT", headers: clientHeaders(token) }
  );
  assert.equal(cancelado.status, 200);
  assert.equal(cancelado.json.status, "Cancelado");

  const canceladoOtraVez = await call(
    env.fetch,
    `/cliente/empresa/${reserva.json.empresa_id}/turno/${reserva.json.id}/cancelar`,
    { method: "PUT", headers: clientHeaders(token) }
  );
  assert.equal(canceladoOtraVez.status, 400);
  assert.equal(canceladoOtraVez.json.message, "El turno ya está cancelado");

  const misTurnos = await call(env.fetch, "/cliente/todos-mis-turnos", {
    headers: clientHeaders(token),
  });
  assert.ok(!misTurnos.json.some((t) => t.id === reserva.json.id));
});

test("citizen profile update keeps the PATCH contract the frontend calls", async () => {
  const env = createDemo();
  const { json: session } = await clientLogin(env);
  const token = session.token;

  const actualizado = await call(
    env.fetch,
    "/cliente/perfil",
    jsonBody(
      { nombre: "Juan Carlos", apellido: "Perez", email: null, telefono: "2914000000" },
      { ...clientHeaders(token), method: "PATCH" }
    )
  );
  assert.equal(actualizado.status, 200);
  assert.equal(actualizado.json.message, "Perfil actualizado correctamente");

  const perfil = await call(env.fetch, "/cliente/perfil", { headers: clientHeaders(token) });
  assert.equal(perfil.json.nombre, "Juan Carlos");
});

function nextWeekdayDate(targetDay) {
  const day = new Date();
  day.setDate(day.getDate() + 1);
  while (day.getDay() !== targetDay) day.setDate(day.getDate() + 1);
  return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
    day.getDate()
  ).padStart(2, "0")}`;
}
