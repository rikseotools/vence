#!/usr/bin/env npx tsx
/**
 * backend/scripts/sim-fatiga-email.ts — SIMULACIÓN, no escribe nada.
 *
 * Mide, sobre los disparos REALES de `alert_fired`, cuántos correos manda la
 * política de email de T-272 frente a los que se mandaron de verdad. Tres capas,
 * desactivables por flag para poder atribuir el ahorro a cada una:
 *
 *   1. **Severidad mínima** (`--severidad`, default el del código).
 *   2. **Backoff por problema** (mismo `regla|fingerprint`): inmediato → 1 h →
 *      6 h → 1/día mientras siga.
 *   3. **Agrupación por tick** del motor (5 min): los supervivientes van en un
 *      correo.
 *
 * NO duplica el criterio: importa `decideEmail` / `parseEmailHistory` / la curva
 * REALES de `src/alerts/email-policy.ts`. Esto no es un detalle de estilo — la
 * primera versión de este simulador llevaba la curva COPIADA y por eso no vio el
 * defecto que sí cazó el test unitario (reinicio de racha == último escalón ⇒ el
 * backoff se desarmaba solo). Una copia miente en cuanto divergen.
 *
 * Por qué existe (30/07/2026): 392 correos en 7 días (56/día) para **28
 * problemas distintos** = 14 correos por problema. Misma disciplina que
 * `sim-cooldown-persistido.cjs` y `sim-cadencia-cron-overdue.ts`: no se cambia
 * la calibración de un canal de alertas sin medirla contra lo que de verdad pasó.
 *
 * Fidelidad: suprimir un CORREO no cambia CUÁNDO dispara la regla (eso lo
 * gobierna `cooldownMin`, que esta tarea no toca), así que replayar los `ts`
 * reales de `alert_fired` es exacto, no una aproximación.
 *
 * Uso:  npx tsx backend/scripts/sim-fatiga-email.ts [--dias 7] [--severidad critical]
 *                                                   [--sin-backoff] [--sin-agrupar] [--tick 5]
 *   (o el atajo integrado:  npm run sim:fatiga-email -- --dias 7)
 *
 * ⚠️ Vive bajo `backend/` A PROPÓSITO: el `tsconfig.json` de la raíz EXCLUYE
 * `backend`, así que un script en `scripts/` que importe de `backend/src`
 * arrastra NestJS al typecheck de la raíz y lo rompe. Mismo motivo que
 * `sim-cadencia-cron-overdue.ts` y `sim-cron-stalled.ts`.
 */
import * as dotenv from 'dotenv';
import postgres from 'postgres';
import {
  BACKOFF_CURVE_MIN,
  DEFAULT_MIN_EMAIL_SEVERITY,
  EMAIL_HISTORY_LOOKBACK_MIN,
  STREAK_RESET_MIN,
  decideEmail,
  parseMinSeverity,
  problemKey,
  type AlertSeverity,
} from '../src/alerts/email-policy';
import { ALERT_RULES } from '../src/alerts/alert-rules';

dotenv.config({ path: '.env.local' });

const argv = process.argv.slice(2);
const arg = (flag: string, def: string) => {
  const i = argv.indexOf(flag);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : def;
};
const has = (flag: string) => argv.includes(flag);

const DIAS = Number(arg('--dias', '7'));
const SEVERIDAD: AlertSeverity = parseMinSeverity(
  arg('--severidad', DEFAULT_MIN_EMAIL_SEVERITY),
);
const BACKOFF = !has('--sin-backoff');
const AGRUPAR = !has('--sin-agrupar');
const TICK_MIN = Number(arg('--tick', '5'));

