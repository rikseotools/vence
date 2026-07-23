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

  // ── CONTENIDO: leyes NO verificadas contra su fuente oficial (falso verde) ──
  // Mirror INLINE de lib/laws/completeness.ts — MANTENER EN SYNC (guardado por
  // __tests__/lib/laws/completeness.test.ts). Una ley importada a medias, sin
  // fuente, o marcada "actualizada" sin evidencia (falso verde) es invisible al
  // monitor BOE (que solo parsea el BOE consolidado). Caso ULE T18: 9 de 74 arts,
  // boe_url NULL, verification_status='actualizada' sin summary → lo cazó una
  // usuaria, no nosotros. Solo se cuentan las que SIRVEN en temas vivos (impacto).
  const classifyLaw = (isVirtual, boeUrl, status, su) => {
    const hasSource = !!(boeUrl && String(boeUrl).trim());
    const claims = ['actualizada', 'verificada'].includes((status || '').toLowerCase());
    if (isVirtual === true) return null;
    if (!su) {
      if (claims) return 'false_green';
      if (!hasSource) return 'no_source';
      return 'never_verified';
    }
    if (su.no_consolidated_text === true || su.historical === true || su.deliberate_subset === true) return null;
    const nn = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
    const boe = nn(su.boe_count), db = nn(su.db_count);
    const missing = nn(su.missing_in_db) ?? (boe != null && db != null ? Math.max(0, boe - db) : null);
    if (missing != null && missing > 0) return 'incomplete';
    if ((nn(su.content_mismatch) ?? 0) > 0 || (nn(su.title_mismatch) ?? 0) > 0) return 'issues';
    return null;
  };
  const lawRows = (await c.query(`
    SELECT l.id, l.short_name, l.name, l.scope, l.is_virtual, l.boe_url,
           l.verification_status, l.last_verification_summary AS su,
           EXISTS (SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
                   WHERE ts.law_id = l.id AND t.disponible) AS serving_live
    FROM laws l`)).rows;
  const unverified = [];
  for (const l of lawRows) {
    const st = classifyLaw(l.is_virtual, l.boe_url, l.verification_status, l.su);
    if (st && l.serving_live) unverified.push({ id: l.id, name: l.short_name || l.name, scope: l.scope, state: st });
  }
  if (unverified.length) {
    const byState = unverified.reduce((a, u) => ((a[u.state] = (a[u.state] || 0) + 1), a), {});
    add('content', 'warn', null, 'law_unverified_source',
      `${unverified.length} ley(es) sirviendo en temas vivos SIN verificar contra su fuente oficial (${Object.entries(byState).map(([k, v]) => `${k}:${v}`).join(', ')}) — importadas a medias o falso verde`,
      { count: unverified.length, byState, sample: unverified.slice(0, 20) });
  }

  // ── CONTENIDO: TÍTULOS HUÉRFANOS del temario (hueco INTERNO del topic_scope) ──
  // Un título de una ley que la oposición SÍ usa, con preguntas activas, con 0
  // artículos escopados en NINGÚN tema de esa oposición, Y flanqueado a ambos lados
  // por artículos escopados de la misma ley (hueco INTERNO, no un recorte de borde).
  // Es el punto ciego entre la detección ley-entera (audit-epigrafe: la ley SÍ está
  // en el scope, no salta UNDER) y la tema-servido (empty_topic/low_coverage: el tema
  // tiene cientos de preguntas por OTROS títulos, sale verde). Caso raíz 19/07: CE
  // Título V (108-116) huérfano en Diputación Córdoba → 186 preguntas sin practicar,
  // pese a que el epígrafe del Tema 2 nombra "Relaciones entre el Gobierno y las Cortes
  // Generales". Prefiltro DETERMINISTA: la adjudicación (hueco REAL vs título fuera de
  // programa) la hace el pipeline LLM verify:scope leyendo el epígrafe (frase-gatillo
  // "revisa los huecos del temario" → docs/runbooks/verificar-epigrafes-scope.md).
  const SCOPE_GAP_MIN_Q = Number(process.env.SCOPE_GAP_MIN_Q || 8);
  const titSecs = (await c.query(`SELECT ls.law_id, l.short_name, ls.section_number, ls.article_range_start lo, ls.article_range_end hi
    FROM law_sections ls JOIN laws l ON l.id = ls.law_id
    WHERE ls.section_type = 'titulo' AND ls.article_range_start IS NOT NULL AND ls.article_range_end IS NOT NULL`)).rows;
  const scopeAll = (await c.query(`SELECT t.position_type pt, ts.law_id, ts.article_numbers
    FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id WHERE ts.article_numbers IS NOT NULL AND t.is_active`)).rows;
  const qAll = (await c.query(`SELECT a.law_id, a.article_number an, count(DISTINCT q.id)::int n
    FROM questions q JOIN articles a ON a.id = q.primary_article_id
    WHERE q.is_active AND a.article_number ~ '^[0-9]+$' GROUP BY a.law_id, a.article_number`)).rows;
  const scopedByPtLaw = new Map(); // "pt|law_id" → Set(int) — art 0 (fabricado) excluido
  for (const r of scopeAll) {
    const k = r.pt + '|' + r.law_id; let set = scopedByPtLaw.get(k); if (!set) scopedByPtLaw.set(k, set = new Set());
    for (const a of (r.article_numbers || [])) { const n = parseInt(a); if (!isNaN(n) && n > 0) set.add(n); }
  }
  const qByLawArt = new Map();
  for (const r of qAll) qByLawArt.set(r.law_id + '|' + parseInt(r.an), r.n);
  const secsByLaw = new Map();
  for (const sc of titSecs) { let arr = secsByLaw.get(sc.law_id); if (!arr) secsByLaw.set(sc.law_id, arr = []); arr.push(sc); }
  const scopeGaps = [];
  for (const [k, scoped] of scopedByPtLaw) {
    if (scoped.size === 0) continue;
    const bar = k.lastIndexOf('|'); const pt = k.slice(0, bar); const lawId = k.slice(bar + 1);
    const secs = secsByLaw.get(lawId); if (!secs) continue;
    const smin = Math.min(...scoped), smax = Math.max(...scoped);
    for (const sc of secs) {
      let q = 0, anyScoped = false;
      for (let i = sc.lo; i <= sc.hi; i++) { q += (qByLawArt.get(lawId + '|' + i) || 0); if (scoped.has(i)) anyScoped = true; }
      if (q >= SCOPE_GAP_MIN_Q && !anyScoped && smin < sc.lo && smax > sc.hi)
        scopeGaps.push({ pt, ley: sc.short_name, titulo: sc.section_number, rango: `${sc.lo}-${sc.hi}`, preguntas: q });
    }
  }
  if (scopeGaps.length) {
    scopeGaps.sort((a, b) => b.preguntas - a.preguntas);
    const nOpos = new Set(scopeGaps.map(g => g.pt)).size;
    add('content', 'warn', null, 'scope_titulo_huerfano',
      `${scopeGaps.length} título(s) con preguntas huérfanas (hueco INTERNO del scope) en ${nOpos} oposición(es) — el epígrafe puede pedirlos; adjudicar con verify:scope`,
      { count: scopeGaps.length, oposiciones: nOpos, sample: scopeGaps.slice(0, 20) });
  }

  // ── CONTENIDO: ARTÍCULOS FANTASMA del scope (integridad referencial) ──
  // Un número en topic_scope.article_numbers que NO tiene fila ACTIVA en articles
  // (mismo law_id). El scope lo "pide" pero no hay artículo servible → 0 preguntas y
  // 0 teoría, EN SILENCIO. Dos causas, ambas invisibles: `inexistente` (no hay fila:
  // article_numbers es text[] denormalizado, no FK, nada garantiza la existencia) y
  // `desactivado` (la fila existe pero is_active=false → aunque tenga preguntas activas,
  // no se sirven). Punto ciego del verificador epígrafe↔scope (razona sobre MATERIA/rangos,
  // no existencia por-artículo — da CORRECT dando por cubierto el artículo que falta) y del
  // detector de filas rotas (solo caza '{}'). Casos raíz 21/07 (los cazó una usuaria):
  // LPRL art 3 INEXISTENTE en administrativa_universidad_de_murcia, y LPRL art 3
  // DESACTIVADO (con 38 preguntas) en auxiliar_administrativo_sms. Se SEPARA por boe_url:
  // ley real (con BOE) = accionable (importar/reactivar/recortar); virtual/ofimática (sin
  // BOE) = variante mal (· Escritorio/Web, dedupe Office) → CONTEXTO en el detail, no alarma
  // aparte. Solo refs de artículo reales (`^\d+( bis| ter)?$`), excluye notas coladas.
  const phantom = (await c.query(`
    WITH refs AS (
      SELECT DISTINCT ts.law_id, l.short_name, l.name, (l.boe_url IS NOT NULL) AS has_boe, trim(an) AS art
      FROM topic_scope ts
      JOIN topics t ON t.id = ts.topic_id
      JOIN laws l ON l.id = ts.law_id
      CROSS JOIN LATERAL unnest(ts.article_numbers) AS an
      WHERE ts.article_numbers IS NOT NULL AND t.is_active = true
    )
    SELECT coalesce(r.short_name, r.name) AS ley, r.has_boe, r.art,
           CASE WHEN NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND a.article_number = r.art)
                THEN 'inexistente' ELSE 'desactivado' END AS causa
    FROM refs r
    WHERE r.art ~ '^[0-9]+( bis| ter)?$'
      AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND a.article_number = r.art AND a.is_active)`)).rows;
  if (phantom.length) {
    const real = phantom.filter(p => p.has_boe);
    const virt = phantom.filter(p => !p.has_boe);
    const leyesReal = [...new Set(real.map(p => p.ley))];
    const inex = real.filter(p => p.causa === 'inexistente').length;
    const desact = real.filter(p => p.causa === 'desactivado').length;
    if (real.length) add('content', 'warn', null, 'scope_phantom_article',
      `${real.length} artículo(s) escopado(s) que NO sirven (0 preguntas/teoría en silencio) en ${leyesReal.length} ley(es): ${inex} inexistente(s) + ${desact} desactivado(s) — importar del BOE / reactivar / o recortar el scope si la ley no lo tiene`,
      { count: real.length, laws: leyesReal.length, inexistentes: inex, desactivados: desact, virtual_ofimatica: virt.length, sample: real.slice(0, 25).map(p => ({ ley: p.ley, art: p.art, causa: p.causa })) });
  }

  // ── CONTENIDO: SOBRE-INCLUSIÓN de topic_scope (epígrafe enumera, scope = ley entera) ──
  // Mirror INLINE de lib/laws/scopeOverInclusion.ts — MANTENER EN SYNC (guardado por
  // __tests__/lib/laws/scopeOverInclusion.test.ts). El epígrafe enumera sub-materias
  // CONCRETAS pero el scope mete casi TODA la ley → sirve muchas preguntas fuera de
  // programa. Punto ciego doble: los detectores de HUECOS no lo ven (el tema rebosa)
  // y verify:scope lo dio en FALSO VERDE (caso Luisa/SMS T11, 21/07). Filtro Stage-1
  // determinista; el límite fino lo adjudica verify:scope. Sólo se emite la banda HIGH
  // (título con hueco / arts citados = precisión alta); la MEDIUM (patrón T11, prosa)
  // tiene recall alto pero precisión ~35% → NO pinga el badge para no criar lobos.
  const romanToInt = (s) => { s = s.toUpperCase().replace(/\.BIS$/, ''); const R = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }; let n = 0; for (let i = 0; i < s.length; i++) { const cur = R[s[i]], nxt = R[s[i + 1]]; if (cur == null) return null; n += (nxt && cur < nxt) ? -cur : cur; } return n; };
  const classifyScope = (lawTotal, scopedCount, ep) => {
    ep = ep || ''; const coverage = lawTotal > 0 ? scopedCount / lawTotal : 0;
    const semis = (ep.match(/;/g) || []).length, hasColon = /:/.test(ep);
    const titulos = []; let m; const reTit = /[Tt][íi]tulo\s+(Preliminar|[IVXLC]+(?:\.bis)?)/g;
    while ((m = reTit.exec(ep)) !== null) { const v = /preliminar/i.test(m[1]) ? 0 : romanToInt(m[1]); if (v != null) titulos.push(v); }
    const titSet = [...new Set(titulos)].sort((a, b) => a - b);
    let titComplete = null, titGap = false;
    if (titSet.length >= 2) { const max = titSet[titSet.length - 1]; const miss = []; for (let i = titSet[0]; i <= max; i++) if (!titSet.includes(i)) miss.push(i); titGap = miss.length > 0; titComplete = !titGap; }
    const closureWord = /\breforma\b|disposici[oó]n(?:es)?\s+(?:adicional|transitoria|derogatoria|final)/i.test(ep);
    let segments = 0;
    if (hasColon) { segments = ep.slice(ep.indexOf(':') + 1).split(/[;,]/).map(s => s.trim()).filter(s => s.length >= 4 && /[a-záéíóúñ]/i.test(s)).length; }
    const explicitArts = new Set(); const reR = /art[íi]?c?u?l?o?s?\.?\s*(\d+)\s*(?:a|al|-|–)\s*(\d+)/gi;
    while ((m = reR.exec(ep)) !== null) { const a = +m[1], b = +m[2]; if (b - a >= 0 && b - a < 500) for (let i = a; i <= b; i++) explicitArts.add(i); }
    const reS = /art[íi]?c?u?l?o?\.?\s*(\d+)(?!\s*(?:a|al|-|–)\s*\d)/gi;
    while ((m = reS.exec(ep)) !== null) explicitArts.add(+m[1]);
    const wholeLawWords = /[íi]ntegr|en su totalidad|toda la ley|texto [íi]ntegro|el conjunto de la ley|la ley completa/i.test(ep);
    const bigLaw = lawTotal >= 12, nearFull = coverage >= 0.9, enumerator = hasColon && segments >= 3;
    if (wholeLawWords) return { band: 'CLEARED', score: 0, coverage, reason: null };
    if (titComplete && closureWord && nearFull) return { band: 'CLEARED', score: 0, coverage, reason: null };
    let score = 0, reason = null;
    if (explicitArts.size > 0 && bigLaw && scopedCount >= explicitArts.size * 2 && nearFull) { score += 60; reason = `epígrafe cita ${explicitArts.size} arts concretos pero scope tiene ${scopedCount}/${lawTotal}`; }
    if (titGap && nearFull && bigLaw) { score += 50; reason = reason || `epígrafe nombra títulos con huecos (${titSet.join(',')}) pero scope cubre toda la ley`; }
    if (bigLaw && nearFull && enumerator) { score += 30; reason = reason || `ley grande (${lawTotal}) casi completa (${(coverage * 100).toFixed(0)}%) con epígrafe que enumera ${segments} bloques`; }
    const band = score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'NONE';
    return { band, score, coverage, reason };
  };
  const overIncl = (await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley, t.epigrafe,
           ts.article_numbers,
           (SELECT count(*) FROM articles a WHERE a.law_id = ts.law_id AND a.article_number ~ '^[0-9]+$') law_total
    FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
    WHERE t.is_active = true`)).rows;
  const oiHigh = [];
  for (const r of overIncl) {
    const scoped = (r.article_numbers || []).filter(x => /^[0-9]+$/.test(x)).length;
    const v = classifyScope(Number(r.law_total), scoped, r.epigrafe);
    if (v.band === 'HIGH') oiHigh.push({ pt: r.pt, tema: r.tn, ley: r.ley, cobertura: Math.round(v.coverage * 100), motivo: v.reason });
  }
  if (oiHigh.length) {
    oiHigh.sort((a, b) => b.cobertura - a.cobertura);
    const nOpos = new Set(oiHigh.map(x => x.pt)).size;
    add('content', 'warn', null, 'scope_over_inclusion_suspect',
      `${oiHigh.length} tema(s) con SCOPE MÁS ANCHO que el epígrafe (mete casi la ley entera) en ${nOpos} oposición(es) — sirve preguntas fuera de programa; adjudicar con verify:scope y recortar el scope`,
      { count: oiHigh.length, oposiciones: nOpos, sample: oiHigh.slice(0, 20) });
  }

  // ── DUPLICADO cross-tema de LEY REAL (misma ley entera/con solape grande en ≥2 temas) ──
  // Complementa a scope_over_inclusion (que mira 1 tema vs SU epígrafe). Aquí: la MISMA
  // ley duplicada ENTRE temas → sirve las mismas preguntas en varios tests → hay que
  // REPARTIR por materia. Núcleo = scripts/scope-health-classify.cjs (`npm run scope:health`);
  // MANTENER EN SYNC con classifySharedLaw/isRealLaw de ese fichero.
  // Umbral ALTO (NULL-compartido o solape ≥20 arts) para pingar solo en dups CLAROS de ley
  // entera; el cross-cutting de 1-10 arts (tema específico que toma unos artículos del rango
  // general de otro) es legítimo y NO se marca. GOTCHA: article_numbers=NULL = ley entera.
  const ctRows = (await c.query(`
    SELECT t.position_type pt, l.short_name ley, t.topic_number tn, ts.article_numbers an
    FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
    WHERE t.is_active = true
      AND l.short_name ~* '^(Ley|LO|RD|RDL|CE|Real|Decreto|Estatut|Llei|TR|Convenio|Reglament|Constituci|Tratado|TUE|TFUE|RGPD)'`)).rows;
  const ctGroups = {};
  for (const r of ctRows) { const k = r.pt + ' ' + r.ley; (ctGroups[k] = ctGroups[k] || []).push(r); }
  const ctDups = [];
  for (const k of Object.keys(ctGroups)) {
    const rows = ctGroups[k]; if (rows.length < 2) continue;
    const [pt, ley] = k.split(' ');
    const arrs = rows.map(r => { const a = r.an || []; const nums = a.map(x => parseInt(String(x).replace(/[^0-9]/g, ''), 10)).filter(n => !isNaN(n)); return { tn: r.tn, set: new Set(nums), nulish: a.length === 0 }; });
    let maxOv = 0, pair = null;
    if (arrs.filter(a => a.nulish).length > 1) { maxOv = 9999; pair = arrs.filter(a => a.nulish).map(a => 'T' + a.tn).join('=T') + ' (ley entera/NULL)'; }
    else for (let i = 0; i < arrs.length; i++) for (let j = i + 1; j < arrs.length; j++) { let cc = 0; for (const n of arrs[i].set) if (arrs[j].set.has(n)) cc++; if (cc > maxOv) { maxOv = cc; pair = 'T' + arrs[i].tn + '∩T' + arrs[j].tn + '=' + cc + ' arts'; } }
    if (maxOv >= 20) ctDups.push({ pt, ley, dup: pair });
  }
  if (ctDups.length) {
    const nOpos = new Set(ctDups.map(x => x.pt)).size;
    add('content', 'warn', null, 'scope_cross_tema_dup',
      `${ctDups.length} ley(es) DUPLICADA(S) entre temas (misma ley entera o con solape grande en ≥2 temas) en ${nOpos} oposición(es) — las mismas preguntas salen en varios tests; repartir por materia con verify:scope`,
      { count: ctDups.length, oposiciones: nOpos, sample: ctDups.slice(0, 20) });
  }

  // ── CONTENIDO: preguntas con DEIXIS VISUAL pero SIN imagen almacenada ──
  // El enunciado apunta a un icono/símbolo/imagen que DEBE mostrarse ("el siguiente
  // icono", "el siguiente símbolo", "observa la siguiente figura", "las restas de la
  // imagen") pero image_url es NULL y content_data va vacío → la pregunta es
  // IRRESOLUBLE (nadie ve el gráfico) y aun así está activa. Punto ciego total: ningún
  // detector miraba coherencia enunciado↔imagen, y el re-verificador LLM razona solo
  // sobre TEXTO — de hecho puede REVERTIR un flag correcto de "inverificable" (caso raíz
  // 22/07: pregunta de icono Outlook marcada needs_human 2× por "requiere imagen no
  // disponible" y re-aprobada el 10/07 como falso positivo → la cazó una usuaria, Concha,
  // vía impugnación 7119bd5d; barrido posterior jubiló 4 más). Patrón ALTA PRECISIÓN:
  // SINGULAR "el/la siguiente <cosa visual>" (el plural "de las siguientes …" = "de las
  // siguientes opciones", FP masivo) + guardas contra "imagen corporal/pública", "de la
  // imagen y el sonido", etc. Remediar: si hay fuente → reconstruir la imagen; si no →
  // jubilar (admin_image_unavailable). NUNCA inventar la imagen.
  // Deixis fuerte, ambos órdenes (prefijo "siguiente icono" Y pospuesto "imagen siguiente"),
  // + "en la imagen anterior/superior…", + identificar símbolo/pictograma de la imagen, + data-de-la-imagen.
  const VD_STRONG = "(\\y(el|la)\\s+siguiente\\s+(icono|imagen|imágen|s[íi]mbolo|gr[áa]fico|figura|captura|pictograma|esquema|diagrama|se[ñn]al)\\y)"
    + "|(en\\s+la\\s+imagen\\s+(anterior|superior|inferior|adjunt\\w+|siguiente|de\\s+arriba|de\\s+abajo))"
    + "|(\\yla\\s+imagen\\s+(muestra|adjunt\\w+|superior|inferior|siguiente|anterior)\\y)"
    + "|((observa|observe|obsérv\\w+|f[íi]jese\\s+en)\\s+(la|el)\\s+(siguiente\\s+)?(imagen|figura|gr[áa]fico|icono|s[íi]mbolo|captura))"
    + "|(seg[úu]n\\s+(la\\s+imagen|la\\s+figura|el\\s+gr[áa]fico\\s+adjunt|muestra\\s+la\\s+(imagen|figura)|se\\s+muestra\\s+en\\s+la\\s+(imagen|figura)))"
    + "|(¿qu[ée]\\s+(significa|representa|indica)\\s+(este|el\\s+siguiente)\\s+(icono|s[íi]mbolo|pictograma|gr[áa]fico))"
    + "|(\\y(icono|s[íi]mbolo|pictograma|gr[áa]fico|captura|divisa|distintivo|emblema)\\s+(mostrad\\w+|adjunt\\w+|que\\s+se\\s+muestra|siguiente|anterior|de\\s+la\\s+(imagen|figura|fotograf\\w+))\\y)"
    + "|(\\y(restas|celda|celdas|f[óo]rmula|f[óo]rmulas|tabla|query|consulta|marca|base\\s+de\\s+datos|diagrama)\\w*\\s+\\w*\\s*(de|en)\\s+la\\s+imagen\\y)"
    + "|(\\yde\\s+la\\s+imagen[,. ]+(indica|se[ñn]ale|cu[áa]l|obten|calcul))";
  const VD_FP = "imagen corporal|imagen p[úu]blica|imagen de la administraci|imagen de las mujeres|de la imagen y|imagen y (el |del )?sonido|imagen y sonido|derecho a la propia imagen|reproducci[óo]n del sonido|de la imagen o|icono (muestra|con forma|que representa a)|s[íi]mbolo (¶|de p[áa]rrafo)|figura (jur[íi]dic|del? |profesional)";
  const vdRows = (await c.query(`
    SELECT id, question_text FROM questions
    WHERE is_active = true
      AND (image_url IS NULL OR image_url = '')
      AND (content_data IS NULL OR content_data::text IN ('{}','null',''))
      AND question_text ~* $1 AND question_text !~* $2
    LIMIT 60`, [VD_STRONG, VD_FP])).rows;
  if (vdRows.length) add('content', 'warn', null, 'visual_deixis_no_image',
    `${vdRows.length}${vdRows.length >= 60 ? '+' : ''} pregunta(s) visible(s) que invocan un icono/símbolo/imagen SIN imagen almacenada (image_url NULL) — irresolubles; reconstruir la imagen o jubilar (admin_image_unavailable)`,
    { count: vdRows.length, sample: vdRows.slice(0, 15).map(r => ({ id: r.id, q: (r.question_text || '').slice(0, 90) })) });

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
