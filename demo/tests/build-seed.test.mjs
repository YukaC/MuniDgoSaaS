/**
 * Behaviour tests for scripts/build-seed.mjs (the SQL -> JSON generator).
 * The script is exercised as a black box: run it, read the JSON it writes.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SQL_DATETIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;

function buildSeed() {
  const scratch = mkdtempSync(join(tmpdir(), "turnos-seed-"));
  const outPath = join(scratch, "seed.json");
  try {
    const stdout = execFileSync(
      process.execPath,
      [join(DEMO_ROOT, "scripts", "build-seed.mjs"), "--out", outPath],
      { cwd: DEMO_ROOT, encoding: "utf8" }
    );
    return { seed: JSON.parse(readFileSync(outPath, "utf8")), stdout };
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

test("build-seed parses every INSERT in the municipal seed", () => {
  const { seed, stdout } = buildSeed();

  // Row counts of database/02_SEED_MUNI.sql (VALUES rows + INSERT..SELECT rows).
  assert.equal(seed.empresas.length, 4);
  assert.equal(seed.profesionales.length, 91); // 83 hospital + 8 other sectors
  assert.equal(seed.servicios.length, 41);
  assert.equal(seed.disponibilidades.length, 90); // 50 VALUES + 15 + 15 + 10 SELECT
  assert.equal(seed.clientes.length, 8);
  assert.equal(seed.turnos.length, 15); // 9 VALUES + 6 INSERT..SELECT

  // The script reports the row count per table.
  for (const table of ["empresas", "profesionales", "servicios", "disponibilidades", "clientes", "turnos"]) {
    assert.match(stdout, new RegExp(`${table}\\s+\\.*\\s*\\d+`, "i"), `stdout must report ${table}`);
  }
  assert.match(stdout, /profesionales\s+\.*\s*91/);
});

test("build-seed assigns sequential ids and keeps relations consistent", () => {
  const { seed } = buildSeed();

  for (const table of ["empresas", "profesionales", "servicios", "disponibilidades", "clientes", "turnos"]) {
    const ids = seed[table].map((row) => row.id);
    assert.deepEqual(ids, ids.map((_, index) => index + 1), `${table} ids must be 1..n`);
  }

  const hospital = seed.empresas[0];
  assert.equal(hospital.nombre, "Hospital Municipal Coronel Dorrego");
  assert.equal(hospital.username, "hospital_muni");

  const primero = seed.profesionales[0];
  assert.equal(primero.name, "Santiago");
  assert.equal(primero.surname, "Braghero");
  assert.equal(primero.empresa_id, 1);
  assert.equal(primero.especialidad, "Cirugía");

  const empresaPorId = new Map(seed.empresas.map((e) => [e.id, e]));
  const profesionalPorId = new Map(seed.profesionales.map((p) => [p.id, p]));

  for (const disp of seed.disponibilidades) {
    const prof = profesionalPorId.get(disp.profesional_id);
    assert.ok(prof, `disponibilidad ${disp.id} points to a professional that exists`);
    assert.equal(disp.empresa_id, prof.empresa_id);
    assert.ok(empresaPorId.has(disp.empresa_id));
    assert.match(disp.start_time, /^\d{2}:\d{2}:\d{2}$/);
    assert.match(disp.end_time, /^\d{2}:\d{2}:\d{2}$/);
  }

  for (const turno of seed.turnos) {
    assert.ok(profesionalPorId.has(turno.profesional_id));
    assert.equal(turno.empresa_id, profesionalPorId.get(turno.profesional_id).empresa_id);
    assert.ok(seed.servicios.some((s) => s.id === turno.servicio_id));
  }
});

test("build-seed evaluates the MySQL date expressions into concrete datetimes", () => {
  const { seed } = buildSeed();
  const now = new Date();

  for (const turno of seed.turnos) {
    assert.match(turno.start_datetime, SQL_DATETIME);
    assert.ok(!Number.isNaN(Date.parse(turno.start_datetime.replace(" ", "T"))));
  }

  const futuros = seed.turnos.filter(
    (t) => t.status === "Reservado" && Date.parse(t.start_datetime.replace(" ", "T")) > now.getTime()
  );
  assert.ok(futuros.length >= 6, "seed must keep its future bookings relative to generation time");

  assert.equal(seed.turnos.filter((t) => t.status === "Completado").length, 3);
  assert.equal(seed.turnos.filter((t) => t.status === "Cancelado").length, 1);

  // Rows produced by INSERT ... SELECT (one booking per non-hospital sector).
  const vialidad = seed.turnos.filter((t) => t.empresa_id === 2);
  assert.equal(vialidad.length, 2);
  assert.equal(vialidad[0].servicio_id, 31);
  assert.equal(vialidad[0].cliente_name, "Maria Gonzalez");
});

test("build-seed emulates the CROSS JOIN disponibilidades per sector", () => {
  const { seed } = buildSeed();

  const vialidad = seed.disponibilidades.filter((d) => d.empresa_id === 2);
  assert.equal(vialidad.length, 15); // 3 professionals x 5 weekdays
  assert.deepEqual(
    [...new Set(vialidad.map((d) => d.day_of_week))].sort(),
    [1, 2, 3, 4, 5]
  );
  assert.equal(vialidad[0].start_time, "08:00:00");
  assert.equal(vialidad[0].end_time, "16:00:00");

  const registro = seed.disponibilidades.filter((d) => d.empresa_id === 4);
  assert.equal(registro.length, 10); // 2 professionals x 5 weekdays
  assert.equal(registro[0].end_time, "15:00:00");
});

test("build-seed never copies password hashes into the public JSON", () => {
  const { seed } = buildSeed();

  for (const empresa of seed.empresas) assert.ok(!("password" in empresa));
  for (const cliente of seed.clientes) assert.ok(!("password" in cliente));

  assert.equal(seed.clientes[0].dni, "12345678");
  assert.equal(seed.clientes[0].nombre, "Juan");
  assert.equal(seed.clientes[0].apellido, "Perez");
  assert.equal(seed.clientes[3].activo, true);
});