interface Disparo {
  ts: Date;
  severity: AlertSeverity;
  rule: string;
  fingerprint: string;
  emailAlways: boolean;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en .env.local');
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    ssl: { rejectUnauthorized: false },
  });

  const filas = await sql<Disparo[]>`
    SELECT ts,
           severity::text AS severity,
           metadata->>'rule' AS rule,
           COALESCE(metadata->>'fingerprint', metadata->>'rule') AS fingerprint
      FROM observable_events
     WHERE event_type = 'alert_fired'
       AND ts >= NOW() - ${`${DIAS} days`}::interval
       AND metadata->>'rule' IS NOT NULL
     ORDER BY ts ASC
  `;
  await sql.end();

  if (!filas.length) {
    console.log('Sin disparos en la ventana — nada que simular.');
    return;
  }

  // `emailAlways` se resuelve contra el catálogo REAL de reglas para que la
  // simulación cuente las excepciones igual que producción (si se lee de una
  // lista aparte, la simulación y el motor divergen sin avisar).
  const conEmailAlways = new Set(
    ALERT_RULES.filter((r) => r.emailAlways).map((r) => r.name),
  );
  const emailAlwaysDe = (rule: string) => conEmailAlways.has(rule);

  // Historial por problema, tal como lo vería el cron (solo lo EMAILEADO).
  const historial = new Map<string, number[]>();
  const supervivientes: Array<Disparo & { tsMs: number }> = [];
  const callados = { severidad: 0, backoff: 0 };

  for (const f of filas) {
    const tsMs = +new Date(f.ts);
    const clave = problemKey(f.rule, f.fingerprint);
    const decision = decideEmail({
      severity: f.severity,
      minSeverity: SEVERIDAD,
      emailAlways: emailAlwaysDe(f.rule),
      sentAtMs: BACKOFF ? historial.get(clave) : [],
      nowMs: tsMs,
    });
    if (!decision.email) {
      if (decision.skippedBy === 'severity') callados.severidad++;
      else callados.backoff++;
      continue;
    }
    historial.set(clave, [...(historial.get(clave) ?? []), tsMs]);
    supervivientes.push({ ...f, tsMs });
  }

  // Agrupación: los supervivientes del MISMO tick del motor viajan juntos.
  const correos = new Map<string | number, Array<Disparo & { tsMs: number }>>();
  for (const s of supervivientes) {
    const bucket = AGRUPAR
      ? Math.floor(s.tsMs / (TICK_MIN * 60_000))
      : `${s.tsMs}|${s.rule}`;
    if (!correos.has(bucket)) correos.set(bucket, []);
    correos.get(bucket)!.push(s);
  }

  const real = filas.length;
  const nuevo = correos.size;
  const fundidos = supervivientes.length - nuevo;

  console.log(
    `\nSIMULACIÓN política de email (T-272) — ${real} disparos reales, últimos ${DIAS} días\n`,
  );
  console.log(
    `  política: severidad ≥ ${SEVERIDAD}` +
      (BACKOFF
        ? ` · backoff [inmediato, ${BACKOFF_CURVE_MIN.join('min, ')}min] · reinicio de racha ${STREAK_RESET_MIN}min`
        : ' · SIN backoff') +
      (AGRUPAR ? ` · agrupa por tick de ${TICK_MIN}min` : ' · SIN agrupar'),
  );
  if (DIAS * 1440 > EMAIL_HISTORY_LOOKBACK_MIN) {
    console.log(
      `  (nota: en producción el historial se lee ${EMAIL_HISTORY_LOOKBACK_MIN}min hacia atrás; aquí se replaya la ventana entera)`,
    );
  }
  const f = (n: number) => String(n).padStart(5);
  console.log('');
  console.log(
    `  correos HOY (1 por disparo)     ${f(real)}   ${(real / DIAS).toFixed(1)}/día`,
  );
  console.log(`   − filtrados por severidad      ${f(-callados.severidad)}`);
  console.log(`   − callados por backoff         ${f(-callados.backoff)}`);
  console.log(`   − fundidos al agrupar          ${f(-fundidos)}`);
  console.log(`  ────────────────────────────────${'─'.repeat(5)}`);
  console.log(
    `  correos con la política nueva   ${f(nuevo)}   ${(nuevo / DIAS).toFixed(1)}/día   (−${Math.round((1 - nuevo / real) * 100)}%)`,
  );

  // Reparto por regla: quién dejaba de pesar.
  const porRegla = new Map<string, number>();
  filas.forEach((x) => porRegla.set(x.rule, (porRegla.get(x.rule) ?? 0) + 1));
  const quedan = new Map<string, number>();
  supervivientes.forEach((x) =>
    quedan.set(x.rule, (quedan.get(x.rule) ?? 0) + 1),
  );

  console.log('\n  regla                          | real | avisa | callados');
  console.log('  -------------------------------|------|-------|---------');
  for (const [rule, n] of [...porRegla.entries()].sort((a, b) => b[1] - a[1])) {
    const q = quedan.get(rule) ?? 0;
    console.log(
      `  ${rule.padEnd(30).slice(0, 30)} | ${String(n).padStart(4)} | ${String(q).padStart(5)} | ${String(n - q).padStart(8)}`,
    );
  }

  // La garantía que hay que poder AFIRMAR, no suponer: ningún problema se queda
  // mudo por el backoff. Si alguno aparece aquí es por la severidad, y eso es
  // una decisión consciente — pero tiene que verse, no descubrirse en un incidente.
  const todos = new Set(filas.map((x) => problemKey(x.rule, x.fingerprint)));
  const avisados = new Set(
    supervivientes.map((x) => problemKey(x.rule, x.fingerprint)),
  );
  const mudos = [...todos].filter((p) => !avisados.has(p));
  console.log(
    `\n  problemas distintos: ${todos.size} · avisados al menos una vez: ${avisados.size}`,
  );
  if (mudos.length) {
    console.log(
      `  ⚠️  ${mudos.length} problema(s) NO avisarían nunca con esta política:`,
    );
    mudos.forEach((m) => console.log(`      · ${m}`));
    console.log(
      '      → si alguno debe avisar, su regla necesita `emailAlways: true` (ver AlertRule).',
    );
  } else {
    console.log('  ✅ todos los problemas siguen avisando al menos una vez');
  }

  console.log('\nNada de esto se ha escrito.\n');
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
