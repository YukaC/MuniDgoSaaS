# Mi Turno — demo estática (Municipalidad de Coronel Dorrego)

**Demo en vivo: <https://muniturnos.vercel.app>**

Demo **sin backend y sin MySQL** del sistema de turnos municipal. Es el frontend real
(HTML + JS plano + CSS propio) copiado tal cual, con la API Flask reemplazada por un
mock que corre en el navegador y lee un snapshot de la base en JSON.

Objetivo: abrir una URL y poder reservar un turno de punta a punta en menos de un minuto.

```
demo/
├── index.html          # panel administrativo (dashboard, reportes, turnos, clientes, ...)
├── login.html          # login del panel (sectores del municipio)
├── cliente.html        # portal del ciudadano (reservar, mis turnos, modificar, cancelar)
├── css/style.css       # copia del CSS real
├── img/logo-muni.png
├── js/
│   ├── mock-api.js     # ← la "API": intercepta window.fetch y responde desde el seed
│   ├── seed.json       # ← datos generados desde database/02_SEED_MUNI.sql
│   ├── config.js       # API_BASE_URL = "" (sin hosts hardcodeados)
│   └── ...             # main.js, turnos.js, cliente-publico.js, etc. (código real)
├── scripts/build-seed.mjs  # SQL → JSON (node, sin dependencias)
└── tests/                  # node --test: parser del seed + contrato del mock
```

## Qué está simulado y qué es real

**Real (sin cambios):** todo el frontend. Módulos, navegación, modales, cálculos de
horarios libres del lado del cliente, render de charts, búsqueda, responsive.

**Simulado:**

| Pieza real | En la demo |
|---|---|
| Flask (`backend/api/routes/**`) | `js/mock-api.js`: un mapa ruta → handler que imita códigos HTTP, forma del JSON, nombres de campos y headers (`x-access-token` + `id-empresa`, `x-access-token-cliente`) |
| MySQL + `database/*.sql` | `js/seed.json` generado por `scripts/build-seed.mjs` |
| JWT firmado | token de mentira (`demo-token:empresa:<id>` / `demo-cliente-token:<id>`); el mock valida que el token corresponda a la empresa o al cliente |
| Hash pbkdf2 de contraseñas | contraseña fija de demo (`123456`). El JSON **no** incluye los hashes del SQL |
| Escrituras en la base | `localStorage` bajo el prefijo `turnos-demo:` (`turnos-demo:state`) |

Todo lo que el mock no cubre devuelve **HTTP 501** con un mensaje explícito
(`La ruta GET /x no está incluida en la demo (mock)`), nunca un JSON vacío.

## Credenciales de demo

**Panel administrativo** (`login.html`) — contraseña `123456` para los cuatro sectores:

| Usuario | Sector |
|---|---|
| `hospital_muni` | Hospital Municipal Coronel Dorrego (83 profesionales, 30 servicios) |
| `vialidad_muni` | Dirección de Vialidad |
| `admin_muni` | Administración Pública |
| `registro_civil` | Registro Civil |

**Portal del ciudadano** (`cliente.html`) — contraseña `123456`:

| DNI | Ciudadano/a |
|---|---|
| `12345678` | Juan Perez |
| `23456789` | Maria Gonzalez |
| `34567890` | Carlos Rodriguez |
| `45678901` | Ana Martinez |
| `56789012` | Pedro Lopez |
| `67890123` | Laura Fernandez |
| `78901234` | Roberto Gomez |
| `89012345` | Sofia Sanchez |

También se puede crear una cuenta nueva desde "Registrarse" (la cuenta queda en
`localStorage`).

## Cómo correrlo localmente

No hace falta Node, ni Python packages, ni `.env`. Sólo un servidor estático
(el JSON no carga abriendo el archivo con `file://`):

```bash
cd demo
python3 -m http.server 8099
# → http://127.0.0.1:8099/cliente.html   (portal del ciudadano)
# → http://127.0.0.1:8099/login.html     (panel administrativo)
```

### Flujo recomendado para la entrevista (2 minutos)

1. `cliente.html` → DNI `12345678`, contraseña `123456`.
2. **+ Reservar Nuevo Turno** → sector "Hospital Municipal" → profesional → fecha
   (elegí un día que el profesional atienda: el portal te muestra los días) → hora → confirmar.
