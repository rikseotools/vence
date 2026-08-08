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
const { clasificarNotasVigilancia } = require('../lib/convocatoria/notasSinVigilancia.cjs');
const { detectarEnOposicion } = require('../lib/convocatoria/examenPasadoEnTexto.cjs');
const { clasificarHito, esFechaDeExamen } = require('../lib/convocatoria/hitoOrigen.js');
const { checkConvocatoriaLinks } = require('../lib/convocatoria/linkCoherence.cjs');
const { detectarReservaSinDeclarar } = require('../lib/convocatoria/reservaSinDeclarar.cjs');
const { classifyLandingCompleteness } = require('../lib/convocatoria/landingCompleteness.cjs');
const { VD_STRONG, VD_FP, VD_SQL } = require('../lib/health/visualDeixis.cjs');
const { tablasFrias, tablasSinAjuste, remedioVisibilidad, VM_MIN_PAGES } = require('../lib/db/visibilityMap.cjs');
const { detectarTecho } = require('../lib/observability/techoTimeout.cjs');
const { epigrafesSucios } = require('../lib/health/epigrafeRuidoBoletin.cjs');
const { epigrafesTruncados } = require('../lib/health/epigrafeTruncado.cjs');
const { explicacionesRotas } = require('../lib/health/explicacionEstructuraRota.cjs');
const { clasificaTruncada } = require('../lib/health/explicacionTruncada.cjs');
const { AC_DESNUDA, AC_IDENTIFICA, AC_SIGLA } = require('../lib/health/autocontenida.cjs');
const { AUDIT_NOTE_META_RE_SRC, AUDIT_NOTE_ACTO_RE_SRC, AUDIT_NOTE_LITERAL_RE_SRC } = require('../lib/health/auditNoteExplanation.cjs');
const { ARTICLE_AUDIT_NOTE_RE_SRC_SQL } = require('../lib/health/articleAuditNote.cjs');
const { clasificarLote: clasificarOpcionesDuplicadas, LETRAS: LETRAS_OPCION } = require('../lib/health/opcionesDuplicadas.cjs');
const { clasificarVeredicto } = require('../lib/health/veredictoRojoInequivoco.cjs');
// Criterio del banco duplicado ENTERO (distinto de opciones_duplicadas: aquí se repite la
// PREGUNTA, no una opción dentro de ella). Compartido con scripts/calidad/duplicados-exactos.cjs
// para que el barrido nocturno y la herramienta manual de jubilar nunca discrepen. Ver T-408.
const { bandaGrupo: bandaDuplicado, sqlNormalizar: sqlNormalizarDup, unidoSoloPorTildes } = require('../lib/calidad/duplicados.js');
// Universo del detector de cobertura (numérico + familia de reforma) y orden seguro de los
// ejemplos: una sola definición, compartida con el planificador. Ver T-146.
const { SQL_UNIVERSO_COBERTURA, SQL_ORDEN_ARTICULO, UMBRAL_BANDA_CIEGA } = require('../lib/generacion/huerfanosPlan.js');
// Clasificador de familia (T-384): `lib/oposiciones/familia.ts` es TS y este script es CJS sin
// ts-node — el bridge YA existía (`scripts/_load-familia.cjs`, babel-en-memoria), usado hasta hoy
// solo por `backfill-familia.cjs`. Reutilizarlo aquí es la única fuente, no una copia.
const loadFamiliaModule = require('./_load-familia.cjs');
const { degradaFamilia } = require('../lib/oposiciones/familiaBackfill.cjs');

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
  // Latido de lo EVALUADO (T-529): kind → nº de sujetos mirados esta pasada, con o sin hallazgos.
  // El gemelo real es el `@Cron` del backend (el que ESCRIBE el latido en `observable_events`);
  // este script es manual/DRY, así que aquí solo se IMPRIME al final — sirve para comprobar a
  // mano, antes de desplegar un detector nuevo, que su kind quedó cableado en el punto correcto.
  const kindsEvaluados = {};
  const marcar = (kind, n) => { kindsEvaluados[kind] = (kindsEvaluados[kind] || 0) + n; };

  // ── Detección: AISLADA del resto (T-307, 30/07/2026) ──
  // Mismo contrato que el @Cron del backend: un detector que revienta NO se lleva la pasada. Se
  // escribe lo recogido hasta el corte y se añade `sweep_incompleto` para que el panel diga que la
  // foto está a medias en vez de enseñar la de ayer como si fuera de hoy.
  let incompleto = null;
  try {
    await detectarTodo(c, add, marcar, now);
  } catch (e) {
    const msg = String(e?.message || e);
    const m = msg.match(/Failed query:\s*([\s\S]{0,400})/);
    incompleto = { mensaje: msg.slice(0, 300), sql: m ? m[1].trim().slice(0, 300) : null };
    console.error('❌ barrido INCOMPLETO:', incompleto.mensaje);
    add('app', 'error', null, 'sweep_incompleto',
      `el barrido se cortó a mitad: solo ${F.length} hallazgo(s) de esta pasada son fiables — el resto de detectores NO llegaron a correr`,
      { hallazgosAntesDelCorte: F.length, error: incompleto.mensaje, queryQueFallo: incompleto.sql });
  }


  // ── Techo de timeout: ¿lento, o chocando contra un corte? (T-315) ──
  // Todos los detectores de latencia miran la MAGNITUD, y un timeout y una lentitud real dan la
  // misma. Lo que los separa es la FORMA de la cola. Esta capa faltaba y su ausencia costó TRES
  // atribuciones erróneas del mismo síntoma antes de dar con ANTIFRAUD_TIMEOUT_MS.
  try {
    const eps = (await c.query(`
      SELECT endpoint FROM observable_events
       WHERE event_type='request_completed' AND duration_ms > 5000
         AND created_at > now() - interval '14 days' AND endpoint IS NOT NULL
       GROUP BY endpoint HAVING count(*) >= 20`)).rows;
    for (const { endpoint } of eps) {
      const tr = (await c.query(`
        SELECT lo AS "desdeMs", hi AS "hastaMs",
               (SELECT count(*)::int FROM observable_events e
                 WHERE e.event_type='request_completed' AND e.endpoint=$1
                   AND e.created_at > now() - interval '14 days'
                   AND e.duration_ms >= lo AND e.duration_ms < hi) AS n
          FROM (VALUES (5000,10000),(10000,20000),(20000,24000),(24000,26000),(26000,60000),(60000,600000)) v(lo,hi)`,
        [endpoint])).rows;
      const techo = detectarTecho(tr.map(r => ({ desdeMs: Number(r.desdeMs), hastaMs: Number(r.hastaMs), n: Number(r.n) })));
      if (techo.hayTecho) {
        add('app', 'warn', null, 'latencia_techo_timeout',
          `\`${endpoint}\` NO va lento: choca contra un TECHO de ~${Math.round(techo.techoMs/1000)} s — ${techo.motivo}`,
          { endpoint, techoMs: techo.techoMs, enTecho: techo.enTecho, porEncima: techo.porEncima, motivo: techo.motivo });
      }
    }
    marcar('latencia_techo_timeout', eps.length);
  } catch (e) { console.warn('⚠️ techo de timeout no evaluado:', String(e.message || e).slice(0, 120)); }

  // ── Escribir snapshot ──
  //
  // NO es un TRUNCATE de la tabla entera (arreglado T-455, 07/08/2026): otras herramientas
  // ON-DEMAND (p.ej. `audit-oposicion-completa.ts`, kind oposicion_incompleta) escriben en
  // esta MISMA tabla fuera de este barrido, y un TRUNCATE incondicional se las llevaba por
  // delante cada noche sin que este barrido las volviera a comprobar — la publicación de
  // T-455 sobrevivía como mucho hasta el siguiente tick del @Cron (07:30 UTC), no hasta que
  // el problema se arreglara. Medido en vivo (07/08): `content_health_findings` tenía 0 filas
  // kind oposicion_incompleta (sin comillas) mientras las demás ~37 kinds databan `computed_at` de la
  // pasada de la noche anterior — el barrido las había borrado y nada las repuso. Ahora solo
  // se borran los kinds que ESTA pasada evaluó de verdad (`kindsEvaluados`, el mismo objeto
  // del latido de T-529): un kind ajeno al barrido nunca se toca, y un barrido `sweep_incompleto`
  // (T-307) tampoco arrasa los kinds que no llegó a evaluar.
  if (!NO_WRITE) {
    const kindsDeEstaPasada = Object.keys(kindsEvaluados);
    if (kindsDeEstaPasada.length) await c.query('DELETE FROM content_health_findings WHERE kind = ANY($1::text[])', [kindsDeEstaPasada]);
    for (const f of F) await c.query(`INSERT INTO content_health_findings (category, severity, oposicion_slug, kind, message, detail) VALUES ($1,$2,$3,$4,$5,$6)`, [f.category, f.severity, f.slug, f.kind, f.message, f.detail ? JSON.stringify(f.detail) : null]);
    console.log(`✅ ${stamp} — ${F.length} hallazgos escritos (app err=${F.filter(x => x.category === 'app' && x.severity === 'error').length}, content err=${F.filter(x => x.category === 'content' && x.severity === 'error').length}, content warn=${F.filter(x => x.category === 'content' && x.severity === 'warn').length})`);
  }
  console.log(`ℹ️  kinds evaluados esta pasada: ${Object.keys(kindsEvaluados).length} (npm run health:kinds-evaluados lee el latido REAL, el del @Cron)`);
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
  // `feedback_sin_conversacion` va en la lista de los que alertan SIEMPRE, con
  // `http_down` y `empty_topic`: aquí el volumen no mide la gravedad. UN feedback
  // incontestable es UN usuario que escribió y no recibirá respuesta nunca, y esperar a
  // que se acumulen diez es esperar a tener diez personas ignoradas. (Se descubrió al
  // correr el sweep de verdad, 28/07: el hallazgo usaba `detail.count` y este filtro lee
  // `detail.n`, así que además no habría alertado NUNCA por volumen.)
  const appFire = appErr.filter(f => ['http_down', 'empty_topic', 'feedback_sin_conversacion', 'chat_ia_errores'].includes(f.kind) || (f.detail && Number(f.detail.n) >= APP_OBS_MIN));

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
  // Una pasada a MEDIAS no sale con 0 (T-307): el que lo invoque —persona o wrapper— tiene que
  // poder distinguir "barrido completo" de "barrido cortado", igual que el @Cron marca su
  // `cron_run` en error. Salir con 0 tras escribir un snapshot incompleto sería el mismo falso
  // verde que este arreglo existe para matar.
  process.exit(incompleto ? 1 : 0);

  async function sendEmail(subject, html) {
    if (DRY) { console.log('=== DRY EMAIL ===\nTo:', ALERT_EMAIL, '| Subject:', subject, '\n', html.slice(0, 400), '...'); return; }
    if (!process.env.RESEND_API_KEY) { console.error('❌ Falta RESEND_API_KEY'); return; }
    const res = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: `Vence Salud <${FROM_EMAIL}>`, to: [ALERT_EMAIL], subject, html }) });
    const b = await res.json().catch(() => ({}));
    console.log(res.ok ? `✅ email enviado: ${subject} (${b.id || 'ok'})` : `❌ fallo email: ${res.status} ${JSON.stringify(b)}`);
  }
}

/**
 * Todos los detectores, en secuencia. Aparte de main() para que main() pueda aislar el fallo de
 * uno y conservar lo ya recogido (T-307). No escribe nada: solo llena F vía add().
 */
