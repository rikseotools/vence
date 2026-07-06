import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { normalize } from '../oep-signals/oep-match';
import {
  competitorChanges,
  competitorCourses,
  competitorPrices,
  competitorSources,
  competitorUrls,
  competitors,
  oposiciones,
} from './competitors.schema';
import type { ParsedPrice } from './adapters/types';

export interface UrlIndexRow {
  id: string;
  url: string;
  urlType: string;
  contentHash: string | null;
  lastmod: string | null;
  contentCheckedAt: string | null;
  isActive: boolean;
}

export interface OposicionForMatch {
  id: string;
  nombre: string;
  shortName: string | null;
}

export interface CompetitorForOposicion {
  competitorId: string;
  competitorName: string;
  tipo: string | null;
  region: string | null;
  courseUrl: string | null;
  rawName: string;
  modalidad: string | null;
  prices: {
    kind: string;
    audience: string | null;
    amountCents: number | null;
    period: string | null;
    currency: string;
  }[];
}

/**
 * Acceso a datos del subsistema "Analizador de Competidores".
 * Ops finas (el diff sitemap↔BD y la lógica de cambios viven en el sync service).
 * Diseño: docs/roadmap/analizador-competidores.md
 */
@Injectable()
export class CompetitorQueriesService {
  private readonly logger = new Logger(CompetitorQueriesService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // ── competitors ──────────────────────────────────────────────────────────

  async getActiveCompetitors() {
    return this.db.select().from(competitors).where(eq(competitors.isActive, true));
  }

  async getCompetitorBySlug(slug: string) {
    const rows = await this.db.select().from(competitors).where(eq(competitors.slug, slug)).limit(1);
    return rows[0] ?? null;
  }

  async updateCompetitorTech(id: string, tech: Record<string, unknown>): Promise<void> {
    await this.db
      .update(competitors)
      .set({ tech, updatedAt: sql`now()` })
      .where(eq(competitors.id, id));
  }

  async markCompetitorSynced(id: string): Promise<void> {
    await this.db
      .update(competitors)
      .set({ lastSyncedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(competitors.id, id));
  }

  // ── competitor_sources (fuentes a vigilar, con last_hash) ─────────────────

  async getActiveSources(competitorId: string) {
    return this.db
      .select()
      .from(competitorSources)
      .where(and(eq(competitorSources.competitorId, competitorId), eq(competitorSources.isActive, true)));
  }

  /** Registra el resultado de revisar una fuente (hash + estado, como radar). */
  async markSourceChecked(
    id: string,
    result: { hash?: string | null; error?: string | null },
  ): Promise<void> {
    const ok = !result.error;
    await this.db
      .update(competitorSources)
      .set({
        lastCheckedAt: sql`now()`,
        lastHash: result.hash ?? null,
        lastError: result.error ?? null,
        ...(ok ? { lastSuccessAt: sql`now()` } : {}),
        updatedAt: sql`now()`,
      })
      .where(eq(competitorSources.id, id));
  }

  // ── competitor_urls ──────────────────────────────────────────────────────

  /** Índice de URLs ya conocidas (para el diff contra el sitemap). */
  async loadUrlIndex(competitorId: string): Promise<UrlIndexRow[]> {
    return this.db
      .select({
        id: competitorUrls.id,
        url: competitorUrls.url,
        urlType: competitorUrls.urlType,
        contentHash: competitorUrls.contentHash,
        lastmod: competitorUrls.lastmod,
        contentCheckedAt: competitorUrls.contentCheckedAt,
        isActive: competitorUrls.isActive,
      })
      .from(competitorUrls)
      .where(eq(competitorUrls.competitorId, competitorId));
  }

  async insertUrl(input: {
    competitorId: string;
    url: string;
    urlType: string;
    lastmod: string | null;
  }): Promise<string> {
    const rows = await this.db
      .insert(competitorUrls)
      .values({
        competitorId: input.competitorId,
        url: input.url,
        urlType: input.urlType,
        lastmod: input.lastmod,
      })
      .onConflictDoNothing({ target: [competitorUrls.competitorId, competitorUrls.url] })
      .returning({ id: competitorUrls.id });
    if (rows[0]) return rows[0].id;
    // Ya existía (carrera): recupéralo.
    const existing = await this.db
      .select({ id: competitorUrls.id })
      .from(competitorUrls)
      .where(and(eq(competitorUrls.competitorId, input.competitorId), eq(competitorUrls.url, input.url)))
      .limit(1);
    return existing[0].id;
  }

  /** URL vista de nuevo en el sitemap: refresca last_seen + lastmod + reactiva. */
  async markUrlSeen(id: string, lastmod: string | null, urlType: string): Promise<void> {
    await this.db
      .update(competitorUrls)
      .set({ lastSeenAt: sql`now()`, lastmod, urlType, isActive: true })
      .where(eq(competitorUrls.id, id));
  }

  /**
   * Registra que descargamos+hasheamos la página. `content_checked_at` se sella
   * SIEMPRE (resetea la antigüedad, aunque el contenido no cambie); `content_hash`
   * y `last_changed_at` solo cuando cambió.
   */
  async markUrlFetched(id: string, hash: string, changed: boolean): Promise<void> {
    await this.db
      .update(competitorUrls)
      .set({
        contentCheckedAt: sql`now()`,
        contentHash: hash,
        ...(changed ? { lastChangedAt: sql`now()` } : {}),
      })
      .where(eq(competitorUrls.id, id));
  }

  /** URLs que ya no aparecen en el sitemap → desactivadas (removed). */
  async deactivateUrls(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db
      .update(competitorUrls)
      .set({ isActive: false })
      .where(inArray(competitorUrls.id, ids));
  }

  // ── competitor_courses ───────────────────────────────────────────────────

  /** Upsert por URL. Devuelve id + si es nuevo. */
  async upsertCourse(input: {
    competitorId: string;
    urlId: string;
    oposicionId: string | null;
    rawName: string;
    modalidad: string | null;
    region: string | null;
  }): Promise<{ id: string; isNew: boolean }> {
    const existing = await this.db
      .select({ id: competitorCourses.id })
      .from(competitorCourses)
      .where(eq(competitorCourses.competitorUrlId, input.urlId))
      .limit(1);
    if (existing[0]) {
      await this.db
        .update(competitorCourses)
        .set({
          oposicionId: input.oposicionId,
          rawName: input.rawName,
          modalidad: input.modalidad,
          region: input.region,
          isActive: true,
          lastSeenAt: sql`now()`,
          updatedAt: sql`now()`,
        })
        .where(eq(competitorCourses.id, existing[0].id));
      return { id: existing[0].id, isNew: false };
    }
    const rows = await this.db
      .insert(competitorCourses)
      .values({
        competitorId: input.competitorId,
        competitorUrlId: input.urlId,
        oposicionId: input.oposicionId,
        rawName: input.rawName,
        modalidad: input.modalidad,
        region: input.region,
      })
      .returning({ id: competitorCourses.id });
    return { id: rows[0].id, isNew: true };
  }

  // ── competitor_prices (histórico via is_current) ─────────────────────────

  async getCurrentPrices(courseId: string) {
    return this.db
      .select()
      .from(competitorPrices)
      .where(and(eq(competitorPrices.competitorCourseId, courseId), eq(competitorPrices.isCurrent, true)));
  }

  async insertPrice(courseId: string, p: ParsedPrice): Promise<void> {
    await this.db.insert(competitorPrices).values({
      competitorCourseId: courseId,
      priceKind: p.kind,
      audience: p.audience,
      amountCents: p.amountCents,
      period: p.period,
      raw: p.raw,
    });
  }

  async supersedePrice(id: string): Promise<void> {
    await this.db
      .update(competitorPrices)
      .set({ isCurrent: false, supersededAt: sql`now()` })
      .where(eq(competitorPrices.id, id));
  }

  // ── competitor_changes (log) ─────────────────────────────────────────────

  async logChange(input: {
    competitorId: string;
    changeType: string;
    url?: string | null;
    courseId?: string | null;
    detail?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(competitorChanges).values({
      competitorId: input.competitorId,
      changeType: input.changeType,
      url: input.url ?? null,
      courseId: input.courseId ?? null,
      detail: (input.detail ?? {}) as Record<string, unknown>,
    });
  }

  // ── match curso → oposición ──────────────────────────────────────────────

  async loadOposicionesForMatch(): Promise<OposicionForMatch[]> {
    return this.db
      .select({ id: oposiciones.id, nombre: oposiciones.nombre, shortName: oposiciones.shortName })
      .from(oposiciones)
      .where(eq(oposiciones.isActive, true));
  }

  /**
   * Match conservador por nombre (precisión > recall): solo empareja si el
   * nombre normalizado del curso y el de la oposición se contienen mutuamente
   * con longitud suficiente. Si duda, devuelve null (= gap). El match fino
   * estructural (oep-match) queda para una fase posterior si hace falta.
   */
  matchCourseToOposicion(rawName: string, catalog: OposicionForMatch[]): string | null {
    const n = normalize(rawName);
    if (n.length < 8) return null;
    let best: { id: string; len: number } | null = null;
    for (const o of catalog) {
      for (const raw of [o.shortName, o.nombre]) {
        if (!raw) continue;
        const c = normalize(raw);
        if (c.length < 8) continue;
        if (n.includes(c) || c.includes(n)) {
          if (!best || c.length > best.len) best = { id: o.id, len: c.length };
        }
      }
    }
    return best?.id ?? null;
  }

  // ── alimentación del radar (Capa 3 lee del competitor-DB) ─────────────────

  /**
   * Cursos con "movimiento" reciente (recién añadidos o cuya página cambió en
   * los últimos `sinceDays` días) → pistas de posible convocatoria nueva para el
   * radar. Devuelve solo lo que se movió, no el catálogo entero (que sería ruido).
   */
  async getRadarCandidates(sinceDays = 7): Promise<
    { rawName: string; url: string | null; region: string | null }[]
  > {
    const since = sql`now() - make_interval(days => ${sinceDays})`;
    return this.db
      .select({
        rawName: competitorCourses.rawName,
        url: competitorUrls.url,
        region: competitors.region,
      })
      .from(competitorCourses)
      .innerJoin(competitors, eq(competitorCourses.competitorId, competitors.id))
      .leftJoin(competitorUrls, eq(competitorCourses.competitorUrlId, competitorUrls.id))
      .where(
        and(
          eq(competitorCourses.isActive, true),
          or(
            gte(competitorCourses.firstSeenAt, since),
            gte(competitorUrls.lastChangedAt, since),
          ),
        ),
      );
  }

  // ── consulta de negocio: ¿quién prepara la oposición X? ───────────────────

  async getCompetitorsForOposicion(oposicionId: string): Promise<CompetitorForOposicion[]> {
    const rows = await this.db
      .select({
        courseId: competitorCourses.id,
        competitorId: competitors.id,
        competitorName: competitors.name,
        tipo: competitors.tipo,
        region: competitors.region,
        courseUrl: competitorUrls.url,
        rawName: competitorCourses.rawName,
        modalidad: competitorCourses.modalidad,
      })
      .from(competitorCourses)
      .innerJoin(competitors, eq(competitorCourses.competitorId, competitors.id))
      .leftJoin(competitorUrls, eq(competitorCourses.competitorUrlId, competitorUrls.id))
      .where(and(eq(competitorCourses.oposicionId, oposicionId), eq(competitorCourses.isActive, true)))
      .orderBy(competitors.name);

    if (rows.length === 0) return [];
    const courseIds = rows.map((r) => r.courseId);
    const priceRows = await this.db
      .select()
      .from(competitorPrices)
      .where(and(inArray(competitorPrices.competitorCourseId, courseIds), eq(competitorPrices.isCurrent, true)))
      .orderBy(desc(competitorPrices.capturedAt));

    return rows.map((r) => ({
      competitorId: r.competitorId,
      competitorName: r.competitorName,
      tipo: r.tipo,
      region: r.region,
      courseUrl: r.courseUrl,
      rawName: r.rawName,
      modalidad: r.modalidad,
      prices: priceRows
        .filter((p) => p.competitorCourseId === r.courseId)
        .map((p) => ({
          kind: p.priceKind,
          audience: p.audience,
          amountCents: p.amountCents,
          period: p.period,
          currency: p.currency,
        })),
    }));
  }
}