3. El turno aparece en "Mis Turnos"; recargá la página: sigue ahí (está en `localStorage`).
4. **🔁 Modificar Turno** para reprogramarlo, **🗑️ Cancelar Turno** para cancelarlo.
5. `login.html` → `hospital_muni` / `123456` → dashboard con contadores, listados de
   turnos / clientes / profesionales / servicios / disponibilidades y reportes con ECharts.

### Resetear los datos de la demo

La demo persiste en `localStorage`. Para volver al estado del seed:

- consola del navegador: `turnosDemoReset()`, o simplemente `localStorage.clear()` y recargar.

Ojo: el botón **Cerrar Sesión** del panel administrativo ejecuta `localStorage.clear()`
(comportamiento del frontend original), así que también reinicia los datos de la demo.

## Regenerar el seed

`js/seed.json` se genera desde el SQL real, no se edita a mano:

```bash
node demo/scripts/build-seed.mjs
# database/02_SEED_MUNI.sql -> demo/js/seed.json
# 26 INSERT statements parsed
# empresas         ...... 4
# profesionales    ...... 91
# servicios        ...... 41
# disponibilidades ...... 90
# clientes         ...... 8
# turnos           ...... 15
```

Opciones: `--sql <path>` y `--out <path>`.

El script no tiene dependencias: parsea los `INSERT ... VALUES`, traduce a datos
concretos las expresiones MySQL (`NOW()`, `CURDATE()`, `DATE_ADD/DATE_SUB ... INTERVAL`)
y emula los `INSERT ... SELECT` del seed (disponibilidades por sector vía
`CROSS JOIN`, y un turno por sector tomando el n-ésimo profesional). Los IDs se
asignan 1..n en el orden del archivo, igual que el `AUTO_INCREMENT` original.

**Las fechas del seed se congelan al generar el JSON** (los turnos "futuros" quedan a
1–4 días de la fecha de generación). Si la demo se ve vieja, volvé a correr el script.
Los hashes de contraseña del SQL se descartan a propósito: no viajan al navegador.

## Deploy en Vercel

Es un sitio 100 % estático, sin build y sin variables de entorno:

1. Importá el repo en Vercel.
2. **Root Directory:** `demo`.
3. **Framework Preset:** *Other* (sin build command, sin output directory).
4. Deploy. `vercel.json` no hace falta.

## API mockeada (`js/mock-api.js`)

Rutas cubiertas, todas con la forma de `backend/api/routes/**`:

| Método | Ruta | Uso |
|---|---|---|
| POST | `/login` | login del sector (Basic auth) → `{token, nombre, id}` |
| POST | `/cliente/registro` · `/cliente/login` | alta y login del ciudadano |
| GET | `/publico/empresas` | sectores para el portal |
| GET | `/empresas` · `/empresa/:id` | sectores (panel) |
| GET/PATCH/PUT | `/cliente/perfil` | perfil del ciudadano |
| GET | `/turnos` · `/empresa/:id/turnos` | turnos (con joins: profesional, servicio, empresa, precio, `X-Total-Count`) |
| POST/PUT/DELETE | `/turno` · `/empresa/:id/turno/:id` | alta, edición y baja de turnos |
| GET | `/empresa/:id/horarios-disponibles` · `/cliente/empresa/:id/horarios-disponibles` | slots libres (paso de 10 min, descuenta turnos existentes) |
| GET/POST/PUT/DELETE | `/empresa/:id/profesionales` · `/profesional` · `/empresa/:id/profesional/:id` | CRUD de profesionales |
| GET | `/empresa/:id/profesional/:id/disponibilidades` · `.../profesionales/disponibilidades-resumen` | horarios de atención |
| GET/POST/PUT/DELETE | `/empresa/:id/servicios` · `/servicio` · `/empresa/:id/servicio/:id` | CRUD de servicios |
| GET/POST/PUT/DELETE | `/empresa/:id/disponibilidades` · `/disponibilidad` · `/empresa/:id/disponibilidad/:id` | CRUD de disponibilidades |
| GET/POST/PUT/DELETE | `/empresa/:id/clientes-todos` · `/empresa/:id/cliente[/:id]` | clientes (panel) |
| GET | `/cliente/empresa/:id/profesionales` · `/servicios` · `/disponibilidades` | catálogo para el ciudadano |
| POST | `/cliente/empresa/:id/reservar-turno` | reserva (valida pasado y superposición) |
| GET | `/cliente/todos-mis-turnos` · `/cliente/empresa/:id/mis-turnos` | turnos del ciudadano |
| PUT | `/cliente/empresa/:id/turno/:id/cancelar` · `.../modificar` | cancelar y reprogramar |