async function detectarTodo(c, add, marcar, now) {
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
    marcar('http_down', 3);
    // ── APP: cobertura (MV, misma fuente que la app) ──
    // `tp.is_active` NO estaba, y eso daba VERDE FALSO en la tarjeta de temas (T-384, 31/07/2026):
    // un topic desactivado no existe para el opositor, pero contaba igual, así que una landing que
    // promete 120 temas y sirve 20 cuadraba porque los otros 100 seguían ahí como filas inactivas.
    // Caso real: `etgoa-sanidad-consumo`, PUBLICADA, tarjeta de 120 con 20 activos (19 disponibles)
    // y 4 usuarios estudiándola. Lo cazaba el test de CI `configDbIntegrity` —que sí filtra
    // activos— mientras este detector decía que todo bien; el desacuerdo entre los dos era la
    // pista. Calibrado antes de tocar: de 124 oposiciones publicadas solo UNA tiene topics
    // inactivos, así que el filtro añade exactamente ese hallazgo y no genera ruido.
    const topics = (await c.query(`SELECT tp.topic_number, tp.disponible, COALESCE(SUM(s.total_questions),0)::int n
      FROM topics tp LEFT JOIN topic_law_question_summary s ON s.topic_id = tp.id
      WHERE tp.position_type = $1 AND tp.is_active
      GROUP BY tp.topic_number, tp.disponible`, [pt])).rows;
    const disp = topics.filter(t => t.disponible);
    marcar('empty_topic', topics.length);
    if (topics.length && disp.length === 0) add('app', 'error', o.slug, 'empty_topic', `${o.slug}: 0 temas disponibles (publicado vacío)`);
    const vacios = disp.filter(t => t.n === 0);
    if (vacios.length) add('app', 'error', o.slug, 'empty_topic', `${o.slug}: ${vacios.length} tema(s) disponible(s) SIN preguntas (T${vacios.slice(0, 5).map(v => v.topic_number).join(',T')})`);
    const finos = disp.filter(t => t.n > 0 && t.n < 6);
    marcar('low_coverage', disp.length);
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
          (array_agg(l.short_name || ' ' || a.article_number ORDER BY ${SQL_ORDEN_ARTICULO})
            FILTER (WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)))[1:6] AS ejemplos
        FROM topic_scope ts
        JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
        JOIN laws l ON l.id = ts.law_id
        -- article_numbers NULL = LA LEY ENTERA (T-451). Con el unnest de antes, unnest(NULL) no
        -- devuelve ni una fila, así que esos scopes DESAPARECÍAN del detector: el badge no podía
        -- ver el temario escopado por ley completa. Mismo criterio que articleInScope() y que el
        -- planificador de huérfanos, ya arreglado — no un tercer intérprete del NULL.
        JOIN articles a ON a.law_id = ts.law_id AND a.is_active
                       AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        WHERE tp.position_type = $1 AND length(coalesce(a.content,'')) > 40 AND a.content NOT ILIKE '%derogado%'
          AND ${SQL_UNIVERSO_COBERTURA}
        GROUP BY tp.topic_number
        HAVING count(*) >= 4
           AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
           AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float / count(*) >= 0.6
           AND count(*) - count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) >= 4
      ) t
      ORDER BY topic_number`, [pt])).rows;
    marcar('article_no_coverage', topics.length);
    if (sinPreg.length) {
      const tot = sinPreg.reduce((a2, r) => a2 + r.n, 0);
      add('content', 'warn', o.slug, 'article_no_coverage',
        `${o.slug}: ${sinPreg.length} tema(s) con artículos del temario SIN preguntas (${tot} arts; p.ej. T${sinPreg[0].topic_number}: ${(sinPreg[0].ejemplos || []).join(', ')})`,
        { temas: sinPreg.map(r => ({ tema: r.topic_number, arts_sin_preguntas: r.n, ejemplos: r.ejemplos })) });
    }

    // ── CONTENIDO: banda ciega de cobertura (T-543, 05/08/2026) ──
    // La zona que NI `article_no_coverage` (exige ≥60% cubierto) NI `low_coverage` (exige
    // <6 preguntas servidas) ven: un tema con ≥4 huecos, cobertura de artículos <60% y, aun
    // así, un volumen de preguntas servidas donde SÍ se nota al estudiar (calibrado contra
    // RDS: acotado a <=50 porque por encima la mediana de la banda es 92 y esas preguntas
    // no se agotan en una sesión de estudio — ver `UMBRAL_BANDA_CIEGA` en huerfanosPlan.js).
    // Caso raíz: Neus A.B. repitiendo el tema 3 de subalterno_gva (EACV) tres veces en 19h.
    const bandaCiega = (await c.query(`
      SELECT topic_number, n_content, n_cov, (n_content - n_cov)::int AS huerfanos, preguntas, ejemplos FROM (
        SELECT tp.topic_number, tp.id AS topic_id,
          count(*)::int AS n_content,
          count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::int AS n_cov,
          (array_agg(l.short_name || ' ' || a.article_number ORDER BY ${SQL_ORDEN_ARTICULO})
            FILTER (WHERE NOT EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)))[1:6] AS ejemplos
        FROM topic_scope ts
        JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active AND tp.disponible
        JOIN laws l ON l.id = ts.law_id
        JOIN articles a ON a.law_id = ts.law_id AND a.is_active
                       AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
        WHERE tp.position_type = $1 AND length(coalesce(a.content,'')) > 40 AND a.content NOT ILIKE '%derogado%'
          AND ${SQL_UNIVERSO_COBERTURA}
        GROUP BY tp.topic_number, tp.id
        HAVING count(*) >= 4
           AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
           AND count(*) - count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) >= 4
           AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float / count(*) < 0.6
      ) t
      JOIN LATERAL (
        SELECT COALESCE(SUM(s.total_questions), 0)::int AS preguntas
          FROM topic_law_question_summary s WHERE s.topic_id = t.topic_id
      ) q ON true
      WHERE q.preguntas BETWEEN ${UMBRAL_BANDA_CIEGA.minPreguntas} AND ${UMBRAL_BANDA_CIEGA.maxPreguntas}
      ORDER BY q.preguntas ASC, topic_number`, [pt])).rows;
    if (bandaCiega.length) {
      const tot = bandaCiega.reduce((a2, r) => a2 + Number(r.huerfanos), 0);
      add('content', 'warn', o.slug, 'cobertura_banda_ciega',
        `${o.slug}: ${bandaCiega.length} tema(s) con cobertura de artículos <60% y pocas preguntas para notarlo (${tot} arts sin cubrir; p.ej. T${bandaCiega[0].topic_number}: ${bandaCiega[0].preguntas} preg, ${(bandaCiega[0].ejemplos || []).join(', ')})`,
        { temas: bandaCiega.map(r => ({ tema: r.topic_number, preguntas: r.preguntas, arts_sin_preguntas: r.huerfanos, ejemplos: r.ejemplos })) });
    }
    // El bloque TERMINÓ de mirar su población: un 0 aquí es «vigilado y limpio», no «nadie miró».
    marcar('cobertura_banda_ciega', bandaCiega.length);

    // ── ARTÍCULO SERVIDO MUDO (T-596) ──
    // El temario pinta cada artículo con su rúbrica y, si no la hay, con un extracto de su
    // contenido (`lib/teoria/encabezadoArticulo`). Queda mudo —número pelado, sin una línea que
    // leer— solo cuando NO tiene ninguna de las dos cosas. Eso es lo que se mide aquí.
    //
    // Nace del bug que lo originó: hasta el 05/08 el encabezado colgaba SOLO de `title`, que
    // 13.952 artículos activos (23% del banco) tienen a NULL teniendo el texto guardado, así que
    // se servían mudos 48 de 62 en un tema. Lo destapó un premium estudiando, no un detector:
    // ningún kind miraba si lo que servimos se puede LEER. Con el render arreglado esa masa
    // desaparece y queda esta cola, corta y accionable: los que de verdad no tienen contenido.
    //
    // ⚠️ El criterio que MANDA es `articuloSinTextoVisible()`; esto es su espejo en SQL (el sweep
    // es CJS y no puede llamar al núcleo TS). Por eso el corte es el trivial —ni rúbrica ni texto—
    // y no una heurística propia: un espejo simple se puede comprobar de un vistazo, uno listo no.
    const mudos = (await c.query(`
      SELECT tp.topic_number,
        count(*)::int AS n,
        (array_agg(l.short_name || ' ' || a.article_number ORDER BY ${SQL_ORDEN_ARTICULO}))[1:6] AS ejemplos
      FROM topic_scope ts
      JOIN topics tp ON tp.id = ts.topic_id AND tp.is_active
      JOIN laws l ON l.id = ts.law_id
      -- article_numbers NULL = LA LEY ENTERA: mismo criterio que el detector de cobertura.
      JOIN articles a ON a.law_id = ts.law_id AND a.is_active
                     AND (ts.article_numbers IS NULL OR a.article_number = ANY(ts.article_numbers))
      WHERE tp.position_type = $1
        AND coalesce(btrim(a.title), '') = ''
        AND length(btrim(coalesce(a.content, ''))) = 0
      GROUP BY tp.topic_number
      ORDER BY tp.topic_number`, [pt])).rows;
    if (mudos.length) {
      const tot = mudos.reduce((a2, r) => a2 + r.n, 0);
      add('content', 'warn', o.slug, 'articulo_servido_sin_texto',
        `${o.slug}: ${tot} artículo(s) del temario se sirven SIN NADA que leer (ni rúbrica ni texto; p.ej. T${mudos[0].topic_number}: ${(mudos[0].ejemplos || []).join(', ')})`,
        { temas: mudos.map(r => ({ tema: r.topic_number, arts_mudos: r.n, ejemplos: r.ejemplos })) });
    }
    marcar('articulo_servido_sin_texto', mudos.length);

    // ── CONTENIDO: coherencia de tarjetas + dual-write + hitos ──
    const nTopics = topics.length;
    if (o.temas_count != null && Number(o.temas_count) !== nTopics) add('content', 'error', o.slug, 'temas_card', `temas_count=${o.temas_count} ≠ ${nTopics} topics reales`);
    // Una tarjeta que dice "del programa OFICIAL" habla del temario del boletín, no de lo que
    // servimos, y las dos cosas pueden diferir legítimamente (Policía Nacional: 45 del Anexo I +
    // un bloque de inglés de apoyo). Compararla con los topics servidos ponía a este detector a
    // pelearse con la honestidad de la landing; esas tarjetas las verifica `audit:landing` contra
    // el documento oficial (T-142).
    const temaCards = cardsAbout(o.landing_estadisticas, 'tema');
    for (const card of temaCards) {
      if (/oficial|programa/i.test(String(card.texto || ''))) continue;
      const v = cardInt(card.numero);
      if (v != null && v !== nTopics) add('content', 'error', o.slug, 'temas_card', `tarjeta "${card.texto}"=${v} pero hay ${nTopics} topics`);
    }
    marcar('temas_card', 1 + temaCards.length);
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
      const plazaCards = cardsAbout(o.landing_estadisticas, 'plaza');
      for (const card of plazaCards) { const v = cardInt(card.numero); if (v != null && !valid.has(v)) add('content', 'error', o.slug, 'plaza_card', `tarjeta "${card.texto}"=${v} no cuadra con conv (L=${L} D=${D} P=${P})`); }
      marcar('plaza_card', plazaCards.length);
      const faltan = ['boe_reference', 'programa_url', 'examen_config', 'landing_faqs', 'landing_estadisticas', 'landing_description'].filter(k => conv[k] == null);
      if (faltan.length) add('content', 'warn', o.slug, 'dual_write', `dual-write convocatoria incompleto: ${faltan.join(', ')}`);
      marcar('dual_write', 1);
      if (conv.estado_proceso === 'inscripcion_abierta') {
        const h = Number((await c.query(`SELECT COUNT(*)::int n FROM convocatoria_hitos WHERE oposicion_id = $1`, [o.id])).rows[0].n);
        if (h === 0) add('content', 'error', o.slug, 'no_hitos', `${o.slug}: inscripción abierta pero 0 hitos (timeline vacío)`);
        marcar('no_hitos', 1);
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
    marcar('convocatoria_timeline_incoherente', inc.length);
    marcar('convocatoria_timeline_caducado', inc.length);
  }

  // ── APP: observable_events críticos 24h ──
  const CRIT = ['server_render_error', 'http_5xx', 'webhook_unhealthy'];
  const obs = (await c.query(`SELECT event_type, endpoint, COUNT(*)::int n, MAX(error_message) sample FROM observable_events
    WHERE severity='error' AND event_type = ANY($1) AND ts > now() - interval '24 hours' GROUP BY event_type, endpoint ORDER BY n DESC LIMIT 25`, [CRIT])).rows;
  for (const o of obs) add('app', 'error', null, o.event_type, `${o.n}× ${o.event_type} @ ${o.endpoint}${o.sample ? ' — ' + o.sample.slice(0, 80) : ''}`, { n: o.n });
  for (const k of CRIT) marcar(k, obs.filter((o) => o.event_type === k).reduce((a, o) => a + o.n, 0));

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
  let flatEscaneados = 0;
  for (let off = 0; off <= 60000; off += 4000) {
    const rows = (await c.query(`SELECT l.slug, a.id aid, a.article_number an, a.content
      FROM articles a JOIN laws l ON a.law_id = l.id
      WHERE a.is_active AND l.is_active AND position('<' in a.content) = 0 AND length(a.content) > 200 AND a.article_number ~ '^[0-9]+$'
      ORDER BY a.id LIMIT 4000 OFFSET ${off}`)).rows;
    if (!rows.length) break;
    flatEscaneados += rows.length;
    for (const r of rows) { const cells = detectFlattenedTable(r.content); if (cells) flat.push({ slug: r.slug, an: r.an, aid: r.aid, n: cells.length, cells: cells.slice(0, 6) }); }
  }
  marcar('flattened_table', flatEscaneados);
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
  //
  // DOS vías complementarias (28/07/2026, ver el núcleo): los literales cazan las notas con
  // OTRO sujeto ("Esta pregunta debería", "Nota técnica:"); el patrón meta caza el acto de que
  // la explicación se juzgue a sí misma, que ninguna lista de literales alcanzaba (medido: 96
  // activas, 0 vistas por los 21 literales).
  // Los literales van FUNDIDOS en UNA alternancia (`AUDIT_NOTE_LITERAL_RE_SRC` del núcleo), no
  // como 23 `ILIKE` con OR: así costaban 38 de los 40,6 s y el gemelo del backend reventaba su
  // `statement_timeout`, tumbando el barrido entero (T-307). Mismo conjunto de resultados.
  const anRows = (await c.query(
    `SELECT id FROM questions WHERE is_active = true
        AND (explanation ~* $1 OR explanation ~* $2 OR explanation ~* $3) LIMIT 50`,
    [AUDIT_NOTE_LITERAL_RE_SRC, AUDIT_NOTE_META_RE_SRC, AUDIT_NOTE_ACTO_RE_SRC])).rows;
  if (anRows.length) add('content', 'warn', null, 'audit_note_explanation',
    `${anRows.length}${anRows.length >= 50 ? '+' : ''} pregunta(s) visibles con la explicación = nota de auditoría de un pase IA (reescribir o needs_human)`,
    { count: anRows.length, sample: anRows.slice(0, 15).map(r => r.id) });
  marcar('audit_note_explanation', anRows.length);

  // ── CONTENIDO: la prosa de auditoría también está DENTRO del temario (T-253) ──
  // Hermano de audit_note_explanation, un escalón más grave: aquí la nota está en el
  // ARTÍCULO (la teoría que el opositor lee directamente en /temario y de la que cuelgan
  // las preguntas), no en la explicación de una pregunta suelta. Ver el núcleo
  // (lib/health/articleAuditNote.cjs) para la calibración y el falso positivo descartado
  // (Access 365: "también es incorrecta" es una trampa de examen explicada, no una nota).
  const aanRows = (await c.query(
    `SELECT a.id FROM articles a JOIN laws l ON l.id = a.law_id
      WHERE a.is_active AND l.is_active AND a.content ~* $1 LIMIT 50`,
    [ARTICLE_AUDIT_NOTE_RE_SRC_SQL])).rows;
  if (aanRows.length) add('content', 'warn', null, 'article_audit_note',
    `${aanRows.length}${aanRows.length >= 50 ? '+' : ''} artículo(s) activos con la nota de auditoría incrustada en la TEORÍA (contrastar con la fuente oficial y revisar las preguntas del artículo)`,
    { count: aanRows.length, sample: aanRows.slice(0, 15).map(r => r.id) });
  marcar('article_audit_note', aanRows.length);

  // ── CONTENIDO: integridad de los PSICOTÉCNICOS ──
  // Hueco encontrado al inventariar las suites del job de integración (T-384): el barrido de salud
  // no cubría los psicotécnicos EN ABSOLUTO — sus 60+ kinds son todos de temario y convocatoria—,
  // así que las únicas comprobaciones vivían en dos tests de CI que, con el job mudo, no le decían
  // nada a nadie. Son 7.102 preguntas activas servidas a usuarios.
  //
  // Los tres invariantes vienen de esas dos suites (`psychometricSectionIntegrity`,
  // `psychometricDataQuality`), no de un criterio nuevo:
  //   · sin `section_id`  → la pregunta existe pero no cae en ninguna sección: no se sirve;
  //   · sección AJENA     → cuenta en una categoría y su sección es de otra: los totales mienten;
  //   · clave inválida    → `correct_option` fuera de 0-3: la pregunta no se puede corregir.
  //
  // `error` y no `warn` a propósito: los tres significan que la pregunta o no llega, o llega
  // rota — no es cosmético. Medido el 31/07 sobre las 7.102 activas: 0, 0 y 0. Nace en silencio,
  // que es como debe nacer un trinquete: si algún día habla, es que ha entrado una regresión.
  const psi = (await c.query(`
    SELECT
      (SELECT count(*) FROM psychometric_questions WHERE is_active)::int AS total_activas,
      (SELECT count(*) FROM psychometric_questions WHERE is_active AND section_id IS NULL)::int AS sin_seccion,
      (SELECT count(*) FROM psychometric_questions q JOIN psychometric_sections s ON s.id = q.section_id
        WHERE q.is_active AND s.category_id <> q.category_id)::int AS seccion_ajena,
      (SELECT count(*) FROM psychometric_questions WHERE is_active
        AND (correct_option IS NULL OR correct_option < 0 OR correct_option > 3))::int AS clave_invalida`)).rows[0];
  marcar('psicotecnico_integridad', psi.total_activas);
  {
    const partes = [];
    if (psi.sin_seccion) partes.push(`${psi.sin_seccion} sin sección (no se sirven)`);
    if (psi.seccion_ajena) partes.push(`${psi.seccion_ajena} con sección de otra categoría (los totales mienten)`);
    if (psi.clave_invalida) partes.push(`${psi.clave_invalida} con correct_option inválido (no se pueden corregir)`);
    if (partes.length) add('content', 'error', null, 'psicotecnico_integridad',
      `Psicotécnicos con la integridad rota: ${partes.join(' · ')}`,
      { sinSeccion: psi.sin_seccion, seccionAjena: psi.seccion_ajena, claveInvalida: psi.clave_invalida });
  }

  // ── CONTENIDO: taxonomía de FAMILIA (T-384) ──
  // Segundo hueco del inventario de suites del job de integración: `familiaClassification.test.ts`
  // mezclaba DOS verdades — contrato de esquema (¿la vista expone `familia`? ¿el CHECK rechaza
  // valores fuera de la taxonomía?) y vigilancia de datos (¿el clasificador sigue de acuerdo con
  // lo persistido? ¿hay cobertura suficiente?). El esquema se queda en CI, bloqueante
  // (`__tests__/integration/familiaSchemaContract.test.ts`); esto es la mitad de VIGILANCIA, los
  // dos `it()` de contenido que quedaron en `familiaClassification.test.ts`.
  //
  // CLI-only a propósito, mismo motivo que `cita_no_literal`/`shuffle_*`: `classifyFamilia` vive
  // en `lib/oposiciones/familia.ts` (TS del frontend) y el @Cron del backend es un build NestJS
  // aparte sin acceso a ese `lib/`. Duplicar el clasificador (200 líneas de keywords) como TS
  // nativo en el backend sería la tercera copia de la misma lógica — el propio problema que este
  // registro existe para evitar. Se documenta en `content-sweep-parity.test.ts` (CLI_ONLY_KINDS).
  const { classifyFamilia } = loadFamiliaModule();
  const famRows = (await c.query(
    `SELECT nombre, administracion, familia FROM oposiciones WHERE familia IS NOT NULL ORDER BY id LIMIT 300`,
  )).rows;
  marcar('familia_desincronizada', famRows.length);
  {
    // EXENCIÓN (heredada de T-377): que el clasificador diga `otros` donde la BD tiene familia
    // concreta no es desincronización — es una fila corregida a mano que `degradaFamilia`
    // protege a propósito. Mismo núcleo puro que el backfill, para que detector y herramienta no
    // puedan discrepar.
    const desincronizados = famRows.filter((o) => {
      const nueva = classifyFamilia(o.nombre, o.administracion);
      if (nueva === o.familia) return false;
      return !degradaFamilia(o.familia, nueva);
    });
    if (desincronizados.length) {
      const ejemplos = desincronizados.slice(0, 5).map((o) => o.nombre);
      add('content', 'error', null, 'familia_desincronizada',
        `${desincronizados.length} oposición(es) donde classifyFamilia() ya no reproduce la familia persistida (p.ej. ${ejemplos.join(', ')}) — re-correr scripts/backfill-familia.cjs o revisar el cambio de keywords`,
        { count: desincronizados.length, ejemplos });
    }
  }
  // COBERTURA: catalogadas mostrables (banner, plazo abierto HOY) con familia útil.
  const famCobertura = (await c.query(
    `SELECT familia FROM oposiciones
      WHERE is_active = false AND seguimiento_url IS NOT NULL
        AND inscription_start::text <= $1 AND inscription_deadline::text >= $1`,
    [hoyMadrid(now)],
  )).rows;
  marcar('familia_cobertura_baja', famCobertura.length);
  if (famCobertura.length) {
    const clasificadas = famCobertura.filter((o) => o.familia && o.familia !== 'otros').length;
    const ratio = clasificadas / famCobertura.length;
    if (ratio < 0.8) add('content', 'warn', null, 'familia_cobertura_baja',
      `Solo ${clasificadas}/${famCobertura.length} (${Math.round(ratio * 100)}%) de las catalogadas con plazo abierto hoy tienen familia útil (mínimo 80%)`,
      { clasificadas, total: famCobertura.length, ratio });
  }

  // ── CONTENIDO: veredicto ROJO de verificación que no llega a ninguna cola (T-405) ──
  // Caso Estela (31/07): una verificación del 19/07 escribió «OPCIONES CORRUPTAS» sobre 8cd4ee16
  // y la pregunta siguió `approved` y sirviéndose 12 días — escribir la fila en
  // `ai_verification_results` no cambia `lifecycle_state`, no crea señal, no pinga ningún badge y
  // no abre ninguna cola. Se queda de dato histórico hasta que una persona la mire a mano.
  //
  // Solo la ÚLTIMA verificación no descartada de cada pregunta activa: una fila vieja con flag en
  // false que una verificación POSTERIOR ya corrigió no debe seguir sonando. `fix_applied` filtra
  // lo que ya se atendió aunque el histórico siga en false.
  //
  // DOS BANDAS (no una — ver la cabecera larga en lib/health/veredictoRojoInequivoco.cjs):
  // `error` = el texto describe un defecto INEQUÍVOCO (opciones de otra pregunta, opción marcada
  // que no responde al enunciado) — el patrón del caso Estela. `warn` = el resto: el pool de
  // ~400 `options_ok=false` activas es MAYORMENTE ruido de auditoría ciega (~76% según la propia
  // campaña de calibración de junio, `scripts/answer-review/README.md`) — convertirlo todo en
  // alarma repetiría el error de [T-317]. Ambas bandas EXISTEN a partir de hoy; antes, ninguna.
  const vrRows = (await c.query(`
    WITH ultima AS (
      SELECT DISTINCT ON (v.question_id)
        v.question_id, v.options_ok, v.answer_ok, v.enunciado_ok, v.explanation, v.verified_at, v.fix_applied
      FROM ai_verification_results v
      JOIN questions q ON q.id = v.question_id AND q.is_active
      WHERE v.discarded IS NOT TRUE
      ORDER BY v.question_id, v.verified_at DESC
    )
    SELECT question_id, options_ok, answer_ok, enunciado_ok, explanation, verified_at
      FROM ultima
     WHERE (options_ok = false OR answer_ok = false OR enunciado_ok = false)
       AND COALESCE(fix_applied, false) = false`)).rows;
  // El UNIVERSO evaluado, no las que ya salen defectuosas: `marcar()` alimenta el «N sujeto(s)
  // mirados esta última vez» que se le enseña a una persona (scripts/health/kinds-evaluados.cjs
  // y el cuerpo de la alerta de detector-muerto). Contando `vrRows` —ya filtradas por el WHERE—
  // el día que no queden veredictos rojos diría «0 sujetos mirados» habiendo revisado miles de
  // verificaciones sanas: exactamente al revés que su vecino `opciones_duplicadas` en este mismo
  // fichero, que marca TODAS las activas. Lo señaló la revisión de [T-405].
  const vrUniverso = Number((await c.query(`
    SELECT count(*)::int AS n FROM (
      SELECT DISTINCT ON (v.question_id) v.question_id
        FROM ai_verification_results v
        JOIN questions q ON q.id = v.question_id AND q.is_active
       WHERE v.discarded IS NOT TRUE
       ORDER BY v.question_id, v.verified_at DESC
    ) u`)).rows[0]?.n || 0);
  {
    const inequivocas = [];
    const opinables = [];
    for (const fila of vrRows) {
      const banda = clasificarVeredicto(fila);
      if (banda === 'error') inequivocas.push(fila);
      else if (banda === 'warn') opinables.push(fila);
    }
    const muestra = (xs) => xs.slice(0, 15).map((f) => f.question_id);
    if (inequivocas.length) add('content', 'error', null, 'veredicto_verificacion_rojo',
      `${inequivocas.length} pregunta(s) activas con un veredicto de verificación INEQUÍVOCO (opciones de otra pregunta / no responden al enunciado) sin atender`,
      { count: inequivocas.length, banda: 'inequivoco', sample: muestra(inequivocas) });
    if (opinables.length) add('content', 'warn', null, 'veredicto_verificacion_rojo',
      `${opinables.length} pregunta(s) activas con un flag de verificación en falso (options_ok/answer_ok/enunciado_ok) sin adjudicar — mayoría esperada: ruido de auditoría ciega, triar antes de tocar`,
      { count: opinables.length, banda: 'opinable', sample: muestra(opinables) });
    marcar('veredicto_verificacion_rojo', vrUniverso);
  }

  // ── CONTENIDO: dos OPCIONES idénticas dentro de la misma pregunta ──
  // Hueco que ningún kind cubría (T-406): todos los detectores de contenido comparan la pregunta
  // con su ARTÍCULO, con el epígrafe o con la convocatoria — ninguno la compara CONSIGO MISMA. La
  // pregunta se queda de hecho en tres alternativas y no lo dice.
  //
  // La comparación va en JS, en el núcleo puro, y NO en esta consulta a propósito: normalizar en
  // SQL fue justo lo que inventó los fantasmas. Un `\s+` que llegó como `s+` borraba las eses e
  // igualaba `wardrobes` con `wardrobess` (8 falsos), y `lower()` igualaba opciones que se
  // distinguen precisamente por la mayúscula. Aquí solo se TRAEN las opciones.
  //
  // Dos bandas: `error` = la clave está dentro del par (se acierta y se falla a la vez) · `warn` =
  // son dos distractores (resoluble, pero se lee descuido). Medido el 31/07: 33 preguntas, todas
  // warn, ya reparadas → **nace en verde**, que es el momento exacto de poner el trinquete.
  const opcRows = (await c.query(`
    SELECT id, option_a, option_b, option_c, option_d, correct_option
      FROM questions WHERE is_active`)).rows;
  {
    const { errores, avisos } = clasificarOpcionesDuplicadas(opcRows);
    const muestra = (xs) => xs.slice(0, 15).map(x => `${x.id} (${LETRAS_OPCION[x.i]}=${LETRAS_OPCION[x.j]})`);
    if (errores.length) add('content', 'error', null, 'opciones_duplicadas',
      `${errores.length} pregunta(s) activas con la CLAVE duplicada en dos opciones: se acierta y se falla a la vez`,
      { count: errores.length, banda: 'clave_en_el_par', sample: muestra(errores) });
    if (avisos.length) add('content', 'warn', null, 'opciones_duplicadas',
      `${avisos.length} pregunta(s) activas con dos distractores idénticos: se quedan en tres opciones sin decirlo`,
      { count: avisos.length, banda: 'distractores', sample: muestra(avisos) });
    marcar('opciones_duplicadas', opcRows.length);
  }

  // ── CONTENIDO: la MISMA pregunta duplicada dentro del banco (T-408) ──
  // Distinto de opciones_duplicadas (arriba): allí se repite una OPCIÓN dentro de una pregunta;
  // aquí se repite la PREGUNTA ENTERA — mismo artículo, mismo enunciado normalizado y las
  // mismas 4 opciones. El opositor la ve dos veces, y si las copias discrepan en la clave no
  // hay forma de saber cuál vale. Lo destapó una usuaria ACORDÁNDOSE de haber visto la pregunta
  // antes (impugnación 32b0d55e) — la peor forma posible de detectarlo.
  //
  // Corte ESTRICTO a propósito, el mismo que usa la herramienta de jubilar
  // (scripts/calidad/duplicados-exactos.cjs, T-321): un umbral de parecido ya se probó y dio
  // 3.230 pares cuyos peores casos eran SUPUESTOS PRÁCTICOS (comparten preámbulo por diseño).
  // El corte borroso (T-425/T-519) sigue siendo bajo demanda, no al badge — necesita
  // calibración humana que este barrido determinista no puede dar.
  //
  // Dos bandas, con el MISMO criterio que opciones_duplicadas: `error` = las gemelas dan
  // respuestas DISTINTAS (irresoluble para el opositor) · `warn` = misma respuesta, solo
  // repetición. La banda compara el TEXTO de la opción correcta, NUNCA `correct_option`: las
  // copias vienen barajadas entre sí, así que el índice difiere de forma legítima.
  //
  // Se excluyen los supuestos prácticos (`exam_case_id IS NULL`) — comparten enunciado del
  // caso POR DISEÑO — y las preguntas sin artículo (agrupar por NULL uniría cosas sin relación).
  const SQL_DUPLICADOS = `
    with base as (
      select q.id, q.question_text, q.correct_option, q.created_at, q.is_official_exam,
             q.explanation, q.primary_article_id, q.lifecycle_state,
             q.option_a, q.option_b, q.option_c, q.option_d,
             lower(regexp_replace(q.question_text, '\\s+', ' ', 'g')) as norm,
             (select string_agg(x, '|' order by x) from unnest(array[
                lower(trim(q.option_a)), lower(trim(q.option_b)),
                lower(trim(q.option_c)), lower(trim(q.option_d))]) x) as ops,
             (select count(*)::int from test_questions t where t.question_id = q.id) as servida
        from questions q
       where q.is_active
         and q.primary_article_id is not null
         and q.exam_case_id is null
    )
    select norm, primary_article_id, ops, count(*)::int n,
           json_agg(json_build_object(
             'id', id, 'oficial', is_official_exam, 'servida', servida,
             'expl', coalesce(length(explanation), 0), 'alta', created_at, 'estado', lifecycle_state,
             'correct_option', correct_option,
             'option_a', option_a, 'option_b', option_b, 'option_c', option_c, 'option_d', option_d
           ) order by created_at) as miembros
      from base
     group by 1, 2, 3
    having count(*) > 1`;
  const dupGrupos = (await c.query(SQL_DUPLICADOS)).rows;
  {
    // El universo EVALUADO (no solo el defectuoso) es lo que se pasa a `marcar`: un 0 en
    // `dupGrupos` significaría lo mismo si el detector no llegó a correr — el mismo hueco que
    // T-529 vino a cerrar para el resto de kinds.
    const dupUniverso = (await c.query(
      `select count(*)::int n from questions
        where is_active and primary_article_id is not null and exam_case_id is null`)).rows[0].n;
    const opts = (m) => [m.option_a, m.option_b, m.option_c, m.option_d];
    let erroresGrupos = 0, erroresPreguntas = 0, avisosGrupos = 0, avisosPreguntas = 0;
    const muestraError = [], muestraAviso = [];
    for (const g of dupGrupos) {
      const miembros = g.miembros.map((m) => ({ ...m, textoCorrecta: opts(m)[m.correct_option] }));
      const banda = bandaDuplicado(miembros);
      const ids = miembros.map((m) => m.id);
      if (banda === 'error') {
        erroresGrupos++; erroresPreguntas += g.n;
        if (muestraError.length < 15) muestraError.push(ids.join('='));
      } else {
        avisosGrupos++; avisosPreguntas += g.n;
        if (muestraAviso.length < 15) muestraAviso.push(ids.join('='));
      }
    }
    if (erroresGrupos) add('content', 'error', null, 'pregunta_duplicada',
      `${erroresGrupos} grupo(s) de preguntas DUPLICADAS con clave CONTRADICTORIA (${erroresPreguntas} activas): el opositor no puede saber cuál vale`,
      { grupos: erroresGrupos, preguntas: erroresPreguntas, banda: 'clave_contradictoria', sample: muestraError });
    if (avisosGrupos) add('content', 'warn', null, 'pregunta_duplicada',
      `${avisosGrupos} grupo(s) de preguntas duplicadas literalmente (${avisosPreguntas} activas), misma clave: repetición, no contradicción`,
      { grupos: avisosGrupos, preguntas: avisosPreguntas, banda: 'repeticion', sample: muestraAviso });
    marcar('pregunta_duplicada', dupUniverso);
  }

  // ── CONTENIDO: mismo kind, banco PSICOTÉCNICO (T-410) ──
  // El criterio ya estaba unificado en lib/calidad/duplicados.js desde que se construyó la
  // herramienta de jubilar (T-410, --banco psicotecnicas); lo que faltaba era el badge, igual
  // que en legislativas. Dos diferencias que impone la tabla, no el criterio:
  //   - normalización FUERTE (sqlNormalizar: ignora tildes/puntuación) en vez de la laxa de
  //     legislativas — psicotécnicas necesita agrupar «¿Qué palabra…» con «¿Que palabra…»;
  //   - la clave de grupo lleva la HUELLA de imagen/content_data. Sin ella, 95 de 98 grupos son
  //     preguntas DISTINTAS que solo comparten un enunciado genérico («Observa la secuencia…») y
  //     se diferencian en la figura — medido al construir la herramienta.
  // Guarda propia: un grupo unido SOLO por quitar la tilde se aparta (no se cuenta como
  // duplicado) — en un banco que examina ORTOGRAFÍA la tilde puede ser la respuesta.
  const NP = (col) => sqlNormalizarDup(col);
  const SQL_DUP_PSICO = `
    with base as (
      select q.id, q.correct_option, q.section_id,
             ${NP('q.question_text')} as norm,
             (select string_agg(x, '|' order by x) from unnest(array[
                ${NP('q.option_a')}, ${NP('q.option_b')}, ${NP('q.option_c')},
                ${NP('q.option_d')}, ${NP('q.option_e')}]) x where x <> '') as ops,
             md5(coalesce(q.image_url, '') || '#' || coalesce(q.content_data::text, '')) as huella,
             array[q.option_a, q.option_b, q.option_c, q.option_d, q.option_e] as opciones,
             (array[q.option_a, q.option_b, q.option_c, q.option_d, q.option_e])[q.correct_option + 1] as texto_correcta
        from psychometric_questions q
       where q.is_active
    )
    select norm, ops, huella, count(*)::int n,
           json_agg(json_build_object(
             'id', id, 'opciones', opciones, 'textoCorrecta', texto_correcta
           )) as miembros
      from base
     group by 1, 2, 3
    having count(*) > 1`;
  const dupPsicoGrupos = (await c.query(SQL_DUP_PSICO)).rows;
  {
    const dupPsicoUniverso = (await c.query(
      `select count(*)::int n from psychometric_questions where is_active`)).rows[0].n;
    let erroresGrupos = 0, erroresPreguntas = 0, avisosGrupos = 0, avisosPreguntas = 0, porTilde = 0;
    const muestraError = [], muestraAviso = [];
    for (const g of dupPsicoGrupos) {
      if (unidoSoloPorTildes(g.miembros.map((m) => m.opciones))) { porTilde++; continue; }
      const banda = bandaDuplicado(g.miembros);
      const ids = g.miembros.map((m) => m.id).join('=');
      if (banda === 'error') {
        erroresGrupos++; erroresPreguntas += g.n;
        if (muestraError.length < 15) muestraError.push(ids);
      } else {
        avisosGrupos++; avisosPreguntas += g.n;
        if (muestraAviso.length < 15) muestraAviso.push(ids);
      }
    }
    if (erroresGrupos) add('content', 'error', null, 'pregunta_duplicada',
      `${erroresGrupos} grupo(s) de PSICOTÉCNICAS duplicadas con clave CONTRADICTORIA (${erroresPreguntas} activas): el opositor no puede saber cuál vale`,
      { grupos: erroresGrupos, preguntas: erroresPreguntas, banda: 'clave_contradictoria_psico', sample: muestraError });
    if (avisosGrupos) add('content', 'warn', null, 'pregunta_duplicada',
      `${avisosGrupos} grupo(s) de PSICOTÉCNICAS duplicadas literalmente (${avisosPreguntas} activas), misma clave: repetición, no contradicción`,
      { grupos: avisosGrupos, preguntas: avisosPreguntas, banda: 'repeticion_psico', sample: muestraAviso, apartadosPorTilde: porTilde });
    marcar('pregunta_duplicada', dupPsicoUniverso);
  }

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
  marcar('stale_dated_law', scopedLaws.length);

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
    // T-395: is_ok:false sin contadores es una NOTA DE INCIDENCIA (audit_boe_url), no una
    // comparación limpia — mismo mirror que lib/laws/completeness.ts, MANTENER EN SYNC.
    if (su.is_ok === false) return 'never_verified';
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
  marcar('hito_vencido_abierto', hitosVencidos.length);

  // ── hitos que se PRESENTAN como fecha oficial sin tener ninguna fuente ────────────────
  // `origen` NO es documentación: el RENDER decide con él (un `registro` se muestra como
  // oficial; una `estimacion` se oculta desde el 20/07). Hasta T-256 nadie exigía fuente al
  // escribirlo, y quedaron 642 de 960 `registro` sin url, sin cita y sin documento. Caso
  // verificado contra DOS fuentes: la landing de Huesca anunciaba "Primer ejercicio
  // 01/11/2026" y ni el Ayuntamiento ni el BOE publican fecha.
  //
  // Bandas calibradas con simulación bank-wide ANTES de encender (lección T-047/T-113):
  //   · error → fecha de EXAMEN, futura, en oposición ACTIVA: es el dato por el que un
  //     opositor organiza meses de estudio. Medido en vivo el 28/07: 3 hallazgos / 4 hitos
  //     (se agrupa por oposición: Galicia pone dos), sobre 25 candidatos — 21 exentos.
  //   · warn  → cualquier otra fecha futura sin fuente. Medido: 0, porque las 5 candidatas
  //     COINCIDÍAN con el `inscription_deadline` verificado de su convocatoria → les falta la
  //     cita, no la verdad (provenance, T-147), y el núcleo puro las exime. Sin esa exención
  //     el detector nacía con un 100% de ruido.
  // La decisión vive en `lib/convocatoria/hitoOrigen.js` (24 tests), compartida con el
  // escritor `scripts/convocatoria/degradar-origen-hito.cjs`.
  const hitosSinFuente = (await c.query(`
    SELECT h.id, h.titulo, h.origen, h.url, h.cita_literal, h.source_documento_id, h.fecha,
           o.slug, c2.inscription_deadline
    FROM convocatoria_hitos h
    JOIN oposiciones o ON o.id = h.oposicion_id
    LEFT JOIN convocatorias c2 ON c2.oposicion_id = o.id AND c2.is_current
    WHERE o.is_active AND h.origen = 'registro' AND h.fecha > CURRENT_DATE`)).rows;
  const sinFuentePorSlug = new Map();
  for (const h of hitosSinFuente) {
    if (clasificarHito(h, { fechaCorroborada: h.inscription_deadline }).accion === 'dejar') continue;
    const clave = `${h.slug}|${esFechaDeExamen(h) ? 'examen' : 'otro'}`;
    if (!sinFuentePorSlug.has(clave)) sinFuentePorSlug.set(clave, []);
    sinFuentePorSlug.get(clave).push(h);
  }
  for (const [clave, hs] of sinFuentePorSlug) {
    const [slug, tipo] = clave.split('|');
    const esExamen = tipo === 'examen';
    add('content', esExamen ? 'error' : 'warn', slug, 'hito_registro_sin_fuente',
      `${slug}: ${hs.length} hito(s) se muestran como fecha OFICIAL sin ninguna fuente` +
      (esExamen ? ' — y son fechas de EXAMEN: el opositor organiza meses de estudio con ellas'
                : ' (fecha futura sin url, cita ni documento)'),
      { count: hs.length, hitos: hs.slice(0, 10).map(h => ({ id: h.id, titulo: h.titulo, fecha: h.fecha })) });
  }
  marcar('hito_registro_sin_fuente', hitosSinFuente.length);

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
           seguimiento_last_checked::text AS seguimiento_last_checked,
           boe_reference,
           boe_publication_date::text     AS boe_publication_date
    FROM oposiciones_ssot`)).rows;
  const HOY_MADRID = hoyMadrid();
  for (const o of estados) {
    for (const inc of detectarIncoherenciasEstado(o, HOY_MADRID)) {
      add('content', inc.severidad, o.slug, 'convocatoria_estado_incoherente',
        `${o.slug}${o.is_active ? ' [PUBLICADA]' : ''}: ${inc.mensaje}`, { regla: inc.regla });
    }
  }
  marcar('convocatoria_estado_incoherente', estados.length);

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
  marcar('seguimiento_url_stale', urlRows.length);

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
  marcar('seguimiento_fuente_ciega', ciegaRows.length);

  // ── El sensor de NOTAS (versión de software, fechas, criterio) parece vigilar y no vigila ──
  // Hermano de los dos anteriores, pero del sensor `detect-notas-convocatoria`, no del cron de
  // hash de `check-seguimiento`. Origen (T-311, 30/07→06/08): una usuaria de Madrid preguntó por
  // Windows 11 y, al comprobarlo, el sensor tenía 0 filas en `convocatoria_notas` para su
  // oposición pese a tener documentos ya clonados. La consulta simple que proponía la ficha
  // ("corpus>0 y notas=0") se queda corta: 3 oposiciones de Madrid (celador/TCAE/auxiliar-
  // administrativo SERMAS) SÍ tenían notas, pero congeladas 11+ días — "notas=0" las daba por
  // sanas. Con las dos condiciones juntas (nunca vista, o vista pero stale ≥4 días — umbral
  // calibrado: 103/111 oposiciones sanas ven su última nota en <2 días, 7 forman una cola aparte
  // de 7 a 21.6 días, sin casos intermedios) la lista mide 21, no 2. Causa raíz DEMOSTRADA solo
  // para `comunidad.madrid` (WAF que bloquea la UA propia del sensor — arreglado con reintento de
  // UA de navegador en `oep-signals-llm.service.ts`); el resto queda solo VISIBLE, sin diagnosticar.
  const notasRows = (await c.query(`
    SELECT o.slug,
      (SELECT count(*) FROM convocatoria_documentos cd
        JOIN convocatorias cv ON cv.id = cd.convocatoria_id
        WHERE cv.oposicion_id = o.id)::int AS docs_corpus,
      (SELECT count(*) FROM convocatoria_notas n WHERE n.oposicion_id = o.id)::int AS notas_count,
      (SELECT EXTRACT(EPOCH FROM (now() - max(n.last_seen)))/86400
         FROM convocatoria_notas n WHERE n.oposicion_id = o.id) AS dias_sin_ver
    FROM oposiciones o
    WHERE o.is_active AND o.seguimiento_url IS NOT NULL`)).rows;
  for (const r of notasRows) {
    const v = clasificarNotasVigilancia({
      docsCorpus: r.docs_corpus,
      notasCount: r.notas_count,
      diasSinVer: r.dias_sin_ver != null ? Number(r.dias_sin_ver) : null,
    });
    if (v.severidad !== 'error') continue;
    add('content', 'error', r.slug, 'notas_convocatoria_sin_vigilancia',
      `${r.slug}: el sensor de notas no está vigilando esta oposición — ${v.motivo}`);
  }
  marcar('notas_convocatoria_sin_vigilancia', notasRows.length);

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
    SELECT s.slug, s.boe_reference AS ref, s.programa_url AS url, s.diario_oficial AS etiqueta,
           s.estado_proceso AS estado,
           -- Documento de la OEP vigente ya clonado: es el enlace que la landing enseña DE VERDAD
           -- cuando aún no hay convocatoria (F4/T-108). Sin este dato el detector juzga
           -- programa_url a pelo y marca URLs que el opositor no ve (medido 28/07: falsos
           -- (SIN backticks: van DENTRO de un template literal y lo cerrarían).
           -- positivos en administrativo-andalucia y administrativo-castilla-la-mancha, señalados
           -- por su temario cuando la página enseña su BOJA/DOCM correctos).
           (SELECT d.url FROM convocatorias c
              JOIN convocatoria_oep co ON co.convocatoria_id = c.id
              JOIN oep e ON e.id = co.oep_id
              JOIN convocatoria_documentos d ON d.id = e.source_documento_id
            WHERE c.oposicion_id = o.id AND c.is_current = true AND d.url IS NOT NULL
            ORDER BY e."año_oep" DESC LIMIT 1) AS enlace_oep
    FROM oposiciones_ssot s
    JOIN oposiciones o ON o.slug = s.slug
    WHERE s.is_active`)).rows;
  // ── NOTAS INTERNAS PUBLICADAS (T-435) ────────────────────────────────────────────────────────
  // Los campos de referencia se PINTAN en el hero y bajo el botón oficial, y se estaban usando
  // como bloc de notas de auditoría. Medido el 31/07: 7 landings activas sirviendo cosas como
  // «⚠️ SIN VERIFICAR: la fila afirma 688 plazas…» — es decir, contándole al opositor que no nos
  // fiamos de nuestro propio dato. Se mira sobre `oposiciones_ssot`, que es lo que la landing LEE:
  // el barrido sobre la tabla base daba CERO con el texto en pantalla, porque la nota vivía en
  // `convocatorias` y la vista resuelve desde ahí.
  const notaRows = (await c.query(`
    SELECT slug, is_active, boe_reference, diario_referencia, convocatoria_numero, oep_decreto
      FROM oposiciones_ssot`)).rows;
  const { clasificarLote: clasificarNotas } = require('../lib/convocatoria/notaInternaPublicada.cjs');
  for (const h of clasificarNotas(notaRows.map((r) => ({
    slug: r.slug, isActive: r.is_active,
    campos: {
      boe_reference: r.boe_reference, diario_referencia: r.diario_referencia,
      convocatoria_numero: r.convocatoria_numero, oep_decreto: r.oep_decreto,
    },
  }))).todos) {
    add('content', h.severity, h.slug, 'nota_interna_publicada',
      `${h.slug}: el campo ${h.campo} publica una nota interna [${h.tipo}] — ${h.extracto.slice(0, 90)}`,
      h.extracto);
  }
  marcar('nota_interna_publicada', notaRows.length);

  for (const r of linkRows) {
    const issues = checkConvocatoriaLinks({
      boeReference: r.ref, programaUrl: r.url, diarioOficial: r.etiqueta, estadoProceso: r.estado,
      enlaceOep: r.enlace_oep,
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
  marcar('convocatoria_link_mismatch', linkRows.length);
  marcar('convocatoria_etiqueta_boletin', linkRows.length);
  marcar('convocatoria_enlace_no_boletin', linkRows.length);

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
  marcar('documentos_sin_revisar', docsRows.length);

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
  marcar('landing_incompleta', landRows.length);

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
  marcar('convocatoria_oep_sin_enlace', oepLinkRows.length);

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
  marcar('texto_examen_pasado', textoRows.length);

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
  marcar('law_unverified_source', lawRows.length);

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
  marcar('scope_titulo_huerfano', titSecs.length);

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
  marcar('answer_in_annulled_fragment', annulledBugs.length);

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
  marcar('convocatoria_docs_incompletos', cov.length);
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
  marcar('convocatoria_docs_incompletos', orf ? orf.con_url + orf.con_cita : 0);

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
  marcar('plazas_afirmadas_sin_documento', huerfanas.length);

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
  marcar('epigrafe_provenance_no_doc', epiOrf.length);

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
  marcar('temario_revision_pendiente', revQ.length);

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
    // MIRROR de lib/laws/scopeOverInclusion.ts — enumeraciones con PUNTO (T-137, 31/07/2026),
    // descontando la CITA de la norma: «La Ley 19/2013, de 9 de diciembre, de transparencia…»
    // son 4 trozos que NO son materias, y contarlos haría enumerador a todo el que cite la ley.
    const RE_CITA_NORMA = /\b(?:ley\s+org[áa]nica|ley\s+foral|ley|real\s+decreto(?:\s+legislativo|\s+ley)?|decreto(?:\s+legislativo)?|reglamento|orden|resoluci[óo]n)\s+\d+\/\d{2,4}/i;
    const RE_SOLO_FECHA = /^de\s+\d{1,2}\s+de\s+[a-záéíóú]+$|^de\s+\d{4}$/i;
    const segmentsMaterias = (hasColon ? ep.slice(ep.indexOf(':') + 1) : ep)
      .split(/[;,.]/).map(s => s.trim())
      .filter(s => s.length >= 4 && /[a-záéíóúñ]/i.test(s))
      .filter(s => !RE_SOLO_FECHA.test(s) && !RE_CITA_NORMA.test(s)).length;
    const explicitArts = new Set(); const reR = /art[íi]?c?u?l?o?s?\.?\s*(\d+)\s*(?:a|al|-|–)\s*(\d+)/gi;
    while ((m = reR.exec(ep)) !== null) { const a = +m[1], b = +m[2]; if (b - a >= 0 && b - a < 500) for (let i = a; i <= b; i++) explicitArts.add(i); }
    const reS = /art[íi]?c?u?l?o?\.?\s*(\d+)(?!\s*(?:a|al|-|–)\s*\d)/gi;
    while ((m = reS.exec(ep)) !== null) explicitArts.add(+m[1]);
    const wholeLawWords = /[íi]ntegr|en su totalidad|toda la ley|texto [íi]ntegro|el conjunto de la ley|la ley completa/i.test(ep);
    // MIRROR de lib/laws/scopeOverInclusion.ts — materia acotada en prosa (26/07/2026).
    const acotaMateria = (ep.match(/(concepto[s]?|principio[s]?|disposicion(?:es)? general(?:es)?|[áa]mbito de aplicaci[óo]n|definici[óo]n(?:es)?|especialmente protegid\w*|objeto y [áa]mbito)/i) || [null])[0];
    const bigLaw = lawTotal >= 12, nearFull = coverage >= 0.9, veryBigLaw = lawTotal >= 60;
    // El PUNTO exige el suelo de 60 arts: es señal más débil que un ';' tras dos puntos (el punto
    // también termina frases normales). Caso etiquetado que lo fija: «El archivo. Concepto. Tipos
    // de archivos.» sobre 22 artículos es LEGÍTIMO. MIRROR de lib/laws/scopeOverInclusion.ts.
    const enumerator = (hasColon && segments >= 3) || (veryBigLaw && segmentsMaterias >= 3);
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
  marcar('scope_over_inclusion_suspect', overIncl.length);

  // ── CONTENIDO: recortes de sobre-inclusión ya CONFIRMADOS y sin aplicar ──
  // Hermano del de arriba y su continuación natural. El de arriba dice «esto HUELE a
  // sobre-inclusión, alguien tiene que adjudicarlo»; éste dice «ya se adjudicó contra el
  // BOE, el recorte está decidido y el tema SIGUE sirviendo la materia de más».
  //
  // POR QUÉ HACÍA FALTA, y no es una intuición (medido el 31/07, T-088): el kind de
  // sospechosos está a **0** —todos los HIGH se adjudicaron— mientras hay **16 recortes
  // confirmados en 12 oposiciones** esperando. O sea que el pipeline funcionó, y su propio
  // éxito hizo DESAPARECER su salida del panel: el badge en verde significaba «nada que
  // adjudicar», que no es «nada que hacer». Exactamente el patrón de «un badge a cero no es
  // temario cubierto».
  //
  // La definición de la cola es la MISMA que usa `--reguard` para su contador
  // (`cola_recorte_confirmada`), a propósito: dos criterios distintos para la misma cola es
  // como se empieza a discutir con el panel en vez de con los datos. Y baja sola, porque el
  // flujo de aplicación marca la fila `verificado=false` (y la guarda determinista de
  // `--reguard` degrada a `ok` lo que ya no tiene recorte que aplicar).
  const oiConf = (await c.query(`
    SELECT t.position_type pt, t.topic_number tn, l.short_name ley, a.band,
           left(coalesce(a.arts_correctos, ''), 80) AS arts_correctos,
           a.adjudicado_at::date AS adjudicado
      FROM scope_over_inclusion_adjudications a
      JOIN topics t ON t.id = a.topic_id
      JOIN laws l ON l.id = a.law_id
     WHERE a.verdict = 'over_inclusion' AND a.verificado
       AND t.is_active = true
     ORDER BY t.position_type, t.topic_number`)).rows;
  if (oiConf.length) {
    const nOpos = new Set(oiConf.map(x => x.pt)).size;
    add('content', 'warn', null, 'scope_over_inclusion_confirmed',
      `${oiConf.length} recorte(s) de scope ya ADJUDICADOS contra la fuente oficial y sin aplicar, en ${nOpos} oposición(es) — esos temas siguen sirviendo materia fuera de programa; aplicar con verify:scope plan/apply`,
      { count: oiConf.length, oposiciones: nOpos, sample: oiConf.slice(0, 20) });
  }
  marcar('scope_over_inclusion_confirmed', oiConf.length);

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
  marcar('scope_phantom_article', phantom.length);

  // ── CONTENIDO: artículos huérfanos — inactivos Y sin escopar, pero con preguntas activas ──
  // `scope_phantom_article` (arriba) solo mira lo que el SCOPE pide y no existe/no está activo.
  // Punto ciego (T-157, cierre de T-139): un artículo puede estar `is_active=false` y no
  // aparecer en NINGÚN `topic_scope` — y aun así tener preguntas `is_active=true` colgando de
  // él (`primary_article_id`), invisibles POR PARTIDA DOBLE: ningún tema las pide (nada las
  // sirve) y ningún detector las cuenta (scope_phantom_article no las ve porque no hay scope
  // que las reclame). Origen real: T-139 desactivó artículos por discrepancia con el oficial
  // (LECrim 588 bis/ter/quater, arts. 130/140 rotulados "del Código Penal") sin darse cuenta de
  // que sus preguntas seguían activas.
  // CALIBRADO contra ruido (07/08/2026): de 379 artículos inactivos-y-sin-escopar, SOLO 14
  // tienen preguntas activas — el resto (365) son bajas legítimas sin nada colgando, y
  // NO se reportan (ver el `HAVING`). Cero falsos positivos medidos en la calibración: los 14
  // son el defecto real, uno por uno.
  const huerfanos = (await c.query(`
    WITH scoped AS (
      SELECT DISTINCT ts.law_id, ${normArt('trim(an)')} AS art_norm
      FROM topic_scope ts
      JOIN topics t ON t.id = ts.topic_id
      CROSS JOIN LATERAL unnest(ts.article_numbers) AS an
      WHERE ts.article_numbers IS NOT NULL AND t.is_active = true
    )
    SELECT coalesce(l.short_name, l.name) AS ley, a.article_number AS art, count(q.id)::int AS preguntas
      FROM articles a
      JOIN laws l ON l.id = a.law_id
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
     WHERE a.is_active = false
       AND NOT EXISTS (SELECT 1 FROM scoped s WHERE s.law_id = a.law_id AND s.art_norm = ${normArt('a.article_number')})
     GROUP BY l.short_name, l.name, a.article_number
     ORDER BY count(q.id) DESC`)).rows;
  if (huerfanos.length) {
    const totalPreguntas = huerfanos.reduce((s, h) => s + h.preguntas, 0);
    const leyes = [...new Set(huerfanos.map(h => h.ley))];
    add('content', 'warn', null, 'orphan_inactive_article',
      `${totalPreguntas} pregunta(s) activa(s) en ${huerfanos.length} artículo(s) inactivo(s) y SIN escopar en ${leyes.length} ley(es) — invisibles por partida doble: ningún tema las sirve y scope_phantom_article no las ve. Decidir por artículo: entra en el temario de alguna oposición (escoparlo + reactivar) o jubilar las preguntas.`,
      { count: huerfanos.length, preguntas: totalPreguntas, laws: leyes.length, sample: huerfanos.slice(0, 25) });
  }
  marcar('orphan_inactive_article', huerfanos.length);

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
    // Hallazgo SEPARADO (T-262): la letra clavada en el intro/outro de una explicación
    // estructurada. Mismo detector y mismo barrido, pero otro remedio —se PODA la narrativa, no
    // se reescribe la razón—, así que va con su propio kind para que el chip de /admin/contenido
    // dé la instrucción correcta.
    if (drift.narrative_stale_letters > 0) {
      add('content', 'warn', null, 'shuffle_narrativa_letra_clavada',
        `${drift.narrative_stale_letters} pregunta(s) con explicación estructurada cuyo intro/outro clava una letra de opción — al barajar se contradicen con la letra que calcula el render`,
        { total: drift.narrative_stale_letters, sample: drift.narrative_sample });
    }
    // TERCER hallazgo, y su causa es la INVERSA de los otros dos (T-316): aquí el contenido no se
    // ha movido — se ha movido el CRITERIO. Cuando se afina el detector, el trigger no puede
    // invalidar nada (invalida por hash del contenido) y el veredicto viejo se queda escrito, así
    // que la mejora del detector no llega al banco. Medido dos veces: el arreglo de las tildes
    // (28/07) dejó 21 preguntas mal marcadas ocho días y el de los grados (T-301) otras 91.
    // No es un defecto de la pregunta, es trabajo pendiente de una línea: por eso `info`.
    if (drift.criterio_viejo > 0) {
      add('content', 'info', null, 'shuffle_veredicto_criterio_viejo',
        `${drift.criterio_viejo} veredicto(s) de barajabilidad que el detector de HOY contradice — el criterio mejoró y nadie los recalculó; se arreglan con backfill-shuffle-safety.ts --recriterio --apply`,
        { total: drift.criterio_viejo, sample: drift.criterio_sample });
    }
    marcar('shuffle_safe_regressed', drift.regressions || 0);
    marcar('shuffle_narrativa_letra_clavada', drift.narrative_stale_letters || 0);
    marcar('shuffle_veredicto_criterio_viejo', drift.criterio_viejo || 0);
  } catch (e) { console.warn('⚠️ drift barajado no evaluado:', String(e.message || e).slice(0, 120)); }

  // ── Citas NO literales: la explicación atribuye al artículo algo que no dice ──
  // El criterio ya existía y estaba compartido (`citaNoLiteral` en validar-explicacion.cjs, con
  // trinquete en criterioCitaUnico.test.ts) y el barrido del banco también — lo que faltaba era
  // que llegara al badge en vez de vivir en una ficha. Subproceso porque compara la cita contra el
  // TEXTO del artículo fila a fila: eso no cabe en un `WHERE`.
  //
  // Solo se reportan las AJENAS (solape <0.5: el artículo no habla de eso → cita inventada o
  // pregunta mal vinculada). Las `retocadas` —el artículo dice lo mismo y la cita solo está
  // reformateada— son 904 y NO son defecto: meterlas dejaría el badge gritando para siempre.
  try {
    const { execSync } = require('child_process');
    const out = execSync('node scripts/impugnaciones/barrido-citas.cjs --json', {
      cwd: process.cwd(), encoding: 'utf8', env: process.env, timeout: 900000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const citas = JSON.parse(out.trim().match(/\{[\s\S]*\}$/)[0]);
    if (citas.ajenas > 0) {
      add('content', citas.ajenas_vistas > 0 ? 'error' : 'warn', null, 'cita_no_literal',
        `${citas.ajenas} pregunta(s) visibles cuya cita en blockquote NO aparece en el artículo vinculado (${citas.ajenas_vistas} ya vistas por usuarios) — cita inventada o pregunta mal vinculada`,
        { ajenas: citas.ajenas, ajenas_vistas: citas.ajenas_vistas, dudosas: citas.dudosas, retocadas_no_defecto: citas.retocadas, sample: citas.sample });
    }
    marcar('cita_no_literal', citas.ajenas || 0);
  } catch (e) { console.warn('⚠️ barrido de citas no evaluado:', String(e.message || e).slice(0, 120)); }

  // ── Explicaciones que reproducen la opción FALSA sin veredicto (T-525) ──
  // La explicación cita casi carácter por carácter la opción falsa, con la palabra corregida
  // pegada detrás (o delante), y NUNCA dice que esa opción es incorrecta: el opositor falla, lee
  // la "explicación" y encuentra una frase que no está en la ley y no sabe distinguir del texto
  // legal real. Subproceso por la misma razón que `cita_no_literal`: compara, opción por opción,
  // el segmento de la explicación contra el texto de esa opción — no cabe en un `WHERE`.
  try {
    const { execSync } = require('child_process');
    const out = execSync('node scripts/audit-explicacion-yuxtaposicion.cjs --json', {
      cwd: process.cwd(), encoding: 'utf8', env: process.env, timeout: 900000, stdio: ['ignore', 'pipe', 'ignore'],
    });
    const yux = JSON.parse(out.trim().match(/\{[\s\S]*\}$/)[0]);
    if (yux.yuxtaposicion > 0) {
      add('content', yux.vistas > 0 ? 'error' : 'warn', null, 'explicacion_yuxtaposicion',
        `${yux.yuxtaposicion} pregunta(s) visibles cuya explicación reproduce una opción FALSA casi literal con la palabra corregida pegada, sin decir en ningún momento que es incorrecta (${yux.oficiales} de examen oficial, ${yux.vistas} ya vistas)`,
        { yuxtaposicion: yux.yuxtaposicion, oficiales: yux.oficiales, vistas: yux.vistas, sample: yux.sample });
    }
    // El latido de lo EVALUADO (T-529): va DENTRO del try y DESPUÉS del add, porque lo que
    // certifica es que este detector llegó a mirar. Si el subproceso revienta, el catch de abajo
    // deja el kind SIN marcar — que es exactamente lo que hay que poder distinguir de un cero.
    // (Este marcar faltaba: T-525 escribió el detector antes de que T-529 aterrizara el latido,
    // así que cada rama estaba verde por su lado y solo el merge lo destapó.)
    marcar('explicacion_yuxtaposicion', yux.yuxtaposicion || 0);
  } catch (e) { console.warn('⚠️ barrido de yuxtaposición no evaluado:', String(e.message || e).slice(0, 120)); }

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
  marcar('scope_cross_tema_dup', ctRows.length);

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
  marcar('scope_sin_verificar', svRows.length);

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
  marcar('visual_deixis_no_image', vdRows.length);

  // ── §2.2-quater: enunciado que cita una norma SIN nombrarla (29/07/2026) ──
  // «Según el artículo 75 DE LA LEY, ¿cuál es el contenido mínimo…?»: fuera del test no hay forma
  // de saber de qué norma habla. La regla («cada pregunta debe ser AUTOCONTENIDA») ya tenía la
  // mitad de las siglas vigilada en generación (`lib/generacion/siglasSinDesarrollar.js`), pero
  // nadie la barría sobre el banco vivo. Núcleo puro compartido en lib/health/autocontenida.cjs;
  // el backend @Cron replica los patrones inline y `content-sweep-parity` los compara POR VALOR.
  // OJO: las siglas se comparan con `~` (sensible a mayúsculas) — con `~*` casaría cualquier par
  // de letras y daría por identificada toda pregunta.
  const acRows = (await c.query(`
    SELECT id, question_text FROM questions
    WHERE is_active = true
      AND question_text ~* $1
      AND NOT (question_text ~* $2 OR question_text ~ $3)
    LIMIT 60`, [AC_DESNUDA, AC_IDENTIFICA, AC_SIGLA])).rows;
  if (acRows.length) add('content', 'warn', null, 'enunciado_norma_sin_nombrar',
    `${acRows.length}${acRows.length >= 60 ? '+' : ''} pregunta(s) visible(s) cuyo enunciado cita un artículo «de la ley» sin nombrarla nunca — incumple §2.2-quater (autocontenida); el nombre está en la ley vinculada`,
    { count: acRows.length, sample: acRows.slice(0, 15).map(r => ({ id: r.id, q: (r.question_text || '').slice(0, 90) })) });
  marcar('enunciado_norma_sin_nombrar', acRows.length);

  // ── CHAT IA caído: respuestas de error servidas a usuarios (28/07/2026) ──
  // El chat sirvió 210 respuestas de error y `had_error` estaba en false en las 210, así que
  // NADA lo veía: lo destaparon 27 usuarios pulsando el pulgar abajo, semanas después. Dos
  // causas medidas en las trazas: un modelo que ya no existía (179 fallos, 15/06→09/07, ya
  // corregido) y la cuenta del proveedor sin saldo (27, el último el 26/07).
  //
  // Se mira el TEXTO servido y no `had_error` a propósito: el arreglo que rellena esa columna
  // es nuevo, así que durante un tiempo los errores viejos seguirán con `false`. El texto
  // estaba desde el principio.
  const chatErr = (await c.query(`
    SELECT count(*)::int n, max(created_at) ult,
           count(DISTINCT user_id)::int usuarios
    FROM ai_chat_logs
    WHERE created_at > now() - interval '24 hours'
      AND (full_response ILIKE '%ha ocurrido un error%'
        OR full_response ILIKE '%hubo un error al procesar%'
        OR full_response ILIKE '%no está disponible ahora mismo%')`)).rows[0];
  if (chatErr && chatErr.n > 0) add('app', 'error', null, 'chat_ia_errores',
    `${chatErr.n} respuesta(s) de ERROR servidas por el chat IA en 24h a ${chatErr.usuarios} usuario(s) — el asistente está fallando (mira el errorStatus en ai_chat_traces: sin saldo del proveedor, modelo inexistente…)`,
    { n: chatErr.n, usuarios: chatErr.usuarios, ultimo: chatErr.ult });
  marcar('chat_ia_errores', chatErr ? chatErr.n : 0);

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
    { n: sinConv.length, sample: sinConv.slice(0, 10).map(r => ({ id: r.id, type: r.type, msg: r.msg, creado: r.created_at })) });
  marcar('feedback_sin_conversacion', sinConv.length);

  // ── Barajado ENCENDIDO pero sin rastro (28/07/2026) ──
  //
  // La bandera activa y ni una sola respuesta reciente con `option_order`. Un piloto que no
  // produce señal es indistinguible de uno que va bien, y así estuvo 8 horas el día que se
  // encendió: `option_order` a NULL en el 100 % de las filas mientras el servidor SÍ barajaba
  // (verificado ejecutando la función real de servir). Eso significa que la permutación no vuelve
  // al guardar y el servidor corrige la posición MOSTRADA contra la clave ORIGINAL → fallos falsos
  // en silencio. El criterio ya estaba escrito en la ficha del piloto, pero como consulta que
  // alguien tenía que acordarse de lanzar; aquí deja de depender de la memoria de nadie.
  if (String(process.env.FEATURE_SHUFFLE_OPTIONS || '').toLowerCase() === 'true') {
    const [barajado] = (await c.query(`
      SELECT count(*)::int AS respuestas,
             count(option_order)::int AS con_orden
        FROM test_questions
       WHERE created_at > now() - interval '24 hours'`)).rows;
    if (barajado.respuestas > 100 && barajado.con_orden === 0) {
      add('app', 'error', null, 'shuffle_encendido_sin_efecto',
        `El barajado está ACTIVO y ninguna de las ${barajado.respuestas} respuestas de las últimas 24h guarda el orden servido: o no baraja de verdad (piloto inerte) o la permutación no vuelve al guardar (y entonces se están registrando fallos falsos)`,
        { respuestas24h: barajado.respuestas, conOrden: barajado.con_orden, scope: process.env.FEATURE_SHUFFLE_OPTIONS_SCOPE || null });
    }
    marcar('shuffle_encendido_sin_efecto', barajado.respuestas);
  }

  // ── Mapa de visibilidad frío: index-only scans que NO lo son (T-275) ──
  // Cuando el mapa se enfría, Postgres sigue diciendo «Index Only Scan» en el plan pero baja al
  // heap fila por fila. La consulta devuelve lo correcto; solo que tarda cien veces más — y por
  // eso NINGÚN indicador lo veía: no es un error, es una respuesta correcta que llega tarde
  // (mismo punto ciego que T-254). Caso real 29/07: `test_questions` al 67,5% → 72.695 heap
  // fetches y 17.809 ms en la consulta de theme-stats; tras calentar el mapa, 0 y 145 ms.
  //
  // La decisión vive en `lib/db/visibilityMap.ts` (pura y testeada). Aquí solo la consulta.
  try {
    const vm = (await c.query(`
      SELECT c.relname, c.relpages::int AS relpages, c.relallvisible::int AS relallvisible,
             (COALESCE(c.reloptions::text,'') ILIKE '%insert_scale%') AS tiene_ajuste,
             s.n_live_tup::bigint AS vivas, s.n_dead_tup::bigint AS muertas,
             s.n_ins_since_vacuum::bigint AS ins_pend,
             -- Los dos parámetros del disparador de inserts: con ellos el remedio sabe si el
             -- autovacuum está A MITAD DE CICLO (cola en su régimen) o atascado (T-275, 30/07).
             COALESCE(NULLIF(substring(COALESCE(c.reloptions::text,'') from 'autovacuum_vacuum_insert_threshold=([0-9]+)'),'')::int, 1000) AS ins_threshold,
             COALESCE(NULLIF(substring(COALESCE(c.reloptions::text,'') from 'autovacuum_vacuum_insert_scale_factor=([0-9.]+)'),'')::float, 0.2) AS ins_scale,
             COALESCE(NULLIF(substring(COALESCE(c.reloptions::text,'') from 'autovacuum_vacuum_scale_factor=([0-9.]+)'),'')::float, 0.2) AS scale_muertas
        FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
        JOIN pg_stat_user_tables s ON s.relid = c.oid
       WHERE c.relkind = 'r' AND c.relpages > $1`, [VM_MIN_PAGES])).rows;
    const norm = vm.map(r => ({
      relname: r.relname, relpages: r.relpages, relallvisible: r.relallvisible,
      tieneAjusteInserts: r.tiene_ajuste,
      vivas: Number(r.vivas), muertas: Number(r.muertas),
      insPendientes: Number(r.ins_pend), scaleFactorMuertas: Number(r.scale_muertas),
      insertThreshold: Number(r.ins_threshold), insertScaleFactor: Number(r.ins_scale),
    }));
    const frias = tablasFrias(norm);
    // PREVENTIVO: grande y sin la protección puesta, aunque hoy esté caliente. El detector de
    // frías llega tarde — el 29/07 se protegieron las 13 frías de ese momento y a la mañana
    // siguiente `observable_events` (la mayor, ~3 GB) había caído por no estar en aquella lista.
    for (const t of tablasSinAjuste(norm).slice(0, 5)) {
      add('app', 'warn', null, 'visibility_map_sin_ajuste',
        `\`${t.relname}\` (${t.relpages.toLocaleString('es-ES')} páginas) NO tiene el ajuste de autovacuum por inserts: se enfriará tarde o temprano y nadie la despertará`,
        { tabla: t.relname, relpages: t.relpages, pctVisible: t.pctVisible, remedio: remedioVisibilidad(t) });
    }
    for (const f of frias.slice(0, 5)) {
      add('app', f.status === 'error' ? 'error' : 'warn', null, 'visibility_map_frio',
        `\`${f.relname}\` con solo el ${f.pctVisible}% de páginas marcadas visibles (${f.paginasFrias.toLocaleString('es-ES')} frías): sus index-only scans bajan al heap y pueden tardar 100× más`,
        { tabla: f.relname, pctVisible: f.pctVisible, paginasFrias: f.paginasFrias, relpages: f.relpages, remedio: remedioVisibilidad(f) });
    }
    marcar('visibility_map_sin_ajuste', norm.length);
    marcar('visibility_map_frio', norm.length);
  } catch (e) { console.warn('⚠️ mapa de visibilidad no evaluado:', String(e.message || e).slice(0, 120)); }

  // ── Epígrafe con la cabecera/pie del PDF del boletín incrustada (T-171) ──
  // Al importar un temario desde el PDF de un boletín, el pie puede colarse EN MITAD DE LA FRASE.
  // Caso real: `ordenanza-ayuntamiento-cordoba` T8 → «…Medidas preventivas y pautas de DE LA
  // PROVINCIA ESTE DOCUMENTO ES UNA COPIA ELECTRÓNICA… Nº 99 p. 7474 actuación ante incendios…».
  // Frecuencia baja, daño caro: la verificación de literalidad compara contra un texto que ya no
  // es el programa, y cualquier adjudicación epígrafe↔scope por LLM razona sobre basura.
  // La guarda de «Depósito legal» (materia legítima en biblioteconomía) vive en el núcleo puro.
  try {
    const eps = (await c.query(`SELECT position_type AS slug, topic_number AS tema, epigrafe
                                  FROM topics WHERE epigrafe IS NOT NULL`)).rows;
    for (const e of epigrafesSucios(eps).slice(0, 10)) {
      add('content', 'warn', e.slug, 'epigrafe_ruido_boletin',
        `${e.slug} T${e.tema}: el epígrafe trae incrustada la cabecera/pie del PDF del boletín (${e.marcadores.slice(0, 2).join(' · ')})`,
        { slug: e.slug, tema: e.tema, marcadores: e.marcadores });
    }
    marcar('epigrafe_ruido_boletin', eps.length);
  } catch (e) { console.warn('⚠️ ruido de boletín en epígrafes no evaluado:', String(e.message || e).slice(0, 120)); }

  // ── Epígrafe CORTADO: promete la lista de materias y no la trae (T-625) ──
  // Al importar por lotes, la continuación del epígrafe (lo que sigue a los dos puntos) se pierde
  // y el campo se queda cortado en seco: «Régimen Jurídico del Sector Público (I):». El epígrafe
  // es la VARA DE MEDIR del temario (Paso 1/Paso 2/sobre-inclusión); uno truncado no se puede
  // contrastar con NADA — cualquier scope le encaja porque no dice nada. Solo temas ACTIVOS: es la
  // superficie que sirve al usuario. Nace en 14 (medido 06-07/08/2026): cualquier subida es
  // regresión demostrable.
  try {
    const epsTemasActivos = (await c.query(`SELECT position_type AS slug, topic_number AS tema, epigrafe
                                  FROM topics WHERE is_active = true AND epigrafe IS NOT NULL`)).rows;
    for (const e of epigrafesTruncados(epsTemasActivos).slice(0, 20)) {
      add('content', 'warn', e.slug, 'epigrafe_truncado',
        `${e.slug} T${e.tema}: el epígrafe termina en ":" sin traer la lista de materias que promete ("${(e.epigrafe || '').slice(-50)}")`,
        { slug: e.slug, tema: e.tema, epigrafe: e.epigrafe });
    }
    marcar('epigrafe_truncado', epsTemasActivos.length);
  } catch (e) { console.warn('⚠️ epígrafes truncados no evaluados:', String(e.message || e).slice(0, 120)); }


  // ── Explicación estructurada que se RENDERIZA rota (29/07) ──
  // Desde que producción compone el texto desde `explanation_data`, un campo mal formado ahí sale a
  // pantalla tal cual. El defecto dominante es un `**` sin pareja en una razón, herencia de la
  // transcripción del histórico: partía «**A) Insertar** — …» y se quedaba con «Insertar** — …».
  // Lo destapó la auditoría del 29/07 (los agentes lo vieron en 11 de 115 preguntas revisadas, y el
  // backup demostró que YA venían rotas). Es defecto de FORMA: no dice nada del contenido.
  try {
    const filas = (await c.query(`
      SELECT q.id, q.explanation_data,
             (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id)::int AS servidas
        FROM questions q
       WHERE q.is_active = true AND q.explanation_data IS NOT NULL`)).rows;
    const rotas = explicacionesRotas(filas);
    if (rotas.length) {
      const exposiciones = rotas.reduce((a, b) => a + b.servidas, 0);
      add('content', 'warn', null, 'explicacion_estructura_rota',
        `${rotas.length} explicación(es) estructurada(s) se renderizan rotas (${exposiciones} exposiciones acumuladas)`,
        { total: rotas.length, exposiciones, muestra: rotas.slice(0, 10) });
    }
    marcar('explicacion_estructura_rota', filas.length);
  } catch (e) { console.warn('⚠️ estructura de explicaciones no evaluada:', String(e.message || e).slice(0, 120)); }

  // ── Explicación CORTADA a mitad de frase (T-250) ──
  // Hermana de la anterior y distinta: allí el texto está entero y se PINTA mal; aquí el texto
  // termina en seco y falta lo que venía después («…los miembros del Cuerpo Nacional de»).
  // Lo que hizo falta para poder cablearlo fue la CALIBRACIÓN: la heurística ortográfica («no
  // acaba en signo de cierre») da 8.938 sobre 136.310 y casi todas son correctas —cierran con la
  // referencia de la fuente, con una URL, o simplemente están mal puntuadas—. El criterio que sí
  // discrimina es gramatical: la última palabra PIDE continuación (preposición, conjunción,
  // determinante) o el texto acaba en coma. Con eso: 112 hallazgos y 20 de 20 correctos en muestra
  // aleatoria juzgada a mano. El juicio vive en el núcleo puro, no aquí.
  try {
    const filas = (await c.query(`
      SELECT q.id, right(q.explanation, 220) AS cola,
             (SELECT count(*) FROM test_questions tq WHERE tq.question_id = q.id)::int AS servidas
        FROM questions q
       WHERE q.is_active = true AND q.explanation IS NOT NULL AND length(trim(q.explanation)) > 0`)).rows;
    const cortadas = filas
      .map((f) => ({ ...f, v: clasificaTruncada({ explanation: f.cola }) }))
      .filter((f) => f.v.truncada);
    if (cortadas.length) {
      const exposiciones = cortadas.reduce((a, b) => a + b.servidas, 0);
      add('content', 'warn', null, 'explicacion_truncada',
        `${cortadas.length} explicación(es) se cortan a mitad de frase (${exposiciones} exposiciones acumuladas)`,
        {
          total: cortadas.length,
          exposiciones,
          muestra: cortadas
            .sort((a, b) => b.servidas - a.servidas)
            .slice(0, 10)
            .map((f) => ({ id: f.id, motivo: f.v.motivo, cola: f.v.cola.slice(-70), servidas: f.servidas })),
        });
    }
    marcar('explicacion_truncada', filas.length);
  } catch (e) { console.warn('⚠️ explicaciones truncadas no evaluadas:', String(e.message || e).slice(0, 120)); }
  // ── Plazas publicadas con una SUMA que puede ser falsa (29/07/2026, caso Concha) ──
  // Cuando `plazas_discapacidad_incluidas` es NULL no consta si la reserva va dentro del
  // turno libre o aparte, y la vista SSOT tiene que dar un número: supone que van aparte
  // y SUMA. Si iban dentro, publicamos plazas que no existen — que es justo lo que una
  // usuaria vio en el catálogo (51 en Sevilla cuando son 46). El bug de código está
  // arreglado y con guardarraíl; esto vigila el hueco de DATOS que queda. Se resuelve
  // verificando la convocatoria contra su boletín, nunca suponiendo.
  try {
    const filas = (await c.query(`
      SELECT o.slug, c2.plazas_libres, c2.plazas_discapacidad,
             c2.plazas_discapacidad_incluidas AS incluidas
        FROM oposiciones o
        JOIN convocatorias c2 ON c2.oposicion_id = o.id AND c2.is_current
       WHERE o.is_active AND COALESCE(c2.plazas_discapacidad, 0) > 0
    `)).rows;
    for (const h of detectarReservaSinDeclarar(filas).slice(0, 12)) {
      add('content', h.severity, h.slug, 'plazas_reserva_sin_declarar', h.mensaje,
        { plazas_en_duda: h.plazas_en_duda });
    }
    marcar('plazas_reserva_sin_declarar', filas.length);
  } catch (e) { console.warn('⚠️ reserva de discapacidad sin declarar no evaluada:', String(e.message || e).slice(0, 120)); }
}

main().catch(e => { console.error(e?.message || e); process.exit(2); });
