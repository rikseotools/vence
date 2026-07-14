// lib/api/laws/teoriaCatalog.ts
// ============================================================================
// Catálogo de leyes de /teoria: búsqueda server-side + paginación, leyendo de la
// vista materializada `mv_teoria_law_catalog` (SSOT — ver migración
// 20260709_teoria_law_catalog_matview.sql).
//
// Escalable por construcción: la búsqueda es un lookup indexado (GIN pg_trgm +
// unaccent) sobre una tabla pre-derivada, no un scan laws×articles en JS. El
// coste NO crece con el tamaño del catálogo (índice + LIMIT/OFFSET), a
// diferencia del patrón cliente de /leyes (que envía y pinta todas las leyes).
//
// Agnóstico a la BD: sólo Drizzle/getDb, cero acoplamiento a Supabase.
// ============================================================================
import 'server-only'
import { sql } from 'drizzle-orm'
import { getReadDb, getAdminDb } from '@/db/client'

export interface TeoriaCatalogLaw {
  id: string
  short_name: string
  name: string
  description: string | null
  slug: string
  articleCount: number
}

export interface TeoriaCatalogPage {
  laws: TeoriaCatalogLaw[]
  /** Total de resultados que cumplen el filtro `q` (para calcular páginas). */
  total: number
  page: number
  pageSize: number
  totalPages: number
  /** Query normalizada efectivamente aplicada (''  = listado completo). */
  q: string
}

// Tamaño de página del listado (rejilla 3 columnas → 16 filas por página).
export const TEORIA_PAGE_SIZE = 48
// Techo defensivo del término de búsqueda (evita queries patológicas).
const MAX_QUERY_LEN = 100
// Techo defensivo de página (evita OFFSET absurdos).
const MAX_PAGE = 100_000

// ---------------------------------------------------------------------------
// Helpers PUROS (sin BD) — unit-testables de forma aislada.
// ---------------------------------------------------------------------------

/** Normaliza el término de búsqueda: trim, colapsa espacios, acota longitud. */
export function normalizeQuery(raw: string | undefined | null): string {
  if (!raw) return ''
  return String(raw).trim().replace(/\s+/g, ' ').slice(0, MAX_QUERY_LEN)
}

/** Parsea `?page=` a un entero ≥ 1 robusto ante basura/negativos/overflow. */
export function parsePage(raw: string | undefined | null): number {
  const n = parseInt(String(raw ?? '1'), 10)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(n, MAX_PAGE)
}

/** Nº total de páginas (mínimo 1, incluso con 0 resultados). */
export function computeTotalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 1
  if (total <= 0) return 1
  return Math.max(1, Math.ceil(total / pageSize))
}

/** Acota la página solicitada al rango [1, totalPages]. */
export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(page, 1), totalPages)
}

// ---------------------------------------------------------------------------
// Lectura del catálogo (BD)
// ---------------------------------------------------------------------------

/**
 * Página del catálogo de teoría, opcionalmente filtrada por `q`.
 *
 * - Sin `q`: orden por nº de artículos desc (más "gordas" primero), como el
 *   listado histórico de /teoria.
 * - Con `q`: match por substring O trigrama (insensible a acentos y mayúsculas),
 *   ordenado por similitud → los aciertos más exactos arriba.
 *
 * La página solicitada se **acota** al total real: pedir ?page=999 devuelve la
 * última página, nunca una lista vacía por OFFSET fuera de rango.
 */
export async function searchTeoriaCatalog(opts: {
  q?: string | null
  page?: number
  pageSize?: number
}): Promise<TeoriaCatalogPage> {
  const q = normalizeQuery(opts.q)
  const pageSize = opts.pageSize && opts.pageSize > 0 ? opts.pageSize : TEORIA_PAGE_SIZE
  const requestedPage = opts.page && opts.page >= 1 ? opts.page : 1
  const db = getReadDb()

  // 1) Total (con el mismo filtro que el listado) para calcular páginas.
  let total: number
  if (q) {
    const r = (await db.execute(sql`
      SELECT count(*)::int AS c
      FROM mv_teoria_law_catalog
      WHERE search_text LIKE '%' || public.immutable_unaccent(lower(${q})) || '%'
         OR search_text % public.immutable_unaccent(lower(${q}))
    `)) as unknown as Array<{ c: number }>
    total = Number(r[0]?.c ?? 0)
  } else {
    const r = (await db.execute(sql`
      SELECT count(*)::int AS c FROM mv_teoria_law_catalog
    `)) as unknown as Array<{ c: number }>
    total = Number(r[0]?.c ?? 0)
  }

  const totalPages = computeTotalPages(total, pageSize)
  const page = clampPage(requestedPage, totalPages)
  const offset = (page - 1) * pageSize

  // 2) Filas de la página.
  type Row = {
    law_id: string
    short_name: string
    name: string
    description: string | null
    slug: string
    article_count: number
  }
  let rows: Row[]
  if (q) {
    rows = (await db.execute(sql`
      SELECT law_id, short_name, name, description, slug, article_count
      FROM mv_teoria_law_catalog
      WHERE search_text LIKE '%' || public.immutable_unaccent(lower(${q})) || '%'
         OR search_text % public.immutable_unaccent(lower(${q}))
      ORDER BY similarity(search_text, public.immutable_unaccent(lower(${q}))) DESC,
               article_count DESC,
               short_name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `)) as unknown as Row[]
  } else {
    rows = (await db.execute(sql`
      SELECT law_id, short_name, name, description, slug, article_count
      FROM mv_teoria_law_catalog
      ORDER BY article_count DESC, short_name ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `)) as unknown as Row[]
  }

  return {
    laws: rows.map((r) => ({
      id: r.law_id,
      short_name: r.short_name,
      name: r.name,
      description: r.description,
      slug: r.slug,
      articleCount: Number(r.article_count),
    })),
    total,
    page,
    pageSize,
    totalPages,
    q,
  }
}

