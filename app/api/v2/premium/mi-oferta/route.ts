// app/api/v2/premium/mi-oferta/route.ts
// La oferta de precio personalizada del usuario AUTENTICADO (precio heredado).
//
// La consume `/premium/personal`, la página donde ve y contrata su precio dentro de
// Vence en vez de en un enlace de Stripe suelto que no dice a dónde lleva.
//
// El `userId` sale SIEMPRE del token, nunca del body: una oferta es de quien es.
//
// ## Por qué responde también a POST (30/07/2026)
//
// La página llamaba con POST sin querer: `apiFetch(url, body, options)` recibía las
// opciones —incluido `method: 'GET'`— en la posición del CUERPO, así que `options` quedaba
// `undefined` y se aplicaba el método por defecto. Se arregló en el cliente (`apiGet` y el
// tipo `CuerpoValido`, que impide volver a escribirlo así), pero eso solo vale para quien
// cargue la versión nueva: todo navegador que no recargue sigue ejecutando la anterior y
// seguirá mandando POST.
//
// Medido en `observable_events`: cuatro POST 405 de la misma usuaria entre las 04:50 y las
// 06:57 del 30/07, cada uno un intento de pagar que acabó en «no tienes precio activo».
//
// Por eso el método viejo se sigue atendiendo. Es una lectura autenticada e idempotente:
// no cuesta nada y evita que alguien se quede sin poder pagar por un despliegue que aún no
// ha alcanzado a su pestaña.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getOfertasActivas, ETIQUETA_INTERVALO, formatearImporte, euroPorMes } from '@/lib/api/premium/ofertas'

export const maxDuration = 15
export const dynamic = 'force-dynamic'

async function _handler(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/premium/mi-oferta')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const ofertas = await getOfertasActivas(auth.userId)
  if (!ofertas.length) {
    return NextResponse.json({ success: true, oferta: null, ofertas: [] })
  }

  const vista = (oferta: (typeof ofertas)[number]) => ({
    priceId: oferta.stripePriceId,
    intervalo: oferta.intervalo,
    periodicidad: ETIQUETA_INTERVALO[oferta.intervalo],
    importe: formatearImporte(oferta.importeCentimos),
    importeCentimos: oferta.importeCentimos,
    euroPorMes: euroPorMes(oferta.importeCentimos, oferta.intervalo),
    expiraEl: oferta.expiresAt ? oferta.expiresAt.toISOString() : null,
  })

  // `oferta` (singular) se mantiene para no romper a ningún cliente viejo.
  return NextResponse.json({ success: true, oferta: vista(ofertas[0]), ofertas: ofertas.map(vista) })
}

export const GET = withErrorLogging('/api/v2/premium/mi-oferta', _handler)
// Mismo handler: los clientes con la página cacheada de antes del 29/07 llaman con POST.
export const POST = withErrorLogging('/api/v2/premium/mi-oferta', _handler)
