#!/usr/bin/env node
/**
 * scripts/fraude/dossier-confirmadas.cjs — SOLO LEE. No bloquea, no marca, no escribe.
 *
 * Expediente de cada señal de fraude CONFIRMADA que sigue sin acción: quién es, qué consume, desde
 * cuándo y qué pasaría si se aplicara el límite por dispositivo.
 *
 * ── POR QUÉ EXISTE (30/07/2026) ─────────────────────────────────────────────
 * Confirmar una señal la saca del badge (que cuenta las `new`), así que el trabajo de detectarla y
 * verificarla acaba enterrándola: medido hoy, **20 confirmadas sin resolver, la más antigua del
 * 21/07**, con el badge en verde. Detectar sin resolver es peor que no detectar, porque consume
 * triaje y deja la sensación de que el asunto está atendido.
 *
 * Decidir sobre una cuenta —bloquearla, limitarla o dejarla— exige saber quién hay detrás. Un
 * `alert_type` y un `device_id` no bastan: hace falta ver si esa persona estudia de verdad, si
 * paga, cuánto consume y si el patrón sigue vivo. Eso es lo que reúne este expediente.
 *
 * NO emite veredicto: los datos se presentan para que decida una persona, igual que en el resto
 * del sistema de fraude (F0 detecta, el humano decide).
 *
 * Uso:  npm run fraude:dossier            (todas las confirmadas sin acción)
 *       npm run fraude:dossier -- --json  (para tratarlo con otra herramienta)
 */
require('dotenv').config({ path: '.env.local' });
const postgres = require('postgres');

const JSON_OUT = process.argv.includes('--json');
/** Tope diario del plan free — el que se estaría saltando. */
const LIMITE_FREE = 25;

(async () => {
  const sql = postgres(process.env.DATABASE_URL, {
    max: 1, prepare: false, ssl: { rejectUnauthorized: false },
  });

  const señales = await sql`
    SELECT id, alert_type, severity, details, notes, reviewed_at, detected_at
      FROM fraud_alerts
     WHERE status = 'confirmed'
     ORDER BY detected_at`;

  // Se agrupan por DISPOSITIVO: varias señales (multicuenta + farmeo) suelen ser el mismo caso
  // visto por dos detectores, y tratarlas por separado duplica el trabajo de revisión.
  const porDispositivo = new Map();
  const sueltas = [];
  for (const s of señales) {
    const dev = s.details?.device_id;
    if (!dev) { sueltas.push(s); continue; }
    if (!porDispositivo.has(dev)) porDispositivo.set(dev, []);
    porDispositivo.get(dev).push(s);
  }

  const expedientes = [];
  for (const [device, ss] of porDispositivo) {
    const cuentas = await sql`
      SELECT p.id, p.email, p.plan_type, p.created_at::date AS alta,
             (SELECT count(*)::int FROM test_questions t
               WHERE t.user_id = p.id AND t.created_at >= NOW() - INTERVAL '7 days') AS resp7,
             (SELECT count(*)::int FROM test_questions t WHERE t.user_id = p.id) AS resp_total,
             (SELECT max(t.created_at)::date FROM test_questions t WHERE t.user_id = p.id) AS ultima,
             (SELECT COALESCE(max(u.questions_answered), 0)::int FROM daily_question_usage u
               WHERE u.user_id = p.id) AS peor_dia
        FROM user_devices ud JOIN user_profiles p ON p.id = ud.user_id
       WHERE ud.device_id = ${device}
       ORDER BY p.created_at`;

    // Consumo conjunto del dispositivo: es lo que el límite por dispositivo recortaría.
    const [conjunto] = await sql`
      WITH dia AS (
        SELECT u.usage_date, sum(u.questions_answered)::int AS total
          FROM user_devices ud JOIN daily_question_usage u ON u.user_id = ud.user_id
         WHERE ud.device_id = ${device} AND u.usage_date >= CURRENT_DATE - 30
         GROUP BY 1)
      SELECT COALESCE(max(total), 0)::int AS peor_dia,
             COALESCE(sum(total), 0)::int AS total_30d,
             COALESCE(sum(GREATEST(total - ${LIMITE_FREE}, 0)), 0)::int AS exceso_30d,
             count(*)::int AS dias_activos
        FROM dia`;

    expedientes.push({
      device,
      señales: ss.map((s) => s.alert_type),
      desde: ss[0]?.reviewed_at ?? ss[0]?.detected_at,
      cuentas,
      conjunto,
      hayPremium: cuentas.some((c) => String(c.plan_type || '').startsWith('premium')),
    });
  }

  expedientes.sort((a, b) => b.conjunto.exceso_30d - a.conjunto.exceso_30d);
  await sql.end();

  if (JSON_OUT) { console.log(JSON.stringify({ expedientes, sueltas: sueltas.length }, null, 2)); return; }

  console.log(`\n===== ${señales.length} señales confirmadas · ${expedientes.length} dispositivos · ${sueltas.length} sin dispositivo =====\n`);
  let i = 0;
  for (const e of expedientes) {
    i += 1;
    const c = e.conjunto;
    console.log(`── ${i}. dispositivo ${e.device.slice(0, 12)}…  [${[...new Set(e.señales)].join(', ')}]`);
    console.log(`   confirmada el ${e.desde ? new Date(e.desde).toISOString().slice(0, 10) : '?'} · ${e.cuentas.length} cuentas${e.hayPremium ? ' · ⚠️ INCLUYE PREMIUM' : ''}`);
    console.log(`   consumo del equipo: peor día ${c.peor_dia} · ${c.total_30d} preguntas en 30d · ${c.exceso_30d} por encima del tope · ${c.dias_activos} días activos`);
    for (const u of e.cuentas) {
      const viva = u.ultima ? `última ${u.ultima.toISOString().slice(0, 10)}` : 'sin actividad';
      console.log(`     · ${String(u.email).padEnd(34)} ${String(u.plan_type).padEnd(8)} alta ${u.alta.toISOString().slice(0, 10)} · 7d ${String(u.resp7).padStart(4)} · total ${String(u.resp_total).padStart(5)} · tope ${String(u.peor_dia).padStart(3)} · ${viva}`);
    }
    console.log('');
  }
  console.log('CÓMO LEERLO');
  console.log('  · Correos que son variantes del mismo nombre + altas escalonadas = una persona rotando cuentas.');
  console.log('  · "tope" a 25 en varias cuentas del mismo equipo = está agotando cupos en cadena.');
  console.log('  · ⚠️ INCLUYE PREMIUM = hay un cliente de pago en ese equipo: NO tocar sin mirarlo despacio.');
  console.log('  · "exceso 30d" = preguntas servidas por encima del tope; es lo que recortaría el límite');
  console.log('    por dispositivo cuando DEVICE_LIMIT_MODE pase a enforce (hoy está en shadow: solo mide).\n');
})().catch((e) => { console.error('❌', e.message); process.exit(1); });
