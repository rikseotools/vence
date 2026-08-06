// app/api/v2/test-config/estimate/route.ts
// GET /api/v2/test-config/estimate?topicNumber=1&positionType=auxiliar_administrativo&...
import { NextRequest, NextResponse } from 'next/server'
import { safeParseEstimateQuestions, estimateAvailableQuestionsCached } from '@/lib/api/test-config'
import { shouldRouteToBackend, backendUrlFor } from '@/lib/api/backend-router'

import { withErrorLogging } from '@/lib/api/withErrorLogging'
async function _GET(request: NextRequest) {
  try {
    // ─── Bloque 3 canary: proxy condicional al backend NestJS/Fargate ──
    // estimate tiene params complejos JSON — los reenviamos via search string
    // tal cual; backend hace su propio parse equivalente.
    if (shouldRouteToBackend('test-config')) {
      try {
        const { search } = new URL(request.url)
        const backendUrl = backendUrlFor(`api/v2/test-config/estimate${search}`)
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000) // 8s — estimate puede ser lento
        try {
          const backendRes = await fetch(backendUrl, {
            signal: controller.signal,
            headers: { 'x-forwarded-by': 'vercel-proxy' },
          })
          clearTimeout(timer)
          const body = await backendRes.text()
          return new NextResponse(body, {
            status: backendRes.status,
            headers: {
              'Content-Type': backendRes.headers.get('content-type') ?? 'application/json',
              'x-served-by': backendRes.headers.get('x-served-by') ?? 'vence-backend-proxy',
            },
          })
        } finally {
          clearTimeout(timer)
        }
      } catch (backendError) {
        console.warn(
          `⚠️ [test-config/estimate proxy] backend canary falló (${(backendError as Error).message ?? 'unknown'}), fallback Vercel local`,
        )
      }
    }

    const { searchParams } = new URL(request.url)

    // Parsear JSON de parámetros complejos
    let selectedArticlesByLaw = {}
    let selectedSectionFilters: unknown[] = []

    try {
      const sabParam = searchParams.get('selectedArticlesByLaw')
      if (sabParam) selectedArticlesByLaw = JSON.parse(sabParam)
    } catch { /* ignorar JSON inválido */ }

    try {
      const ssfParam = searchParams.get('selectedSectionFilters')
      if (ssfParam) selectedSectionFilters = JSON.parse(ssfParam)
    } catch { /* ignorar JSON inválido */ }

    const rawData = {
      topicNumber: searchParams.get('topicNumber') ? Number(searchParams.get('topicNumber')) : null,
      positionType: searchParams.get('positionType') || undefined,
      selectedLaws: (() => {
        const all = searchParams.getAll('selectedLaws')
        if (all.length > 1) return all // Multiple repeated params: ?selectedLaws=CE&selectedLaws=LO
        if (all.length === 1) return all[0].split(',') // Single comma-separated: ?selectedLaws=CE,LO
        return []
      })(),
      selectedArticlesByLaw,
      selectedSectionFilters,
      onlyOfficialQuestions: searchParams.get('onlyOfficialQuestions') === 'true',
      difficultyMode: searchParams.get('difficultyMode') || 'random',
      focusEssentialArticles: searchParams.get('focusEssentialArticles') === 'true',
      // Modo "por leyes" acotado a la oposición del usuario (sin topicNumber): sin esto
      // el conteo sería el de la ley entera y no el de su temario — T-326.
      scopeToPosition: searchParams.get('scopeToPosition') === 'true',
    }

    // Mismo cuerpo que el POST: validar y contar viven en un solo sitio (T-623).
    return responder(rawData)
  } catch (error) {
    console.error('❌ [API/v2/test-config/estimate] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}

// ── POST: la MISMA cuenta, para selecciones que no caben en una URL (T-623, 06/08/2026) ──
//
// `selectedArticlesByLaw` viaja como JSON y en GET eso va dentro de la URL; al url-encodificar
// se triplica. Medido contra producción: 7.514 bytes → 200, 8.914 → **414**, 41.114 → **494**
// (los 8 KB de `large_client_header_buffers` de nginx). nginx responde con una PÁGINA HTML, el
// cliente hace `res.json()` sobre ella y revienta con «Unexpected token '<'»; el `catch` no
// repinta nada y la pantalla se queda igual — el usuario lo vive como que la app se ha colgado.
// Lo reportó una usuaria, no una alerta: 87 respuestas 494 a 12 usuarios en 48 h.
//
// El GET NO se retira: hay clientes desplegados que lo usan y para una selección pequeña es
// correcto. Los dos caminos comparten el MISMO cuerpo (`responder`), porque servir las
// peticiones grandes con un código distinto del de las pequeñas serían dos fuentes de verdad
// para el mismo número — el modo de fallo que esta familia ya pagó tres veces (T-326, T-551 y
// el re-arreglo de T-551, que se aplicó otra vez solo al gemelo del frontend).
async function _POST(request: NextRequest) {
  try {
    let body: Record<string, unknown> = {}
    try {
      body = (await request.json()) as Record<string, unknown>
    } catch {
      return NextResponse.json(
        { success: false, error: 'Cuerpo JSON inválido' },
        { status: 400 },
      )
    }

    // Camino canary: al backend, también por POST — el cuerpo no tiene el techo de la URL, así
    // que la petición grande sobrevive el salto entero y no solo el primero.
    if (shouldRouteToBackend('test-config')) {
      try {
        const backendUrl = backendUrlFor('api/v2/test-config/estimate')
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), 8000)
        try {
          const backendRes = await fetch(backendUrl, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'x-forwarded-by': 'vercel-proxy' },
            body: JSON.stringify(body),
          })
          clearTimeout(timer)
          // ── SI EL BACKEND NO CONOCE EL VERBO, SE CUENTA AQUÍ ────────────────────────
          // Frontend y backend se despliegan por separado, así que SIEMPRE hay una ventana en
          // la que uno tiene el POST y el otro no. Medido en vivo el 06/08: con el frontend ya
          // desplegado y el backend aún en cola, este proxy devolvía el **404 del backend tal
          // cual** — y entonces el configurador dejaba de contar para TODAS las selecciones, no
          // solo las grandes. O sea: el arreglo, a medio desplegar, era peor que el defecto.
          //
          // El `catch` de abajo no cubría esto porque un 404 NO lanza: es una respuesta válida.
          // Aquí se trata como lo que es —«este backend todavía no sabe hacer esto»— y se cae al
          // camino local, que sabe. Solo para 404/405: un 500 del backend SÍ debe verse, porque
          // significa que sabe hacerlo y le ha salido mal, y taparlo escondería una avería real.
          if (backendRes.status === 404 || backendRes.status === 405) {
            console.warn(
              `⚠️ [test-config/estimate POST] el backend no conoce el verbo (${backendRes.status}) — ` +
              'se cuenta en local. Normal durante el despliegue de las dos superficies [T-623].',
            )
            return responder(body)
          }
          const texto = await backendRes.text()
          return new NextResponse(texto, {
            status: backendRes.status,
            headers: {
              'Content-Type': backendRes.headers.get('content-type') ?? 'application/json',
              'x-served-by': backendRes.headers.get('x-served-by') ?? 'vence-backend-proxy',
            },
          })
        } finally {
          clearTimeout(timer)
        }
      } catch (backendError) {
        console.warn(
          `⚠️ [test-config/estimate proxy POST] backend canary falló (${(backendError as Error).message ?? 'unknown'}), fallback Vercel local`,
        )
      }
    }

    return responder(body)
  } catch (error) {
    console.error('❌ [API/v2/test-config/estimate POST] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 },
    )
  }
}

/**
 * El cuerpo compartido por GET y POST: validar y contar. Un solo sitio (T-623).
 */
async function responder(rawData: Record<string, unknown>) {
  const parseResult = safeParseEstimateQuestions(rawData)
  if (!parseResult.success) {
    return NextResponse.json({
      success: false,
      error: 'Parámetros inválidos',
      details: parseResult.error.issues,
    }, { status: 400 })
  }
  const result = await estimateAvailableQuestionsCached(parseResult.data)
  return NextResponse.json(result, { status: result.success ? 200 : 500 })
}

export const GET = withErrorLogging('/api/v2/test-config/estimate', _GET)
export const POST = withErrorLogging('/api/v2/test-config/estimate', _POST)
