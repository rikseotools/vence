// app/teoria/page.tsx - PÁGINA PRINCIPAL DE TEORÍA CON SEO + BUSCADOR
//
// Listado del catálogo de leyes ("textos legales") con BÚSQUEDA y PAGINACIÓN
// resueltas en SERVIDOR sobre la matview `mv_teoria_law_catalog`
// (lib/api/laws/teoriaCatalog.ts). Escalable: cada render son 1-2 lookups
// indexados (GIN pg_trgm + unaccent) + LIMIT/OFFSET, no un scan laws×articles.
//
// NOTA sobre caching: la página es dinámica porque depende de `searchParams`
// (?q=, ?page=). Ya NO aplica el edge-cache estático anterior, pero tampoco
// hace falta: la matview convirtió el antiguo fetchLawsList de ~4s en consultas
// de milisegundos. Los totales de las stat cards se cachean aparte (Data Cache,
// tag 'teoria') porque son estables entre búsquedas.
import { versionedCache } from '@/lib/cache/versionedCache'
import Link from 'next/link'
import { BookOpenIcon, DocumentTextIcon, ScaleIcon } from '@heroicons/react/24/outline'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'
import TeoriaSearch from '@/components/TeoriaSearch'
import {
  searchTeoriaCatalog,
  getTeoriaCatalogTotals,
  normalizeQuery,
  parsePage,
  computeTotalPages,
  clampPage,
  TEORIA_PAGE_SIZE,
} from '@/lib/api/laws/teoriaCatalog'
import type { Metadata } from 'next'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

// Totales para las stat cards, cacheados (estables entre búsquedas).
// `versionedCache` (no `unstable_cache` plano) → invalidable CROSS-INSTANCIA en
// AWS: un bumpCacheVersion('teoria') limpia el cache en TODAS las instancias ECS.
// Se invalida tras cambios de contenido vía /api/admin/revalidate-temario
// (refresh matview + bumpCacheVersion) o /api/admin/revalidate {tag:'teoria'}.
const getCachedTotals = versionedCache(
  async () => getTeoriaCatalogTotals(),
  { tag: 'teoria', keyParts: ['teoria-catalog-totals-v1'] }
)

// Listado SIN búsqueda (navegación por defecto), cacheado por página en el Data
// Cache. La página es dinámica (por ?q=/?page=), pero el caso común —abrir
// /teoria y paginar sin buscar— se sirve desde caché sin tocar la BD, así que
// carga casi instantáneo. Las BÚSQUEDAS (?q=) NO pasan por aquí: van en vivo a
// la matview (indexada, ms). La clave de caché incluye la página (nº de páginas
// acotado → conjunto de claves pequeño). Se invalida con revalidateTag('teoria').
const getCachedListingPage = versionedCache(
  async (page: number) => searchTeoriaCatalog({ q: '', page }),
  { tag: 'teoria', keyParts: ['teoria-listing-page-v1'] }
)

type SearchParams = { q?: string; page?: string }

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<SearchParams> }
): Promise<Metadata> {
  const sp = await searchParams
  const q = normalizeQuery(sp.q)
  const page = parsePage(sp.page)
  const isFiltered = q.length > 0 || page > 1

  return {
    title: q
      ? `Buscar "${q}" en Teoria Legal | Vence`
      : 'Teoria Legal - Estudia Legislacion Española',
    description:
      'Accede a todos los articulos de las principales leyes españolas. Constitucion, Ley 39/2015, Ley 40/2015 y mas. Teoria completa para oposiciones.',
    alternates: { canonical: `${SITE_URL}/teoria` },
    // Las variantes filtradas/paginadas no se indexan: se consolidan en /teoria.
    robots: isFiltered
      ? { index: false, follow: true }
      : { index: true, follow: true },
  }
}

// Construye el href de paginación preservando la query activa.
function buildPageHref(q: string, page: number): string {
  const params = new URLSearchParams()
  if (q) params.set('q', q)
  if (page > 1) params.set('page', String(page))
  const qs = params.toString()
  return qs ? `/teoria?${qs}` : '/teoria'
}