Guarda de auth idéntica al backend: sin `x-access-token` → 401
`No contiene el header x-access-token`; token de otra empresa → 401
`No coincide id del token con el del header`. Para el ciudadano, sin
`x-access-token-cliente` → 401.

## Lo que NO funciona en la demo

Sin maquillaje:

1. **No hay backend ni base de datos.** Nada de lo que se hace acá persiste fuera del
   navegador; borrar `localStorage` (o usar otro navegador/perfil) vuelve al seed.
2. **Autenticación de mentira.** No hay hashing, ni JWT firmado, ni expiración de sesión,
   ni rate limiting (`@rate_limit_login`, `@rate_limit_registro` no se reproducen).
3. **Rutas fuera de la tabla de arriba devuelven 501**, por ejemplo:
   `/actualizar-estados-turnos` (el cron que pasa turnos vencidos a
   "Pendiente de Confirmación"), `/registro` + `PUT/DELETE /empresa/:id` (CRUD de
   sectores), `/empresa/usuario/:username`, `GET /empresa/:id/turno/:id`,
   `/empresa/:id/profesional/:id/dias-disponibles` y sus equivalentes `/cliente/...`.
4. **Emails de confirmación inexistentes:** el backend real encola un mail 15 minutos
   después de reservar (`programar_email_confirmacion`); acá no pasa nada.
5. **Reportes:** funcionan con el seed (el gráfico de turnos por día y la tabla de
   rendimiento), pero el de "Ingresos por Profesional" muestra *"No hay ingresos
   registrados aún"* porque los servicios del Hospital tienen `price = 0` en el seed.
   Requiere internet para bajar ECharts del CDN (`cdn.jsdelivr.net`).
6. **Paginación / límites:** el backend acepta `limit`/`offset` y devuelve `X-Truncated`;
   el mock siempre entrega todo (`X-Truncated: false`).
7. **Bug del frontend real que el mock tapa:** `cliente-publico.js` guarda el perfil con
   `PUT /cliente/perfil`, pero el backend Flask sólo define `PATCH`
   (`backend/api/routes/Clientes.py`), así que contra el backend real "Guardar Cambios"
   del perfil devolvería 405. La demo acepta `PUT` y `PATCH` para que se pueda probar.
8. **"Modificar turno" es un agregado de la demo.** El frontend original sólo permitía
   cancelar; la API ya tenía `/modificar`, así que se agregó el panel mínimo
   (`#panel-modificar` en `cliente.html` + 3 funciones en `js/cliente-publico.js`).
   Es el único cambio de comportamiento respecto de `frontend/`.
9. **Datos del seed:** son los del SQL de demo (profesionales y servicios del municipio).
   Los turnos "futuros" del seed se generan relativos a la fecha de build; si el JSON
   queda viejo, hay que regenerarlo.

## Diferencias con `frontend/`

El resto del código es una copia literal (rama `fix/turnosApp-query-limits`). Cambios:

| Archivo | Cambio |
|---|---|
| `js/config.js` | `API_BASE_URL = ""` (antes `http://127.0.0.1:5000`) |
| `*.html` | se agrega `<script src="js/mock-api.js">` antes de `config.js` |
| `cliente.html`, `js/cliente-publico.js` | panel y handlers de "Modificar Turno" (punto 8) |

## Tests

```bash
cd demo
node --test tests/
```

- `tests/build-seed.test.mjs`: corre el generador y valida conteos por tabla, IDs
  secuenciales, relaciones, evaluación de fechas MySQL y que no se filtren hashes.
- `tests/mock-api.test.mjs`: levanta `js/mock-api.js` en un sandbox con
  `window`/`localStorage`/`fetch` falsos y ejercita el contrato: 501 para rutas no
  cubiertas, guards de token, shape de las listas, cálculo de slots, alta/edición/baja
  de turnos, flujo completo de reserva del ciudadano (incluida la persistencia tras
  "recargar"), superposición, cancelación y reprogramación.

## Origen

Repo `turnosApp` — sistema de turnos de la Municipalidad de Coronel Dorrego
(Flask + MySQL + frontend JS plano). Esta carpeta existe sólo para mostrar el sistema
como demo pública, sin infraestructura.
