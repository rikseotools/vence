#!/usr/bin/env node
/**
 * content-quality-digest.cjs — DIGEST SEMANAL de CALIDAD DE CONTENIDO (scope↔epígrafe).
 *
 * POR QUÉ EXISTE (separado del health-digest): el health-digest.cjs responde
 * "¿está VIVO y sirviendo?" (canary HTTP + errores 5xx) y es email-on-ROJO (caídas).
 * Este responde una pregunta DISTINTA: "¿el CONTENIDO es CORRECTO?" — cuánta deuda de
 * verificación scope↔epígrafe hay por oposición (comodines, sobre-scope, huecos, needs_human).
 * Eso NO es una caída, es DEUDA DE CALIDAD → NO va en la alerta roja (generaría fatiga:
 * rojo permanente). Va en su propio digest, con cadencia SEMANAL y tono informativo (azul).
 *
 * Fuente = los dos sistemas de verificación (mismos que el badge de /admin/contenido):
 *   S1 scope   → topic_scope_verification (never_verified/stale/verified_issues/needs_human)
 *   S2 epígrafe→ topic_epigrafe_verification_effective (≠ verified_literal)
 * Ver docs/runbooks/verificar-epigrafes-scope.md y lib/api/scope-verification/queries.ts.
 *
 * AUTOCONTENIDO (igual que health-digest): solo `pg` + `fetch` builtin. Corre igual en la
 * imagen ECS standalone y en local. Pensado para EventBridge Scheduler → ECS Fargate (SEMANAL).
 *
 * ANTI-FATIGA: informativo, no crítico. Solo manda email si hay deuda accionable
 * (issues + needs_human > 0); si todo está verified_correct/literal, silencio.
 *
 * Uso:
 *   DATABASE_URL=... RESEND_API_KEY=... node scripts/content-quality-digest.cjs
 *   DRY_RUN=1 DATABASE_URL=... node scripts/content-quality-digest.cjs   # imprime, no manda
 *
 * Env: DATABASE_URL, RESEND_API_KEY, FROM_EMAIL (default info@vence.es),
 *      ALERT_EMAIL (default manueltrader@gmail.com), BASE_URL (default www.vence.es).
 * Exit 0 siempre (es un reporter; el email es su salida).
 */
const { Client } = require('pg');

const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

/**
 * FUNCIÓN PURA (testeable): agrega las filas por-oposición en el reporte del digest.
 * @param {Array<{position_type:string, total:number, correct:number, issues:number,
 *          needs_human:number, stale:number, never:number, epigrafe_pending:number}>} rows
 * @param {string} stamp
 * @returns {{ hasContent:boolean, pendientesTotal:number, issuesTotal:number,
 *          needsHumanTotal:number, oposConDeuda:Array, subject:string, html:string }}
 */
function buildQualityReport(rows, stamp) {
  const opos = rows.map((r) => {
    const total = Number(r.total) || 0;
    const correct = Number(r.correct) || 0;
    const issues = Number(r.issues) || 0;
    const needs_human = Number(r.needs_human) || 0;
    const stale = Number(r.stale) || 0;
    const never = Number(r.never) || 0;
    const epigrafe_pending = Number(r.epigrafe_pending) || 0;
    // "deuda" = todo lo que NO está verificado-correcto por S1, unido a lo pendiente de S2.
    const scope_pending = issues + needs_human + stale + never;
    const deuda = scope_pending + epigrafe_pending;
    return { position_type: r.position_type, total, correct, issues, needs_human, stale, never, epigrafe_pending, scope_pending, deuda };
  });

  // Solo importa lo ACCIONABLE: issues + needs_human (never/stale son "aún sin verificar", cobertura).
  const issuesTotal = opos.reduce((a, o) => a + o.issues, 0);
  const needsHumanTotal = opos.reduce((a, o) => a + o.needs_human, 0);
  const pendientesTotal = opos.reduce((a, o) => a + o.deuda, 0);

  // Ordena: primero las que tienen issues/needs_human (deuda accionable), luego por deuda total.
  const accionables = opos
    .filter((o) => o.issues > 0 || o.needs_human > 0)
    .sort((a, b) => (b.issues + b.needs_human) - (a.issues + a.needs_human) || b.deuda - a.deuda);

  const hasContent = issuesTotal > 0 || needsHumanTotal > 0;
  // Cobertura: oposiciones aún SIN tocar (0 verificados de cualquier tipo) — contexto, no alarma.
  const sinVerificar = opos.filter((o) => o.correct === 0 && o.issues === 0 && o.needs_human === 0 && o.stale === 0).length;

  const subject = `📋 Vence calidad de contenido — ${issuesTotal} issues + ${needsHumanTotal} needs_human en ${accionables.length} oposiciones`;

  const row = (o) => {
    const bits = [];
    if (o.issues) bits.push(`<span style="color:#b45309">⚠️ ${o.issues} issues</span>`);
    if (o.needs_human) bits.push(`<span style="color:#7c3aed">🚨 ${o.needs_human} needs_human</span>`);
    if (o.epigrafe_pending) bits.push(`<span style="color:#6b7280">📄 ${o.epigrafe_pending} epígrafe</span>`);
    return `<tr>
      <td style="padding:4px 10px 4px 0;font-family:monospace;font-size:13px">${esc(o.position_type)}</td>
      <td style="padding:4px 10px 4px 0;font-size:13px">${bits.join(' · ')}</td>
      <td style="padding:4px 0;font-size:12px;color:#6b7280">${o.correct}/${o.total} ✓</td>
    </tr>`;
  };

  let html = `<div style="font-family:sans-serif;max-width:680px">
    <h2 style="color:#2563eb">📋 Calidad de contenido — ${esc(stamp)}</h2>
    <p style="color:#374151;font-size:14px">Deuda de verificación <b>scope↔epígrafe</b> (NO es una caída — es calidad de temario). Resumen semanal.</p>
    <p style="font-size:14px"><b>${issuesTotal}</b> issues (bugs de scope) · <b>${needsHumanTotal}</b> needs_human (tu decisión) · en <b>${accionables.length}</b> oposiciones.</p>`;
  if (accionables.length) {
    html += `<table style="border-collapse:collapse;margin-top:8px">${accionables.map(row).join('')}</table>`;
  }
  html += `<p style="color:#6b7280;font-size:13px;margin-top:12px">Cobertura: <b>${sinVerificar}</b> oposiciones aún sin verificar (nunca pasadas por el pipeline). Ver <code>npm run audit:scope-verification</code>.</p>`;
  html += `<p style="color:#6b7280;font-size:12px;margin-top:16px">
    Badge en <a href="https://www.vence.es/admin/contenido">/admin/contenido</a> · Curar: <code>npm run verify:scope status &lt;position_type&gt;</code> · Runbook: docs/runbooks/verificar-epigrafes-scope.md · Generado por content-quality-digest (EventBridge→ECS, semanal).
    </p></div>`;

  return { hasContent, pendientesTotal, issuesTotal, needsHumanTotal, sinVerificar, oposConDeuda: accionables, subject, html };
}