export default async function TeoriaMainPage(
  { searchParams }: { searchParams: Promise<SearchParams> }
) {
  const sp = await searchParams
  const q = normalizeQuery(sp.q)
  const requestedPage = parsePage(sp.page)

  let totals = { totalLaws: 0, totalArticles: 0 }
  let result = { laws: [], total: 0, page: 1, pageSize: 48, totalPages: 1, q } as Awaited<
    ReturnType<typeof searchTeoriaCatalog>
  >
  let error: string | null = null

  try {
    totals = await getCachedTotals()
    if (q) {
      // Búsqueda: en vivo (indexada, ms). No se cachea (claves ilimitadas).
      result = await searchTeoriaCatalog({ q, page: requestedPage })
    } else {
      // Listado por defecto: cacheado por página. Clampamos la página con los
      // totales YA cacheados → la clave de caché queda acotada a [1, totalPages].
      const totalPages = computeTotalPages(totals.totalLaws, TEORIA_PAGE_SIZE)
      const safePage = clampPage(requestedPage, totalPages)
      result = await getCachedListingPage(safePage)
    }
  } catch (err) {
    console.error('Error cargando catálogo de teoría:', err)
    error = (err as Error).message
  }

  const { laws, total, page, totalPages, pageSize } = result
  const firstIdx = total === 0 ? 0 : (page - 1) * pageSize + 1
  const lastIdx = Math.min(page * pageSize, total)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <ClientBreadcrumbsWrapper />
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpenIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Teoria Legal</h1>
              <p className="text-gray-600 mt-1">
                Accede al contenido completo de la legislacion española
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ScaleIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Leyes Disponibles</p>
                <p className="text-2xl font-bold text-gray-900">{totals.totalLaws}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Articulos Totales</p>
                <p className="text-2xl font-bold text-gray-900">{totals.totalArticles}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpenIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Contenido Rico</p>
                <p className="text-2xl font-bold text-gray-900">100%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Buscador (sincroniza ?q= en la URL → búsqueda en servidor) */}
        <TeoriaSearch initialQuery={q} />

        {/* Línea de resultados */}
        {!error && (
          <p className="text-sm text-gray-600 mb-4" aria-live="polite">
            {total === 0
              ? q
                ? <>No hay leyes que coincidan con <strong>&ldquo;{q}&rdquo;</strong>.</>
                : 'No hay leyes disponibles.'
              : q
                ? <>Mostrando <strong>{firstIdx}-{lastIdx}</strong> de <strong>{total}</strong> leyes para <strong>&ldquo;{q}&rdquo;</strong></>
                : <>Mostrando <strong>{firstIdx}-{lastIdx}</strong> de <strong>{total}</strong> leyes</>}
          </p>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div className="text-red-400">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error cargando contenido</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {laws.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {laws.map((law) => (
              <Link key={law.id} href={`/teoria/${law.slug}`} className="group">
                <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border hover:border-blue-200 p-6 h-full">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                        {law.short_name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">{law.name}</p>
                      {law.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-3">{law.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-500">
                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                      <span>{law.articleCount} articulos</span>
                    </div>
                    <div className="text-blue-600 group-hover:text-blue-700">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : !error && q ? (
          <div className="text-center py-12">
            <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Sin resultados</h3>
            <p className="text-gray-600">
              Prueba con otro término (por nombre de la ley o sus siglas).
            </p>
          </div>
        ) : !error ? (
          <div className="text-center py-12">
            <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay contenido disponible</h3>
            <p className="text-gray-600">No se encontraron leyes con contenido de teoria disponible.</p>
          </div>
        ) : null}

        {/* Paginación (enlaces server-side → funciona sin JS) */}
        {totalPages > 1 && (
          <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Paginación">
            {page > 1 ? (
              <Link
                href={buildPageHref(q, page - 1)}
                rel="prev"
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                ← Anterior
              </Link>
            ) : (
              <span className="px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed">
                ← Anterior
              </span>
            )}

            <span className="px-4 py-2 text-sm text-gray-600">
              Pagina <strong>{page}</strong> de <strong>{totalPages}</strong>
            </span>

            {page < totalPages ? (
              <Link
                href={buildPageHref(q, page + 1)}
                rel="next"
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                Siguiente →
              </Link>
            ) : (
              <span className="px-4 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed">
                Siguiente →
              </span>
            )}
          </nav>
        )}

        <div className="mt-12 bg-white rounded-xl shadow-sm border p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Sobre el Contenido de Teoria
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Accede al contenido completo y oficial de la legislacion española.
              Cada articulo incluye el texto integro y la estructura original
              para facilitar tu estudio y comprension.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
