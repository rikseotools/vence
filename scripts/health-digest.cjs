#!/usr/bin/env node
/**
 * health-digest.cjs — CAPA DE ENTREGA de alertas de salud (la "Fase 2" que faltaba).
 *
 * POR QUÉ EXISTE: toda la observabilidad era PULL (había que abrir /admin/salud-sistema).
 * Ninguna señal de salud llegaba al email de Manuel. Este job cierra ese hueco: corre
 * los canaries, lee observable_events, y si hay algo CRÍTICO manda UN email-digest.
 * Pensado para EventBridge Scheduler → ECS Fargate (diario), mismo patrón que
 * vence-content-radar. AWS-native by default, agnóstico by contract.
 *
 * ANTI-FATIGA (lección de las alertas de auth): el email SOLO se dispara por señales
 * CRÍTICAS (usuarios topando con errores): canary HTTP≠200, temas vacíos, y en
 * observable_events server_render_error / http_5xx / webhook_unhealthy (últimas 24h).
 * Las incoherencias de datos (tarjetas de plazas/temas — CALIDAD, no user-facing) van
 * como FYI dentro del email pero NO lo disparan solas → si solo hay calidad, silencio.
 *
 * Uso:
 *   node scripts/health-digest.cjs           # evalúa y, si hay crítico, envía email
 *   DRY_RUN=1 node scripts/health-digest.cjs  # evalúa e imprime el email, NO lo manda
 *
 * Env: DATABASE_URL, RESEND_API_KEY, FROM_EMAIL (default info@vence.es),
 *      ALERT_EMAIL (default manueltrader@gmail.com), BASE_URL (default www.vence.es).
 * Exit 0 siempre (es un reporter; el email es su salida, no el exit code).
 */
const { spawnSync } = require('child_process');
const path = require('path');
const postgres = require('postgres');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'manueltrader@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@vence.es';
const DRY = process.env.DRY_RUN === '1' || process.argv.includes('--dry');
const sql = postgres(DB_URL, { prepare: false, max: 4, idle_timeout: 20, connect_timeout: 10, ssl: 'require', onnotice: () => {} });

// Corre un script hijo y devuelve { code, out, redLines }.
function runScript(rel) {
  const r = spawnSync('node', [path.join(__dirname, rel)], { encoding: 'utf8', timeout: 280000, env: process.env });
  const out = (r.stdout || '') + (r.stderr || '');
  const redLines = out.split('\n').filter(l => l.includes('❌'));
  return { code: r.status == null ? 2 : r.status, out, redLines };
}

const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function main() {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

  // 1) Canaries (subprocesos). Canary exit≠0 = CRÍTICO (HTTP≠200 o tema vacío).
  const canary = runScript('canary-oposiciones-live.cjs');
  const coher = runScript('audit-oposiciones-coherencia.cjs'); // ❌ aquí = CALIDAD (FYI), no dispara

  // 2) observable_events: señales críticas últimas 24h.
  const CRIT_EVENTS = ['server_render_error', 'http_5xx', 'webhook_unhealthy'];
  const obs = await sql`
    SELECT event_type, endpoint, COUNT(*)::int AS n, MAX(error_message) AS sample
    FROM observable_events
    WHERE severity = 'error' AND event_type = ANY(${CRIT_EVENTS})
      AND ts > now() - interval '24 hours'
    GROUP BY event_type, endpoint
    ORDER BY n DESC LIMIT 25`;

  // 3) ¿hay CRÍTICO?
  const canaryCrit = canary.code !== 0 && canary.redLines.length > 0;
  const obsCrit = obs.length > 0;
  const isCritical = canaryCrit || obsCrit;

  const nQuality = coher.redLines.length;

  if (!isCritical) {
    console.log(`✅ ${stamp} — sin señales críticas. ${nQuality} incoherencias de calidad (no disparan email).`);
    await sql.end();
    process.exit(0);
  }

  // 4) Componer email
  const line = (l) => `<div style="font-family:monospace;font-size:13px;color:#b91c1c">${esc(l.trim())}</div>`;
  let html = `<div style="font-family:sans-serif;max-width:640px">
    <h2 style="color:#b91c1c">🔴 Salud del sistema — ${esc(stamp)}</h2>`;

  if (canaryCrit) {
    html += `<h3>Canary de oposiciones (usuarios topando con errores)</h3>${canary.redLines.map(line).join('')}`;
  }
  if (obsCrit) {
    html += `<h3>Errores en producción (observable_events, 24h)</h3>`;
    html += obs.map(o => line(`${o.n}× ${o.event_type} @ ${o.endpoint}${o.sample ? ' — ' + o.sample.slice(0, 80) : ''}`)).join('');
  }
  if (nQuality > 0) {
    html += `<h3 style="color:#a16207">🟡 Calidad de datos (no urgente, FYI)</h3>
      <div style="font-family:monospace;font-size:13px;color:#a16207">${nQuality} incoherencia(s) de tarjetas. Detalle: <code>npm run audit:coherencia</code></div>`;
  }
  html += `<p style="color:#6b7280;font-size:12px;margin-top:20px">Panel: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a> · Generado por health-digest (EventBridge→ECS).</p></div>`;

  const subject = `🔴 Vence salud: ${canaryCrit ? canary.redLines.length + ' canary' : ''}${canaryCrit && obsCrit ? ' + ' : ''}${obsCrit ? obs.reduce((a, o) => a + o.n, 0) + ' errores prod' : ''}`;

  if (DRY) {
    console.log('=== DRY RUN — email que se enviaría ===');
    console.log('To:', ALERT_EMAIL, '| Subject:', subject);
    console.log(html);
    await sql.end();
    process.exit(0);
  }

  if (!process.env.RESEND_API_KEY) { console.error('❌ Falta RESEND_API_KEY para enviar.'); await sql.end(); process.exit(2); }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Vence Salud <${FROM_EMAIL}>`, to: [ALERT_EMAIL], subject, html }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) console.log(`✅ ${stamp} — email de alerta enviado a ${ALERT_EMAIL} (${body.id || 'ok'})`);
  else console.error(`❌ fallo al enviar email: ${res.status} ${JSON.stringify(body)}`);

  await sql.end();
  process.exit(0);
}

main().catch(e => { console.error(e?.message || e); process.exit(2); });
