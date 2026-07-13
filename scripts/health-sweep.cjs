#!/usr/bin/env node
/**
 * health-sweep.cjs — barrido nocturno de SALUD (app + contenido) → tabla + email.
 *
 * Sustituye a health-digest.cjs: además de mandar el email, ESCRIBE los hallazgos en
 * content_health_findings, que leen el badge del nav y la pestaña de /admin/salud-sistema.
 * "Computa UNA vez de madrugada, todas las superficies leen el snapshot" → cero carga en
 * admin durante horas de usuarios.
 *
 * Corre en EventBridge Scheduler → ECS Fargate a las ~05:00 (Madrid). Autocontenido con
 * `pg` (la imagen standalone poda postgres-js) + `fetch` builtin.
 *
 * SEPARACIÓN app/contenido (urgencia distinta):
 *   APP (fallos, usuario topa con error) → email SIEMPRE que haya, la noche que sea.
 *   CONTENIDO (calidad, dato mal, app va) → email solo los LUNES (revisión semanal),
 *     para no fatigar (el contenido cambia despacio). El badge/panel lo ven a diario.
 *
 * Uso:
 *   DATABASE_URL=... RESEND_API_KEY=... node scripts/health-sweep.cjs
 *   DRY_RUN=1 node scripts/health-sweep.cjs        # computa + escribe tabla, imprime email, no envía
 *   NO_WRITE=1 ... node scripts/health-sweep.cjs   # no toca la tabla (solo email)
 *   FORCE_CONTENT_EMAIL=1 ...                       # fuerza el email de contenido (probar sin ser lunes)
 *
 * Env: DATABASE_URL, RESEND_API_KEY, FROM_EMAIL (info@vence.es), ALERT_EMAIL (manueltrader@gmail.com),
 *      BASE_URL (www.vence.es). Exit 0 siempre.
 */
const { Client } = require('pg');

const DB_URL = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '');
if (!DB_URL) { console.error('❌ DATABASE_URL no configurado.'); process.exit(2); }
const BASE = (process.env.BASE_URL || 'https://www.vence.es').replace(/\/$/, '');
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'manueltrader@gmail.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'info@vence.es';
const DRY = process.env.DRY_RUN === '1' || process.argv.includes('--dry');
const NO_WRITE = process.env.NO_WRITE === '1';

async function httpOnce(url) {
  try { const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 15000);
    const r = await fetch(url, { redirect: 'manual', signal: ctrl.signal, headers: { 'user-agent': 'vence-health-sweep/1.0' } });
    clearTimeout(t); return r.status;
  } catch (e) { return `ERR(${e.name || 'fetch'})`; }
}
async function httpStatus(url) { const a = await httpOnce(url); if (a === 200) return a; await new Promise(r => setTimeout(r, 1200)); return httpOnce(url); }
const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
function cardInt(n) { if (n == null) return null; const s = String(n).trim(); if (/\{\w+\}/.test(s)) return null; if (!/^[0-9][0-9.\s]*$/.test(s)) return null; const v = parseInt(s.replace(/[.\s]/g, ''), 10); return Number.isFinite(v) ? v : null; }
function cardsAbout(est, w) { if (!Array.isArray(est)) return []; const re = new RegExp(w, 'i'); return est.filter(c => c && re.test(String(c.texto || ''))); }

