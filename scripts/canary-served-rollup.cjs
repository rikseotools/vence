#!/usr/bin/env node
// scripts/canary-served-rollup.cjs
//
// CANARY de LIVENESS de la medición anti-cosecha.
//
// POR QUÉ EXISTE: `daily_questions_served` es la base de toda la detección de
// scraping del banco (ratio respondidas/servidas). Si el writer deja de escribir
// —flag apagado, módulo que no carga, migración perdida, regresión de bundling—
// los detectores siguen corriendo, no encuentran nada, y el panel enseña una lista
// vacía. Eso NO se distingue de "no hay cosechadores": es el falso verde clásico.
// Nadie se entera hasta que un usuario nos avisa, que es exactamente el fallo que
// la filosofía de observabilidad del repo prohíbe.
//
// Dos aserciones, que cubren dos averías distintas:
//   1. FRESCURA — hay filas de las últimas FRESH_HOURS horas. Si no, el writer
//      está muerto (o no hay tráfico, ver nota de abajo).
//   2. COHERENCIA — se escriben los sujetos que `gateSubjects()` produce. Si solo
//      aparecen usuarios y nunca dispositivos, el `x-device-id` dejó de llegar y
//      perdemos el ancla que caza al que rota IP o cuentas.
//
// NO comprueba el camino de escritura sintéticamente (no inventa filas): mide el
// tráfico REAL. Por eso está pensado para correr en horario con actividad; con la
// plataforma parada de madrugada un cero es legítimo, y por eso la ventana por
// defecto es de 24 h y no de una hora.
//
// Uso: node scripts/canary-served-rollup.cjs          (carga .env.local si está)
//      SERVED_CANARY_FRESH_HOURS=24 SERVED_CANARY_MIN_ROWS=1
// Exit 0 = verde; exit 1 = la medición no está viva.

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
} catch { /* sin .env.local: se espera DATABASE_URL en el entorno */ }

const DB_URL = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '');
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }

const FRESH_HOURS = Number(process.env.SERVED_CANARY_FRESH_HOURS) || 24;
const MIN_ROWS = Number(process.env.SERVED_CANARY_MIN_ROWS) || 1;

(async () => {
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false }, statement_timeout: 30000 });
  await c.connect();
  const fails = [];
  let stats = null;

  try {
    // La tabla tiene que existir: si una migración se perdió en el despliegue, el
    // writer falla en cada request y solo lo cuenta `served_rollup_write_failed`.
    const exists = (await c.query(
      `SELECT to_regclass('public.daily_questions_served') IS NOT NULL AS ok`
    )).rows[0].ok;
    if (!exists) {
      console.error('❌ canary served-rollup: la tabla daily_questions_served NO existe (¿migración sin aplicar?)');
      process.exit(1);
    }

    stats = (await c.query(
      `SELECT count(*)::int AS filas,
              count(*) FILTER (WHERE subject_kind = 'user')::int   AS usuarios,
              count(*) FILTER (WHERE subject_kind = 'device')::int  AS dispositivos,
              count(*) FILTER (WHERE subject_kind = 'ip')::int      AS ips,
              coalesce(sum(served), 0)::int AS servidas,
              max(updated_at) AS ultima
         FROM daily_questions_served
        WHERE updated_at > now() - ($1 || ' hours')::interval`,
      [String(FRESH_HOURS)]
    )).rows[0];

    // 1) Frescura
    if (stats.filas < MIN_ROWS) {
      fails.push(`sin filas en ${FRESH_HOURS}h (mínimo ${MIN_ROWS}) → el writer de servidas no está escribiendo`);
    }

    // 2) Coherencia de sujetos. Solo se exige si hay volumen: con 3 filas sueltas
    // que falte el dispositivo no prueba nada.
    if (stats.filas >= 20 && stats.dispositivos === 0) {
      fails.push('hay filas de usuario pero NINGUNA de dispositivo → el header x-device-id dejó de llegar (se pierde el ancla anti-rotación)');
    }

    // 3) ¿Se está denunciando algún fallo del propio writer?
    const rotos = (await c.query(
      `SELECT event_type, count(*)::int n FROM observable_events
        WHERE event_type IN ('served_rollup_write_failed','served_rollup_module_failed','fraud_detection_blind')
          AND created_at > now() - ($1 || ' hours')::interval
        GROUP BY 1`, [String(FRESH_HOURS)]
    )).rows;
    for (const r of rotos) fails.push(`${r.n} evento(s) ${r.event_type} en ${FRESH_HOURS}h`);

  } finally {
    await c.end();
  }

  console.log(`servidas ${FRESH_HOURS}h: ${stats.filas} filas (${stats.usuarios} usuario / ${stats.dispositivos} dispositivo / ${stats.ips} ip), ${stats.servidas} preguntas, última ${stats.ultima || 'nunca'}`);
  if (fails.length) {
    console.error('❌ canary served-rollup: la medición anti-cosecha NO está viva');
    for (const f of fails) console.error(`   · ${f}`);
    process.exit(1);
  }
  console.log('✅ canary served-rollup: la medición anti-cosecha está viva');
})().catch(e => { console.error('❌ canary served-rollup:', e.message); process.exit(1); });
