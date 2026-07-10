#!/usr/bin/env node
/**
 * health-digest.cjs — CAPA DE ENTREGA de alertas de salud (la "Fase 2" que faltaba).
 *
 * POR QUÉ EXISTE: toda la observabilidad era PULL (había que abrir /admin/salud-sistema).
 * Ninguna señal de salud llegaba al email de Manuel. Este job cierra ese hueco: hace
 * los checks de salud, lee observable_events, y si hay algo CRÍTICO manda UN email-digest.
 * Corre en EventBridge Scheduler → ECS Fargate (diario), mismo patrón que vence-content-radar.
 *
 * AUTOCONTENIDO A PROPÓSITO: usa solo `pg` (presente en la imagen standalone del frontend,
 * a diferencia de `postgres`/postgres-js que Next poda) + `fetch` (builtin node ≥18). NO
 * spawnea los CLIs canary/coherencia (que usan postgres-js) → así corre igual en la imagen
 * ECS y en local. Los checks HTTP + cobertura van inline (mismo criterio que canary:oposiciones).
 *
 * ANTI-FATIGA (lección de las alertas de auth): el email SOLO se dispara por señales
 * CRÍTICAS (usuarios topando con errores): canary HTTP≠200, temas disponibles vacíos, y en
 * observable_events server_render_error / http_5xx / webhook_unhealthy (últimas 24h).
 *
 * Uso:
 *   DATABASE_URL=... RESEND_API_KEY=... node scripts/health-digest.cjs
 *   DRY_RUN=1 DATABASE_URL=... node scripts/health-digest.cjs   # imprime el email, no lo manda
 *
 * Env: DATABASE_URL, RESEND_API_KEY, FROM_EMAIL (default info@vence.es),
 *      ALERT_EMAIL (default manueltrader@gmail.com), BASE_URL (default www.vence.es).
 * Exit 0 siempre (es un reporter; el email es su salida).
 */
const { Client } = require('pg');

const DB_URL = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '');
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }
const BASE = (process.env.BASE_URL || 'https://www.vence.es').replace(/\/$/, '');
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'manueltrader@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@vence.es';
const DRY = process.env.DRY_RUN === '1' || process.argv.includes('--dry');

async function httpOnce(url) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'vence-health-digest/1.0' } });
    clearTimeout(t);
    return r.status;
  } catch (e) { return `ERR(${e.name || 'fetch'})`; }
}
async function httpStatus(url) { // retry-once anti-flaky
  const a = await httpOnce(url);
  if (a === 200) return a;
  await new Promise(r => setTimeout(r, 1200));
  return httpOnce(url);
}
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

async function main() {
  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const critical = []; // strings user-facing

  // 1) CANARY inline: cada oposición is_active → landing+temario+test 200 + temas disponibles sirven preguntas.
  const opos = (await c.query(`SELECT slug FROM oposiciones WHERE is_active = true ORDER BY slug`)).rows;
  for (const o of opos) {
    const pt = o.slug.replace(/-/g, '_');
    const [land, tema, test] = await Promise.all([
      httpStatus(`${BASE}/${o.slug}`), httpStatus(`${BASE}/${o.slug}/temario`), httpStatus(`${BASE}/${o.slug}/test`),
    ]);
    if (land !== 200) critical.push(`landing /${o.slug} → ${land}`);
    if (tema !== 200) critical.push(`/${o.slug}/temario → ${tema}`);
    if (test !== 200) critical.push(`/${o.slug}/test → ${test}`);
    // cobertura: MV topic_law_question_summary (misma fuente que la app)
    const rows = (await c.query(
      `SELECT tp.topic_number, COALESCE(SUM(s.total_questions),0)::int AS n, tp.disponible
       FROM topics tp LEFT JOIN topic_law_question_summary s ON s.topic_id = tp.id
       WHERE tp.position_type = $1 GROUP BY tp.topic_number, tp.disponible`, [pt])).rows;
    const disp = rows.filter(r => r.disponible);
    if (rows.length && disp.length === 0) critical.push(`${o.slug}: 0 temas disponibles (publicado vacío)`);
    const vacios = disp.filter(r => r.n === 0);
    if (vacios.length) critical.push(`${o.slug}: ${vacios.length} tema(s) disponible(s) SIN preguntas (T${vacios.slice(0, 5).map(v => v.topic_number).join(',T')})`);
  }

  // 2) observable_events: errores críticos últimas 24h.
  const CRIT = ['server_render_error', 'http_5xx', 'webhook_unhealthy'];
  const obs = (await c.query(
    `SELECT event_type, endpoint, COUNT(*)::int AS n, MAX(error_message) AS sample
     FROM observable_events
     WHERE severity = 'error' AND event_type = ANY($1) AND ts > now() - interval '24 hours'
     GROUP BY event_type, endpoint ORDER BY n DESC LIMIT 25`, [CRIT])).rows;

  await c.end();

  const isCritical = critical.length > 0 || obs.length > 0;
  if (!isCritical) {
    console.log(`✅ ${stamp} — sin señales críticas. Silencio (no email).`);
    process.exit(0);
  }

  // 3) Componer email
  const line = (l) => `<div style="font-family:monospace;font-size:13px;color:#b91c1c">${esc(l)}</div>`;
  let html = `<div style="font-family:sans-serif;max-width:640px"><h2 style="color:#b91c1c">🔴 Salud del sistema — ${esc(stamp)}</h2>`;
  if (critical.length) html += `<h3>Canary de oposiciones (usuarios topando con errores)</h3>${critical.map(line).join('')}`;
  if (obs.length) {
    html += `<h3>Errores en producción (observable_events, 24h)</h3>`;
    html += obs.map(o => line(`${o.n}× ${o.event_type} @ ${o.endpoint}${o.sample ? ' — ' + o.sample.slice(0, 80) : ''}`)).join('');
  }
  html += `<p style="color:#6b7280;font-size:12px;margin-top:20px">Panel: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a> · Calidad de datos (no urgente): <code>npm run audit:coherencia</code> · Generado por health-digest (EventBridge→ECS).</p></div>`;
  const subject = `🔴 Vence salud: ${critical.length ? critical.length + ' canary' : ''}${critical.length && obs.length ? ' + ' : ''}${obs.length ? obs.reduce((a, o) => a + o.n, 0) + ' errores prod' : ''}`;

  if (DRY) {
    console.log('=== DRY RUN ===\nTo:', ALERT_EMAIL, '| Subject:', subject, '\n', html);
    process.exit(0);
  }
  if (!process.env.RESEND_API_KEY) { console.error('❌ Falta RESEND_API_KEY.'); process.exit(2); }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Vence Salud <${FROM_EMAIL}>`, to: [ALERT_EMAIL], subject, html }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) console.log(`✅ ${stamp} — email de alerta enviado a ${ALERT_EMAIL} (${body.id || 'ok'})`);
  else console.error(`❌ fallo email: ${res.status} ${JSON.stringify(body)}`);
  process.exit(0);
}
main().catch(e => { console.error(e?.message || e); process.exit(2); });
