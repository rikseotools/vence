#!/usr/bin/env node
/**
 * scripts/alerts/sim-cooldown-persistido.cjs — SIMULACIÓN, no escribe nada.
 *
 * Reproduce sobre los disparos REALES (`alert_fired` de `observable_events`)
 * cuántos correos habría mandado el motor de alertas con el comportamiento
 * viejo y con el nuevo (T-258), para no dar por bueno un cambio de cadencia
 * sin medirlo — misma disciplina que `sim-enlace-boletin.cjs`.
 *
 * Qué compara, sobre la MISMA secuencia de eventos:
 *   · REAL      — los avisos que de verdad se mandaron (lo que hay en la tabla).
 *   · NUEVO     — replicando la decisión con el núcleo puro `alert-cooldown`
 *                 y los `cooldownMin` vigentes en `alert-rules.ts`.
 *
 * Limitación honesta: no puede inventar disparos que NO ocurrieron. Si una
 * regla estuvo silenciada por cooldown, no sabemos si su condición seguía
 * activa. Por eso la simulación solo mide REDUCCIÓN (cuántos de los avisos que
 * sí se mandaron habrían quedado silenciados), que es una cota inferior del
 * efecto y nunca lo exagera.
 *
 * Uso:  node scripts/alerts/sim-cooldown-persistido.cjs [--dias 7]
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');
const path = require('path');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const iDias = argv.indexOf('--dias');
const DIAS = iDias >= 0 && argv[iDias + 1] ? Number(argv[iDias + 1]) : 7;

/**
 * Lee los cooldownMin vigentes del fuente, para que la simulación no se
 * desincronice del código.
 *
 * Se parsea POR BLOQUES (`export const RULE_…`) y no con una regex corrida: hay
 * reglas creadas por la factoría `canaryFailedRule('nombre', { cooldownMin })`,
 * donde el nombre es un argumento y el campo es `cooldownMin: opts.cooldownMin`.
 * Con una regex corrida, esas reglas no solo se pierden — el `\d+` sigue
 * buscando y acaba emparejando una regla con el cooldown de OTRA, que es una
 * simulación que miente con buena cara.
 */
function cooldownsVigentes() {
  const src = require('fs').readFileSync(
    path.join(__dirname, '..', '..', 'backend', 'src', 'alerts', 'alert-rules.ts'),
    'utf8',
  );
  const out = new Map();
  const bloques = src.split(/(?=export const RULE_[A-Z0-9_]+)/);
  for (const bloque of bloques) {
    const nombre =
      bloque.match(/name:\s*'([a-z0-9_]+)'/)?.[1] ??
      bloque.match(/canaryFailedRule\(\s*\n?\s*'([a-z0-9_]+)'/)?.[1];
    if (!nombre) continue;
    const cd = bloque.match(/cooldownMin:\s*(\d+)/)?.[1];
    if (cd === undefined) continue;
    if (!out.has(nombre)) out.set(nombre, Number(cd));
  }
  return out;
}

/** Misma decisión que el núcleo puro: elapsed < cooldown ⇒ silenciado. */
function enCooldown(lastMs, cooldownMin, nowMs) {
  if (lastMs === undefined) return false;
  return (nowMs - lastMs) / 60_000 < cooldownMin;
}

(async () => {
  const url =
    process.env.DATABASE_URL ||
    require('fs')
      .readFileSync(path.join(__dirname, '..', '..', '.env.local'), 'utf8')
      .match(/^DATABASE_URL=(.*)$/m)[1]
      .trim();
  const sql = postgres(url, { ssl: { rejectUnauthorized: false }, max: 1 });

  const filas = await sql`
    SELECT metadata->>'rule' AS regla, ts
      FROM observable_events
     WHERE event_type = 'alert_fired'
       AND metadata->>'rule' IS NOT NULL
       AND ts > NOW() - (${DIAS} || ' days')::interval
     ORDER BY ts ASC`;

  const cooldowns = cooldownsVigentes();

  // Verificación de la propia simulación: si el parser no encuentra el cooldown
  // de una regla que SÍ disparó, esa regla se cuenta "sin cambio" y el total
  // sale bajo. Se avisa en vez de dar un número limpio y falso.
  const sinCooldown = [
    ...new Set(filas.map((f) => f.regla).filter((r) => !cooldowns.has(r))),
  ];

  const real = new Map();
  const nuevo = new Map();
  const ultimo = new Map();

  for (const f of filas) {
    const regla = f.regla;
    const t = new Date(f.ts).getTime();
    real.set(regla, (real.get(regla) ?? 0) + 1);

    // El cooldown vigente de la regla; si no está en el fuente, se asume el
    // que tenía (no se inventa una mejora que el código no hace).
    const cd = cooldowns.get(regla);
    if (cd === undefined) {
      nuevo.set(regla, (nuevo.get(regla) ?? 0) + 1);
      continue;
    }
    if (enCooldown(ultimo.get(regla), cd, t)) continue; // silenciado
    nuevo.set(regla, (nuevo.get(regla) ?? 0) + 1);
    ultimo.set(regla, t);
  }

  const reglas = [...new Set([...real.keys(), ...nuevo.keys()])].sort(
    (a, b) => (real.get(b) ?? 0) - (real.get(a) ?? 0),
  );

  console.log(
    `SIMULACIÓN cooldown persistido (T-258) — ${filas.length} disparos reales, últimos ${DIAS} días\n`,
  );
  console.log(
    'regla                          | cooldown |   real |  nuevo | evitados',
  );
  console.log(
    '-------------------------------|----------|--------|--------|---------',
  );
  let totalReal = 0;
  let totalNuevo = 0;
  for (const r of reglas) {
    const a = real.get(r) ?? 0;
    const b = nuevo.get(r) ?? 0;
    totalReal += a;
    totalNuevo += b;
    const cd = cooldowns.get(r);
    console.log(
      `${r.padEnd(30)} | ${String(cd ?? '?').padStart(8)} | ${String(a).padStart(6)} | ${String(b).padStart(6)} | ${String(a - b).padStart(8)}`,
    );
  }
  console.log(
    '-------------------------------|----------|--------|--------|---------',
  );
  console.log(
    `${'TOTAL'.padEnd(30)} | ${''.padStart(8)} | ${String(totalReal).padStart(6)} | ${String(totalNuevo).padStart(6)} | ${String(totalReal - totalNuevo).padStart(8)}`,
  );
  const pct = totalReal ? Math.round(((totalReal - totalNuevo) / totalReal) * 100) : 0;
  console.log(
    `\n→ ${totalReal - totalNuevo} correos menos de ${totalReal} (${pct}%). Cota INFERIOR: no incluye los disparos que el cooldown ya silenció.`,
  );
  console.log(
    `   Reglas con cooldown leído del fuente: ${cooldowns.size}.`,
  );
  if (sinCooldown.length) {
    console.log(
      `\n⚠️  ${sinCooldown.length} regla(s) que dispararon NO tienen cooldown legible en el fuente y se han contado SIN CAMBIO (el total de evitados es conservador): ${sinCooldown.join(', ')}`,
    );
  }
  console.log('\nNada de esto se ha escrito.');

  await sql.end();
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
