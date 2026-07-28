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
 *
 * ⚠️ GOTCHA: este fichero lleva emojis → `file`/`grep` lo tratan como BINARIO y `grep`
 *    NORMAL devuelve 0 hits FALSOS (parece que un bloque no existe cuando sí). Usa
 *    `grep -a` para buscar aquí. (Casi hizo "arreglar" un cableado que ya estaba, 22/07.)
 */
const { Client } = require('pg');
const { diagnosticarSeguimientoUrl, procesoConFichaViva } = require('../lib/convocatoria/seguimientoUrlSalud.cjs');
const { detectarIncoherenciasEstado, hoyMadrid } = require('../lib/convocatoria/estadoCoherencia.cjs');
const { clasificarVigilancia } = require('../lib/convocatoria/seguimientoVigilable.cjs');
const { detectarEnOposicion } = require('../lib/convocatoria/examenPasadoEnTexto.cjs');
const { checkConvocatoriaLinks } = require('../lib/convocatoria/linkCoherence.cjs');
const { classifyLandingCompleteness } = require('../lib/convocatoria/landingCompleteness.cjs');
const { VD_STRONG, VD_FP, VD_SQL } = require('../lib/health/visualDeixis.cjs');
const { AUDIT_NOTE_PATS } = require('../lib/health/auditNoteExplanation.cjs');

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

  // ⚠️ Las tarjetas se leen de `oposiciones_ssot`, NO de `oposiciones` (bug corregido 16/07/2026).
  // La vista resuelve COALESCE(convocatorias, oposiciones): la fila de convocatoria GANA y es lo que
  // ve el opositor. Auditar `oposiciones.landing_estadisticas` es auditar una copia que NADIE VE.
  // Medido: en administrativo-navarra la copia legacy decía "Plazas totales: 264" (que cuadraba con
  // las columnas -> visto bueno) mientras el usuario veía 585. Y 7 de 91 landings activas tenían
  // tarjetas distintas entre legacy y vista: SIETE landings que el sweep nunca comprobó.
  const opos = (await c.query(`SELECT o.id, o.slug, s.landing_estadisticas, o.temas_count
    FROM oposiciones o JOIN oposiciones_ssot s ON s.slug = o.slug
    WHERE o.is_active = true ORDER BY o.slug`)).rows;

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
    // ── CONTENIDO: hueco OCULTO de cobertura de artículos (caso M, SMS Tema 7,
    // 13/07: 6 arts con contenido y 0 preguntas en un tema por lo demás cubierto).
    // Grano más fino que low_coverage: solo marca temas MAYORMENTE cubiertos a
    // nivel de artículo (≥60%) con ≥4 huecos — el patrón "casi terminado, faltan
    // un puñado". NO cuenta oposiciones poco desarrolladas (scope de leyes enteras
    // con cobertura dispersa → eso ya lo señala empty_topic/low_coverage). Excluye
    // derogados/vacíos, y también artículos INACTIVOS (a.is_active): un artículo
    // escopado pero is_active=false NO es un hueco "genera preguntas" (puede tenerlas
    // ya) sino un fallo de servibilidad → lo cubre scope_phantom_article (reactivar/
    // importar). Partición limpia: este detector = existe+activo+0 preguntas → generar;
    // scope_phantom_article = inexistente|desactivado → reactivar/importar/recortar.
    const sinPreg = (await c.query(`
      SELECT topic_number, (n_content - n_cov)::int AS n, ejemplos FROM (
        SELECT tp.topic_number,
          count(*)::int AS n_content,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::int AS n_cov,
          (array_agg(l.short_name || ' ' || a.article_number ORDER BY (a.article_number)::int)
            FILTER (WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)))[1:6] AS ejemplos
        FROM topic_scope ts
        JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
        JOIN laws l ON l.id = ts.law_id
        JOIN LATERAL unnest(ts.article_numbers) AS an(num) ON true
        JOIN articles a ON a.law_id = ts.law_id AND a.article_number = an.num AND a.is_active
        WHERE tp.position_type = $1 AND length(coalesce(a.content,'')) > 40 AND a.content NOT ILIKE '%derogado%'
          AND a.article_number ~ '^[0-9]+$'
        GROUP BY tp.topic_number
        HAVING count(*) >= 4
           AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
           AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float / count(*) >= 0.6
           AND count(*) - count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) >= 4
      ) t
      ORDER BY topic_number`, [pt])).rows;
    if (sinPreg.length) {
      const tot = sinPreg.reduce((a2, r) => a2 + r.n, 0);
      add('content', 'warn', o.slug, 'article_no_coverage',
        `${o.slug}: ${sinPreg.length} tema(s) con artículos del temario SIN preguntas (${tot} arts; p.ej. T${sinPreg[0].topic_number}: ${(sinPreg[0].ejemplos || []).join(', ')})`,
        { temas: sinPreg.map(r => ({ tema: r.topic_number, arts_sin_preguntas: r.n, ejemplos: r.ejemplos })) });
    }

    // ── CONTENIDO: coherencia de tarjetas + dual-write + hitos ──
    const nTopics = topics.length;
    if (o.temas_count != null && Number(o.temas_count) !== nTopics) add('content', 'error', o.slug, 'temas_card', `temas_count=${o.temas_count} ≠ ${nTopics} topics reales`);
    // Una tarjeta que dice "del programa OFICIAL" habla del temario del boletín, no de lo que
    // servimos, y las dos cosas pueden diferir legítimamente (Policía Nacional: 45 del Anexo I +
    // un bloque de inglés de apoyo). Compararla con los topics servidos ponía a este detector a
    // pelearse con la honestidad de la landing; esas tarjetas las verifica `audit:landing` contra
    // el documento oficial (T-142).
    for (const card of cardsAbout(o.landing_estadisticas, 'tema')) {
      if (/oficial|programa/i.test(String(card.texto || ''))) continue;
      const v = cardInt(card.numero);
      if (v != null && v !== nTopics) add('content', 'error', o.slug, 'temas_card', `tarjeta "${card.texto}"=${v} pero hay ${nTopics} topics`);
    }
    const conv = (await c.query(`SELECT plazas_libres, plazas_discapacidad, plazas_promocion_interna, plazas_otros_turnos, estado_proceso, boe_reference, programa_url, examen_config, landing_faqs, landing_estadisticas, landing_description
      FROM convocatorias WHERE oposicion_id = $1 AND is_current = true LIMIT 1`, [o.id])).rows[0];
    if (conv) {
      const L = Number(conv.plazas_libres || 0), D = Number(conv.plazas_discapacidad || 0), P = Number(conv.plazas_promocion_interna || 0);
      // La cola de turnos de reserva (violencia de género, etc.) cuenta para el TOTAL: sin ella, una
      // tarjeta correcta se marcaba como error. Caso real: el BON de Navarra reparte 585 en CUATRO
      // turnos (264+264+51+6) y el esquema solo modelaba tres -> la tarjeta buena (585) no cuadraba.
      const O = Array.isArray(conv.plazas_otros_turnos)
        ? conv.plazas_otros_turnos.reduce((a, t) => a + Number(t?.plazas || 0), 0) : 0;
      const valid = new Set([L, D, P, L + D, L + P, D + P, L + D + P, L + D + P + O].filter(x => x > 0));
      for (const card of cardsAbout(o.landing_estadisticas, 'plaza')) { const v = cardInt(card.numero); if (v != null && !valid.has(v)) add('content', 'error', o.slug, 'plaza_card', `tarjeta "${card.texto}"=${v} no cuadra con conv (L=${L} D=${D} P=${P})`); }
      const faltan = ['boe_reference', 'programa_url', 'examen_config', 'landing_faqs', 'landing_estadisticas', 'landing_description'].filter(k => conv[k] == null);
      if (faltan.length) add('content', 'warn', o.slug, 'dual_write', `dual-write convocatoria incompleto: ${faltan.join(', ')}`);
      if (conv.estado_proceso === 'inscripcion_abierta') {
        const h = Number((await c.query(`SELECT COUNT(*)::int n FROM convocatoria_hitos WHERE oposicion_id = $1`, [o.id])).rows[0].n);
        if (h === 0) add('content', 'error', o.slug, 'no_hitos', `${o.slug}: inscripción abierta pero 0 hitos (timeline vacío)`);
      }
    }
  }

  // ── CONVOCATORIAS: invariantes deterministas del timeline (sin IA, sin documentos) ──
  // La vista `convocatoria_hito_incidencias` (20260716_convocatoria_documentos_hitos_provenance.sql)
  // compara nuestros datos CONSIGO MISMOS: pares universales dentro de un mismo ciclo, unicidad,
  // caducidad de previsiones y status que contradice su propia fecha. Cuesta 0 y caza bugs reales
  // (p.ej. celador-sermas-madrid: el plazo ABRE el 7-ago y CERRÓ el 6-ago).
  // Se acota a oposiciones ACTIVAS: 2.489 hallazgos no es observabilidad, es ruido — y el ruido es
  // exactamente cómo se llegó al bug que originó este subsistema.
  {
    const inc = (await c.query(`
      SELECT o.slug, i.invariante, i.detalle
        FROM convocatoria_hito_incidencias i
        JOIN convocatorias cv ON cv.id = i.convocatoria_id
        JOIN oposiciones o ON o.id = cv.oposicion_id
       WHERE o.is_active AND i.invariante <> 'I5_registro_sin_fuente'`)).rows;
    // I5 (cobertura de fuente) se EXCLUYE a propósito: hasta que el corpus tenga documentos son 328
    // hallazgos que sólo dicen "aún no hay documentos" — línea base, no avería. Se activará cuando
    // detect-notas lleve tiempo llenando `convocatoria_documentos`.
    const porSlug = {};
    for (const r of inc) (porSlug[r.slug] = porSlug[r.slug] || []).push(r);
    for (const [slug, rs] of Object.entries(porSlug)) {
      // I10 va en `graves` (error), no en `stale`: no es un hito viejo sin cerrar, es
      // MISINFORMACIÓN visible — la landing dice "plazo cerrado" en un proceso no
      // convocado (T-124). Reutiliza el kind existente para no inflar el badge.
      // I11 (T-142): la fila y sus propios hitos dan fechas distintas del MISMO plazo, y la
      // landing pinta las dos → misinformación visible, mismo cubo que I10.
      const graves = rs.filter((r) => r.invariante === 'I1_orden' || r.invariante === 'I2_duplicado' || r.invariante === 'I9_tipo_incoherente' || r.invariante === 'I10_inscripcion_sin_convocatoria' || r.invariante === 'I11_fechas_inscripcion_vs_hitos');
      if (graves.length) {
        add('content', 'error', slug, 'convocatoria_timeline_incoherente',
          `${slug}: ${graves.length} incoherencia(s) en el timeline — ${graves[0].detalle}`,
          { incidencias: graves.map((r) => ({ invariante: r.invariante, detalle: r.detalle })) });
      }
      const stale = rs.filter((r) => r.invariante === 'I7_prevision_caducada' || r.invariante === 'I8_status_contradice_fecha');
      if (stale.length) {
        add('content', 'warn', slug, 'convocatoria_timeline_caducado',
          `${slug}: ${stale.length} hito(s) caducados o con estado que contradice su fecha`,
          { incidencias: stale.map((r) => ({ invariante: r.invariante, detalle: r.detalle })) });
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
  // Mirror de lib/teoria/detectFlattenedTable.ts — MANTENER EN SYNC. Pie/menú de la sede del BOE
  // (Contactar · Aviso legal · Accesibilidad · … · Empleo en la AEBOE) colado como celdas = FP.
  const BOE_BOILERPLATE_RE = /\b(Aviso legal|Sobre la sede electr[oó]nica|Sistema Interno de Informaci[oó]n|Empleo en la AEBOE|Agencia Estatal Bolet[ií]n Oficial)\b/i;
  const detectFlattenedTable = (content) => {
    if (!content || !content.trim()) return null;
    const lines = content.replace(/\r\n?/g, '\n').split('\n').map((l) => l.trim()).filter(Boolean);
    let best = [], run = [];
    for (const l of lines) { if (isCellLine(l)) { run.push(l); if (run.length > best.length) best = run.slice(); } else run = []; }
    if (best.length < 4) return null;
    const joined = best.join(' ');
    if (STRUCTURE_RE.test(joined) || BOE_BOILERPLATE_RE.test(joined)) return null; // índice de estructura o pie del BOE → no es tabla
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
  // ── Hitos que anuncian un evento con la fecha YA PASADA ────────────────────────────────
  // Nace de un fallo real (20/07/2026): 11 hitos seguían `upcoming` con fecha vencida. El
  // render ya no publica los estimados (`lib/convocatoria/fechaEstimada.ts`), pero eso hace el
  // fallo INOCUO, no lo impide. Esto lo DETECTA, que son cosas distintas:
  //   · origen='registro'   → la fecha era real y el evento ocurrió: nadie cerró el hito, así
  //                           que el timeline anuncia como próximo algo que ya pasó.
  //   · origen='estimacion' → la fecha nos la inventamos y encima ya venció. No se publica,
  //                           pero delata una estimación que nadie revisó (warn, no error).
  const hitosVencidos = (await c.query(`
    SELECT o.slug, ch.origen, COUNT(*)::int n
    FROM convocatoria_hitos ch JOIN oposiciones o ON o.id = ch.oposicion_id
    WHERE o.is_active AND ch.status = 'upcoming' AND ch.fecha < CURRENT_DATE
    GROUP BY o.slug, ch.origen`)).rows;
  for (const r of hitosVencidos) {
    // Mismo criterio de LISTA BLANCA que `lib/convocatoria/fechaEstimada.ts`: solo `registro`
    // acredita fuente oficial. Con lista negra se escapaban los `origen='inferencia'`.
    const estimado = r.origen !== 'registro';
    add('content', estimado ? 'warn' : 'error', r.slug, 'hito_vencido_abierto',
      `${r.slug}: ${r.n} hito(s) "próximos" con fecha ya pasada` +
      (estimado ? ' (fecha ESTIMADA sin publicar; no se muestra, pero revísala)'
                : ' (fecha REAL: el evento ocurrió y el hito sigue anunciándolo como futuro)'));
  }

  // ── estado_proceso que se contradice con sus PROPIAS fechas ────────────────────────────
  // Misma lógica que `npm run audit:estados` (núcleo compartido `estadoCoherencia.cjs`): antes
  // vivía SOLO en ese CLI, cuyos hallazgos iban a un log/email y NO al badge — 1 error y 34 avisos
  // que nadie veía en /admin/contenido. Aquí se publican donde se mira todo lo demás.
  // Determinista: sin IA y sin boletines; solo contradicciones internas del dato.
  const estados = (await c.query(`
    SELECT slug, is_active, estado_proceso,
           inscription_start::text        AS inscription_start,
           inscription_deadline::text     AS inscription_deadline,
           exam_date::text                AS exam_date,
           exam_date_approximate,
           seguimiento_url,
           seguimiento_last_checked::text AS seguimiento_last_checked
    FROM oposiciones_ssot`)).rows;
  const HOY_MADRID = hoyMadrid();
  for (const o of estados) {
    for (const inc of detectarIncoherenciasEstado(o, HOY_MADRID)) {
      add('content', inc.severidad, o.slug, 'convocatoria_estado_incoherente',
        `${o.slug}${o.is_active ? ' [PUBLICADA]' : ''}: ${inc.mensaje}`, { regla: inc.regla });
    }
  }

  // ── seguimiento_url que vigilan un ciclo YA CERRADO (falso negativo silencioso) ─────────
  // El peor tipo de fallo: la URL responde 200, no da error, no sale en rojo — pero apunta a
  // la convocatoria de otro año, ya resuelta. El día que salga la nueva, nadie se entera.
  // Detectado a mano en el drenaje del 20/07 (5 casos); esto lo hace VISIBLE de forma continua.
  // Graduado a propósito (ver lib/convocatoria/seguimientoUrlSalud.cjs): solo la señal limpia
  // —URL a documento de boletín inmutable de año viejo— es error; el resto es cola de revisión.
  const urlRows = (await c.query(`
    SELECT o.slug, o.seguimiento_url AS su, c."año" AS anio_vig, c.estado_proceso AS estado
    FROM oposiciones o
    JOIN convocatorias c ON c.oposicion_id = o.id AND c.is_current
    WHERE o.is_active AND o.seguimiento_url IS NOT NULL`)).rows;
  for (const r of urlRows) {
    // procesoEnJuego (paridad con el backend @Cron): SOLO cuando hay convocatoria PUBLICADA con
    // ficha viva (procesoConFichaViva) una URL genérica es ceguera accionable. En `oep_aprobada`
    // (esperando bases) o `sin_oep` la genérica es la vigilancia legítima → 'ok', no pinga.
    const d = diagnosticarSeguimientoUrl(r.su, r.anio_vig != null ? Number(r.anio_vig) : null, { procesoEnJuego: procesoConFichaViva(r.estado) });
    if (d.severidad === 'ok') continue;
    add('content', d.severidad, r.slug, 'seguimiento_url_stale',
      `${r.slug}: seguimiento_url ${d.nivel === 'stale_boletin' ? 'DESFASADA' : 'sospechosa'} — ${d.motivo}`);
  }

  // ── seguimiento_url que responde 200 pero NO VIGILA NADA (ceguera silenciosa) ───────────
  // Hermano del anterior, causa distinta: allí la URL apunta al ciclo equivocado; aquí apunta
  // al sitio correcto y el CONTENIDO no llega. El cron hashea el HTML servido sin ejecutar JS,
  // así que una SPA (o un "página en desuso", o un WAF que responde 200) devuelve un shell
  // inmutable → el hash se congela, `seguimiento_change_status` se queda en 'ok' y el panel se
  // ve verde mientras no vigilamos nada. Descubierto al repuntar las 9 de T-114 (26/07): las
  // páginas "buenas" de Córdoba, Asturias y Jaén eran SPAs y se descartaron a mano.
  //
  // Evidencia SIN re-fetchear: `content_preview` ya es el texto extraído por el propio cron.
  // `checked_url = seguimiento_url` es OBLIGATORIO — sin ese filtro, una oposición recién
  // repuntada se juzga con el contenido de su URL anterior (falso positivo garantizado, cazado
  // por la simulación bank-wide el 26/07). Sin evidencia atribuible NO se juzga (fail-safe).
  //
  // Solo se emite la banda `error` (ciega de verdad). La banda `warn` —200 con poco texto, que
  // mezcla páginas reales cortas con contenedores vacíos— NO pinga el badge: se adjudica bajo
  // demanda con `node scripts/seguimiento/sim-fuentes-ciegas.cjs --todos`. Misma política que la
  // banda MEDIUM de sobre-inclusión: una bandeja ruidosa se aprende a ignorar (lección T-047).
  //
  // ENSANCHADO 27/07 (T-165): el clasificador mira ahora también la CABECERA sin límite de
  // longitud, así que caen aquí las páginas RICAS que no vigilan nada — 404 servido con 200,
  // pantalla de error del portal, muro de login, ficha de catálogo. Antes pasaban por sanas
  // (`tcae-galicia` servía 991 KB… de formulario de acceso). Simulación bank-wide antes de
  // encender: 73 hallazgos nuevos, 0 falsos positivos, y de ellos **1 sola oposición ACTIVA** →
  // el badge sube en 1, no se convierte en bandeja. Los otros 72 son catalogadas (SES Extremadura
  // y Rioja Salud sirven un 404 a decenas de fichas) y salen en la simulación, no en el badge.
  const ciegaRows = (await c.query(`
    SELECT o.slug, ch.http_status, ch.error_message, ch.content_preview
    FROM oposiciones o
    JOIN LATERAL (
      SELECT k.http_status, k.error_message, k.content_preview
      FROM convocatoria_seguimiento_checks k
      WHERE k.oposicion_id = o.id AND k.checked_url = o.seguimiento_url
      ORDER BY k.checked_at DESC LIMIT 1
    ) ch ON true
    WHERE o.is_active AND o.seguimiento_url IS NOT NULL`)).rows;
  for (const r of ciegaRows) {
    const v = clasificarVigilancia({
      httpStatus: r.http_status, error: r.error_message, texto: r.content_preview,
    });
    if (v.severidad !== 'error') continue;
    add('content', 'error', r.slug, 'seguimiento_fuente_ciega',
      `${r.slug}: la seguimiento_url responde pero NO se puede vigilar (${v.nivel}) — ${v.motivo}`);
  }

  // ── Enlaces de la convocatoria vigente que NO corresponden a lo que MUESTRAN ──
  // La caja "Ver … en BOE" de la landing muestra una referencia (boe_reference) pero el enlace
  // (programa_url) puede apuntar a OTRO documento: el usuario pincha y aterriza en un doc
  // distinto (p.ej. muestra la OEP 2026 y enlaza a la convocatoria de 2025). Medido 25/07:
  // 5 convocatorias vigentes con el enlace descuadrado (feedback Manuel: "fallos imperdonables").
  // Punto ciego: el detector de seguimiento mira la URL de seguimiento, no la del BOE de la
  // propia convocatoria. Núcleo puro lib/convocatoria/linkCoherence.cjs (con tests).
  // Se lee de `oposiciones_ssot` (lo que VE el opositor), no de la fila legacy: la landing
  // compone la tarjeta oficial con `diario_oficial` (etiqueta) + `programa_url` (enlace) +
  // `boe_reference` (referencia) resueltos por la vista.
  const linkRows = (await c.query(`
    SELECT slug, boe_reference AS ref, programa_url AS url, diario_oficial AS etiqueta,
           estado_proceso AS estado
    FROM oposiciones_ssot
    WHERE is_active`)).rows;
  for (const r of linkRows) {
    const issues = checkConvocatoriaLinks({
      boeReference: r.ref, programaUrl: r.url, diarioOficial: r.etiqueta, estadoProceso: r.estado,
    });
    for (const it of issues) {
      if (it.tipo === 'ref_url_mismatch') {
        add('content', it.severidad, r.slug, 'convocatoria_link_mismatch',
          `${r.slug}: el enlace "Ver en BOE" no corresponde a la referencia mostrada — ${it.detalle}`, it.detalle);
      } else if (it.tipo === 'etiqueta_boletin_mismatch') {
        // Punto ciego del anterior: ahí referencia y enlace SÍ casan; lo que miente es la
        // ETIQUETA del botón ("Ver convocatoria en BOJA" llevando a boe.es). Incidente 25/07.
        add('content', it.severidad, r.slug, 'convocatoria_etiqueta_boletin',
          `${r.slug}: el botón oficial promete un boletín y lleva a otro — ${it.detalle}`, it.detalle);
      } else if (it.tipo === 'enlace_no_es_boletin') {
        // Punto ciego de los dos anteriores (T-134, 26/07): ambos exigen RECONOCER un boletín en
        // la URL, así que si el enlace no era de ninguno se callaban. Medido ese día: 56 de 123
        // landings activas en esa zona muerta; el caso raíz (policia-nacional, plazo ABIERTO)
        // prometía el BOE y llevaba al portal de aspirantes en inglés.
        add('content', it.severidad, r.slug, 'convocatoria_enlace_no_boletin',
          `${r.slug}: el botón oficial no lleva al boletín que promete — ${it.detalle}`, it.detalle);
      }
      // el año de seguimiento ya lo cubre seguimiento_url_stale
    }
  }

  // ── Lo que la landing AFIRMA vs el documento oficial: MEDIDO Y DESCARTADO del sweep (T-142) ──
  // Se construyó, se simuló sobre las 123 landings activas y NO se enchufa aquí, a propósito:
  //   · `landing_cifra_sin_respaldo` daba 168 avisos. La causa no es el detector: es que el hub
  //     de provenance tiene el 96% de los documentos clonados como `nota` (6.408 de 6.625) y solo
  //     149 como `convocatoria`, así que en la mayoría de landings se estaría contrastando contra
  //     el documento equivocado. Con el documento CORRECTO el detector acierta (cazó las cifras
  //     inventadas de policia-nacional); sin él, sería una bandeja de 168 que nadie miraría.
  //   · `landing_superficies_contradictorias` bajó de 89 a 1 al comparar solo superficies de
  //     resumen… y ese 1 también era legítimo (dos tarjetas de Navarra: 585 totales vs 264 turno
  //     libre). Al ritmo actual no paga su ruido.
  // Los dos VIVEN en `npm run audit:landing -- <slug>`, que es donde hay un humano leyendo con
  // contexto, y son la puerta antes de mandarle una campaña a una landing. Cuando la cobertura de
  // documentos de convocatoria suba, el primero se puede promover a nocturno sin tocar el núcleo.


  // ── Documentos oficiales clonados que NADIE ha revisado (documentos_sin_revisar) ─────────
  // El cron clona los documentos de las oposiciones que preparamos y la decisión —qué se publica
  // en la landing— la toma una sesión leyendo la FUENTE. Antes ese paso lo pre-masticaba un LLM
  // barato: 6.886 extracciones generadas y **0 triadas**, ~17 USD por algo que nadie miró. Ahora
  // la bandeja es explícita y se ve aquí: si un documento nuevo de una convocatoria VIVA lleva
  // días sin mirarse, es una fecha o una versión de software que puede estar sin publicar.
  const docsRows = (await c.query(`
    SELECT o.slug, count(*)::int n, min(d.created_at)::date AS mas_viejo
      FROM convocatoria_documentos d
      JOIN convocatorias cv ON cv.id = d.convocatoria_id
      JOIN oposiciones o ON o.id = cv.oposicion_id
     WHERE o.is_active AND cv.is_current AND cv.archived_at IS NULL
       AND d.extracted_text IS NOT NULL
       AND d.created_at > now() - interval '30 days'
       AND cv.estado_proceso IN ('inscripcion_abierta','convocatoria_publicada','convocada','inscripcion_cerrada','lista_admitidos','pendiente_examen')
       AND NOT EXISTS (
         SELECT 1 FROM observable_events e
          WHERE e.event_type = 'documento_revisado' AND e.metadata->>'documentoId' = d.id::text)
     GROUP BY o.slug`)).rows;
  for (const r of docsRows) {
    add('content', 'warn', r.slug, 'documentos_sin_revisar',
      `${r.slug}: ${r.n} documento(s) oficial(es) clonado(s) SIN revisar (el más antiguo, del ${String(r.mas_viejo).slice(0, 10)}) — revísalos con npm run docs:bandeja`,
      `${r.n} pendientes`);
  }

  // ── Landings PUBLICADAS a medio hacer (landing_incompleta) ──
  // Una oposición activa puede llevar semanas servida con el hero sin tarjetas, sin FAQs y sin
  // SEO sin que nadie se entere: `audit:oposicion` lo canta, pero es on-demand y solo se corre
  // al crearla. Caso raíz 25/07: Aux. Admin. UAL, descubierto al ir a mandarle una newsletter a
  // 1.334 personas. Núcleo puro lib/convocatoria/landingCompleteness.cjs (con tests).
  const landRows = (await c.query(`
    SELECT slug, landing_estadisticas, landing_faqs, landing_description,
           seo_title, seo_description, titulo_requerido, examen_config
    FROM oposiciones_ssot WHERE is_active`)).rows;
  for (const r of landRows) {
    const cl = classifyLandingCompleteness({
      isActive: true,
      landingEstadisticas: r.landing_estadisticas, landingFaqs: r.landing_faqs,
      landingDescription: r.landing_description, seoTitle: r.seo_title,
      seoDescription: r.seo_description, tituloRequerido: r.titulo_requerido,
      examenConfig: r.examen_config,
    });
    if (!cl.severidad) continue;
    add('content', cl.severidad, r.slug, 'landing_incompleta',
      `${r.slug}: landing publicada ${cl.nivel === 'incompleta' ? 'INCOMPLETA' : 'mejorable'} — falta ${cl.faltan.join(', ')}`,
      cl.ids.join(','));
  }

  // ── Convocatorias con OEP en texto pero SIN enlazar a la entidad `oep` (T-108) ──
  // El histórico de la landing muestra el AÑO DE OEP derivado del enlace `convocatoria_oep`.
  // Si una convocatoria tiene `oep_decreto` pero nadie corrió el backfill --apply, queda sin
  // enlazar y el histórico enseña el año de CONVOCATORIA (no el de OEP) → inconsistente. Caza
  // el olvido (pasó el 25/07: backfill en DRY). Arreglo: node scripts/oep/poblar-historico.cjs <slug>.
  const oepLinkRows = (await c.query(`
    SELECT o.slug, count(*)::int AS n
    FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
    WHERE o.is_active AND cv.oep_decreto IS NOT NULL AND btrim(cv.oep_decreto) <> ''
      AND NOT EXISTS (SELECT 1 FROM convocatoria_oep co WHERE co.convocatoria_id = cv.id)
    GROUP BY o.slug`)).rows;
  for (const r of oepLinkRows) {
    add('content', 'warn', r.slug, 'convocatoria_oep_sin_enlace',
      `${r.slug}: ${r.n} convocatoria(s) con OEP en texto pero SIN enlazar a la entidad oep → el histórico muestra el año de convocatoria, no el de OEP. Correr: node scripts/oep/poblar-historico.cjs ${r.slug}`);
  }

  // ── Textos libres que anuncian un examen pasado como vigente (punto ciego del rollover) ──
  // El badge de rollover mira `exam_date`, pero los textos (FAQs, descripción) pueden seguir
  // diciendo "¿Cuándo es el examen? El 18 de abril de 2026" con la fecha ya pasada → el badge
  // no lo caza y el opositor lee una fecha vieja como la próxima. Apareció 3 veces en 2 días
  // (T-062 Seguridad Social/Osakidetza, T-061 SESCAM). Detector calibrado en
  // lib/convocatoria/examenPasadoEnTexto.cjs: solo el ENGAÑO (presentado como vigente), no el
  // histórico ("se celebró el…") ni las fechas de plazo/publicación/resultados.
  const hoyIso = now.toISOString().slice(0, 10);
  const textoRows = (await c.query(`
    SELECT o.slug,
           COALESCE(v.landing_faqs, o.landing_faqs) AS faqs,
           COALESCE(v.landing_description, o.landing_description) AS descr
    FROM oposiciones o
    LEFT JOIN LATERAL (
      SELECT c2.landing_faqs, c2.landing_description
      FROM convocatorias c2 WHERE c2.oposicion_id = o.id AND c2.is_current LIMIT 1
    ) v ON TRUE
    WHERE o.is_active`)).rows;
  for (const r of textoRows) {
    const h = detectarEnOposicion({ landingDescription: r.descr, landingFaqs: r.faqs }, hoyIso);
    if (!h.length) continue;
    const fechas = [...new Set(h.map((x) => x.iso))].join(', ');
    add('content', 'warn', r.slug, 'texto_examen_pasado',
      `${r.slug}: los textos de la landing anuncian un examen ya pasado como vigente (${fechas}) — el opositor ve una fecha vieja como la próxima`);
  }

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

  // ── CONTENIDO: incisos ANULADOS por el TC — preguntas activas cuya CLAVE cae en el inciso ──
  // Gemelo del backend (content-health-sweep.service.ts). Barato (DB-only): reusa el gate de
  // T-048 answer_falls_in_annulled_fragment sobre vigencia_notes (poblado por el cron T-009).
  // WARN: el gate (≥60 car.) tiene falsos positivos cuando clave e inciso comparten la cláusula
  // inicial pero difieren en el fondo → CANDIDATOS a revisión humana, NUNCA auto-flip.
  const annulledBugs = (await c.query(`
    SELECT l.short_name AS ley, a.article_number AS art, count(DISTINCT q.id)::int AS preguntas
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active AND a.vigencia_notes IS NOT NULL
      AND public.answer_falls_in_annulled_fragment(
        CASE q.correct_option WHEN 0 THEN q.option_a WHEN 1 THEN q.option_b
          WHEN 2 THEN q.option_c WHEN 3 THEN q.option_d END,
        a.vigencia_notes) = true
    GROUP BY l.short_name, a.article_number
    ORDER BY count(DISTINCT q.id) DESC`)).rows;
  if (annulledBugs.length) {
    const total = annulledBugs.reduce((s, r) => s + Number(r.preguntas), 0);
    add('content', 'warn', null, 'answer_in_annulled_fragment',
      `${total} pregunta(s) activa(s) cuya clave reproduce (≥60 car.) un inciso ANULADO por el TC en ${annulledBugs.length} artículo(s) — CANDIDATO: verificar la clave contra la sentencia (puede ser falso positivo si solo comparten la cláusula inicial; NUNCA auto-flip)`,
      { total, articulos: annulledBugs.length, sample: annulledBugs.slice(0, 20) });
  }

  // ── CONTENIDO: PROVENANCE de documentos de convocatoria (referenciado sin clonar/enlazar) ──
  // Lee la VISTA convocatoria_docs_coverage (migración 20260721). Un hito cita un
  // BOE/boletín (url + cita_literal) pero ese documento no está clonado en
  // convocatoria_documentos o no está enlazado (source_documento_id). Gap medido
  // 21/07: 18/1044 hitos enlazados, 239 docs referenciados sin clonar. Runbook:
  // docs/runbooks/provenance-convocatorias.md. Se emite por oposición viva (ciclo
  // vigente incompleto) + un finding agregado para hitos huérfanos (sin convocatoria).
  const cov = (await c.query(`
    SELECT slug, año, docs_clonados, hitos_con_url, docs_por_clonar, hitos_enlazables, citas_sin_fuente
    FROM convocatoria_docs_coverage
    WHERE is_active = true AND is_current = true AND incompleto = true
    ORDER BY docs_por_clonar DESC, hitos_enlazables DESC`)).rows;
  for (const r of cov) {
    const partes = [];
    if (r.docs_por_clonar) partes.push(`${r.docs_por_clonar} doc(s) referenciados sin clonar`);
    if (r.hitos_enlazables) partes.push(`${r.hitos_enlazables} enlazable(s) por URL`);
    if (r.citas_sin_fuente) partes.push(`${r.citas_sin_fuente} cita(s) sin fuente`);
    add('content', 'warn', r.slug, 'convocatoria_docs_incompletos',
      `${r.slug}: provenance incompleta (${partes.join(', ')})`,
      { año: r.año, docs_clonados: r.docs_clonados, hitos_con_url: r.hitos_con_url,
        docs_por_clonar: r.docs_por_clonar, enlazables: r.hitos_enlazables, citas_sin_fuente: r.citas_sin_fuente });
  }
  // hitos huérfanos: cuelgan de la oposición pero sin convocatoria → provenance no
  // atribuible a un ciclo (invisible a la vista). Hay que asignarlos a su convocatoria.
  const orf = (await c.query(`
    SELECT count(*) FILTER (WHERE url IS NOT NULL)::int con_url,
           count(*) FILTER (WHERE cita_literal IS NOT NULL AND length(btrim(cita_literal)) > 0)::int con_cita
    FROM convocatoria_hitos WHERE convocatoria_id IS NULL`)).rows[0];
  if (orf && (orf.con_url > 0 || orf.con_cita > 0)) {
    add('content', 'warn', null, 'convocatoria_docs_incompletos',
      `${orf.con_url} hito(s) con URL y ${orf.con_cita} con cita SIN convocatoria (provenance no atribuible; asignar a su ciclo)`,
      { orphan: true, con_url: orf.con_url, con_cita: orf.con_cita });
  }

  // ── CONTENIDO: CIFRA DE PLAZAS AFIRMADA SIN NINGÚN DOCUMENTO QUE LA CONTENGA ──
  //
  // Hermano del anterior, pero un escalón más grave: aquel dice «falta papeleo», este dice «la landing
  // afirma un número que no está escrito en ninguna parte». Una cifra de plazas solo puede ser un HECHO
  // (y entonces tiene documento) o una PREVISIÓN (y entonces se declara con `plazas_prevision`). Lo que
  // no puede ser es una cifra huérfana presentada como hecho: así acabó auxiliar-administrativo-estado
  // enseñando un total de 2.170 que no existía en ningún documento del mundo.
  //
  // La regla la escribió `scripts/audit-convocatoria-completitud.cjs`, pero ese auditor solo corre bajo
  // demanda — y de hecho llevaba tiempo SIN PODER CORRER (moría con `self-signed certificate`, ver el
  // arreglo de `sslmode=require` allí). Sus hallazgos no llegaban a nadie. Aquí entran al badge.
  //
  // Solo se emite ESTE kind del auditor, no todos: sus otros 104 hallazgos son `senal_aplicada_sin_
  // documento`, la misma deuda documental que ya reporta `convocatoria_docs_incompletos` arriba —
  // duplicarla llenaría la bandeja de un aviso que ya está dado.
  //
  // `error` y no `warn`: las otras reglas de provenance describen trabajo pendiente nuestro; esta
  // describe una cifra que el usuario está leyendo ahora mismo en una página pública.
  // MANTENER EN SYNC con backend/src/content-health-sweep/content-health-sweep.service.ts.
  const { esPlazaHuerfana } = require('../lib/convocatoria/cifraEnTexto.cjs');
  const huerfanas = (await c.query(`
    SELECT o.slug, cv.plazas_libres, cv.boe_reference, cv."año",
           (SELECT count(*)::int FROM convocatoria_documentos d WHERE d.convocatoria_id = cv.id) docs,
           (SELECT string_agg(d.extracted_text, ' ') FROM convocatoria_documentos d
             WHERE d.convocatoria_id = cv.id) corpus,
           (SELECT (v.state = 'verified_correct' AND v.findings ? 'cifra_derivada')
              FROM convocatoria_verification v WHERE v.convocatoria_id = cv.id) derivada_declarada,
           -- La cita de la firma: sin ella no se puede comprobar que la derivación se sostenga.
           (SELECT v.source_snippet FROM convocatoria_verification v WHERE v.convocatoria_id = cv.id) derivada_snippet
      FROM convocatorias cv JOIN oposiciones o ON o.id = cv.oposicion_id
     WHERE cv.is_current AND o.is_active
       AND cv.plazas_libres IS NOT NULL
       AND NOT cv.plazas_prevision
     ORDER BY cv.plazas_libres DESC NULLS LAST`)).rows.filter(esPlazaHuerfana);
  for (const h of huerfanas) {
    add('content', 'error', h.slug, 'plazas_afirmadas_sin_documento',
      h.docs === 0
        ? `${h.slug}: afirma ${h.plazas_libres} plazas (ciclo ${h.año}) y NO hay NINGÚN documento en el corpus. O se clona su fuente, o se marca plazas_prevision con motivo`
        : `${h.slug}: afirma ${h.plazas_libres} plazas (ciclo ${h.año}) y ninguno de sus ${h.docs} documento(s) contiene esa cifra, ni en dígitos ni en letra: o el documento clonado no es el que la prueba, o la cifra está mal`,
      { plazas: h.plazas_libres, referencia: h.boe_reference, año: h.año, docs: h.docs });
  }

  // ── CONTENIDO: PROVENANCE de EPÍGRAFES (verified_literal sin documento del hub enlazado) ──
  // Gemelo del anterior para el 2.º consumidor del hub. verified_literal con source_documento_id
  // NULL = provenance huérfana (validado contra una URL suelta, no contra el doc clonado; el bug
  // que motivó el hub: txt.php ≠ /pdfs). Se enlaza vía ensure_convocatoria_documento (lo hace
  // verify-epigrafe-literality record). Cierra el falso verde de provenance de T-107.
  // MANTENER EN SYNC con backend/src/content-health-sweep/content-health-sweep.service.ts.
  const epiOrf = (await c.query(`
    SELECT replace(t.position_type, '_', '-') AS slug, count(*)::int AS huerfanos
    FROM topics t JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
    WHERE t.is_active AND ev.state = 'verified_literal' AND ev.source_documento_id IS NULL
    GROUP BY 1 ORDER BY 2 DESC`)).rows;
  for (const r of epiOrf) {
    add('content', 'warn', r.slug, 'epigrafe_provenance_no_doc',
      `${r.slug}: ${r.huerfanos} epígrafe(s) verified_literal sin documento del hub enlazado (source_documento_id NULL) — re-verificar o enlazar vía ensure_convocatoria_documento`,
      { huerfanos: r.huerfanos });
  }

  // ── CONTENIDO: REVISIÓN de temario pendiente (Fase 2 de temario-versionado-por-convocatoria) ──
  // Oposición activa con convocatoria vigente cuyo temario NO está verificado del todo contra su
  // fuente oficial → revisar con verify:epigrafe/scope y aplicar al temario vivo. UN finding agregado
  // (no inunda con 111). MANTENER EN SYNC con backend/src/content-health-sweep/content-health-sweep.service.ts.
  const revQ = (await c.query(`
    WITH tv AS (
      SELECT t.position_type, count(*)::int temas,
             count(*) FILTER (WHERE ev.state = 'verified_literal')::int verificados
      FROM topics t LEFT JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
      WHERE t.is_active GROUP BY 1),
    users AS (SELECT target_oposicion pt, count(*)::int n FROM user_profiles WHERE target_oposicion IS NOT NULL GROUP BY 1)
    SELECT o.slug, COALESCE(u.n, 0)::int usuarios
    FROM tv
    JOIN oposiciones o ON o.is_active AND replace(o.slug, '_', '-') = replace(tv.position_type, '_', '-')
    JOIN convocatorias cv ON cv.oposicion_id = o.id AND cv.is_current
    LEFT JOIN users u ON u.pt = tv.position_type
    WHERE tv.verificados < tv.temas
    ORDER BY usuarios DESC`)).rows;
  if (revQ.length > 0) {
    const usuarios = revQ.reduce((a, r) => a + r.usuarios, 0);
    add('content', 'warn', null, 'temario_revision_pendiente',
      `${revQ.length} oposiciones con convocatoria vigente cuyo temario NO está verificado del todo contra su fuente oficial (${usuarios} usuarios) — revisar con verify:epigrafe/scope`,
      { oposiciones: revQ.length, usuarios, top: revQ.slice(0, 15) });
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
    // MIRROR de lib/laws/scopeOverInclusion.ts — materia acotada en prosa (26/07/2026).
    const acotaMateria = (ep.match(/(concepto[s]?|principio[s]?|disposicion(?:es)? general(?:es)?|[áa]mbito de aplicaci[óo]n|definici[óo]n(?:es)?|especialmente protegid\w*|objeto y [áa]mbito)/i) || [null])[0];
    const bigLaw = lawTotal >= 12, nearFull = coverage >= 0.9, enumerator = hasColon && segments >= 3, veryBigLaw = lawTotal >= 60;
    if (wholeLawWords) return { band: 'CLEARED', score: 0, coverage, reason: null };
    if (titComplete && closureWord && nearFull) return { band: 'CLEARED', score: 0, coverage, reason: null };
    let score = 0, reason = null;
    if (explicitArts.size > 0 && bigLaw && scopedCount >= explicitArts.size * 2 && nearFull) { score += 60; reason = `epígrafe cita ${explicitArts.size} arts concretos pero scope tiene ${scopedCount}/${lawTotal}`; }
    if (titGap && nearFull && bigLaw) { score += 50; reason = reason || `epígrafe nombra títulos con huecos (${titSet.join(',')}) pero scope cubre toda la ley`; }
    if (bigLaw && nearFull && enumerator) { score += 30; reason = reason || `ley grande (${lawTotal}) casi completa (${(coverage * 100).toFixed(0)}%) con epígrafe que enumera ${segments} bloques`; }
    if (veryBigLaw && nearFull && !enumerator && acotaMateria) { score += 30; reason = reason || `ley muy grande (${lawTotal}) escopada al ${(coverage * 100).toFixed(0)}% pero el epígrafe ACOTA la materia en prosa ("${acotaMateria}") sin enumerar bloques`; }
    const band = score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'NONE';
    return { band, score, coverage, reason };
  };
  const overIncl = (await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley, t.epigrafe,
           ts.article_numbers,
           (SELECT count(*) FROM articles a WHERE a.law_id = ts.law_id AND a.article_number ~ '^[0-9]+$') law_total
    FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
    WHERE t.is_active = true
      -- El badge tiene que poder BAJAR: se excluyen los (tema, ley) ya adjudicados con
      -- veredicto ok, que es el estado final tanto de un falso positivo como de un
      -- recorte YA APLICADO (la guarda determinista de --record/--reguard los deja ahi
      -- cuando los articulos a excluir ya no estan en el scope). Sin esto el kind
      -- scope_over_inclusion_suspect no bajaba NUNCA: el 26/07 seguia contando casos
      -- adjudicados y recortados horas antes. Un forcing-function que no se puede
      -- satisfacer deja de ser señal, que es justo lo que T-112 quiere evitar.
      -- Los adjudicados como over_inclusion SI siguen contando: son trabajo pendiente.
      AND NOT EXISTS (
        SELECT 1 FROM scope_over_inclusion_adjudications adj
         WHERE adj.topic_id = ts.topic_id AND adj.law_id = ts.law_id AND adj.verdict = 'ok'
      )`)).rows;
  const oiHigh = [];
  for (const r of overIncl) {
    // NULL en `article_numbers` = TODA la ley (convención del proyecto). Contarlo como 0
    // artículos escopados dejaba el 32% de los scopes (1.925 de 5.925) INVISIBLE al
    // detector de sobre-inclusión: justo los que más pueden pasarse de ancho. Medido
    // el 26/07: al tratarlos como cobertura 100% salen 11 HIGH, y las dos primeras
    // comprobadas a mano eran sobre-inclusión REAL (Guardia Civil T9 enumera títulos
    // concretos dentro de 5 libros de la LECrim y tenía los 920 artículos; tcae_sescam
    // T4 pide de la LPRL solo "Derechos y obligaciones; Consulta y participación" y
    // tenía los 55). Cuidado al leer el MOTIVO en estos casos: puede citar la regla de
    // "artículos concretos" cuando lo que de verdad falla es la enumeración de títulos.
    const scoped = r.article_numbers === null
      ? Number(r.law_total)
      : r.article_numbers.filter(x => /^[0-9]+$/.test(x)).length;
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

  // NOTA: el detector de OFF-BY-ONE DE FRONTERA DE TÍTULO (art. escopado de un
  // título que el epígrafe no nombra; caso Mario/LOSU 24/07) NO se ejecuta aquí
  // como kind que pinga el badge. La simulación bank-wide (24/07) dio recall alto
  // pero PRECISIÓN baja: muchos epígrafes nombran el título por su MATERIA
  // ("La organización territorial del Estado" = Título VIII CE) y no por su número,
  // así que un detector que solo lee "Título <romano>" marca falsos positivos. Es
  // el mismo criterio que la banda MEDIUM de scope_over_inclusion: alimenta la
  // ADJUDICACIÓN bajo demanda, no el badge. Runner on-demand:
  //   npx tsx scripts/scope/sim-title-boundary.ts <position_type> [topic]
  // Núcleo puro y testeado: lib/laws/scopeTitleBoundary.js. Robustecerlo para badge
  // exige cotejar la RÚBRICA del título contra el epígrafe (pendiente).

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
  // Regex de refs de artículo REALES: empieza por dígito (excluye basura estructural
  // tipo "T3"/"TP"/"T1C2" de la CE), acepta variantes latinas (bis/ter/quáter/quinquies/
  // sexies/septies/octies/nonies/decies, con o sin espacio) y sufijo de letra ("861 bis a)",
  // "47 b"). El matching usa NORMALIZACIÓN (minúsculas, sin acentos, sin espacios ni ')')
  // para NO inventar falsos fantasmas por diferencias de FORMATO entre scope y articles
  // ("21bis" == "21 bis", "86 quáter" == "86 quater").
  const normArt = (col) => `lower(regexp_replace(translate(${col}, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g'))`;
  const ART_RE = "'^[0-9]+( ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?( ?[a-z)]*)?$'";
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
           CASE WHEN NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND ${normArt('a.article_number')} = ${normArt('r.art')})
                THEN 'inexistente' ELSE 'desactivado' END AS causa
    FROM refs r
    WHERE r.art ~* ${ART_RE}
      AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND ${normArt('a.article_number')} = ${normArt('r.art')} AND a.is_active)`)).rows;
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

  // ── Drift del barajado de opciones (verificación robusta) ──
  // Delega en el script tsx que usa el detector REAL (sin copiar la lógica aquí): caza
  // preguntas shuffle_safety='safe' cuya explicación cita letras/posición (regresión/miss)
  // o cuyo hash no casa (trigger no invalidó). Subproceso porque el detector es TS.
  try {
    const { execSync } = require('child_process');
    const out = execSync('npx tsx scripts/sweep-shuffle-safety-drift.ts --json', {
      cwd: process.cwd(), encoding: 'utf8', env: process.env, timeout: 120000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const drift = JSON.parse(out.trim().match(/\{[\s\S]*\}$/)[0]);
    if (drift.regressions > 0 || drift.hash_mismatch > 0) {
      add('content', 'warn', null, 'shuffle_safe_regressed',
        `${drift.regressions} pregunta(s) 'safe' cuya explicación cita letras/posición${drift.hash_mismatch ? ` + ${drift.hash_mismatch} con hash desincronizado (trigger)` : ''} — barajarlas rompería la explicación`,
        { regressions: drift.regressions, hash_mismatch: drift.hash_mismatch, sample: drift.sample });
    }
  } catch (e) { console.warn('⚠️ drift barajado no evaluado:', String(e.message || e).slice(0, 120)); }

  // ── scope_cross_tema_dup: misma ley REAL escopada ENTERA (o solape grande) en ≥2 temas ──
  // Punto ciego de over-inclusion (mira 1 tema vs epígrafe) y de huecos (los temas rebosan).
  // Umbral: ley entera/NULL compartida por >1 tema, o ≥20 arts solapados (1-10 = cross-cutting legítimo).
  const ctRows = (await c.query(`
    SELECT t.position_type pt, l.short_name ley, t.topic_number tn, ts.article_numbers an
    FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
    WHERE t.is_active = true
      AND (l.short_name ~* '^(Ley|Real|Decreto|Estatut|Llei|Convenio|Reglament|Constituci|Tratado)' OR l.short_name ~ '^(LO|RD|RDL|CE|TR|TUE|TFUE|RGPD)')`)).rows;
  const ctGroups = {};
  for (const r of ctRows) { const k = r.pt + '\u0000' + r.ley; (ctGroups[k] = ctGroups[k] || []).push(r); }
  const ctDups = [];
  for (const k of Object.keys(ctGroups)) {
    const rows = ctGroups[k]; if (rows.length < 2) continue;
    const [pt, ley] = k.split('\u0000');
    const arrs = rows.map(r => { const a = r.an || []; const nums = a.map(x => parseInt(String(x).replace(/[^0-9]/g, ''), 10)).filter(n => !isNaN(n)); return { tn: r.tn, set: new Set(nums), nulish: a.length === 0 }; });
    let maxOv = 0, pair = null;
    if (arrs.filter(a => a.nulish).length > 1) { maxOv = 9999; pair = arrs.filter(a => a.nulish).map(a => 'T' + a.tn).join('=T') + ' (ley entera/NULL)'; }
    else for (let i = 0; i < arrs.length; i++) for (let j = i + 1; j < arrs.length; j++) { let cc = 0; for (const n of arrs[i].set) if (arrs[j].set.has(n)) cc++; if (cc > maxOv) { maxOv = cc; pair = 'T' + arrs[i].tn + '∩T' + arrs[j].tn + '=' + cc + ' arts'; } }
    if (maxOv >= 20) ctDups.push({ pt, ley, dup: pair });
  }
  if (ctDups.length) {
    const nOpos = new Set(ctDups.map(x => x.pt)).size;
    add('content', 'warn', null, 'scope_cross_tema_dup',
      `${ctDups.length} ley(es) REAL duplicada(s) entre temas (misma ley entera/solape grande en ≥2 temas → preguntas repetidas en varios tests) en ${nOpos} oposición(es) — repartir por materia con verify:scope (npm run scope:health -- --pending)`,
      { count: ctDups.length, oposiciones: nOpos, sample: ctDups.slice(0, 20) });
  }

  // ── CONTENIDO: scope SIN VERIFICAR contra el epígrafe (cierra el punto ciego) ──
  // Un topic_scope nunca auditado (o `stale`) contra el epígrafe oficial es un HUECO:
  // puede servir preguntas fuera de programa sin que salte nada (caso Auxiliar
  // Extremadura, 25/07). Antes solo se cazaba on-demand (audit:epigrafe / verify:scope);
  // ahora el panel lo marca. Agregado por OPOSICIÓN (no por tema) para no inundar.
  // Mirror INLINE de backend/src/content-health-sweep/content-health-sweep.service.ts
  // (scope_sin_verificar) — MANTENER EN SYNC (guardarraíl: content-sweep-parity).
  const svRows = (await c.query(`
    SELECT o.slug,
      count(t.id)::int AS temas,
      count(t.id) FILTER (WHERE v.state IN ('verified_correct','verified_issues'))::int AS verificados,
      count(t.id) FILTER (WHERE v.state IS NULL OR v.state NOT IN ('verified_correct','verified_issues'))::int AS sin_auditar
    FROM oposiciones o
    JOIN topics t ON t.position_type = replace(o.slug, '-', '_') AND t.is_active = true
    LEFT JOIN topic_scope_verification v ON v.topic_id = t.id
    WHERE o.is_active = true
    GROUP BY o.slug
    HAVING count(t.id) FILTER (WHERE v.state IS NULL OR v.state NOT IN ('verified_correct','verified_issues')) > 0
    ORDER BY sin_auditar DESC`)).rows;
  for (const r of svRows) {
    add('content', 'warn', r.slug, 'scope_sin_verificar',
      `${r.slug}: ${r.sin_auditar}/${r.temas} tema(s) con scope SIN auditar (o stale) contra el epígrafe oficial — el temario podría servir preguntas fuera de programa sin avisar. Verifica con verify:scope.`,
      { temas: r.temas, verificados: r.verificados, sin_auditar: r.sin_auditar });
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
  // vía impugnación 7119bd5d; barrido posterior jubiló 5 más). Patrón ALTA PRECISIÓN:
  // deixis SINGULAR "el/la siguiente <cosa visual>" en ambos órdenes (el plural "de las
  // siguientes …" = "de las siguientes opciones", FP masivo) + guardas contra "imagen
  // corporal/pública", "de la imagen y el sonido", iconos descritos en texto, etc.
  // Remediar: si el texto ya describe el visual = autocontenida; si hay fuente →
  // reconstruir la imagen; si no → jubilar (admin_image_unavailable). NUNCA inventar.
  // Patrones + guardas: NÚCLEO PURO COMPARTIDO en lib/health/visualDeixis.cjs (incluye la
  // calibración de T-113: `esquema` no es sustantivo visual, y guarda de SQL autocontenido).
  // El backend @Cron los replica inline y `content-sweep-parity` compara ambos POR VALOR.
  const vdRows = (await c.query(`
    SELECT id, question_text FROM questions
    WHERE is_active = true
      AND (image_url IS NULL OR image_url = '')
      AND (content_data IS NULL OR content_data::text IN ('{}','null',''))
      AND question_text ~* $1 AND question_text !~* $2
      AND (coalesce(question_text,'') || ' ' || coalesce(option_a,'') || ' ' ||
           coalesce(option_b,'') || ' ' || coalesce(option_c,'') || ' ' ||
           coalesce(option_d,'')) !~* $3
    LIMIT 60`, [VD_STRONG, VD_FP, VD_SQL])).rows;
  if (vdRows.length) add('content', 'warn', null, 'visual_deixis_no_image',
    `${vdRows.length}${vdRows.length >= 60 ? '+' : ''} pregunta(s) visible(s) que invocan un icono/símbolo/imagen SIN imagen almacenada (image_url NULL) — irresolubles; reconstruir la imagen o jubilar (admin_image_unavailable)`,
    { count: vdRows.length, sample: vdRows.slice(0, 15).map(r => ({ id: r.id, q: (r.question_text || '').slice(0, 90) })) });

  // ── Feedback INCONTESTABLE: pendiente y sin conversación (T-247, 28/07/2026) ──
  // `/api/v2/feedback/respond` se NIEGA a responder si el feedback no tiene fila en
  // `feedback_conversations` (409). Un feedback `pending` sin ella es, por definición,
  // imposible de contestar por el flujo normal — y el usuario no se entera de nada: escribe
  // y no recibe respuesta jamás.
  //
  // No es hipotético: las solicitudes que llegaban por el CHAT DE IA no creaban conversación,
  // y las 6 que entraron entre abril y julio se quedaron SIN UNA SOLA respuesta (cinco
  // cerradas como `dismissed`, una como `resolved`, en silencio). Se arregló el origen, y
  // esto es la red por si otro camino de creación vuelve a olvidarla.
  //
  // Va como APP y no como contenido: el usuario está esperando una respuesta que no llegará.
  // Se excluyen las solicitudes de borrado de cuenta, que van por su propio manual y NO se
  // responden por el hilo (serían un falso positivo permanente).
  const sinConv = (await c.query(`
    SELECT f.id, f.type, left(f.message, 90) AS msg, f.created_at
    FROM user_feedback f
    WHERE f.status = 'pending'
      AND f.message NOT LIKE '[Solicitud de eliminación de cuenta%'
      AND NOT EXISTS (SELECT 1 FROM feedback_conversations c2 WHERE c2.feedback_id = f.id)
    ORDER BY f.created_at
    LIMIT 50`)).rows;
  if (sinConv.length) add('app', 'error', null, 'feedback_sin_conversacion',
    `${sinConv.length} feedback(s) PENDIENTES sin conversación: el endpoint de respuesta los rechaza (409), así que son incontestables y el usuario nunca recibirá contestación`,
    { count: sinConv.length, sample: sinConv.slice(0, 10).map(r => ({ id: r.id, type: r.type, msg: r.msg, creado: r.created_at })) });

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
