import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { Resend } from 'resend';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';

/**
 * Barrido de SALUD (app + contenido) → tabla `content_health_findings` + email.
 *
 * PORT IN-PROCESS de `scripts/health-sweep.cjs` (que se quedó fuera de la
 * migración GHA→Fargate del 07/07: el sweep nunca tuvo disparador y el panel
 * `/admin/contenido` quedaba congelado). Aquí corre como @Cron del backend
 * NestJS, igual que los otros batches pesados (refresh-theme-cache, boe-changes…),
 * sin límite de duración de endpoint y con heartbeat + observabilidad.
 *
 * FUENTE ÚNICA de la lógica de detección. `scripts/health-sweep.cjs` se conserva
 * como gemelo CLI para DRY/manual (mismas queries). MANTENER EN SYNC.
 *
 * SEPARACIÓN app/contenido: APP (usuario topa con error) → email siempre que haya;
 * CONTENIDO (calidad, app va) → email solo los lunes (revisión semanal). El
 * badge/panel lee la tabla a diario.
 */

interface Finding {
  category: 'app' | 'content';
  severity: 'error' | 'warn';
  slug: string | null;
  kind: string;
  message: string;
  detail: Record<string, unknown> | null;
}

export interface SweepSummary {
  total: number;
  appError: number;
  contentError: number;
  contentWarn: number;
  wrote: boolean;
  emailsSent: number;
}

const esc = (s: unknown): string =>
  String(s).replace(
    /[&<>]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string,
  );

function cardInt(n: unknown): number | null {
  if (n == null) return null;
  if (typeof n !== 'string' && typeof n !== 'number') return null;
  const s = String(n).trim();
  if (/\{\w+\}/.test(s)) return null;
  if (!/^[0-9][0-9.\s]*$/.test(s)) return null;
  const v = parseInt(s.replace(/[.\s]/g, ''), 10);
  return Number.isFinite(v) ? v : null;
}

interface StatCard {
  texto?: string;
  numero?: unknown;
}
function cardsAbout(est: unknown, w: string): StatCard[] {
  if (!Array.isArray(est)) return [];
  const re = new RegExp(w, 'i');
  return (est as StatCard[]).filter((c) => c && re.test(String(c.texto ?? '')));
}

const isCellLine = (l: string): boolean =>
  l.length > 0 &&
  l.length <= 30 &&
  !/[.:;]$/.test(l) &&
  !/^([a-zñ]\)|\d{1,3}\.)/.test(l) &&
  /[A-Za-z0-9]/.test(l);
const STRUCTURE_RE =
  /\b(T[IÍ]TULO|CAP[IÍ]TULO|SECCI[OÓ]N|SUBSECCI[OÓ]N|ANEXO|DISPOSICI[OÓ]N|LIBRO)\b/i;
function detectFlattenedTable(content: string | null): string[] | null {
  if (!content || !content.trim()) return null;
  const lines = content
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  let best: string[] = [];
  let run: string[] = [];
  for (const l of lines) {
    if (isCellLine(l)) {
      run.push(l);
      if (run.length > best.length) best = run.slice();
    } else run = [];
  }
  if (best.length < 4) return null;
  if (STRUCTURE_RE.test(best.join(' '))) return null;
  return best;
}

const TARGET_YEAR_RE =
  /\bpara\s+(?:el\s+a[ñn]o\s+)?(\d{4})\b|\bdel\s+(?:a[ñn]o|ejercicio)\s+(\d{4})\b/i;

interface VerificationSummary {
  no_consolidated_text?: boolean;
  historical?: boolean;
  deliberate_subset?: boolean;
  boe_count?: number;
  db_count?: number;
  missing_in_db?: number;
  content_mismatch?: number;
  title_mismatch?: number;
}
function classifyLaw(
  isVirtual: boolean | null,
  boeUrl: string | null,
  status: string | null,
  su: VerificationSummary | null,
): string | null {
  const hasSource = !!(boeUrl && String(boeUrl).trim());
  const claims = ['actualizada', 'verificada'].includes(
    (status || '').toLowerCase(),
  );
  if (isVirtual === true) return null;
  if (!su) {
    if (claims) return 'false_green';
    if (!hasSource) return 'no_source';
    return 'never_verified';
  }
  if (
    su.no_consolidated_text === true ||
    su.historical === true ||
    su.deliberate_subset === true
  )
    return null;
  const nn = (x: unknown): number | null =>
    typeof x === 'number' && Number.isFinite(x) ? x : null;
  const boe = nn(su.boe_count);
  const db = nn(su.db_count);
  const missing =
    nn(su.missing_in_db) ??
    (boe != null && db != null ? Math.max(0, boe - db) : null);
  if (missing != null && missing > 0) return 'incomplete';
  if ((nn(su.content_mismatch) ?? 0) > 0 || (nn(su.title_mismatch) ?? 0) > 0)
    return 'issues';
  return null;
}

// Mirror INLINE de lib/convocatoria/examenPasadoEnTexto.cjs — MANTENER EN SYNC.
// Detecta textos libres (landing_faqs/description) que anuncian un examen como VIGENTE
// con una fecha YA PASADA (el opositor lee una fecha vieja como la próxima). Calibrado:
// solo el ENGAÑO (presentado como vigente), no el histórico ni fechas de plazo/publicación.
const MESES_EXAM: Record<string, number> = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const ES_EXAMEN = /\b(examen|ejercicio|prueba)\b/i;
const NO_EXAMEN =
  /plazo|solicitud|inscripci|se public|publicad|publicaron|cerr[óo]|finaliz|resultado|lista|admitid|nombramiento/i;
const VIGENTE_EXAM =
  /\b(es el|es la|ser[áa]|tendr[áa] lugar|se celebrar[áa]|previsto para|prevista para|convocado para|convocada para|examen el|examen es|fecha del examen|se realizar[áa])\b/i;
const PASADO_EXAM =
  /(^|\s)se celebr[óo]|(^|\s)celebr[óo]|celebrad[oa]|tuvo lugar|se realiz[óo]|realizad[oa]|ya (se )?celebr|examen fue/i;
