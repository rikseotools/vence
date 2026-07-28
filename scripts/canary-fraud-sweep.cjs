#!/usr/bin/env node
// scripts/canary-fraud-sweep.cjs
//
// CANARY del BARRIDO ANTIFRAUDE: ejercita contra RDS las formas de SQL que el
// servicio del backend ejecuta cada noche, con datos throwaway, y limpia.
//
// POR QUÉ EXISTE — el agujero que dejó pasar 7 noches de fallo (21-28/07/2026):
// `backend/src/fraud-sweep/` falló **7 de 7 noches, con cero éxitos**, muriendo en
// su PRIMER detector. Ninguno de los cinco llegó a ejecutarse jamás. La causa era
// de forma de SQL: Drizzle interpola un array JS como parámetros sueltos, así que
// `ANY(${users})` generaba `ANY(($1,$2,$3))` → *"op ANY/ALL (array) requires array
// on right side"*; y el INSERT en la columna `uuid[]` fallaba con *"expression is
// of type record"*.
//
// Lo que NO lo cazó, y es la lección:
//   · `tsc` y `nest build`  → la forma del SQL no es un problema de tipos.
//   · El spec del módulo    → mockea `execute`, así que el SQL nunca se ejecuta.
//   · El heartbeat del cron → sí emitía `cron_run/failure` cada noche… pero eso
//     avisa DESPUÉS del fallo, en un panel con ruido, y nadie actuó 7 días.
// Solo lo ve ejecutar el SQL contra Postgres de verdad. Eso es lo que hace esto.
//
// Aserciones (cada una es un modo de fallo REAL que ya ocurrió):
//   1. `= ANY(<array de uuid>)` en un SELECT           → D1 y D5
//   2. INSERT en `fraud_alerts.user_ids` (uuid[])       → upsert
//   3. UPDATE de `fraud_alerts.user_ids` (uuid[])       → upsert (refresco)
//   4. La consulta de servidas del detector de cosecha  → D4
//   5. El barrido ha tenido algún ÉXITO recientemente   → salud end-to-end
//
// Uso: node scripts/canary-fraud-sweep.cjs   (carga .env.local si está)
// Exit 0 = verde; exit 1 = el barrido volvería a romperse esta noche.

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

try {
  const p = path.join(process.cwd(), '.env.local');
  if (fs.existsSync(p)) {
    for (const l of fs.readFileSync(p, 'utf8').split('\n')) {
      const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch { /* se espera DATABASE_URL en el entorno */ }

const DB_URL = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '');
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }

/** Réplica del literal que produce `pgUuidArray` — la forma que el servicio manda. */
const arrayUuid = (ids) => `ARRAY[${ids.map((_, i) => `$${i + 1}::uuid`).join(', ')}]::uuid[]`;

(async () => {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await c.connect();
  const fails = [];
  const MARCA = `canary-fraud-sweep-${process.pid}`;

  try {
    const ids = (await c.query(`SELECT id FROM user_profiles LIMIT 2`)).rows.map((r) => r.id);
    if (ids.length < 2) { console.error('❌ no hay usuarios con los que probar'); process.exit(1); }

    // 1) `= ANY(<array>)` — la forma que mató a D1 cada noche.
    try {
      await c.query(`SELECT email, plan_type, created_at::date d FROM user_profiles
                      WHERE id = ANY(${arrayUuid(ids)}) ORDER BY created_at`, ids);
    } catch (e) { fails.push(`SELECT ... = ANY(uuid[]) falla: ${e.message}`); }

    // 2 y 3) escritura en la columna uuid[] — nunca se había ejecutado desde el
    // backend porque D1 moría antes. En transacción: no ensucia el badge.
    await c.query('BEGIN');
    try {
      await c.query(`INSERT INTO fraud_alerts (alert_type, severity, status, user_ids, details, match_criteria, detected_at)
                     VALUES ('canary_probe','low','new',${arrayUuid(ids)},'{}'::jsonb,$${ids.length + 1},now())`,
        [...ids, MARCA]);
    } catch (e) { fails.push(`INSERT en fraud_alerts.user_ids (uuid[]) falla: ${e.message}`); }
    try {
      await c.query(`UPDATE fraud_alerts SET user_ids=${arrayUuid(ids)} WHERE match_criteria=$${ids.length + 1}`,
        [...ids, MARCA]);
    } catch (e) { fails.push(`UPDATE de fraud_alerts.user_ids (uuid[]) falla: ${e.message}`); }
    await c.query('ROLLBACK');

    // 4) La consulta de servidas del detector de cosecha (D4).
    try {
      await c.query(`SELECT s.subject_key, sum(s.served)::int
                       FROM daily_questions_served s
                      WHERE s.subject_kind='user' AND s.usage_date >= CURRENT_DATE - 30
                        AND NOT EXISTS (SELECT 1 FROM user_profiles up
                                         WHERE up.id::text = s.subject_key AND up.email LIKE 'smoke@%')
                      GROUP BY 1 LIMIT 1`);
    } catch (e) { fails.push(`consulta de servidas (D4) falla: ${e.message}`); }

    // 5) Salud end-to-end: el barrido tiene que haber TERMINADO bien alguna vez
    // en los últimos días. Con 0 éxitos, algo lo está matando aunque el SQL de
    // arriba pase — que es exactamente el estado que nadie vio durante 7 noches.
    const runs = (await c.query(
      `SELECT count(*) FILTER (WHERE metadata->>'status'='success')::int exitos,
              count(*) FILTER (WHERE metadata->>'status'='failure')::int fallos,
              max(created_at) ultimo
         FROM observable_events
        WHERE endpoint='fraud-sweep' AND event_type='cron_run'
          AND created_at > now() - interval '3 days'`)).rows[0];
    if (Number(runs.exitos) === 0 && Number(runs.fallos) > 0) {
      fails.push(`el barrido no ha terminado bien ni una vez en 3 días (${runs.fallos} fallos, último ${runs.ultimo?.toISOString?.().slice(0, 16)})`);
    }
    console.log(`barrido últimos 3 días: ${runs.exitos} éxitos / ${runs.fallos} fallos`);

  } finally {
    // Cinturón: si algo dejó la sonda fuera de la transacción, se limpia.
    await c.query(`DELETE FROM fraud_alerts WHERE match_criteria = $1`, [MARCA]).catch(() => {});
    await c.end();
  }

  if (fails.length) {
    console.error('❌ canary fraud-sweep: el barrido antifraude se romperá');
    for (const f of fails) console.error(`   · ${f}`);
    process.exit(1);
  }
  console.log('✅ canary fraud-sweep: las formas de SQL del barrido funcionan');
})().catch((e) => { console.error('❌ canary fraud-sweep:', e.message); process.exit(1); });
