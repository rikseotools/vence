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
