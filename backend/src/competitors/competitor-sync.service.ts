import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'crypto';
import { CompetitorQueriesService, type OposicionForMatch } from './competitor-queries.service';
import { COMPETITOR_ADAPTERS } from './adapters/registry';
import type { CompetitorAdapter, ParsedPrice } from './adapters/types';
import { parseSitemapXml, type SitemapEntry } from './sitemap';
import { detectTech } from './tech-detect';

const UA =
  'VenceCompetitorBot/1.0 (+https://www.vence.es; analizador de competidores) Mozilla/5.0';
const FETCH_TIMEOUT_MS = 20_000;
/**
 * Tope de páginas de curso a descargar por pasada. Acota SOLO el backfill inicial
 * de un competidor nuevo (p.ej. 654 landings en tecnoszubia → ~5 pasadas). En
 * estado estacionario apenas se descarga nada: el gateo por `lastmod` salta las
 * landings que no cambiaron.
 */
const MAX_COURSES_PER_RUN = 400;
/** Pausa entre fetches de detalle (no martillear al competidor). */
const POLITE_DELAY_MS = 500;
/**
 * Red de seguridad: re-chequear una landing aunque su `lastmod` no se mueva, si
 * no la revisamos desde hace estos días. Cubre los CMS que NO actualizan lastmod
 * al editar (cambian el precio y dejan el lastmod igual → sin esto, no lo veríamos).
 */
const STALE_RECHECK_DAYS = 14;

export interface CompetitorSyncSummary {
  competitorKey: string;
  urlsTotal: number;
  urlsNew: number;
  urlsRemoved: number;
  coursesFetched: number;
  coursesNew: number;
  priceChanges: number;
  coursesPending: number; // no descargados por el tope (sin silencio)
  errors: number;
}

/** Identidad de una línea de precio (para reconciliar histórico). Incluye el
 *  plan/paquete: dos precios del mismo kind pero distinto paquete son distintos. */
function priceKey(p: {
  kind?: string; priceKind?: string; audience: string | null; period: string | null; plan?: string | null
}): string {
  return `${p.kind ?? p.priceKind}|${p.audience ?? ''}|${p.period ?? ''}|${p.plan ?? ''}`;
}

/**
 * Motor del "Analizador de Competidores": por cada competidor, lee su sitemap,
 * diffea las URLs contra BD (nuevas/eliminadas), descarga incrementalmente las
 * páginas de curso nuevas o cambiadas, extrae precios y reconcilia el histórico,
 * y registra cada cambio en `competitor_changes`.
 *
 * Diseño: docs/roadmap/analizador-competidores.md
 */
@Injectable()
export class CompetitorSyncService {
  private readonly logger = new Logger(CompetitorSyncService.name);

  constructor(private readonly queries: CompetitorQueriesService) {}

