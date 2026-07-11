import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, gte, inArray, or, sql } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDB } from '../db/database.module';
import { normalize } from '../oep-signals/oep-match';
import { Ambito, OposicionIdentity, deriveIdentity, identityCompatible } from './oposicion-identity';
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

/**
 * Normaliza un nombre para matchear: pasa por `normalize`, convierte cualquier
 * separador a espacio y ELIMINA conectores (de/del/la…) como palabras completas.
 * Así "Auxiliar Administrativo de Córdoba" ≈ "Auxiliar Administrativo del
 * Ayuntamiento de Córdoba" no se rompen por un conector. Sigue exigiendo
 * contención completa de un nombre en el otro (precisión > recall).
 */
function cleanName(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, ' ')
    // Expandir abreviaturas de organismo/CCAA (verificadas) antes de nada, para
    // que "Subalterno GVA" ≈ "Subalterno de la Generalitat Valenciana".
    .replace(/\bgva\b/g, 'generalitat valenciana')
    .replace(/\bcam\b/g, 'comunidad madrid')
    // Acrónimos INEQUÍVOCOS de servicios autonómicos de salud (un solo significado):
    // el competidor suele escribir el acrónimo ("Aux. Administrativos del SAS") y la
    // oposición el nombre largo ("...del Servicio Andaluz de Salud (SAS)"). Al
    // expandir en AMBOS (cleanName se aplica a curso y a oposición) los tokens de
    // región+salud alinean y dejan de ser un `none` de recall. Forma ASCII (normalize
    // ya quitó acentos/ñ). Ambiguos EXCLUIDOS a propósito (SCS = Canario/Cántabro).
    // ADITIVA (mantiene el acrónimo + añade la forma larga): NUNCA borra un token que
    // ya matcheaba (p.ej. shortName "SERMAS") → 0 regresiones; solo suma recall.
    // NOTA: SERMAS (Madrid-salud) y SES (Extremadura-salud) EXCLUIDOS a propósito —
    // el catálogo tiene entradas variantes/duplicadas para ellos y expandirlas las
    // deja con tokens idénticos → empate → `none` (regresión). Añadirlos cuando se
    // deduplique el catálogo. El resto son inequívocos y sin colisión.
    .replace(/\bsas\b/g, 'sas servicio andaluz salud')
    .replace(/\bsergas\b/g, 'sergas servicio gallego salud')
    .replace(/\bsermas\b/g, 'sermas servicio madrileno salud')
    .replace(/\bsescam\b/g, 'sescam servicio salud castilla mancha')
    .replace(/\bsacyl\b/g, 'sacyl servicio salud castilla leon')
    .replace(/\bsespa\b/g, 'sespa servicio salud principado asturias')
    .replace(/\bsms\b/g, 'sms servicio murciano salud')
    .replace(/\bosakidetza\b/g, 'osakidetza servicio vasco salud')
    .replace(/\bosasunbidea\b/g, 'osasunbidea servicio navarro salud')
    .replace(/\bage\b/g, 'age administracion general estado')
    .replace(/\b(de|del|la|las|el|los|y|en|a|para|por)\b/g, ' ')
    // Singularizar de forma simétrica en dos pasos: quitar '-s' y luego '-e'. Así
    // ambos tipos de plural español convergen al MISMO stem sin ambigüedad:
    //   auxiliar/auxiliares → auxiliar (·s→auxiliare ·e→auxiliar)
    //   ayudante/ayudantes  → ayudant  (·s→ayudante  ·e→ayudant)
    //   institucion/instituciones, subalterno/subalternos, agente/agentes…
    // (una regla '-es' ingenua rompía "ayudantes"→"ayudant"≠"ayudante".)
    .replace(/\b([a-z]{4,})s\b/g, '$1')
    .replace(/\b([a-z]{4,})e\b/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

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
  administracion: string | null;
  /** Identidad canónica (ámbito+región) precomputada al cargar. */
  identity: OposicionIdentity;
  /** Tokens significativos (≥4) del nombre y shortName, precomputados. */
  nameTokens: string[];
  shortTokens: string[] | null;
}

export type MatchMethod = 'auto_structured' | 'auto_name' | 'needs_review' | 'none';

export interface MatchResult {
  /** Oposición enlazada (solo si auto_* con confianza suficiente). */
  oposicionId: string | null;
  /** Mejor apuesta cuando queda para revisión humana. */
  candidateId: string | null;
  ambito: Ambito;
  region: string | null;
  method: MatchMethod;
  confidence: number | null;
}

const sigTokens = (clean: string): string[] => clean.split(' ').filter((t) => t.length >= 4);

