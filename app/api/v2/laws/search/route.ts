// app/api/v2/laws/search/route.ts — BUSCAR LEYES: por nombre Y por contenido, devolviendo
// resultados. (T-327)
//
// ── POR QUÉ HACE FALTA ESTE ENDPOINT, SI LA BÚSQUEDA YA EXISTÍA ─────────────────────────────
//
// El motor está construido y es bueno (`lib/api/laws/teoriaCatalog.ts`: pg_trgm sobre matview
// para el nombre, full-text de Postgres sobre el articulado para el contenido). Lo que NO
// existía es **una forma de pedirle resultados desde un cliente**: hoy la búsqueda ocurre
// DENTRO del Server Component de `/teoria`, y el único endpoint del área
// (`/api/teoria/search`) es un GATE de cuota que responde 200 o 429 — no devuelve nada.
//
// Es decir: media función construida en cada lado. `TestConfigurator` sabe seleccionar leyes y
// artículos pero **no tiene buscador** (elige de una lista precargada), y el buscador **no tiene
// salida**. Este endpoint es la unión, y es lo que desbloquea armar un temario propio.
//
// ── POR QUÉ BUSCAR POR CONTENIDO NO ES UN EXTRA ────────────────────────────────────────────
//
// Quien arma su temario parte de un epígrafe en prosa. Los programas oficiales **muchas veces no
// nombran la ley**: dicen la materia. Sin poder preguntar «¿en qué ley está esto?» el usuario no
// sabe ni qué ley elegir, y la selección por nombre —que es lo único que había— no le sirve.
//
// ── CUOTA: DECISIÓN EXPLÍCITA, DISTINTA A LA DE /teoria ────────────────────────────────────
//
// `/teoria` limita a 5 búsquedas/día a free y anónimos. Aquí **no se aplica ese tope**, porque
// armar un temario son muchas búsquedas seguidas y con 5 la función es inusable — el tope
// mataría justo el caso de uso. A cambio, **exige sesión**: no queda como superficie abierta de
// scraping del articulado, y el abuso queda acotado y atribuible. Si algún día hace falta
// contener, el sitio es `featureLimits` con su propia `feature`, NO reutilizar `teoria_search`
// (mezclar dos cuotas distintas bajo el mismo contador hace que ninguna de las dos signifique
// nada).

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import {
  normalizeQuery,
  searchTeoriaCatalog,
  searchTeoriaContent,
} from '@/lib/api/laws/teoriaCatalog'

/** Techo de leyes por nombre. Es un selector, no un catálogo: caben pocas y bien ordenadas. */
const LIMITE_LEYES = 12
/** Techo de aciertos por contenido. El motor ya acota a 50 por su cuenta. */
const LIMITE_CONTENIDO = 15

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/laws/search')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const q = normalizeQuery(new URL(request.url).searchParams.get('q'))
  // Query vacía no es un error: es el estado inicial del buscador. Se contesta vacío y ya.
  if (!q) {
    return NextResponse.json({ success: true, q: '', leyes: [], contenido: [], totales: { leyes: 0, contenido: 0 } })
  }

  // Las dos búsquedas son independientes y ninguna depende de la otra → en paralelo. Y si UNA
  // falla, la otra sigue sirviendo: para quien busca, media respuesta es infinitamente mejor que
  // una pantalla de error, y son motores distintos (trigrama vs full-text) que pueden romperse
  // por separado.
  const [porNombre, porContenido] = await Promise.allSettled([
    searchTeoriaCatalog({ q, page: 1, pageSize: LIMITE_LEYES }),
    searchTeoriaContent({ q, limit: LIMITE_CONTENIDO }),
  ])

  const leyes =
    porNombre.status === 'fulfilled'
      ? porNombre.value.laws.map((l) => ({
          lawId: l.id,
          shortName: l.short_name,
          name: l.name,
          slug: l.slug,
          articleCount: l.articleCount,
        }))
      : []

  const contenido =
    porContenido.status === 'fulfilled'
      ? porContenido.value.hits.map((h) => ({
          lawId: h.lawId,
          shortName: h.lawShortName,
          slug: h.lawSlug,
          articleNumber: h.articleNumber,
          snippet: h.snippet,
        }))
      : []

  return NextResponse.json({
    success: true,
    q,
    leyes,
    contenido,
    totales: {
      leyes: porNombre.status === 'fulfilled' ? porNombre.value.total : 0,
      contenido: porContenido.status === 'fulfilled' ? porContenido.value.total : 0,
    },
    // Se dice CUÁL de los dos motores falló, si alguno. Callarlo haría que «no hay resultados»
    // y «la búsqueda está rota» se vieran igual, que es el error de diagnóstico más caro.
    degradado: {
      leyes: porNombre.status === 'rejected',
      contenido: porContenido.status === 'rejected',
    },
  })
}

export const GET = withErrorLogging('/api/v2/laws/search', _GET)