async function fetchRows(c) {
  // Mismo criterio que getScopeVerificationCount, pero AGRUPADO por position_type.
  return (await c.query(`
    SELECT t.position_type,
      count(*)::int AS total,
      count(*) FILTER (WHERE coalesce(sv.state,'never_verified') = 'verified_correct')::int AS correct,
      count(*) FILTER (WHERE coalesce(sv.state,'never_verified') = 'verified_issues')::int AS issues,
      count(*) FILTER (WHERE coalesce(sv.state,'never_verified') = 'needs_human')::int AS needs_human,
      count(*) FILTER (WHERE coalesce(sv.state,'never_verified') = 'stale')::int AS stale,
      count(*) FILTER (WHERE coalesce(sv.state,'never_verified') = 'never_verified')::int AS never,
      count(*) FILTER (WHERE coalesce(ev.effective_state,'never_sourced') <> 'verified_literal')::int AS epigrafe_pending
    FROM topics t
    LEFT JOIN topic_scope_verification sv ON sv.topic_id = t.id
    LEFT JOIN topic_epigrafe_verification_effective ev ON ev.topic_id = t.id
    WHERE t.is_active
    GROUP BY t.position_type
    ORDER BY t.position_type
  `)).rows;
}

async function main() {
  const DB_URL = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '');
  if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }
  const ALERT_EMAIL = process.env.ALERT_EMAIL || 'manueltrader@gmail.com';
  const FROM_EMAIL = process.env.FROM_EMAIL || 'info@vence.es';
  const DRY = process.env.DRY_RUN === '1' || process.argv.includes('--dry');
  const stamp = new Date().toISOString().slice(0, 10);

  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  let rows;
  try { rows = await fetchRows(c); } finally { await c.end(); }

  const report = buildQualityReport(rows, stamp);

  if (!report.hasContent) {
    console.log(`✅ ${stamp} — sin deuda accionable de contenido (0 issues, 0 needs_human). Silencio.`);
    process.exit(0);
  }
  if (DRY) {
    console.log('=== DRY RUN ===\nTo:', ALERT_EMAIL, '| Subject:', report.subject, '\n', report.html);
    process.exit(0);
  }
  if (!process.env.RESEND_API_KEY) { console.error('❌ Falta RESEND_API_KEY.'); process.exit(2); }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: `Vence Calidad <${FROM_EMAIL}>`, to: [ALERT_EMAIL], subject: report.subject, html: report.html }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) console.log(`✅ ${stamp} — digest de calidad enviado a ${ALERT_EMAIL} (${body.id || 'ok'})`);
  else console.error(`❌ fallo email: ${res.status} ${JSON.stringify(body)}`);
  process.exit(0);
}

module.exports = { buildQualityReport };

if (require.main === module) {
  main().catch((e) => { console.error(e?.message || e); process.exit(2); });
}