  async runAll(): Promise<CompetitorSyncSummary[]> {
    const catalog = await this.queries.loadOposicionesForMatch();
    const summaries: CompetitorSyncSummary[] = [];
    for (const adapter of COMPETITOR_ADAPTERS) {
      try {
        summaries.push(await this.syncCompetitor(adapter, catalog));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[${adapter.key}] sync falló: ${msg}`);
        summaries.push({
          competitorKey: adapter.key,
          urlsTotal: 0, urlsNew: 0, urlsRemoved: 0, coursesFetched: 0,
          coursesNew: 0, priceChanges: 0, coursesPending: 0, errors: 1,
        });
      }
    }
    return summaries;
  }

  private async syncCompetitor(
    adapter: CompetitorAdapter,
    catalog: OposicionForMatch[],
  ): Promise<CompetitorSyncSummary> {
    const competitor = await this.queries.getCompetitorBySlug(adapter.key);
    if (!competitor) {
      throw new Error(`competidor '${adapter.key}' no está en BD (falta seed)`);
    }
    const summary: CompetitorSyncSummary = {
      competitorKey: adapter.key,
      urlsTotal: 0, urlsNew: 0, urlsRemoved: 0, coursesFetched: 0,
      coursesNew: 0, priceChanges: 0, coursesPending: 0, errors: 0,
    };

    // 0) Detección de stack (best-effort; nunca bloquea el sync). Decide la
    //    estrategia de scraping (rendering=js → headless-fetcher, etc.).
    try {
      const { text, headers } = await this.fetchHtmlAndHeaders(competitor.baseUrl);
      const tech = { ...detectTech(text, headers), ...(adapter.techHints ?? {}) };
      await this.queries.updateCompetitorTech(competitor.id, tech);
    } catch (err) {
      this.logger.warn(
        `[${adapter.key}] tech-detect: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    // 1) Fuentes del competidor (N sitemaps/listados). Cada fuente: fetch + hash
    //    (observabilidad + "cambió algo" como en el radar) y parseo a URLs. La
    //    detección de URLs ELIMINADAS solo corre si TODAS las fuentes se leyeron
    //    bien: una caída transitoria no debe desactivar URLs en masa.
    const sources = await this.queries.getActiveSources(competitor.id);
    const entriesMap = new Map<string, SitemapEntry>();
    let allSourcesOk = sources.length > 0;
    for (const source of sources) {
      try {
        let srcEntries: SitemapEntry[];
        let hash: string;
        if (source.sourceType === 'listing_html') {
          // Fuente de listado (para landings que no están en el sitemap).
          const html = await this.fetchText(source.url);
          hash = sha256(html);
          const urls = adapter.discoverUrls ? adapter.discoverUrls(html) : [];
          srcEntries = urls.map((u) => ({ loc: u, lastmod: null }));
        } else {
          ({ entries: srcEntries, hash } = await this.fetchSourceEntries(source.url));
        }
        for (const e of srcEntries) if (!entriesMap.has(e.loc)) entriesMap.set(e.loc, e);
        await this.queries.markSourceChecked(source.id, { hash, error: null });
      } catch (err) {
        allSourcesOk = false;
        const msg = err instanceof Error ? err.message : String(err);
        await this.queries.markSourceChecked(source.id, { error: msg });
        summary.errors++;
        this.logger.warn(`[${adapter.key}] fuente ${source.url}: ${msg}`);
      }
    }
    const entries = [...entriesMap.values()];
    summary.urlsTotal = entries.length;

    // 2) Diff contra BD.
    const index = await this.queries.loadUrlIndex(competitor.id);
    const byUrl = new Map(index.map((r) => [r.url, r]));
    const seenIds = new Set<string>();
    const newCourseUrls: { id: string; url: string }[] = [];
    const knownCourseUrls: { id: string; url: string; hash: string | null }[] = [];

    for (const e of entries) {
      const urlType = adapter.classifyUrl(e.loc);
      const known = byUrl.get(e.loc);
      if (known) {
        seenIds.add(known.id);
        await this.queries.markUrlSeen(known.id, e.lastmod, urlType);
        // Re-descargar la landing solo si hace falta (estado estacionario barato,
        // no re-fetch de las 654 cada día). Señal combinada:
        //   nunca bajada · lastmod movido · antigüedad > STALE_RECHECK_DAYS
        // (esto último cubre CMS que no actualizan lastmod al editar).
        if (urlType === 'oposicion') {
          const needsFetch =
            known.contentHash === null ||
            lastmodDiffers(e.lastmod, known.lastmod) ||
            isStale(known.contentCheckedAt, STALE_RECHECK_DAYS);
          if (needsFetch) {
            knownCourseUrls.push({ id: known.id, url: e.loc, hash: known.contentHash });
          }
        }
      } else {
        const id = await this.queries.insertUrl({
          competitorId: competitor.id,
          url: e.loc,
          urlType,
          lastmod: e.lastmod,
        });
        summary.urlsNew++;
        await this.queries.logChange({
          competitorId: competitor.id,
          changeType: 'url_added',
          url: e.loc,
          detail: { urlType },
        });
        if (urlType === 'oposicion') newCourseUrls.push({ id, url: e.loc });
      }
    }

    // 3) URLs que desaparecieron del sitemap → desactivar + log. Solo si TODAS
    //    las fuentes se leyeron bien (evita falsos "removed" por fallo transitorio).
    const removed = allSourcesOk ? index.filter((r) => r.isActive && !seenIds.has(r.id)) : [];
    if (!allSourcesOk) {
      this.logger.warn(`[${adapter.key}] alguna fuente falló → se omite detección de URLs eliminadas`);
    }
    if (removed.length > 0) {
      await this.queries.deactivateUrls(removed.map((r) => r.id));
      for (const r of removed) {
        await this.queries.logChange({
          competitorId: competitor.id,
          changeType: 'url_removed',
          url: r.url,
        });
      }
      summary.urlsRemoved = removed.length;
    }

    // 4) Descarga incremental de cursos: primero los nuevos, luego los conocidos
    //    (para detectar cambios de precio). Con tope por pasada + educado.
    // Prioriza los NUNCA descargados (hash null) para que el backfill inicial
    // avance sí o sí; los re-chequeos (lastmod/stale) van después.
    knownCourseUrls.sort((a, b) => (a.hash === null ? 0 : 1) - (b.hash === null ? 0 : 1));
    const toFetch = [
      ...newCourseUrls.map((c) => ({ ...c, hash: null as string | null, isNew: true })),
      ...knownCourseUrls.map((c) => ({ ...c, isNew: false })),
    ];
    summary.coursesPending = Math.max(0, toFetch.length - MAX_COURSES_PER_RUN);
    if (summary.coursesPending > 0) {
      this.logger.warn(
        `[${adapter.key}] ${toFetch.length} cursos por revisar, tope ${MAX_COURSES_PER_RUN}/pasada → ${summary.coursesPending} pendientes`,
      );
    }

    for (const course of toFetch.slice(0, MAX_COURSES_PER_RUN)) {
      try {
        const html =
          adapter.techHints?.['rendering'] === 'js'
            ? await this.fetchRendered(course.url)
            : await this.fetchText(course.url);
        summary.coursesFetched++;
        const hash = sha256(html);
        const changed = course.isNew || course.hash !== hash;
        // Sella content_checked_at SIEMPRE (resetea antigüedad), hash+changed si tocó.
        await this.queries.markUrlFetched(course.id, hash, changed);
        // Contenido idéntico → no re-parsear (pero la antigüedad ya se reseteó).
        if (!changed) continue;
        // Cambio en una landing existente (aunque no cambie el precio: p.ej.
        // actualizan la convocatoria). Los cambios de precio se loguean aparte.
        if (!course.isNew && course.hash !== null) {
          await this.queries.logChange({
            competitorId: competitor.id,
            changeType: 'url_modified',
            url: course.url,
            courseId: course.id,
          });
        }

        const parsed = adapter.parseCourse(course.url, html);
        if (!parsed) continue;
        // La identidad se deriva de url + nombre (la URL suele traer la administración).
        const match = this.queries.matchCourse(parsed.rawName, `${course.url} ${parsed.rawName}`, catalog);
        const { id: courseId, isNew } = await this.queries.upsertCourse({
          competitorId: competitor.id,
          urlId: course.id,
          rawName: parsed.rawName,
          modalidad: parsed.modalidad,
          region: parsed.region,
          match,
        });
        if (isNew) {
          summary.coursesNew++;
          await this.queries.logChange({
            competitorId: competitor.id,
            changeType: 'course_added',
            url: course.url,
            courseId,
            detail: {
              rawName: parsed.rawName,
              oposicionId: match.oposicionId,
              matched: !!match.oposicionId,
              method: match.method,
              ambito: match.ambito,
            },
          });
        }
        summary.priceChanges += await this.reconcilePrices(
          competitor.id,
          courseId,
          course.url,
          parsed.prices,
        );
      } catch (err) {
        summary.errors++;
        this.logger.warn(
          `[${adapter.key}] curso ${course.url}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
      await sleep(POLITE_DELAY_MS);
    }

    await this.queries.markCompetitorSynced(competitor.id);
    this.logger.log(
      `[${adapter.key}] urls=${summary.urlsTotal} (+${summary.urlsNew}/-${summary.urlsRemoved}) ` +
        `cursos=${summary.coursesFetched} (+${summary.coursesNew}) precios±${summary.priceChanges}`,
    );
    return summary;
  }

  /** Reconcilia precios parseados contra los vigentes; supersede + inserta si cambia. */
  private async reconcilePrices(
    competitorId: string,
    courseId: string,
    url: string,
    parsed: ParsedPrice[],
  ): Promise<number> {
    const current = await this.queries.getCurrentPrices(courseId);
    const currentByKey = new Map(current.map((p) => [priceKey(p), p]));
    const parsedByKey = new Map(parsed.map((p) => [priceKey(p), p]));
    let changes = 0;

    for (const [k, p] of parsedByKey) {
      const cur = currentByKey.get(k);
      if (!cur) {
        await this.queries.insertPrice(courseId, p);
      } else if (cur.amountCents !== p.amountCents) {
        await this.queries.supersedePrice(cur.id);
        await this.queries.insertPrice(courseId, p);
        await this.queries.logChange({
          competitorId,
          changeType: 'price_changed',
          url,
          courseId,
          detail: { priceKind: p.kind, audience: p.audience, from: cur.amountCents, to: p.amountCents },
        });
        changes++;
      }
    }
    // Precios que desaparecieron de la página → dejan de ser vigentes.
    for (const [k, cur] of currentByKey) {
      if (!parsedByKey.has(k)) await this.queries.supersedePrice(cur.id);
    }
    return changes;
  }

  // ── fetch helpers ──────────────────────────────────────────────────────────

  /**
   * Lee una fuente (sitemap o index) → URLs + hash del contenido. El hash cubre
   * el sitemap raíz + todos sus hijos → cualquier cambio (URL nueva/quitada,
   * lastmod movido) altera el hash. Sirve para observabilidad y "¿cambió algo?".
   */
  private async fetchSourceEntries(
    sitemapUrl: string,
  ): Promise<{ entries: SitemapEntry[]; hash: string }> {
    const rootText = await this.fetchText(sitemapUrl);
    const root = parseSitemapXml(rootText);
    if (!root.isIndex) return { entries: root.entries, hash: sha256(rootText) };
    const all: SitemapEntry[] = [];
    const seen = new Set<string>();
    const parts = [rootText];
    for (const child of root.entries) {
      try {
        const childText = await this.fetchText(child.loc);
        parts.push(childText);
        const sub = parseSitemapXml(childText);
        for (const e of sub.entries) {
          if (seen.has(e.loc)) continue;
          seen.add(e.loc);
          all.push(e);
        }
      } catch (err) {
        this.logger.warn(`sitemap hijo ${child.loc}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return { entries: all, hash: sha256(parts.join('\n')) };
  }

  private async fetchText(url: string): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      return await res.text();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Fetch RENDERIZADO por el headless-fetcher (Lambda Playwright) para
   * competidores JS/SPA (`techHints.rendering==='js'`). El sitemap y la home van
   * por fetch plano (server-served); solo la PÁGINA DE CURSO necesita render.
   */
  private async fetchRendered(url: string): Promise<string> {
    const { LambdaClient, InvokeCommand } = await import('@aws-sdk/client-lambda');
    const client = new LambdaClient({ region: process.env.AWS_REGION ?? 'eu-west-2' });
    const fn = process.env.HEADLESS_FETCHER_FUNCTION_NAME ?? 'vence-backend-headless-fetcher';
    const cmd = new InvokeCommand({
      FunctionName: fn,
      InvocationType: 'RequestResponse',
      Payload: Buffer.from(JSON.stringify({ url, timeout_ms: 45_000 })),
    });
    const resp = await client.send(cmd);
    if (!resp.Payload) throw new Error('headless: payload vacío');
    const parsed = JSON.parse(Buffer.from(resp.Payload).toString('utf-8')) as {
      ok: boolean; status: number; html: string | null; error?: string;
    };
    if (!parsed.ok || parsed.html == null) throw new Error(`headless: ${parsed.error ?? 'sin html'}`);
    return parsed.html;
  }

  /** Como fetchText pero devuelve también las cabeceras (para detección de stack). */
  private async fetchHtmlAndHeaders(
    url: string,
  ): Promise<{ text: string; headers: Record<string, string> }> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status} en ${url}`);
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => (headers[k.toLowerCase()] = v));
      return { text: await res.text(), headers };
    } finally {
      clearTimeout(timer);
    }
  }
}

function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex');
}

/** true si `checkedAt` es null o más antiguo que `days` días. */
function isStale(checkedAt: string | null, days: number): boolean {
  if (!checkedAt) return true;
  return new Date(checkedAt).getTime() < Date.now() - days * 86_400_000;
}

/**
 * ¿Cambió el lastmod? Compara por TIEMPO parseado, no por string: el del sitemap
 * viene crudo ("2025-05-06T10:18:38+00:00") pero al releerlo de la columna
 * timestamptz vuelve normalizado ("2025-05-06 10:18:38+00") → comparar strings
 * daría siempre distinto y rompería el gateo (re-fetch infinito).
 */
export function lastmodDiffers(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a !== b;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return a !== b;
  return ta !== tb;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