async function main() {
  const now = new Date();
  const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
  const isMonday = now.getUTCDay() === 1 || process.env.FORCE_CONTENT_EMAIL === '1';
  const c = new Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();

  const F = []; // {category, severity, slug, kind, message, detail}
  const add = (category, severity, slug, kind, message, detail) => F.push({ category, severity, slug, kind, message, detail: detail || null });

  const opos = (await c.query(`SELECT id, slug, landing_estadisticas, temas_count FROM oposiciones WHERE is_active = true ORDER BY slug`)).rows;

  for (const o of opos) {
    const pt = o.slug.replace(/-/g, '_');
    // ── APP: HTTP ──
    const [land, tema, test] = await Promise.all([httpStatus(`${BASE}/${o.slug}`), httpStatus(`${BASE}/${o.slug}/temario`), httpStatus(`${BASE}/${o.slug}/test`)]);
    if (land !== 200) add('app', 'error', o.slug, 'http_down', `landing /${o.slug} → ${land}`);
    if (tema !== 200) add('app', 'error', o.slug, 'http_down', `/${o.slug}/temario → ${tema}`);
    if (test !== 200) add('app', 'error', o.slug, 'http_down', `/${o.slug}/test → ${test}`);
    // ── APP: cobertura (MV, misma fuente que la app) ──
    const topics = (await c.query(`SELECT tp.topic_number, tp.disponible, COALESCE(SUM(s.total_questions),0)::int n
      FROM topics tp LEFT JOIN topic_law_question_summary s ON s.topic_id = tp.id WHERE tp.position_type = $1
      GROUP BY tp.topic_number, tp.disponible`, [pt])).rows;
    const disp = topics.filter(t => t.disponible);
    if (topics.length && disp.length === 0) add('app', 'error', o.slug, 'empty_topic', `${o.slug}: 0 temas disponibles (publicado vacío)`);
    const vacios = disp.filter(t => t.n === 0);
    if (vacios.length) add('app', 'error', o.slug, 'empty_topic', `${o.slug}: ${vacios.length} tema(s) disponible(s) SIN preguntas (T${vacios.slice(0, 5).map(v => v.topic_number).join(',T')})`);
    const finos = disp.filter(t => t.n > 0 && t.n < 6);
    if (finos.length) add('content', 'warn', o.slug, 'low_coverage', `${o.slug}: ${finos.length} tema(s) con cobertura fina (<6q)`);
    // ── CONTENIDO: artículos EN SCOPE con contenido real pero 0 preguntas ──
    // Grano más fino que low_coverage: un tema puede tener muchas preguntas EN
    // TOTAL pero artículos concretos del temario a 0 → al usuario nunca le salen
    // (caso M, SMS Tema 7, 13/07: 6 arts con contenido y 0 preguntas). Excluye
    // derogados/vacíos. Se marca a partir de 4 en un mismo tema (cluster real,
    // no cobertura parcial normal de 1-2 arts).
    const sinPreg = (await c.query(`
      SELECT tp.topic_number, count(*)::int n,
             (array_agg(l.short_name || ' ' || a.article_number ORDER BY (a.article_number)::int))[1:6] AS ejemplos
      FROM topic_scope ts
      JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
      JOIN laws l ON l.id = ts.law_id
      JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
      JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num
      WHERE tp.position_type = $1
        AND length(coalesce(a.content,'')) > 40
        AND a.content NOT ILIKE '%derogado%'
        AND NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)
      GROUP BY tp.topic_number
      HAVING count(*) >= 4
      ORDER BY tp.topic_number`, [pt])).rows;
    if (sinPreg.length) {
      const tot = sinPreg.reduce((a2, r) => a2 + r.n, 0);
      add('content', 'warn', o.slug, 'article_no_coverage',
        `${o.slug}: ${sinPreg.length} tema(s) con artículos del temario SIN preguntas (${tot} arts; p.ej. T${sinPreg[0].topic_number}: ${(sinPreg[0].ejemplos || []).join(', ')})`,
        { temas: sinPreg.map(r => ({ tema: r.topic_number, arts_sin_preguntas: r.n, ejemplos: r.ejemplos })) });
    }

    // ── CONTENIDO: coherencia de tarjetas + dual-write + hitos ──
    const nTopics = topics.length;
    if (o.temas_count != null && Number(o.temas_count) !== nTopics) add('content', 'error', o.slug, 'temas_card', `temas_count=${o.temas_count} ≠ ${nTopics} topics reales`);
    for (const card of cardsAbout(o.landing_estadisticas, 'tema')) { const v = cardInt(card.numero); if (v != null && v !== nTopics) add('content', 'error', o.slug, 'temas_card', `tarjeta "${card.texto}"=${v} pero hay ${nTopics} topics`); }
    const conv = (await c.query(`SELECT plazas_libres, plazas_discapacidad, plazas_promocion_interna, estado_proceso, boe_reference, programa_url, examen_config, landing_faqs, landing_estadisticas, landing_description
      FROM convocatorias WHERE oposicion_id = $1 AND is_current = true LIMIT 1`, [o.id])).rows[0];
    if (conv) {
      const L = Number(conv.plazas_libres || 0), D = Number(conv.plazas_discapacidad || 0), P = Number(conv.plazas_promocion_interna || 0);
      const valid = new Set([L, D, P, L + D, L + P, D + P, L + D + P].filter(x => x > 0));
      for (const card of cardsAbout(o.landing_estadisticas, 'plaza')) { const v = cardInt(card.numero); if (v != null && !valid.has(v)) add('content', 'error', o.slug, 'plaza_card', `tarjeta "${card.texto}"=${v} no cuadra con conv (L=${L} D=${D} P=${P})`); }
      const faltan = ['boe_reference', 'programa_url', 'examen_config', 'landing_faqs', 'landing_estadisticas', 'landing_description'].filter(k => conv[k] == null);
      if (faltan.length) add('content', 'warn', o.slug, 'dual_write', `dual-write convocatoria incompleto: ${faltan.join(', ')}`);
      if (conv.estado_proceso === 'inscripcion_abierta') {
        const h = Number((await c.query(`SELECT COUNT(*)::int n FROM convocatoria_hitos WHERE oposicion_id = $1`, [o.id])).rows[0].n);
        if (h === 0) add('content', 'error', o.slug, 'no_hitos', `${o.slug}: inscripción abierta pero 0 hitos (timeline vacío)`);
      }
    }
  }

  // ── APP: observable_events críticos 24h ──
  const CRIT = ['server_render_error', 'http_5xx', 'webhook_unhealthy'];
  const obs = (await c.query(`SELECT event_type, endpoint, COUNT(*)::int n, MAX(error_message) sample FROM observable_events
    WHERE severity='error' AND event_type = ANY($1) AND ts > now() - interval '24 hours' GROUP BY event_type, endpoint ORDER BY n DESC LIMIT 25`, [CRIT])).rows;
  for (const o of obs) add('app', 'error', null, o.event_type, `${o.n}× ${o.event_type} @ ${o.endpoint}${o.sample ? ' — ' + o.sample.slice(0, 80) : ''}`, { n: o.n });

  // ── CONTENIDO: tablas APLANADAS (importadas de PDF sin rejilla) ──
  // Mirror INLINE de lib/teoria/detectFlattenedTable.ts (el sweep es self-contained;
  // la imagen standalone no incluye lib/*.ts) — MANTENER EN SYNC (guardado por
  // __tests__/lib/teoria/detectFlattenedTable.test.ts). El render no puede
  // reconstruir tablas con seguridad → se detectan aquí y se arreglan por datos.
  const isCellLine = (l) => l.length > 0 && l.length <= 30 && !/[.:;]$/.test(l) && !/^([a-zñ]\)|\d{1,3}\.)/.test(l) && /[A-Za-z0-9]/.test(l);
  const STRUCTURE_RE = /\b(T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|SUBSECCI[OÓ]N|ANEXO|DISPOSICI[OÓ]N|LIBRO)\b/i;
  const detectFlattenedTable = (content) => {
    if (!content || !content.trim()) return null;
    const lines = content.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
    let best = [], run = [];
    for (const l of lines) { if (isCellLine(l)) { run.push(l); if (run.length > best.length) best = run.slice(); } else run = []; }
    if (best.length < 4) return null;
    if (STRUCTURE_RE.test(best.join(' '))) return null; // índice de estructura → no es tabla
    return best;
  };
  const flat = [];
  for (let off = 0; off <= 60000; off += 4000) {
    const rows = (await c.query(`SELECT l.slug, a.id aid, a.article_number an, a.content
      FROM articles a JOIN laws l ON a.law_id = l.id
      WHERE a.is_active AND l.is_active AND position('<' in a.content) = 0 AND length(a.content) > 200 AND a.article_number ~ '^[0-9]+$'
      ORDER BY a.id LIMIT 4000 OFFSET ${off}`)).rows;
    if (!rows.length) break;
    for (const r of rows) { const cells = detectFlattenedTable(r.content); if (cells) flat.push({ slug: r.slug, an: r.an, aid: r.aid, n: cells.length, cells: cells.slice(0, 6) }); }
  }
  if (flat.length) {
    const leyes = [...new Set(flat.map((f) => f.slug))];
    // UN finding agregado (no inundar el snapshot/email con ~140 filas). El detalle
    // por-artículo lo regenera bajo demanda la herramienta de arreglo (Fase 3).
    add('content', 'warn', null, 'flattened_table',
      `${flat.length} artículo(s) con tabla aplanada (import PDF sin rejilla) en ${leyes.length} leyes — arreglo por datos con verificación`,
      { count: flat.length, laws: leyes.length, sample: flat.slice(0, 15) });
  }

  // ── CONTENIDO: explicaciones que son NOTAS DE AUDITORÍA (defecto de pipeline) ──
  // Un pase IA anterior guardó su crítica ("La explicación debería…", "posible errata",
  // "Nota técnica:", "Esta pregunta debería anularse") COMO explicación en vez de
  // arreglarla. Se remediaron ~46 el 10/07 (36 reescritas + 10 needs_human); este
  // detector evita que reaparezcan en silencio. Patrones ALTA PRECISIÓN (se omite
  // "la explicación anterior", propenso a FP en explicaciones ya corregidas).
  const AUDIT_NOTE_PATS = ['La explicación omite', 'La explicación debería', 'La explicación actual',
    'Esta pregunta debería', 'posible errata', 'Nota técnica:', 'respuesta oficial del examen',
    'debería ser impugnada', 'debería haberse ANULADO', 'debería haber especificado'];
  const anOrs = AUDIT_NOTE_PATS.map((_, i) => `explanation ILIKE $${i + 1}`).join(' OR ');
  const anRows = (await c.query(`SELECT id FROM questions WHERE is_active = true AND (${anOrs}) LIMIT 50`,
    AUDIT_NOTE_PATS.map(p => '%' + p + '%'))).rows;
  if (anRows.length) add('content', 'warn', null, 'audit_note_explanation',
    `${anRows.length}${anRows.length >= 50 ? '+' : ''} pregunta(s) visibles con la explicación = nota de auditoría de un pase IA (reescribir o needs_human)`,
    { count: anRows.length, sample: anRows.slice(0, 15).map(r => r.id) });

  // ── CONTENIDO: leyes ANUALES caducadas dentro de un topic_scope ──
  // Mirror INLINE de lib/laws/staleDatedLaw.ts — MANTENER EN SYNC (guardado por
  // __tests__/lib/laws/staleDatedLaw.test.ts). Una ley "para el año XXXX" ya
  // pasado que sigue escopada = temario desactualizado (presupuestos anuales, que
  // se sustituyen por una ley NUEVA con otro número → invisible al monitor BOE, y
  // "correcta" para el radar de epígrafes porque encaja en la materia). ACTUALIZAR
  // a la vigente + generar preguntas, NUNCA quitar si el epígrafe la pide.
  const TARGET_YEAR_RE = /\bpara\s+(?:el\s+a[ñn]o\s+)?(\d{4})\b|\bdel\s+(?:a[ñn]o|ejercicio)\s+(\d{4})\b/i;
  const CURR_YEAR = now.getFullYear();
  const scopedLaws = (await c.query(`
    SELECT l.id, l.short_name, l.name,
      (SELECT array_agg(DISTINCT t.position_type ORDER BY t.position_type)
         FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id WHERE ts.law_id = l.id) AS oposiciones
    FROM laws l
    WHERE l.is_active = true AND EXISTS (SELECT 1 FROM topic_scope ts WHERE ts.law_id = l.id)`)).rows;
  for (const l of scopedLaws) {
    const m = (l.name || '').match(TARGET_YEAR_RE);
    const yr = m ? Number(m[1] || m[2]) : null;
    if (yr != null && yr < CURR_YEAR) {
      const opos = (l.oposiciones || []).filter(Boolean);
      add('content', 'warn', null, 'stale_dated_law',
        `${l.short_name || l.name} es del año ${yr} (caducada) y sigue en el temario de ${opos.length} oposición(es) — actualizar a la vigente y generar preguntas`,
        { law_id: l.id, year: yr, oposiciones: opos });
    }
  }

  // ── Escribir snapshot ──
  if (!NO_WRITE) {
    await c.query('TRUNCATE content_health_findings');
    for (const f of F) await c.query(`INSERT INTO content_health_findings (category, severity, oposicion_slug, kind, message, detail) VALUES ($1,$2,$3,$4,$5,$6)`, [f.category, f.severity, f.slug, f.kind, f.message, f.detail ? JSON.stringify(f.detail) : null]);
    console.log(`✅ ${stamp} — ${F.length} hallazgos escritos (app err=${F.filter(x => x.category === 'app' && x.severity === 'error').length}, content err=${F.filter(x => x.category === 'content' && x.severity === 'error').length}, content warn=${F.filter(x => x.category === 'content' && x.severity === 'warn').length})`);
  }
  await c.end();

  // ── Emails ──
  const appErr = F.filter(x => x.category === 'app' && x.severity === 'error');
  const contErr = F.filter(x => x.category === 'content' && x.severity === 'error');
  const contWarn = F.filter(x => x.category === 'content' && x.severity === 'warn');
  const line = (l, col) => `<div style="font-family:monospace;font-size:13px;color:${col}">${esc(l)}</div>`;

  // ANTI-FATIGA del email de app: dispara con fallos DEFINITIVOS (canary: endpoint
  // caído o tema publicado vacío) SIEMPRE; los 5xx/render de observable_events solo si
  // un endpoint supera el umbral (un 502/503 puntual es un blip de capacidad, no un bug).
  // TODOS los hallazgos están igualmente en la tabla → el panel/badge los ven; el filtro
  // es solo para decidir si merece EMAIL.
  const APP_OBS_MIN = Number(process.env.APP_OBS_MIN || 10);
  const appFire = appErr.filter(f => ['http_down', 'empty_topic'].includes(f.kind) || (f.detail && Number(f.detail.n) >= APP_OBS_MIN));

  // Email APP (nightly, si hay fallos que merecen alerta)
  if (appFire.length) {
    const html = `<div style="font-family:sans-serif;max-width:640px"><h2 style="color:#b91c1c">🔴 Salud de la APP — ${esc(stamp)}</h2>
      <p>Fallos donde un usuario topa con un error (actúa):</p>${appFire.map(f => line(f.message, '#b91c1c')).join('')}
      ${appErr.length > appFire.length ? `<p style="color:#6b7280;font-size:12px">(+${appErr.length - appFire.length} incidencia(s) de bajo volumen — blips — solo en el panel, no alertan.)</p>` : ''}
      <p style="color:#6b7280;font-size:12px;margin-top:20px">Panel: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a> · Contenido (calidad) va en el resumen semanal.</p></div>`;
    await sendEmail(`🔴 Vence APP: ${appFire.length} fallo(s)`, html);
  }
  // Email CONTENIDO (semanal, lunes)
  if (isMonday && (contErr.length || contWarn.length)) {
    const html = `<div style="font-family:sans-serif;max-width:640px"><h2 style="color:#a16207">🟡 Salud del CONTENIDO (semanal) — ${esc(stamp)}</h2>
      <p>Datos a revisar (la app funciona, no urgente):</p>
      ${contErr.length ? '<h3>Incoherencias (❌)</h3>' + contErr.map(f => line((f.oposicion_slug ? f.oposicion_slug + ' — ' : '') + f.message, '#b45309')).join('') : ''}
      ${contWarn.length ? `<h3>Menores (🟡) — ${contWarn.length}</h3>` + contWarn.slice(0, 20).map(f => line((f.oposicion_slug ? f.oposicion_slug + ' — ' : '') + f.message, '#a16207')).join('') + (contWarn.length > 20 ? line(`… y ${contWarn.length - 20} más`, '#a16207') : '') : ''}
      <p style="color:#6b7280;font-size:12px;margin-top:20px">Pestaña Contenido: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a></p></div>`;
    await sendEmail(`🟡 Vence contenido semanal: ${contErr.length} ❌ / ${contWarn.length} 🟡`, html);
  }
  if (!appFire.length && !(isMonday && (contErr.length || contWarn.length))) console.log(`✅ ${stamp} — sin email (app sin fallos que alerten${isMonday ? ', contenido limpio' : ', contenido va el lunes'}).`);
  process.exit(0);

  async function sendEmail(subject, html) {
    if (DRY) { console.log('=== DRY EMAIL ===\nTo:', ALERT_EMAIL, '| Subject:', subject, '\n', html.slice(0, 400), '...'); return; }
    if (!process.env.RESEND_API_KEY) { console.error('❌ Falta RESEND_API_KEY'); return; }
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: `Vence Salud <${FROM_EMAIL}>`, to: [ALERT_EMAIL], subject, html }) });
    const b = await res.json().catch(() => ({}));
    console.log(res.ok ? `✅ email enviado: ${subject} (${b.id || 'ok'})` : `❌ fallo email: ${res.status} ${JSON.stringify(b)}`);
  }
}
main().catch(e => { console.error(e?.message || e); process.exit(2); });
