#!/usr/bin/env node
/**
 * build-seed.mjs — generates js/seed.json from database/02_SEED_MUNI.sql.
 *
 * The demo has no MySQL, so this script reads the seed SQL and converts the
 * INSERT statements into a JSON snapshot the browser can load.
 *
 * Supported statements (everything the municipal seed uses):
 *   - INSERT INTO <table> (...) VALUES (...), (...), ...
 *   - INSERT INTO disponibilidades (...) SELECT ... FROM profesionales p
 *       CROSS JOIN (SELECT 1 as day UNION ...) d WHERE p.empresa_id = N
 *   - INSERT INTO turnos (...) SELECT <consts>, p.id, ... FROM profesionales p
 *       WHERE p.empresa_id = N LIMIT 1 [OFFSET k]
 *
 * MySQL date expressions (NOW(), CURDATE(), DATE_ADD/DATE_SUB + INTERVAL) are
 * evaluated at build time, so bookings keep a realistic future date whenever the
 * script is run again.
 *
 * Password hashes are intentionally dropped from the output: the demo
 * authenticates against the documented demo credentials, not the real hashes.
 *
 * Usage: node scripts/build-seed.mjs [--sql <path>] [--out <path>]
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEMO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO_ROOT = resolve(DEMO_ROOT, "..");
const DEFAULT_SQL = resolve(REPO_ROOT, "database", "02_SEED_MUNI.sql");
const DEFAULT_OUT = resolve(DEMO_ROOT, "assets", "js", "seed.json");

const TABLES = [
  "empresas",
  "profesionales",
  "servicios",
  "disponibilidades",
  "clientes",
  "turnos",
];

const NOW = new Date();
const WARNINGS = [];

// --------------------------------------------------------------------- args

function parseArgs(argv) {
  const options = { sql: DEFAULT_SQL, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--sql") options.sql = resolve(argv[++index]);
    else if (arg === "--out") options.out = resolve(argv[++index]);
    else if (arg === "--help" || arg === "-h") {
      console.log("usage: node scripts/build-seed.mjs [--sql <path>] [--out <path>]");
      process.exit(0);
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }
  return options;
}

// ------------------------------------------------------------ sql tokenizer

/** Removes -- and block comments, keeping string literals untouched. */
function stripComments(sql) {
  let out = "";
  let quote = null;
  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    if (quote) {
      out += char;
      if (char === "\\" && index + 1 < sql.length) {
        out += sql[index + 1];
        index += 1;
      } else if (char === quote) {
        if (sql[index + 1] === quote) {
          out += sql[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      out += char;
      continue;
    }
    if (char === "-" && sql[index + 1] === "-") {
      while (index < sql.length && sql[index] !== "\n") index += 1;
      out += "\n";
      continue;
    }
    if (char === "/" && sql[index + 1] === "*") {
      index += 2;
      while (index < sql.length && !(sql[index] === "*" && sql[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }
    out += char;
  }
  return out;
}

/** Splits on a separator that sits outside quotes and parentheses. */
function splitTopLevel(text, separator = ",") {
  const parts = [];
  let current = "";
  let quote = null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      current += char;
      if (char === quote) {
        if (text[index + 1] === quote) {
          current += text[index + 1];
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      current += char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      current += char;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      current += char;
      continue;
    }
    if (char === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function splitStatements(sql) {
  return splitTopLevel(sql, ";").filter(Boolean);
}

// --------------------------------------------------------- value evaluation

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatSqlDate(ms) {
  const date = new Date(ms);
  const pad = (value) => String(value).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

const UNIT_MS = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
};

/** Evaluates `DATE_ADD(x, INTERVAL n UNIT) + INTERVAL m UNIT` style expressions. */
function evaluateDateExpression(expression) {
  let text = expression.trim();
  const dateCall = /DATE_(ADD|SUB)\(\s*([^(),]+(?:\(\))?)\s*,\s*INTERVAL\s+(\d+)\s+(SECOND|MINUTE|HOUR|DAY)\s*\)/i;

  let guard = 0;
  while (dateCall.test(text) && guard < 20) {
    guard += 1;
    text = text.replace(dateCall, (_, operation, base, amount, unit) => {
      const baseMs = evaluateTerms(base);
      const sign = operation.toUpperCase() === "SUB" ? -1 : 1;
      return `@${baseMs + sign * UNIT_MS[unit.toUpperCase()] * Number(amount)}`;
    });
  }

  if (!/NOW\(\)|CURDATE\(\)|INTERVAL|@\d+/i.test(text)) return null;
  return formatSqlDate(evaluateTerms(text));
}

function evaluateTerms(text) {
  const token =
    /([+\-])|(@\d+)|(NOW\(\))|(CURDATE\(\))|INTERVAL\s+(\d+)\s+(SECOND|MINUTE|HOUR|DAY)/gi;
  const source = text.trim();
  let total = 0;
  let sign = 1;
  let lastIndex = 0;
  let match;

  while ((match = token.exec(source))) {
    if (source.slice(lastIndex, match.index).trim()) {
      throw new Error(`cannot evaluate date expression: ${text}`);
    }
    lastIndex = token.lastIndex;
    if (match[1]) {
      sign = match[1] === "-" ? -1 : 1;
      continue;
    }
    if (match[2]) total += sign * Number(match[2].slice(1));
    else if (match[3]) total += sign * NOW.getTime();
    else if (match[4]) total += sign * startOfDay(NOW).getTime();
    else if (match[5]) total += sign * UNIT_MS[match[6].toUpperCase()] * Number(match[5]);
    sign = 1;
  }

  if (source.slice(lastIndex).trim()) {
    throw new Error(`cannot evaluate date expression: ${text}`);
  }
  return total;
}

function parseLiteral(raw) {
  const text = raw.trim();
  if (!text) return null;
  if (/^null$/i.test(text)) return null;
  if (/^true$/i.test(text)) return true;
  if (/^false$/i.test(text)) return false;
  if (text.startsWith("'") || text.startsWith('"')) {
    return text.slice(1, -1).replace(/''/g, "'").replace(/""/g, '"');
  }
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);

  const date = evaluateDateExpression(text);
  if (date !== null) return date;

  WARNINGS.push(`unparsed literal kept verbatim: ${text}`);
  return text;
}

/** Parses `(a, b), (c, d)` into [[a, b], [c, d]]. */
function parseValueTuples(text) {
  const rows = [];
  let index = 0;

  while (index < text.length) {
    while (index < text.length && /[\s,]/.test(text[index])) index += 1;
    if (index >= text.length) break;
    if (text[index] !== "(") {
      throw new Error(`expected "(" in VALUES at: ${text.slice(index, index + 60)}`);
    }
    index += 1;

    const fields = [];
    let current = "";
    let quote = null;
    let depth = 0;

    for (; index < text.length; index += 1) {
      const char = text[index];
      if (quote) {
        current += char;
        if (char === quote) {
          if (text[index + 1] === quote) {
            current += text[index + 1];
            index += 1;
          } else {
            quote = null;
          }
        }
        continue;
      }
      if (char === "'" || char === '"') {
        quote = char;
        current += char;
        continue;
      }
      if (char === "(") {
        depth += 1;
        current += char;
        continue;
      }
      if (char === ")") {
        if (depth === 0) {
          fields.push(current.trim());
          current = "";
          index += 1;
          break;
        }
        depth -= 1;
        current += char;
        continue;
      }
      if (char === "," && depth === 0) {
        fields.push(current.trim());
        current = "";
        continue;
      }
      current += char;
    }

    rows.push(fields.map(parseLiteral));
  }

  return rows;
}

// --------------------------------------------------------------- conversion

function createDatabase() {
  const database = {};
  for (const table of TABLES) database[table] = [];
  return database;
}

function insertRow(database, table, row) {
  if (!database[table]) throw new Error(`unexpected table: ${table}`);
  database[table].push({ id: database[table].length + 1, ...row });
}

function parseInsertSelect(database, table, columns, statement) {
  const selectMatch = /^SELECT\s+([\s\S]+?)\s+FROM\s+([\s\S]+)$/i.exec(statement.trim());
  if (!selectMatch) {
    WARNINGS.push(`skipped INSERT ... SELECT on ${table}: cannot read SELECT clause`);
    return false;
  }

  const selectList = splitTopLevel(selectMatch[1], ",");
  const from = selectMatch[2].trim();
  const nowSql = formatSqlDate(NOW.getTime());

  // Availability blocks: one row per professional of the sector, per weekday.
  const crossJoin =
    /^profesionales\s+p\s+CROSS\s+JOIN\s*\(([\s\S]*?)\)\s*d\s+WHERE\s+p\.empresa_id\s*=\s*(\d+)\s*$/i.exec(
      from
    );
  if (crossJoin) {
    const days = [...crossJoin[1].matchAll(/SELECT\s+(\d+)/gi)].map((m) => Number(m[1]));
    const empresaId = Number(crossJoin[2]);
    const startTime = parseLiteral(selectList[3]);
    const endTime = parseLiteral(selectList[4]);

    for (const profesional of database.profesionales) {
      if (profesional.empresa_id !== empresaId) continue;
      for (const day of days) {
        insertRow(database, table, {
          profesional_id: profesional.id,
          empresa_id: empresaId,
          day_of_week: day,
          start_time: startTime,
          end_time: endTime,
          created_at: nowSql,
        });
      }
    }
    return true;
  }

  // Bookings per sector: first (or nth) professional of the sector.
  const single = /^profesionales\s+p\s+WHERE\s+p\.empresa_id\s*=\s*(\d+)\s+LIMIT\s+1(?:\s+OFFSET\s+(\d+))?\s*$/i.exec(
    from
  );
  if (single) {
    const empresaId = Number(single[1]);
    const offset = Number(single[2] ?? 0);
    const candidates = database.profesionales.filter((p) => p.empresa_id === empresaId);
    const profesional = candidates[offset];
    if (!profesional) {
      WARNINGS.push(`skipped INSERT ... SELECT on ${table}: no professional at offset ${offset}`);
      return false;
    }
    insertRow(database, table, {
      empresa_id: parseLiteral(selectList[0]),
      profesional_id: profesional.id,
      servicio_id: parseLiteral(selectList[2]),
      cliente_name: parseLiteral(selectList[3]),
      start_datetime: parseLiteral(selectList[4]),
      status: parseLiteral(selectList[5]),
      created_at: nowSql,
    });
    return true;
  }

  WARNINGS.push(`skipped INSERT ... SELECT on ${table}: unsupported FROM clause`);
  return false;
}

function convert(sql) {
  const database = createDatabase();
  const statements = splitStatements(stripComments(sql));
  let parsedInserts = 0;

  for (const statement of statements) {
    const insert = /^INSERT\s+INTO\s+`?(\w+)`?\s*\(([\s\S]*?)\)\s*([\s\S]+)$/i.exec(statement.trim());
    if (!insert) continue;

    const table = insert[1].toLowerCase();
    const columns = splitTopLevel(insert[2], ",").map((column) =>
      column.replace(/`/g, "").trim()
    );
    const payload = insert[3].trim();

    if (/^VALUES\b/i.test(payload)) {
      const valuesText = payload.replace(/^VALUES\b/i, "").trim();
      for (const values of parseValueTuples(valuesText)) {
        if (values.length !== columns.length) {
          throw new Error(
            `column/value mismatch on ${table}: ${columns.length} columns, ${values.length} values`
          );
        }
        const row = {};
        columns.forEach((column, index) => {
          row[column] = values[index];
        });
        insertRow(database, table, row);
      }
      parsedInserts += 1;
      continue;
    }

    if (/^SELECT\b/i.test(payload)) {
      if (parseInsertSelect(database, table, columns, payload)) parsedInserts += 1;
      continue;
    }

    WARNINGS.push(`skipped unsupported INSERT on ${table}`);
  }

  // The real password hashes stay in the repository; the public JSON has none.
  for (const table of ["empresas", "clientes"]) {
    for (const row of database[table]) delete row.password;
  }

  return { database, parsedInserts };
}

// -------------------------------------------------------------------- entry

function main() {
  const options = parseArgs(process.argv.slice(2));
  const sql = readFileSync(options.sql, "utf8");
  const { database, parsedInserts } = convert(sql);

  const output = {
    generatedAt: formatSqlDate(NOW.getTime()),
    source: relative(REPO_ROOT, options.sql),
    note: "Generated by demo/scripts/build-seed.mjs — do not edit by hand.",
    counts: Object.fromEntries(TABLES.map((table) => [table, database[table].length])),
    warnings: WARNINGS,
    ...database,
  };

  mkdirSync(dirname(options.out), { recursive: true });
  writeFileSync(options.out, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const labelWidth = Math.max(...TABLES.map((table) => table.length));
  console.log(`${relative(process.cwd(), options.sql)} -> ${relative(process.cwd(), options.out)}`);
  console.log(`${parsedInserts} INSERT statements parsed`);
  for (const table of TABLES) {
    console.log(`${table.padEnd(labelWidth)} ${".".repeat(6)} ${database[table].length}`);
  }
  for (const warning of WARNINGS) console.warn(`warning: ${warning}`);
}

main();