/**
 * Totales del catálogo para las stat cards. Barato (agregado sobre la matview),
 * pensado para envolver en `unstable_cache` desde la página.
 */
export async function getTeoriaCatalogTotals(): Promise<{
  totalLaws: number
  totalArticles: number
}> {
  const db = getReadDb()
  const r = (await db.execute(sql`
    SELECT count(*)::int AS laws, coalesce(sum(article_count), 0)::int AS articles
    FROM mv_teoria_law_catalog
  `)) as unknown as Array<{ laws: number; articles: number }>
  return {
    totalLaws: Number(r[0]?.laws ?? 0),
    totalArticles: Number(r[0]?.articles ?? 0),
  }
}

/**
 * Refresca la matview sin bloquear lecturas (CONCURRENTLY, habilitado por el
 * unique index sobre law_id). Invocar tras imports/ediciones de leyes o
 * artículos. Cableado en /api/admin/revalidate-temario.
 */
export async function refreshTeoriaCatalog(): Promise<void> {
  // Pool ADMIN (no el de usuario): REFRESH MATERIALIZED VIEW CONCURRENTLY puede tardar
  // >10s en catálogos grandes; con el statement_timeout de 10s del pool de usuario se
  // abortaría. En getAdminDb() (30s) completa (revisión adversarial 14/07).
  const db = getAdminDb()
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_teoria_law_catalog`)
}

// ---------------------------------------------------------------------------
// Búsqueda de CONTENIDO (full-text sobre el texto de los artículos)
// ---------------------------------------------------------------------------

/** Sentinelas de resaltado (no-HTML) → se pintan como <mark> en React SIN
 *  dangerouslySetInnerHTML (evita XSS del contenido del artículo). */
export const HL_START = '⟦' // ⟦
export const HL_END = '⟧' // ⟧

export interface TeoriaContentHit {
  lawShortName: string
  lawSlug: string
  articleNumber: string
  /** Ruta al artículo (o a la ley si el nº no es numérico, p.ej. disposiciones). */
  href: string
  /** Fragmento con los términos entre HL_START/HL_END. */
  snippet: string
}

/** Enlace al artículo: numérico → /teoria/slug/articulo-N; si no, a la ley. */
function articleHref(slug: string, articleNumber: string): string {
  const m = String(articleNumber ?? '').match(/^\s*(\d+)/)
  return m ? `/teoria/${slug}/articulo-${m[1]}` : `/teoria/${slug}`
}

/**
 * Busca un término dentro del TEXTO de los artículos (FTS español + unaccent),
 * devolviendo los artículos más relevantes con un fragmento resaltado. Es el
 * "buscar un concepto en toda la legislación" (complementa la búsqueda por
 * nombre de ley). Excluye leyes-contenedor de variante, igual que el catálogo.
 */
export async function searchTeoriaContent(opts: {
  q?: string | null
  limit?: number
}): Promise<{ hits: TeoriaContentHit[]; total: number }> {
  const q = normalizeQuery(opts.q)
  if (!q) return { hits: [], total: 0 }
  const limit = opts.limit && opts.limit > 0 ? Math.min(opts.limit, 50) : 20
  const db = getReadDb()

  const totalRes = (await db.execute(sql`
    SELECT count(*)::int AS c
    FROM articles a JOIN laws l ON l.id = a.law_id
    WHERE a.is_active AND a.content IS NOT NULL AND l.is_active
      AND (l.slug IS NULL OR (l.slug NOT LIKE '%-solo-escritorio' AND l.slug NOT LIKE '%-solo-web'))
      AND a.teoria_content_tsv @@ websearch_to_tsquery('public.spanish_unaccent', ${q})
  `)) as unknown as Array<{ c: number }>
  const total = Number(totalRes[0]?.c ?? 0)
  if (total === 0) return { hits: [], total: 0 }

  const headlineOpts = `MaxWords=26,MinWords=12,MaxFragments=1,StartSel=${HL_START},StopSel=${HL_END}`
  const rows = (await db.execute(sql`
    SELECT l.short_name, l.slug, a.article_number,
      ts_headline('public.spanish_unaccent', a.content,
        websearch_to_tsquery('public.spanish_unaccent', ${q}), ${headlineOpts}) AS snippet
    FROM articles a JOIN laws l ON l.id = a.law_id
    WHERE a.is_active AND a.content IS NOT NULL AND l.is_active
      AND (l.slug IS NULL OR (l.slug NOT LIKE '%-solo-escritorio' AND l.slug NOT LIKE '%-solo-web'))
      AND a.teoria_content_tsv @@ websearch_to_tsquery('public.spanish_unaccent', ${q})
    ORDER BY ts_rank(a.teoria_content_tsv, websearch_to_tsquery('public.spanish_unaccent', ${q})) DESC,
             l.short_name ASC
    LIMIT ${limit}
  `)) as unknown as Array<{
    short_name: string
    slug: string
    article_number: string
    snippet: string
  }>

  return {
    total,
    hits: rows.map((r) => ({
      lawShortName: r.short_name,
      lawSlug: r.slug,
      articleNumber: r.article_number,
      href: articleHref(r.slug, r.article_number),
      snippet: r.snippet ?? '',
    })),
  }
}