// Palabras de ROL demasiado comunes para identificar un cuerpo por sí solas (forma
// ya singularizada por cleanName). Un solape parcial que SOLO comparta estas es
// ruido (p.ej. TCAE vs Auxiliar Administrativo comparten "auxiliar"). Exigimos ≥1
// token compartido FUERA de esta lista para proponer revisión.
const GENERIC_TOKENS = new Set([
  'auxiliar', 'administrativo', 'administrativa', 'administracion', 'tecnico', 'tecnica',
  'superior', 'personal', 'oposicion', 'curso', 'academia', 'online', 'turno', 'libre',
  'promocion', 'interna', 'cuerpo', 'escala', 'grupo', 'laboral', 'funcionario', 'gestion',
]);

/** Enriquece una fila de oposición con su identidad y tokens (para el matcher). */
export function buildOposicionMatch(row: {
  id: string;
  nombre: string;
  shortName: string | null;
  administracion: string | null;
}): OposicionForMatch {
  return {
    ...row,
    identity: deriveIdentity(`${row.administracion ?? ''} ${row.nombre}`),
    nameTokens: sigTokens(cleanName(row.nombre)),
    shortTokens: row.shortName ? sigTokens(cleanName(row.shortName)) : null,
  };
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
    rawName: string;
    modalidad: string | null;
    region: string | null;
    match: MatchResult;
  }): Promise<{ id: string; isNew: boolean }> {
    const m = input.match;
    const matchFields = {
      oposicionId: m.oposicionId,
      ambito: m.ambito,
      regionSlug: m.region,
      matchMethod: m.method,
      matchConfidence: m.confidence,
      matchCandidateId: m.candidateId,
      matchedAt: m.oposicionId ? sql`now()` : null,
    };
    const existing = await this.db
      .select({ id: competitorCourses.id, matchMethod: competitorCourses.matchMethod })
      .from(competitorCourses)
      .where(eq(competitorCourses.competitorUrlId, input.urlId))
      .limit(1);
    if (existing[0]) {
      // STICKY: los enlaces manuales/confirmados por un humano NO se pisan por el
      // re-match automático (solo se refresca nombre/modalidad/visto).
      const sticky = existing[0].matchMethod === 'manual' || existing[0].matchMethod === 'confirmed';
      await this.db
        .update(competitorCourses)
        .set({
          rawName: input.rawName,
          modalidad: input.modalidad,
          region: input.region,
          isActive: true,
          lastSeenAt: sql`now()`,
          updatedAt: sql`now()`,
          ...(sticky ? {} : matchFields),
        })
        .where(eq(competitorCourses.id, existing[0].id));
      return { id: existing[0].id, isNew: false };
    }
    const rows = await this.db
      .insert(competitorCourses)
      .values({
        competitorId: input.competitorId,
        competitorUrlId: input.urlId,
        rawName: input.rawName,
        modalidad: input.modalidad,
        region: input.region,
        ...matchFields,
      })
      .returning({ id: competitorCourses.id });
    return { id: rows[0].id, isNew: true };
  }

  /** Cola de revisión: cursos con candidato pero sin enlace automático seguro. */
  async getReviewQueue(limit = 200) {
    return this.db
      .select({
        courseId: competitorCourses.id,
        competitorName: competitors.name,
        rawName: competitorCourses.rawName,
        courseUrl: competitorUrls.url,
        ambito: competitorCourses.ambito,
        regionSlug: competitorCourses.regionSlug,
        confidence: competitorCourses.matchConfidence,
        candidateId: competitorCourses.matchCandidateId,
        candidateNombre: oposiciones.nombre,
        candidateSlug: oposiciones.slug,
      })
      .from(competitorCourses)
      .innerJoin(competitors, eq(competitors.id, competitorCourses.competitorId))
      .leftJoin(competitorUrls, eq(competitorUrls.id, competitorCourses.competitorUrlId))
      .leftJoin(oposiciones, eq(oposiciones.id, competitorCourses.matchCandidateId))
      .where(and(eq(competitorCourses.matchMethod, 'needs_review'), eq(competitorCourses.isActive, true)))
      .orderBy(desc(competitorCourses.matchConfidence))
      .limit(limit);
  }

  /** Confirma (o corrige) manualmente un enlace curso→oposición. Queda STICKY. */
  async confirmMatch(courseId: string, oposicionId: string | null): Promise<void> {
    await this.db
      .update(competitorCourses)
      .set({
        oposicionId,
        matchMethod: oposicionId ? 'confirmed' : 'manual',
        matchCandidateId: null,
        matchedAt: sql`now()`,
        updatedAt: sql`now()`,
      })
      .where(eq(competitorCourses.id, courseId));
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
      plan: p.plan ?? null,
      includes: p.includes ?? [],
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
    // Matchear contra TODAS las oposiciones catalogadas, NO solo las activas
    // (vendibles). El valor del analizador es "quién prepara la oposición X", y el
    // 83% de nuestro catálogo son `coverage_level='catalogada'` (is_active=false):
    // filtrarlas dejaba sus cursos como gaps eternos (p.ej. Subalterno GVA).
    const rows = await this.db
      .select({
        id: oposiciones.id,
        nombre: oposiciones.nombre,
        shortName: oposiciones.shortName,
        administracion: oposiciones.administracion,
      })
      .from(oposiciones);
    return rows.map(buildOposicionMatch);
  }

  /**
   * Match conservador por nombre (precisión > recall): solo empareja si el
   * nombre normalizado del curso y el de la oposición se contienen mutuamente
   * con longitud suficiente. Si duda, devuelve null (= gap). El match fino
   * estructural (oep-match) queda para una fase posterior si hace falta.
   */
  /**
   * Empareja un curso de competidor con una oposición del catálogo por IDENTIDAD
   * ESTRUCTURADA + nombre. Primero deriva la identidad del curso (ámbito+región) de
   * `courseText` (url + rawName — la URL suele traer la administración) y descarta
   * las oposiciones de ámbito/región incompatibles (guarda dura: un curso de
   * "Ayuntamiento de Zaragoza" NUNCA empareja una opo de ámbito Estado). Solo dentro
   * de las compatibles compara el cuerpo/materia por solapamiento de tokens (gana la
   * más específica; a igualdad, la reforzada por identidad). Devuelve el método y la
   * confianza: enlaza en auto solo si la confianza es alta; si es dudoso o ambiguo lo
   * deja en `needs_review` con la mejor apuesta para que un humano lo confirme.
   */
  matchCourse(rawName: string, courseText: string, catalog: OposicionForMatch[]): MatchResult {
    const identity = deriveIdentity(courseText);
    const base: MatchResult = {
      oposicionId: null,
      candidateId: null,
      ambito: identity.ambito,
      region: identity.region,
      method: 'none',
      confidence: null,
    };
    const n = cleanName(rawName);
    if (n.length < 8) return base;
    const nTokens = new Set(sigTokens(n));
    // Guarda 1: el curso debe tener ≥2 tokens significativos (un genérico de una
    // palabra no empareja cuerpos específicos).
    if (nTokens.size < 2) return base;

    let bestId: string | null = null;
    let bestSize = 0;
    let bestReinforced = false;
    let tie = false;
    for (const o of catalog) {
      const compat = identityCompatible(identity, o.identity);
      if (!compat.compatible) continue; // guarda dura ámbito/región
      for (const toks of [o.nameTokens, o.shortTokens]) {
        if (!toks || toks.length < 2) continue;
        // La oposición (la más corta) debe estar contenida por tokens en el curso.
        if (!toks.every((t) => nTokens.has(t))) continue;
        const size = toks.length;
        if (size > bestSize || (size === bestSize && compat.reinforced && !bestReinforced)) {
          bestId = o.id;
          bestSize = size;
          bestReinforced = compat.reinforced;
          tie = false;
        } else if (size === bestSize && o.id !== bestId && compat.reinforced === bestReinforced) {
          tie = true;
        }
      }
    }
    if (!bestId) {
      // ROBUSTEZ: sin subset completo, en vez de gap silencioso buscamos el mejor
      // SOLAPE PARCIAL dentro del ámbito compatible → REVISIÓN humana. Cubre el caso
      // "la opo tiene una palabra-cualificador que el competidor no escribe"
      // (p.ej. 'Agente de la Hacienda *Pública*' vs 'Agentes de Hacienda'). Estricto:
      // ≥2 tokens compartidos, ≥60% del nombre de la oposición presente, y ganador
      // único (si empata, gap). Nunca auto-enlaza: siempre lo confirma un humano.
      let partId: string | null = null;
      let partShared = 0;
      let partRatio = 0;
      let partTie = false;
      for (const o of catalog) {
        if (!identityCompatible(identity, o.identity).compatible) continue;
        for (const toks of [o.nameTokens, o.shortTokens]) {
          if (!toks || toks.length < 2) continue;
          const sharedTokens = toks.filter((t) => nTokens.has(t));
          const shared = sharedTokens.length;
          const ratio = shared / toks.length;
          if (shared < 2 || ratio < 0.6) continue;
          // Debe compartir ≥1 palabra DISTINTIVA (no solo genéricas de rol) → evita
          // emparejar cuerpos distintos que solo coinciden en "auxiliar/administrativo".
          if (!sharedTokens.some((t) => !GENERIC_TOKENS.has(t))) continue;
          if (shared > partShared || (shared === partShared && ratio > partRatio)) {
            partId = o.id;
            partShared = shared;
            partRatio = ratio;
            partTie = false;
          } else if (shared === partShared && ratio === partRatio && o.id !== partId) {
            partTie = true;
          }
        }
      }
      if (partId && !partTie) {
        return { ...base, candidateId: partId, method: 'needs_review', confidence: Math.min(0.55, 0.4 + 0.15 * partRatio) };
      }
      return base;
    }

    // Confianza según cuánta identidad respalda el match.
    let confidence: number;
    if (bestReinforced) confidence = 0.95; // ámbito+región conocidos y coincidentes
    else if (identity.ambito !== 'desconocido') confidence = 0.8; // ámbito compatible
    else if (bestSize >= 3) confidence = 0.65; // sin ámbito pero nombre muy específico
    else confidence = 0.45;

    // Empate no resuelto ni por especificidad ni por identidad → revisión humana.
    if (tie) {
      return { ...base, candidateId: bestId, method: 'needs_review', confidence: Math.min(confidence, 0.4) };
    }
    // Bajo umbral de auto-enlace → revisión (nunca un match silencioso dudoso).
    if (confidence < 0.6) {
      return { ...base, candidateId: bestId, method: 'needs_review', confidence };
    }
    return {
      oposicionId: bestId,
      candidateId: null,
      ambito: identity.ambito,
      region: identity.region,
      method: bestReinforced ? 'auto_structured' : 'auto_name',
      confidence,
    };
  }

  // ── alimentación del radar (Capa 3 lee del competitor-DB) ─────────────────

  /**
   * Cursos con "movimiento" reciente (recién añadidos o cuya página cambió en
   * los últimos `sinceDays` días) → pistas de posible convocatoria nueva para el
   * radar. Devuelve solo lo que se movió, no el catálogo entero (que sería ruido).
   */
  async getRadarCandidates(sinceDays = 7): Promise<
    { rawName: string; url: string | null; region: string | null; nCompetitors: number }[]
  > {
    // Candidatas a CATALOGAR = solo GAPS (oposiciones que competidores imparten y
    // NO catalogamos). Deduplicadas por identidad (ámbito, región, nombre
    // normalizado) con nº de competidores distintos (fuerza de la demanda), y
    // filtrando basura de marketing (títulos de categoría/tagline mal parseados:
    // "… Online", "…| Academia X - 93% Aprobados"). Antes emitía 1 señal por CURSO
    // (2022 de golpe, duplicando el competitor-DB); ahora 1 por HUECO real → no se
    // pierde ninguna señal de catalogación, pero sin ruido ni duplicación.
    const rows = await this.db.execute(sql`
      SELECT
        (array_agg(cc.raw_name ORDER BY length(cc.raw_name)))[1] AS raw_name,
        (array_agg(u.url) FILTER (WHERE u.url IS NOT NULL))[1] AS url,
        (array_agg(c.region) FILTER (WHERE c.region IS NOT NULL))[1] AS region,
        count(DISTINCT cc.competitor_id)::int AS n_competitors
      FROM competitor_courses cc
      JOIN competitors c ON c.id = cc.competitor_id
      LEFT JOIN competitor_urls u ON u.id = cc.competitor_url_id
      WHERE cc.is_active
        AND cc.oposicion_id IS NULL
        AND cc.match_method = 'none'   -- excluye needs_review (tienen candidato → no es opo nueva)
        AND (cc.first_seen_at >= now() - make_interval(days => ${sinceDays})
             OR u.last_changed_at >= now() - make_interval(days => ${sinceDays}))
        AND length(cc.raw_name) BETWEEN 8 AND 90
        AND cc.raw_name !~* '(online|aprobad|black friday|matr[ií]cula|descuento|\\||%)'
      GROUP BY cc.ambito, cc.region_slug,
               unaccent(lower(regexp_replace(cc.raw_name, '[^a-zA-Z0-9]+', ' ', 'g')))
      HAVING count(DISTINCT cc.competitor_id) >= 2   -- demanda REAL (≥2 competidores)
      ORDER BY count(DISTINCT cc.competitor_id) DESC, raw_name
    `);
    return (
      rows as unknown as {
        raw_name: string;
        url: string | null;
        region: string | null;
        n_competitors: number;
      }[]
    ).map((r) => ({ rawName: r.raw_name, url: r.url, region: r.region, nCompetitors: r.n_competitors }));
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