function extraerFechasExam(txt: string): Array<{ iso: string; idx: number }> {
  const out: Array<{ iso: string; idx: number }> = [];
  const re1 =
    /(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\s+de\s+(20\d\d)/gi;
  for (const m of txt.matchAll(re1))
    out.push({
      iso: `${m[3]}-${String(MESES_EXAM[m[2].toLowerCase()]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`,
      idx: m.index ?? 0,
    });
  const re2 = /(\d{1,2})\/(\d{1,2})\/(20\d\d)/g;
  for (const m of txt.matchAll(re2))
    out.push({
      iso: `${m[3]}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`,
      idx: m.index ?? 0,
    });
  return out;
}
function examenPasadoPresentadoVigente(
  texto: string | null | undefined,
  hoyIso: string,
): Array<{ iso: string; contexto: string }> {
  if (!texto) return [];
  const t = String(texto);
  const hits: Array<{ iso: string; contexto: string }> = [];
  for (const f of extraerFechasExam(t)) {
    if (f.iso >= hoyIso) continue;
    const ctx = t.slice(Math.max(0, f.idx - 55), f.idx + 15);
    if (!ES_EXAMEN.test(ctx)) continue;
    if (NO_EXAMEN.test(ctx)) continue;
    if (PASADO_EXAM.test(ctx)) continue;
    if (!VIGENTE_EXAM.test(ctx)) continue;
    hits.push({ iso: f.iso, contexto: ctx.replace(/\s+/g, ' ').trim() });
  }
  return hits;
}
function detectarExamenPasado(
  data: { landingDescription?: unknown; landingFaqs?: unknown },
  hoyIso: string,
): Array<{ iso: string; contexto: string }> {
  const textos: string[] = [];
  if (data.landingDescription) textos.push(String(data.landingDescription));
  if (Array.isArray(data.landingFaqs))
    for (const f of data.landingFaqs as Array<{ pregunta?: string; respuesta?: string }>)
      textos.push(`${f.pregunta || ''} ${f.respuesta || ''}`);
  return textos.flatMap((t) => examenPasadoPresentadoVigente(t, hoyIso));
}

// Mirror INLINE de scripts/health-sweep.cjs (scope_over_inclusion_suspect) — MANTENER EN SYNC.
function romanToInt(s: string): number | null {
  s = s.toUpperCase().replace(/\.BIS$/, '');
  const R: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const cur = R[s[i]],
      nxt = R[s[i + 1]];
    if (cur == null) return null;
    n += nxt && cur < nxt ? -cur : cur;
  }
  return n;
}
function classifyScope(
  lawTotal: number,
  scopedCount: number,
  ep: string | null,
): { band: string; score: number; coverage: number; reason: string | null } {
  ep = ep || '';
  const coverage = lawTotal > 0 ? scopedCount / lawTotal : 0;
  const hasColon = /:/.test(ep);
  const titulos: number[] = [];
  let m: RegExpExecArray | null;
  const reTit = /[Tt][íi]tulo\s+(Preliminar|[IVXLC]+(?:\.bis)?)/g;
  while ((m = reTit.exec(ep)) !== null) {
    const v = /preliminar/i.test(m[1]) ? 0 : romanToInt(m[1]);
    if (v != null) titulos.push(v);
  }
  const titSet = [...new Set(titulos)].sort((a, b) => a - b);
  let titComplete: boolean | null = null,
    titGap = false;
  if (titSet.length >= 2) {
    const max = titSet[titSet.length - 1];
    const miss: number[] = [];
    for (let i = titSet[0]; i <= max; i++) if (!titSet.includes(i)) miss.push(i);
    titGap = miss.length > 0;
    titComplete = !titGap;
  }
  const closureWord =
    /\breforma\b|disposici[oó]n(?:es)?\s+(?:adicional|transitoria|derogatoria|final)/i.test(ep);
  let segments = 0;
  if (hasColon)
    segments = ep
      .slice(ep.indexOf(':') + 1)
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 4 && /[a-záéíóúñ]/i.test(s)).length;
  const explicitArts = new Set<number>();
  const reR = /art[íi]?c?u?l?o?s?\.?\s*(\d+)\s*(?:a|al|-|–)\s*(\d+)/gi;
  while ((m = reR.exec(ep)) !== null) {
    const a = +m[1],
      b = +m[2];
    if (b - a >= 0 && b - a < 500) for (let i = a; i <= b; i++) explicitArts.add(i);
  }
  const reS = /art[íi]?c?u?l?o?\.?\s*(\d+)(?!\s*(?:a|al|-|–)\s*\d)/gi;
  while ((m = reS.exec(ep)) !== null) explicitArts.add(+m[1]);
  const wholeLawWords =
    /[íi]ntegr|en su totalidad|toda la ley|texto [íi]ntegro|el conjunto de la ley|la ley completa/i.test(
      ep,
    );
  const bigLaw = lawTotal >= 12,
    nearFull = coverage >= 0.9,
    enumerator = hasColon && segments >= 3;
  if (wholeLawWords) return { band: 'CLEARED', score: 0, coverage, reason: null };
  if (titComplete && closureWord && nearFull)
    return { band: 'CLEARED', score: 0, coverage, reason: null };
  let score = 0,
    reason: string | null = null;
  if (explicitArts.size > 0 && bigLaw && scopedCount >= explicitArts.size * 2 && nearFull) {
    score += 60;
    reason = `epígrafe cita ${explicitArts.size} arts concretos pero scope tiene ${scopedCount}/${lawTotal}`;
  }
  if (titGap && nearFull && bigLaw) {
    score += 50;
    reason = reason || `epígrafe nombra títulos con huecos (${titSet.join(',')}) pero scope cubre toda la ley`;
  }
  if (bigLaw && nearFull && enumerator) {
    score += 30;
    reason =
      reason ||
      `ley grande (${lawTotal}) casi completa (${(coverage * 100).toFixed(0)}%) con epígrafe que enumera ${segments} bloques`;
  }
  const band = score >= 50 ? 'HIGH' : score >= 30 ? 'MEDIUM' : 'NONE';
  return { band, score, coverage, reason };
}

// Mirror INLINE de lib/convocatoria/seguimientoUrlSalud.cjs — MANTENER EN SYNC.
// seguimiento_url que vigila un ciclo ya cerrado (falso negativo silencioso). Graduado:
// solo la señal LIMPIA (doc de boletín de año viejo) es error; el resto warn (cola de revisión).
const REF_DOC_BOLETIN =
  /\b(?:BOE|BOCYL|BOJA|DOGV|DOCV|DOG|BOPV|BORM|BOA|BOPA|BOCM|BOIB|BON|DOE|BOR|BOC)[-_ ]?[A-Z]?[-_ ]?(20\d\d)\b/i;
const ANIO_SUELTO = /\b(20\d\d)\b/g;
const URL_GENERICA =
  /\/(?:empleo-?p[uú]blico|emprego|oferta-?de-?empleo(?:-p[uú]blico)?(?:-\d{4}(?:-\d{4})?)?|procesos-?selectivos|convocatorias|recursos-?humanos|tabl[oó]n(?:-oficial)?)\/?$/i;
function diagnosticarSeguimientoUrl(
  url: string | null | undefined,
  anioVigente: number | null | undefined,
  opts?: { procesoEnJuego?: boolean },
): { nivel: string; severidad: 'error' | 'warn' | 'ok'; motivo: string } {
  if (!url) return { nivel: 'ok', severidad: 'ok', motivo: 'sin seguimiento_url' };
  const vig =
    typeof anioVigente === 'number' && Number.isFinite(anioVigente) ? anioVigente : null;
  const doc = url.match(REF_DOC_BOLETIN);
  if (doc && vig && Number(doc[1]) < vig)
    return {
      nivel: 'stale_boletin',
      severidad: 'error',
      motivo: `apunta al documento de boletín ${doc[0]} (${doc[1]}), anterior a la convocatoria vigente (${vig}); un boletín es inmutable y nunca reflejará la nueva`,
    };
  const anios = [...String(url).matchAll(ANIO_SUELTO)].map((m) => Number(m[1]));
  if (vig && anios.length > 0 && !anios.includes(vig) && Math.max(...anios) < vig)
    return {
      nivel: 'posible_ciclo_viejo',
      severidad: 'warn',
      motivo: `la URL menciona ${[...new Set(anios)].join(', ')} pero no ${vig} (convocatoria vigente); revisar si sigue el ciclo correcto`,
    };
  // Índice genérico: normalmente warn (para una diputación pequeña el índice puede ser lo único).
  // PERO con el proceso VIVO en una oposición que vendemos (procesoEnJuego) nos deja CIEGOS a su
  // convocatoria —y a si hay VARIAS de la misma OEP (caso Murcia)— → error accionable que
  // reaparece cada sweep hasta apuntar la URL a la ficha concreta (una señal correcta no se
  // descarta como ruido de hash_change).
  if (URL_GENERICA.test(url)) {
    const enJuego = !!opts?.procesoEnJuego;
    return {
      nivel: 'url_generica',
      severidad: enJuego ? 'error' : 'warn',
      motivo: enJuego
        ? 'la URL es una página índice del portal de empleo, no la ficha de la convocatoria; con el proceso VIVO esto nos deja CIEGOS a sus cambios y a si hay varias convocatorias de la misma OEP — apúntala a la convocatoria concreta'
        : 'la URL es una página índice del portal de empleo, no una convocatoria concreta; un cambio ahí rara vez significa algo de esta oposición',
    };
  }
  return { nivel: 'ok', severidad: 'ok', motivo: 'sin señales de desfase' };
}

@Injectable()
export class ContentHealthSweepService {
  private readonly logger = new Logger(ContentHealthSweepService.name);
  private readonly base: string;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly config: ConfigService,
  ) {
    this.base = (
      this.config.get<string>('APP_BASE_URL') || 'https://www.vence.es'
    ).replace(/\/$/, '');
  }

  private async httpOnce(url: string): Promise<number | string> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 15000);
      const r = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': 'vence-health-sweep/1.0' },
      });
      clearTimeout(t);
      return r.status;
    } catch (e) {
      return `ERR(${(e as Error)?.name || 'fetch'})`;
    }
  }
  private async httpStatus(url: string): Promise<number | string> {
    const a = await this.httpOnce(url);
    if (a === 200) return a;
    await new Promise((r) => setTimeout(r, 1200));
    return this.httpOnce(url);
  }

  async run(): Promise<SweepSummary> {
    const now = new Date();
    const stamp = now.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const isMonday =
      now.getUTCDay() === 1 || process.env.FORCE_CONTENT_EMAIL === '1';
    const NO_WRITE = process.env.NO_WRITE === '1';

    const F: Finding[] = [];
    const add = (
      category: Finding['category'],
      severity: Finding['severity'],
      slug: string | null,
      kind: string,
      message: string,
      detail?: Record<string, unknown> | null,
    ) =>
      F.push({
        category,
        severity,
        slug,
        kind,
        message,
        detail: detail || null,
      });

    const opos = (await this.db.execute(sql`
      SELECT id, slug, landing_estadisticas, temas_count FROM oposiciones WHERE is_active = true ORDER BY slug
    `)) as unknown as Array<{
      id: string;
      slug: string;
      landing_estadisticas: unknown;
      temas_count: number | null;
    }>;

    for (const o of opos) {
      const pt = o.slug.replace(/-/g, '_');
      // ── APP: HTTP ──
      const [land, tema, test] = await Promise.all([
        this.httpStatus(`${this.base}/${o.slug}`),
        this.httpStatus(`${this.base}/${o.slug}/temario`),
        this.httpStatus(`${this.base}/${o.slug}/test`),
      ]);
      if (land !== 200)
        add(
          'app',
          'error',
          o.slug,
          'http_down',
          `landing /${o.slug} → ${land}`,
        );
      if (tema !== 200)
        add(
          'app',
          'error',
          o.slug,
          'http_down',
          `/${o.slug}/temario → ${tema}`,
        );
      if (test !== 200)
        add('app', 'error', o.slug, 'http_down', `/${o.slug}/test → ${test}`);
      // ── APP: cobertura (MV, misma fuente que la app) ──
      const topics = (await this.db.execute(sql`
        SELECT tp.topic_number, tp.disponible, COALESCE(SUM(s.total_questions),0)::int n
        FROM topics tp LEFT JOIN topic_law_question_summary s ON s.topic_id = tp.id WHERE tp.position_type = ${pt}
        GROUP BY tp.topic_number, tp.disponible
      `)) as unknown as Array<{
        topic_number: number;
        disponible: boolean;
        n: number;
      }>;
      const disp = topics.filter((t) => t.disponible);
      if (topics.length && disp.length === 0)
        add(
          'app',
          'error',
          o.slug,
          'empty_topic',
          `${o.slug}: 0 temas disponibles (publicado vacío)`,
        );
      const vacios = disp.filter((t) => t.n === 0);
      if (vacios.length)
        add(
          'app',
          'error',
          o.slug,
          'empty_topic',
          `${o.slug}: ${vacios.length} tema(s) disponible(s) SIN preguntas (T${vacios
            .slice(0, 5)
            .map((v) => v.topic_number)
            .join(',T')})`,
        );
      const finos = disp.filter((t) => t.n > 0 && t.n < 6);
      if (finos.length)
        add(
          'content',
          'warn',
          o.slug,
          'low_coverage',
          `${o.slug}: ${finos.length} tema(s) con cobertura fina (<6q)`,
        );
      // ── CONTENIDO: hueco OCULTO de cobertura de artículos (caso M, SMS Tema 7,
      // 13/07). Grano más fino que low_coverage: solo temas MAYORMENTE cubiertos a nivel
      // de artículo (≥60%) con ≥4 huecos. Excluye derogados/vacíos y artículos INACTIVOS
      // (a.is_active): un escopado is_active=false NO es "genera preguntas" (puede tenerlas
      // ya) sino servibilidad → lo cubre scope_phantom_article. Partición limpia.
      const sinPreg = (await this.db.execute(sql`
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
          WHERE tp.position_type = ${pt} AND length(coalesce(a.content,'')) > 40 AND a.content NOT ILIKE '%derogado%'
            AND a.article_number ~ '^[0-9]+$'
          GROUP BY tp.topic_number
          HAVING count(*) >= 4
             AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) < count(*)
             AND count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active))::float / count(*) >= 0.6
             AND count(*) - count(*) FILTER (WHERE EXISTS (SELECT 1 FROM questions q WHERE q.primary_article_id = a.id AND q.is_active)) >= 4
        ) t
        ORDER BY topic_number
      `)) as unknown as Array<{ topic_number: number; n: number; ejemplos: string[] | null }>;
      if (sinPreg.length) {
        const tot = sinPreg.reduce((a2, r) => a2 + r.n, 0);
        add(
          'content',
          'warn',
          o.slug,
          'article_no_coverage',
          `${o.slug}: ${sinPreg.length} tema(s) con artículos del temario SIN preguntas (${tot} arts; p.ej. T${sinPreg[0].topic_number}: ${(sinPreg[0].ejemplos || []).join(', ')})`,
          {
            temas: sinPreg.map((r) => ({
              tema: r.topic_number,
              arts_sin_preguntas: r.n,
              ejemplos: r.ejemplos,
            })),
          },
        );
      }

      // ── CONTENIDO: coherencia de tarjetas + dual-write + hitos ──
      const nTopics = topics.length;
      if (o.temas_count != null && Number(o.temas_count) !== nTopics)
        add(
          'content',
          'error',
          o.slug,
          'temas_card',
          `temas_count=${o.temas_count} ≠ ${nTopics} topics reales`,
        );
      for (const card of cardsAbout(o.landing_estadisticas, 'tema')) {
        const v = cardInt(card.numero);
        if (v != null && v !== nTopics)
          add(
            'content',
            'error',
            o.slug,
            'temas_card',
            `tarjeta "${card.texto}"=${v} pero hay ${nTopics} topics`,
          );
      }
      const convRows = (await this.db.execute(sql`
        SELECT plazas_libres, plazas_discapacidad, plazas_promocion_interna, plazas_otros_turnos, estado_proceso, boe_reference, programa_url, examen_config, landing_faqs, landing_estadisticas, landing_description
        FROM convocatorias WHERE oposicion_id = ${o.id} AND is_current = true LIMIT 1
      `)) as unknown as Array<Record<string, unknown>>;
      const conv = convRows[0];
      if (conv) {
        const L = Number(conv.plazas_libres || 0),
          D = Number(conv.plazas_discapacidad || 0),
          P = Number(conv.plazas_promocion_interna || 0);
        // plazas_otros_turnos es jsonb: array [{turno, plazas, ...}] con reservas
        // especiales (violencia de género, terrorismo, personas trans…) que forman
        // parte del total pero NO son libre/discapacidad/PI. Sin sumarlas, el total
        // de la tarjeta (p.ej. 144 = 139 libre + 5 reservas) se marca en falso.
        const otros = conv.plazas_otros_turnos;
        const O = Array.isArray(otros)
          ? otros.reduce(
              (a: number, t) =>
                a + Number((t as { plazas?: unknown })?.plazas || 0),
              0,
            )
          : 0;
        const valid = new Set(
          [L, D, P, L + D, L + P, D + P, L + D + P, L + D + P + O].filter(
            (x) => x > 0,
          ),
        );
        for (const card of cardsAbout(o.landing_estadisticas, 'plaza')) {
          const v = cardInt(card.numero);
          if (v != null && !valid.has(v))
            add(
              'content',
              'error',
              o.slug,
              'plaza_card',
              `tarjeta "${card.texto}"=${v} no cuadra con conv (L=${L} D=${D} P=${P} O=${O})`,
            );
        }
        const faltan = [
          'boe_reference',
          'programa_url',
          'examen_config',
          'landing_faqs',
          'landing_estadisticas',
          'landing_description',
        ].filter((k) => conv[k] == null);
        if (faltan.length)
          add(
            'content',
            'warn',
            o.slug,
            'dual_write',
            `dual-write convocatoria incompleto: ${faltan.join(', ')}`,
          );
        if (conv.estado_proceso === 'inscripcion_abierta') {
          const hRows = (await this.db.execute(sql`
            SELECT COUNT(*)::int n FROM convocatoria_hitos WHERE oposicion_id = ${o.id}
          `)) as unknown as Array<{ n: number }>;
          if (Number(hRows[0].n) === 0)
            add(
              'content',
              'error',
              o.slug,
              'no_hitos',
              `${o.slug}: inscripción abierta pero 0 hitos (timeline vacío)`,
            );
        }
      }
    }

    // ── APP: observable_events críticos 24h ──
    const CRIT = ['server_render_error', 'http_5xx', 'webhook_unhealthy'];
    const obs = (await this.db.execute(sql`
      SELECT event_type, endpoint, COUNT(*)::int n, MAX(error_message) sample FROM observable_events
      WHERE severity='error' AND event_type IN ${CRIT} AND ts > now() - interval '24 hours'
      GROUP BY event_type, endpoint ORDER BY n DESC LIMIT 25
    `)) as unknown as Array<{
      event_type: string;
      endpoint: string;
      n: number;
      sample: string | null;
    }>;
    for (const ev of obs)
      add(
        'app',
        'error',
        null,
        ev.event_type,
        `${ev.n}× ${ev.event_type} @ ${ev.endpoint}${ev.sample ? ' — ' + ev.sample.slice(0, 80) : ''}`,
        { n: ev.n },
      );

    // ── CONTENIDO: tablas APLANADAS (importadas de PDF sin rejilla) ──
    const flat: Array<{
      slug: string;
      an: string;
      aid: string;
      n: number;
      cells: string[];
    }> = [];
    for (let off = 0; off <= 60000; off += 4000) {
      const rows = (await this.db.execute(sql`
        SELECT l.slug, a.id aid, a.article_number an, a.content
        FROM articles a JOIN laws l ON a.law_id = l.id
        WHERE a.is_active AND l.is_active AND position('<' in a.content) = 0 AND length(a.content) > 200 AND a.article_number ~ '^[0-9]+$'
        ORDER BY a.id LIMIT 4000 OFFSET ${off}
      `)) as unknown as Array<{
        slug: string;
        aid: string;
        an: string;
        content: string;
      }>;
      if (!rows.length) break;
      for (const r of rows) {
        const cells = detectFlattenedTable(r.content);
        if (cells)
          flat.push({
            slug: r.slug,
            an: r.an,
            aid: r.aid,
            n: cells.length,
            cells: cells.slice(0, 6),
          });
      }
    }
    if (flat.length) {
      const leyes = [...new Set(flat.map((f) => f.slug))];
      add(
        'content',
        'warn',
        null,
        'flattened_table',
        `${flat.length} artículo(s) con tabla aplanada (import PDF sin rejilla) en ${leyes.length} leyes — arreglo por datos con verificación`,
        { count: flat.length, laws: leyes.length, sample: flat.slice(0, 15) },
      );
    }

    // ── CONTENIDO: explicaciones que son NOTAS DE AUDITORÍA ──
    const AUDIT_NOTE_PATS = [
      'La explicación omite',
      'La explicación debería',
      'La explicación actual',
      'Esta pregunta debería',
      'posible errata',
      'Nota técnica:',
      'respuesta oficial del examen',
      'debería ser impugnada',
      'debería haberse ANULADO',
      'debería haber especificado',
    ];
    const anClause = sql.join(
      AUDIT_NOTE_PATS.map((p) => sql`explanation ILIKE ${'%' + p + '%'}`),
      sql` OR `,
    );
    const anRows = (await this.db.execute(sql`
      SELECT id FROM questions WHERE is_active = true AND (${anClause}) LIMIT 50
    `)) as unknown as Array<{ id: string }>;
    if (anRows.length)
      add(
        'content',
        'warn',
        null,
        'audit_note_explanation',
        `${anRows.length}${anRows.length >= 50 ? '+' : ''} pregunta(s) visibles con la explicación = nota de auditoría de un pase IA (reescribir o needs_human)`,
        { count: anRows.length, sample: anRows.slice(0, 15).map((r) => r.id) },
      );

    // ── CONTENIDO: preguntas que invocan una imagen/icono AUSENTE (visual deixis sin image_url) ──
    // Gemelo de scripts/health-sweep.cjs (MANTENER EN SYNC — guardarraíl content-sweep-parity).
    // El enunciado apunta a un visual ("el siguiente icono", "observa la figura", "de la imagen…")
    // pero image_url es NULL y content_data va vacío → irresoluble en silencio. VD_FP frena FPs
    // ("imagen corporal/pública", "de la imagen y el sonido", "derecho a la propia imagen"…).
    const VD_STRONG =
      '(\\y(el|la)\\s+siguiente\\s+(icono|imagen|imágen|s[íi]mbolo|gr[áa]fico|figura|captura|pictograma|esquema|diagrama|se[ñn]al)\\y)' +
      '|(en\\s+la\\s+imagen\\s+(anterior|superior|inferior|adjunt\\w+|siguiente|de\\s+arriba|de\\s+abajo))' +
      '|(\\yla\\s+imagen\\s+(muestra|adjunt\\w+|superior|inferior|siguiente|anterior)\\y)' +
      '|((observa|observe|obsérv\\w+|f[íi]jese\\s+en)\\s+(la|el)\\s+(siguiente\\s+)?(imagen|figura|gr[áa]fico|icono|s[íi]mbolo|captura))' +
      '|(seg[úu]n\\s+(la\\s+imagen|la\\s+figura|el\\s+gr[áa]fico\\s+adjunt|muestra\\s+la\\s+(imagen|figura)|se\\s+muestra\\s+en\\s+la\\s+(imagen|figura)))' +
      '|(¿qu[ée]\\s+(significa|representa|indica)\\s+(este|el\\s+siguiente)\\s+(icono|s[íi]mbolo|pictograma|gr[áa]fico))' +
      '|(\\y(icono|s[íi]mbolo|pictograma|gr[áa]fico|captura|divisa|distintivo|emblema)\\s+(mostrad\\w+|adjunt\\w+|que\\s+se\\s+muestra|siguiente|anterior|de\\s+la\\s+(imagen|figura|fotograf\\w+))\\y)' +
      '|(\\y(restas|celda|celdas|f[óo]rmula|f[óo]rmulas|tabla|query|consulta|marca|base\\s+de\\s+datos|diagrama)\\w*\\s+\\w*\\s*(de|en)\\s+la\\s+imagen\\y)' +
      '|(\\yde\\s+la\\s+imagen[,. ]+(indica|se[ñn]ale|cu[áa]l|obten|calcul))';
    const VD_FP =
      'imagen corporal|imagen p[úu]blica|imagen de la administraci|imagen de las mujeres|de la imagen y|imagen y (el |del )?sonido|imagen y sonido|derecho a la propia imagen|reproducci[óo]n del sonido|de la imagen o|icono (muestra|con forma|que representa a)|s[íi]mbolo (¶|de p[áa]rrafo)|figura (jur[íi]dic|del? |profesional)';
    const vdRows = (await this.db.execute(sql`
      SELECT id, question_text FROM questions
      WHERE is_active = true
        AND (image_url IS NULL OR image_url = '')
        AND (content_data IS NULL OR content_data::text IN ('{}','null',''))
        AND question_text ~* ${VD_STRONG} AND question_text !~* ${VD_FP}
      LIMIT 60
    `)) as unknown as Array<{ id: string; question_text: string }>;
    if (vdRows.length)
      add(
        'content',
        'warn',
        null,
        'visual_deixis_no_image',
        `${vdRows.length}${vdRows.length >= 60 ? '+' : ''} pregunta(s) visible(s) que invocan un icono/símbolo/imagen SIN imagen almacenada (image_url NULL) — irresolubles; reconstruir la imagen o jubilar (admin_image_unavailable)`,
        {
          count: vdRows.length,
          sample: vdRows.slice(0, 15).map((r) => ({ id: r.id, q: (r.question_text || '').slice(0, 90) })),
        },
      );

    // ── CONTENIDO: leyes ANUALES caducadas dentro de un topic_scope ──
    const CURR_YEAR = now.getFullYear();
    const scopedLaws = (await this.db.execute(sql`
      SELECT l.id, l.short_name, l.name,
        (SELECT array_agg(DISTINCT t.position_type ORDER BY t.position_type)
           FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id WHERE ts.law_id = l.id) AS oposiciones
      FROM laws l
      WHERE l.is_active = true AND EXISTS (SELECT 1 FROM topic_scope ts WHERE ts.law_id = l.id)
    `)) as unknown as Array<{
      id: string;
      short_name: string | null;
      name: string | null;
      oposiciones: string[] | null;
    }>;
    for (const l of scopedLaws) {
      const m = (l.name || '').match(TARGET_YEAR_RE);
      const yr = m ? Number(m[1] || m[2]) : null;
      if (yr != null && yr < CURR_YEAR) {
        const opsList = (l.oposiciones || []).filter(Boolean);
        add(
          'content',
          'warn',
          null,
          'stale_dated_law',
          `${l.short_name || l.name} es del año ${yr} (caducada) y sigue en el temario de ${opsList.length} oposición(es) — actualizar a la vigente y generar preguntas`,
          { law_id: l.id, year: yr, oposiciones: opsList },
        );
      }
    }

    // ── CONTENIDO: leyes NO verificadas contra su fuente oficial (falso verde) ──
    const lawRows = (await this.db.execute(sql`
      SELECT l.id, l.short_name, l.name, l.scope, l.is_virtual, l.boe_url,
             l.verification_status, l.last_verification_summary AS su,
             EXISTS (SELECT 1 FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id
                     WHERE ts.law_id = l.id AND t.disponible) AS serving_live
      FROM laws l
    `)) as unknown as Array<{
      id: string;
      short_name: string | null;
      name: string | null;
      scope: string | null;
      is_virtual: boolean | null;
      boe_url: string | null;
      verification_status: string | null;
      su: VerificationSummary | null;
      serving_live: boolean;
    }>;
    const unverified: Array<{
      id: string;
      name: string | null;
      scope: string | null;
      state: string;
    }> = [];
    for (const l of lawRows) {
      const st = classifyLaw(
        l.is_virtual,
        l.boe_url,
        l.verification_status,
        l.su,
      );
      if (st && l.serving_live)
        unverified.push({
          id: l.id,
          name: l.short_name || l.name,
          scope: l.scope,
          state: st,
        });
    }
    if (unverified.length) {
      const byState = unverified.reduce<Record<string, number>>(
        (a, u) => ((a[u.state] = (a[u.state] || 0) + 1), a),
        {},
      );
      add(
        'content',
        'warn',
        null,
        'law_unverified_source',
        `${unverified.length} ley(es) sirviendo en temas vivos SIN verificar contra su fuente oficial (${Object.entries(
          byState,
        )
          .map(([k, v]) => `${k}:${v}`)
          .join(', ')}) — importadas a medias o falso verde`,
        { count: unverified.length, byState, sample: unverified.slice(0, 20) },
      );
    }

    // ── CONTENIDO: TÍTULOS HUÉRFANOS del temario (hueco INTERNO del topic_scope) ──
    const SCOPE_GAP_MIN_Q = Number(process.env.SCOPE_GAP_MIN_Q || 8);
    const titSecs = (await this.db.execute(sql`
      SELECT ls.law_id, l.short_name, ls.section_number, ls.article_range_start lo, ls.article_range_end hi
      FROM law_sections ls JOIN laws l ON l.id = ls.law_id
      WHERE ls.section_type = 'titulo' AND ls.article_range_start IS NOT NULL AND ls.article_range_end IS NOT NULL
    `)) as unknown as Array<{
      law_id: string;
      short_name: string | null;
      section_number: string;
      lo: number;
      hi: number;
    }>;
    const scopeAll = (await this.db.execute(sql`
      SELECT t.position_type pt, ts.law_id, ts.article_numbers
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id WHERE ts.article_numbers IS NOT NULL AND t.is_active
    `)) as unknown as Array<{
      pt: string;
      law_id: string;
      article_numbers: string[] | null;
    }>;
    const qAll = (await this.db.execute(sql`
      SELECT a.law_id, a.article_number an, count(DISTINCT q.id)::int n
      FROM questions q JOIN articles a ON a.id = q.primary_article_id
      WHERE q.is_active AND a.article_number ~ '^[0-9]+$' GROUP BY a.law_id, a.article_number
    `)) as unknown as Array<{ law_id: string; an: string; n: number }>;
    const scopedByPtLaw = new Map<string, Set<number>>();
    for (const r of scopeAll) {
      const k = r.pt + '|' + r.law_id;
      let set = scopedByPtLaw.get(k);
      if (!set) scopedByPtLaw.set(k, (set = new Set()));
      for (const a of r.article_numbers || []) {
        const n = parseInt(a);
        if (!isNaN(n) && n > 0) set.add(n);
      }
    }
    const qByLawArt = new Map<string, number>();
    for (const r of qAll) qByLawArt.set(r.law_id + '|' + parseInt(r.an), r.n);
    const secsByLaw = new Map<
      string,
      Array<{
        short_name: string | null;
        section_number: string;
        lo: number;
        hi: number;
      }>
    >();
    for (const sc of titSecs) {
      let arr = secsByLaw.get(sc.law_id);
      if (!arr) secsByLaw.set(sc.law_id, (arr = []));
      arr.push(sc);
    }
    const scopeGaps: Array<{
      pt: string;
      ley: string | null;
      titulo: string;
      rango: string;
      preguntas: number;
    }> = [];
    for (const [k, scoped] of scopedByPtLaw) {
      if (scoped.size === 0) continue;
      const bar = k.lastIndexOf('|');
      const pt = k.slice(0, bar);
      const lawId = k.slice(bar + 1);
      const secs = secsByLaw.get(lawId);
      if (!secs) continue;
      const smin = Math.min(...scoped),
        smax = Math.max(...scoped);
      for (const sc of secs) {
        let q = 0,
          anyScoped = false;
        for (let i = sc.lo; i <= sc.hi; i++) {
          q += qByLawArt.get(lawId + '|' + i) || 0;
          if (scoped.has(i)) anyScoped = true;
        }
        if (q >= SCOPE_GAP_MIN_Q && !anyScoped && smin < sc.lo && smax > sc.hi)
          scopeGaps.push({
            pt,
            ley: sc.short_name,
            titulo: sc.section_number,
            rango: `${sc.lo}-${sc.hi}`,
            preguntas: q,
          });
      }
    }
    if (scopeGaps.length) {
      scopeGaps.sort((a, b) => b.preguntas - a.preguntas);
      const nOpos = new Set(scopeGaps.map((g) => g.pt)).size;
      add(
        'content',
        'warn',
        null,
        'scope_titulo_huerfano',
        `${scopeGaps.length} título(s) con preguntas huérfanas (hueco INTERNO del scope) en ${nOpos} oposición(es) — el epígrafe puede pedirlos; adjudicar con verify:scope`,
        {
          count: scopeGaps.length,
          oposiciones: nOpos,
          sample: scopeGaps.slice(0, 20),
        },
      );
    }

    // ── Incisos anulados por el TC: preguntas activas cuya CLAVE cae en un inciso anulado ──
    // Barato (DB-only, sin red): reusa el gate de T-048 `answer_falls_in_annulled_fragment`
    // sobre las vigencia_notes que el cron semanal `annulled-vigencia-sweep` va poblando (T-009).
    // El gate impide ACTIVAR nuevas; esto SURGE las que ya estaban activas de antes.
    const annulledBugs = (await this.db.execute(sql`
      SELECT l.short_name AS ley, a.article_number AS art,
             count(DISTINCT q.id)::int AS preguntas
      FROM questions q
      JOIN articles a ON a.id = q.primary_article_id
      JOIN laws l ON l.id = a.law_id
      WHERE q.is_active AND a.vigencia_notes IS NOT NULL
        AND public.answer_falls_in_annulled_fragment(
          CASE q.correct_option
            WHEN 0 THEN q.option_a WHEN 1 THEN q.option_b
            WHEN 2 THEN q.option_c WHEN 3 THEN q.option_d END,
          a.vigencia_notes) = true
      GROUP BY l.short_name, a.article_number
      ORDER BY count(DISTINCT q.id) DESC
    `)) as unknown as Array<{ ley: string; art: string; preguntas: number }>;
    if (annulledBugs.length) {
      const total = annulledBugs.reduce((s, r) => s + Number(r.preguntas), 0);
      // WARN, no ERROR: el gate (≥60 car. de la clave dentro del inciso) tiene falsos
      // positivos cuando la clave y el inciso anulado comparten la CLÁUSULA INICIAL pero
      // difieren en el fondo (caso LO 4/2000 art 58: "...tres años" anulado vs "...cinco
      // años" vigente). Son CANDIDATOS a revisión humana, no bugs confirmados.
      add(
        'content',
        'warn',
        null,
        'answer_in_annulled_fragment',
        `${total} pregunta(s) activa(s) cuya clave reproduce (≥60 car.) un inciso ANULADO por el TC en ${annulledBugs.length} artículo(s) — CANDIDATO: verificar la clave contra la sentencia (puede ser falso positivo si solo comparten la cláusula inicial; NUNCA auto-flip)`,
        { total, articulos: annulledBugs.length, sample: annulledBugs.slice(0, 20) },
      );
    }

    // ── CONTENIDO: PROVENANCE de documentos de convocatoria (referenciado sin clonar/enlazar) ──
    // Lee la VISTA convocatoria_docs_coverage (migración 20260721). Un hito cita un
    // BOE/boletín (url + cita_literal) pero ese documento no está clonado en
    // convocatoria_documentos o no está enlazado (source_documento_id). Gap medido
    // 21/07: 18/1044 hitos enlazados, 239 docs referenciados sin clonar. Runbook:
    // docs/runbooks/provenance-convocatorias.md. Gemelo de scripts/health-sweep.cjs.
    const cov = (await this.db.execute(sql`
      SELECT slug, año, docs_clonados, hitos_con_url, docs_por_clonar, hitos_enlazables, citas_sin_fuente
      FROM convocatoria_docs_coverage
      WHERE is_active = true AND is_current = true AND incompleto = true
      ORDER BY docs_por_clonar DESC, hitos_enlazables DESC
    `)) as unknown as Array<{
      slug: string;
      año: number;
      docs_clonados: number;
      hitos_con_url: number;
      docs_por_clonar: number;
      hitos_enlazables: number;
      citas_sin_fuente: number;
    }>;
    for (const r of cov) {
      const partes: string[] = [];
      if (r.docs_por_clonar)
        partes.push(`${r.docs_por_clonar} doc(s) referenciados sin clonar`);
      if (r.hitos_enlazables)
        partes.push(`${r.hitos_enlazables} enlazable(s) por URL`);
      if (r.citas_sin_fuente)
        partes.push(`${r.citas_sin_fuente} cita(s) sin fuente`);
      add(
        'content',
        'warn',
        r.slug,
        'convocatoria_docs_incompletos',
        `${r.slug}: provenance incompleta (${partes.join(', ')})`,
        {
          año: r.año,
          docs_clonados: r.docs_clonados,
          hitos_con_url: r.hitos_con_url,
          docs_por_clonar: r.docs_por_clonar,
          enlazables: r.hitos_enlazables,
          citas_sin_fuente: r.citas_sin_fuente,
        },
      );
    }
    const orf = (await this.db.execute(sql`
      SELECT count(*) FILTER (WHERE url IS NOT NULL)::int con_url,
             count(*) FILTER (WHERE cita_literal IS NOT NULL AND length(btrim(cita_literal)) > 0)::int con_cita
      FROM convocatoria_hitos WHERE convocatoria_id IS NULL
    `)) as unknown as Array<{ con_url: number; con_cita: number }>;
    if (orf[0] && (orf[0].con_url > 0 || orf[0].con_cita > 0)) {
      add(
        'content',
        'warn',
        null,
        'convocatoria_docs_incompletos',
        `${orf[0].con_url} hito(s) con URL y ${orf[0].con_cita} con cita SIN convocatoria (provenance no atribuible; asignar a su ciclo)`,
        { orphan: true, con_url: orf[0].con_url, con_cita: orf[0].con_cita },
      );
    }

    // ── CONTENIDO: PROVENANCE de EPÍGRAFES (verified_literal sin documento del hub enlazado) ──
    // Gemelo del anterior para el OTRO consumidor del hub convocatoria_documentos. Un epígrafe
    // verified_literal cuyo source_documento_id es NULL = provenance huérfana: se validó contra
    // una URL suelta, no contra el documento clonado (txt.php ≠ /pdfs → no casaba). Se enlaza
    // vía ensure_convocatoria_documento (verify-epigrafe-literality record lo hace ya). Cierra
    // el falso verde de provenance de T-107. Runbook: docs/maintenance/provenance-convocatorias.md.
    const epiOrf = (await this.db.execute(sql`
      SELECT replace(t.position_type, '_', '-') AS slug, count(*)::int AS huerfanos
      FROM topics t
      JOIN topic_epigrafe_verification ev ON ev.topic_id = t.id
      WHERE t.is_active AND ev.state = 'verified_literal' AND ev.source_documento_id IS NULL
      GROUP BY 1 ORDER BY 2 DESC
    `)) as unknown as Array<{ slug: string; huerfanos: number }>;
    for (const r of epiOrf) {
      add(
        'content',
        'warn',
        r.slug,
        'epigrafe_provenance_no_doc',
        `${r.slug}: ${r.huerfanos} epígrafe(s) verified_literal sin documento del hub enlazado (source_documento_id NULL) — re-verificar o enlazar vía ensure_convocatoria_documento`,
        { huerfanos: r.huerfanos },
      );
    }

    // ── CONVOCATORIAS: invariantes deterministas del timeline (vista convocatoria_hito_incidencias) ──
    // I1/I2/I9 = graves (error); I7/I8 = caducado (warn). I5 se excluye a propósito (línea base sin docs).
    {
      const inc = (await this.db.execute(sql`
        SELECT o.slug, i.invariante, i.detalle
          FROM convocatoria_hito_incidencias i
          JOIN convocatorias cv ON cv.id = i.convocatoria_id
          JOIN oposiciones o ON o.id = cv.oposicion_id
         WHERE o.is_active AND i.invariante <> 'I5_registro_sin_fuente'
      `)) as unknown as Array<{ slug: string; invariante: string; detalle: string }>;
      const porSlug: Record<string, Array<{ invariante: string; detalle: string }>> = {};
      for (const r of inc) (porSlug[r.slug] = porSlug[r.slug] || []).push(r);
      for (const [slug, rs] of Object.entries(porSlug)) {
        const graves = rs.filter(
          (r) =>
            r.invariante === 'I1_orden' ||
            r.invariante === 'I2_duplicado' ||
            r.invariante === 'I9_tipo_incoherente',
        );
        if (graves.length)
          add(
            'content',
            'error',
            slug,
            'convocatoria_timeline_incoherente',
            `${slug}: ${graves.length} incoherencia(s) en el timeline — ${graves[0].detalle}`,
            { incidencias: graves.map((r) => ({ invariante: r.invariante, detalle: r.detalle })) },
          );
        const stale = rs.filter(
          (r) =>
            r.invariante === 'I7_prevision_caducada' ||
            r.invariante === 'I8_status_contradice_fecha',
        );
        if (stale.length)
          add(
            'content',
            'warn',
            slug,
            'convocatoria_timeline_caducado',
            `${slug}: ${stale.length} hito(s) caducados o con estado que contradice su fecha`,
            { incidencias: stale.map((r) => ({ invariante: r.invariante, detalle: r.detalle })) },
          );
      }
    }

    // ── Hitos que anuncian un evento con la fecha YA PASADA ──
    // origen='registro' → la fecha era real y el evento ocurrió, nadie cerró el hito (error);
    // origen≠registro → estimación vencida sin revisar (warn, no se publica pero delata).
    const hitosVencidos = (await this.db.execute(sql`
      SELECT o.slug, ch.origen, COUNT(*)::int n
      FROM convocatoria_hitos ch JOIN oposiciones o ON o.id = ch.oposicion_id
      WHERE o.is_active AND ch.status = 'upcoming' AND ch.fecha < CURRENT_DATE
      GROUP BY o.slug, ch.origen
    `)) as unknown as Array<{ slug: string; origen: string | null; n: number }>;
    for (const r of hitosVencidos) {
      const estimado = r.origen !== 'registro';
      add(
        'content',
        estimado ? 'warn' : 'error',
        r.slug,
        'hito_vencido_abierto',
        `${r.slug}: ${r.n} hito(s) "próximos" con fecha ya pasada` +
          (estimado
            ? ' (fecha ESTIMADA sin publicar; no se muestra, pero revísala)'
            : ' (fecha REAL: el evento ocurrió y el hito sigue anunciándolo como futuro)'),
      );
    }

    // ── seguimiento_url que vigilan un ciclo YA CERRADO (falso negativo silencioso) ──
    const urlRows = (await this.db.execute(sql`
      SELECT o.slug, o.seguimiento_url AS su, c."año" AS anio_vig,
             o.is_convocatoria_activa AS conv_activa
      FROM oposiciones o
      JOIN convocatorias c ON c.oposicion_id = o.id AND c.is_current
      WHERE o.is_active AND o.seguimiento_url IS NOT NULL
    `)) as unknown as Array<{
      slug: string;
      su: string | null;
      anio_vig: number | null;
      conv_activa: boolean | null;
    }>;
    for (const r of urlRows) {
      // procesoEnJuego = la vendemos (is_active, filtrado arriba) Y su convocatoria está VIVA →
      // un seguimiento genérico aquí es ceguera accionable (error), no ruido descartable (warn).
      const d = diagnosticarSeguimientoUrl(
        r.su,
        r.anio_vig != null ? Number(r.anio_vig) : null,
        { procesoEnJuego: !!r.conv_activa },
      );
      if (d.severidad === 'ok') continue;
      add(
        'content',
        d.severidad,
        r.slug,
        'seguimiento_url_stale',
        `${r.slug}: seguimiento_url ${d.nivel === 'stale_boletin' ? 'DESFASADA' : 'sospechosa'} — ${d.motivo}`,
      );
    }

    // ── Textos libres que anuncian un examen pasado como vigente (punto ciego del rollover) ──
    const hoyIso = now.toISOString().slice(0, 10);
    const textoRows = (await this.db.execute(sql`
      SELECT o.slug,
             COALESCE(v.landing_faqs, o.landing_faqs) AS faqs,
             COALESCE(v.landing_description, o.landing_description) AS descr
      FROM oposiciones o
      LEFT JOIN LATERAL (
        SELECT c2.landing_faqs, c2.landing_description
        FROM convocatorias c2 WHERE c2.oposicion_id = o.id AND c2.is_current LIMIT 1
      ) v ON TRUE
      WHERE o.is_active
    `)) as unknown as Array<{ slug: string; faqs: unknown; descr: unknown }>;
    for (const r of textoRows) {
      const h = detectarExamenPasado({ landingDescription: r.descr, landingFaqs: r.faqs }, hoyIso);
      if (!h.length) continue;
      const fechas = [...new Set(h.map((x) => x.iso))].join(', ');
      add(
        'content',
        'warn',
        r.slug,
        'texto_examen_pasado',
        `${r.slug}: los textos de la landing anuncian un examen ya pasado como vigente (${fechas}) — el opositor ve una fecha vieja como la próxima`,
      );
    }

    // ── CONTENIDO: SOBRE-INCLUSIÓN de topic_scope (epígrafe enumera, scope = ley entera) ──
    // Solo banda HIGH (título con hueco / arts citados = precisión alta); MEDIUM (prosa) no pinga.
    const overIncl = (await this.db.execute(sql`
      SELECT t.position_type pt, t.topic_number tn, l.short_name ley, t.epigrafe,
             ts.article_numbers,
             (SELECT count(*) FROM articles a WHERE a.law_id = ts.law_id AND a.article_number ~ '^[0-9]+$') law_total
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
      WHERE t.is_active = true
    `)) as unknown as Array<{
      pt: string;
      tn: number;
      ley: string | null;
      epigrafe: string | null;
      article_numbers: string[] | null;
      law_total: number;
    }>;
    const oiHigh: Array<{
      pt: string;
      tema: number;
      ley: string | null;
      cobertura: number;
      motivo: string | null;
    }> = [];
    for (const r of overIncl) {
      const scoped = (r.article_numbers || []).filter((x) => /^[0-9]+$/.test(x)).length;
      const v = classifyScope(Number(r.law_total), scoped, r.epigrafe);
      if (v.band === 'HIGH')
        oiHigh.push({
          pt: r.pt,
          tema: r.tn,
          ley: r.ley,
          cobertura: Math.round(v.coverage * 100),
          motivo: v.reason,
        });
    }
    if (oiHigh.length) {
      oiHigh.sort((a, b) => b.cobertura - a.cobertura);
      const nOpos = new Set(oiHigh.map((x) => x.pt)).size;
      add(
        'content',
        'warn',
        null,
        'scope_over_inclusion_suspect',
        `${oiHigh.length} tema(s) con SCOPE MÁS ANCHO que el epígrafe (mete casi la ley entera) en ${nOpos} oposición(es) — sirve preguntas fuera de programa; adjudicar con verify:scope y recortar el scope`,
        { count: oiHigh.length, oposiciones: nOpos, sample: oiHigh.slice(0, 20) },
      );
    }

    // ── CONTENIDO: ARTÍCULOS FANTASMA del scope (integridad referencial) ──
    // Nº en topic_scope.article_numbers sin fila ACTIVA en articles (mismo law_id) → 0
    // preguntas/teoría EN SILENCIO. `inexistente` (no hay fila) o `desactivado`
    // (is_active=false, aunque tenga preguntas). Regex dígito-inicial (excluye basura CE
    // "T3"/"TP") + variantes latinas + matching NORMALIZADO (sin acentos/espacios/')' ) para
    // no inventar falsos por formato. Separa por boe_url (real accionable vs ofimática).
    const phantom = (await this.db.execute(sql`
      WITH refs AS (
        SELECT DISTINCT ts.law_id, l.short_name, l.name, (l.boe_url IS NOT NULL) AS has_boe, trim(an) AS art
        FROM topic_scope ts
        JOIN topics t ON t.id = ts.topic_id
        JOIN laws l ON l.id = ts.law_id
        CROSS JOIN LATERAL unnest(ts.article_numbers) AS an
        WHERE ts.article_numbers IS NOT NULL AND t.is_active = true
      )
      SELECT coalesce(r.short_name, r.name) AS ley, r.has_boe, r.art,
             CASE WHEN NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND lower(regexp_replace(translate(a.article_number, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')) = lower(regexp_replace(translate(r.art, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')))
                  THEN 'inexistente' ELSE 'desactivado' END AS causa
      FROM refs r
      WHERE r.art ~* '^[0-9]+( ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies))?( ?[a-z)]*)?$'
        AND NOT EXISTS (SELECT 1 FROM articles a WHERE a.law_id = r.law_id AND lower(regexp_replace(translate(a.article_number, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')) = lower(regexp_replace(translate(r.art, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'), '[[:space:])]', '', 'g')) AND a.is_active)
    `)) as unknown as Array<{ ley: string; has_boe: boolean; art: string; causa: string }>;
    if (phantom.length) {
      const real = phantom.filter((p) => p.has_boe);
      const virt = phantom.filter((p) => !p.has_boe);
      const leyesReal = [...new Set(real.map((p) => p.ley))];
      const inex = real.filter((p) => p.causa === 'inexistente').length;
      const desact = real.filter((p) => p.causa === 'desactivado').length;
      if (real.length)
        add(
          'content',
          'warn',
          null,
          'scope_phantom_article',
          `${real.length} artículo(s) escopado(s) que NO sirven (0 preguntas/teoría en silencio) en ${leyesReal.length} ley(es): ${inex} inexistente(s) + ${desact} desactivado(s) — importar del BOE / reactivar / o recortar el scope si la ley no lo tiene`,
          {
            count: real.length,
            laws: leyesReal.length,
            inexistentes: inex,
            desactivados: desact,
            virtual_ofimatica: virt.length,
            sample: real.slice(0, 25).map((p) => ({ ley: p.ley, art: p.art, causa: p.causa })),
          },
        );
    }

    // ── CONTENIDO: MISMA LEY REAL duplicada ENTRE TEMAS (repartir por materia) ──
    // Mirror INLINE de scripts/health-sweep.cjs (scope_cross_tema_dup) — MANTENER EN SYNC.
    // Ley REAL escopada ENTERA (article_numbers NULL/vacío) o con solape grande (≥20 arts)
    // en ≥2 temas activos de la MISMA oposición → mismas preguntas repetidas en varios
    // tests sin reparto por materia. Punto ciego de over-inclusion (1 tema vs epígrafe) y de
    // huecos (los temas rebosan). Umbral conservador: ley entera/NULL compartida o ≥20 arts
    // (solape 1-10 = cross-cutting legítimo, no pinga).
    const ctRows = (await this.db.execute(sql`
      SELECT t.position_type pt, l.short_name ley, t.topic_number tn, ts.article_numbers an
      FROM topic_scope ts JOIN topics t ON t.id = ts.topic_id JOIN laws l ON l.id = ts.law_id
      WHERE t.is_active = true
        AND (l.short_name ~* '^(Ley|Real|Decreto|Estatut|Llei|Convenio|Reglament|Constituci|Tratado)' OR l.short_name ~ '^(LO|RD|RDL|CE|TR|TUE|TFUE|RGPD)')
    `)) as unknown as Array<{
      pt: string;
      ley: string;
      tn: number;
      an: string[] | null;
    }>;
    const ctGroups = new Map<string, typeof ctRows>();
    for (const r of ctRows) {
      const k = r.pt + ' ' + r.ley;
      let g = ctGroups.get(k);
      if (!g) ctGroups.set(k, (g = []));
      g.push(r);
    }
    const ctDups: Array<{ pt: string; ley: string; dup: string }> = [];
    for (const [k, rows] of ctGroups) {
      if (rows.length < 2) continue;
      const [pt, ley] = k.split(' ');
      const arrs = rows.map((r) => {
        const a = r.an || [];
        const nums = a
          .map((x) => parseInt(String(x).replace(/[^0-9]/g, ''), 10))
          .filter((n) => !isNaN(n));
        return { tn: r.tn, set: new Set(nums), nulish: a.length === 0 };
      });
      let maxOv = 0;
      let pair: string | null = null;
      if (arrs.filter((a) => a.nulish).length > 1) {
        maxOv = 9999;
        pair =
          arrs
            .filter((a) => a.nulish)
            .map((a) => 'T' + a.tn)
            .join('=T') + ' (ley entera/NULL)';
      } else {
        for (let i = 0; i < arrs.length; i++)
          for (let j = i + 1; j < arrs.length; j++) {
            let cc = 0;
            for (const n of arrs[i].set) if (arrs[j].set.has(n)) cc++;
            if (cc > maxOv) {
              maxOv = cc;
              pair = 'T' + arrs[i].tn + '∩T' + arrs[j].tn + '=' + cc + ' arts';
            }
          }
      }
      if (maxOv >= 20 && pair) ctDups.push({ pt, ley, dup: pair });
    }
    if (ctDups.length) {
      const nOpos = new Set(ctDups.map((x) => x.pt)).size;
      add(
        'content',
        'warn',
        null,
        'scope_cross_tema_dup',
        `${ctDups.length} ley(es) REAL duplicada(s) entre temas (misma ley entera/solape grande en ≥2 temas → preguntas repetidas en varios tests) en ${nOpos} oposición(es) — repartir por materia con verify:scope (npm run scope:health -- --pending)`,
        { count: ctDups.length, oposiciones: nOpos, sample: ctDups.slice(0, 20) },
      );
    }

    // ── Escribir snapshot ──
    let wrote = false;
    if (!NO_WRITE) {
      await this.db.execute(sql`TRUNCATE content_health_findings`);
      for (const f of F) {
        const detailJson = f.detail ? JSON.stringify(f.detail) : null;
        await this.db.execute(sql`
          INSERT INTO content_health_findings (category, severity, oposicion_slug, kind, message, detail)
          VALUES (${f.category}, ${f.severity}, ${f.slug}, ${f.kind}, ${f.message}, ${detailJson}::jsonb)
        `);
      }
      wrote = true;
      this.logger.log(
        `✅ ${stamp} — ${F.length} hallazgos escritos (app err=${F.filter((x) => x.category === 'app' && x.severity === 'error').length}, content err=${F.filter((x) => x.category === 'content' && x.severity === 'error').length}, content warn=${F.filter((x) => x.category === 'content' && x.severity === 'warn').length})`,
      );
    }

    // ── Emails ──
    const emailsSent = await this.sendEmails(F, stamp, isMonday);

    return {
      total: F.length,
      appError: F.filter((x) => x.category === 'app' && x.severity === 'error')
        .length,
      contentError: F.filter(
        (x) => x.category === 'content' && x.severity === 'error',
      ).length,
      contentWarn: F.filter(
        (x) => x.category === 'content' && x.severity === 'warn',
      ).length,
      wrote,
      emailsSent,
    };
  }

  private async sendEmails(
    F: Finding[],
    stamp: string,
    isMonday: boolean,
  ): Promise<number> {
    const appErr = F.filter(
      (x) => x.category === 'app' && x.severity === 'error',
    );
    const contErr = F.filter(
      (x) => x.category === 'content' && x.severity === 'error',
    );
    const contWarn = F.filter(
      (x) => x.category === 'content' && x.severity === 'warn',
    );
    const line = (l: string, col: string) =>
      `<div style="font-family:monospace;font-size:13px;color:${col}">${esc(l)}</div>`;

    const APP_OBS_MIN = Number(process.env.APP_OBS_MIN || 10);
    const appFire = appErr.filter(
      (f) =>
        ['http_down', 'empty_topic'].includes(f.kind) ||
        (f.detail && Number(f.detail.n) >= APP_OBS_MIN),
    );

    let sent = 0;
    if (appFire.length) {
      const html = `<div style="font-family:sans-serif;max-width:640px"><h2 style="color:#b91c1c">🔴 Salud de la APP — ${esc(stamp)}</h2>
        <p>Fallos donde un usuario topa con un error (actúa):</p>${appFire.map((f) => line(f.message, '#b91c1c')).join('')}
        ${appErr.length > appFire.length ? `<p style="color:#6b7280;font-size:12px">(+${appErr.length - appFire.length} incidencia(s) de bajo volumen — blips — solo en el panel, no alertan.)</p>` : ''}
        <p style="color:#6b7280;font-size:12px;margin-top:20px">Panel: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a> · Contenido (calidad) va en el resumen semanal.</p></div>`;
      if (
        await this.sendEmail(`🔴 Vence APP: ${appFire.length} fallo(s)`, html)
      )
        sent++;
    }
    if (isMonday && (contErr.length || contWarn.length)) {
      const html = `<div style="font-family:sans-serif;max-width:640px"><h2 style="color:#a16207">🟡 Salud del CONTENIDO (semanal) — ${esc(stamp)}</h2>
        <p>Datos a revisar (la app funciona, no urgente):</p>
        ${contErr.length ? '<h3>Incoherencias (❌)</h3>' + contErr.map((f) => line((f.slug ? f.slug + ' — ' : '') + f.message, '#b45309')).join('') : ''}
        ${
          contWarn.length
            ? `<h3>Menores (🟡) — ${contWarn.length}</h3>` +
              contWarn
                .slice(0, 20)
                .map((f) =>
                  line((f.slug ? f.slug + ' — ' : '') + f.message, '#a16207'),
                )
                .join('') +
              (contWarn.length > 20
                ? line(`… y ${contWarn.length - 20} más`, '#a16207')
                : '')
            : ''
        }
        <p style="color:#6b7280;font-size:12px;margin-top:20px">Pestaña Contenido: <a href="https://www.vence.es/admin/salud-sistema">/admin/salud-sistema</a></p></div>`;
      if (
        await this.sendEmail(
          `🟡 Vence contenido semanal: ${contErr.length} ❌ / ${contWarn.length} 🟡`,
          html,
        )
      )
        sent++;
    }
    if (!appFire.length && !(isMonday && (contErr.length || contWarn.length)))
      this.logger.log(
        `✅ ${stamp} — sin email (app sin fallos que alerten${isMonday ? ', contenido limpio' : ', contenido va el lunes'}).`,
      );
    return sent;
  }

  private async sendEmail(subject: string, html: string): Promise<boolean> {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'RESEND_API_KEY no configurada — email de salud degradado (solo panel/log)',
      );
      return false;
    }
    const from = `Vence Salud <${this.config.get<string>('EMAIL_FROM_ADDRESS') || 'info@vence.es'}>`;
    const to = process.env.ALERT_EMAIL || 'manueltrader@gmail.com';
    try {
      const resend = new Resend(apiKey);
      const { data, error } = await resend.emails.send({
        from,
        to,
        subject,
        html,
      });
      if (error) {
        this.logger.error(`fallo email salud: ${JSON.stringify(error)}`);
        return false;
      }
      this.logger.log(`email salud enviado: ${subject} (${data?.id || 'ok'})`);
      return true;
    } catch (e) {
      this.logger.error(
        `fallo email salud: ${e instanceof Error ? e.message : String(e)}`,
      );
      return false;
    }
  }
}
