// app/api/v2/premium/mi-oferta/route.ts
// La oferta de precio personalizada del usuario AUTENTICADO (precio heredado).
//
// La consume `/premium/personal`, la página donde ve y contrata su precio dentro de
// Vence en vez de en un enlace de Stripe suelto que no dice a dónde lleva.
//
// El `userId` sale SIEMPRE del token, nunca del body: una oferta es de quien es.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getOfertasActivas, ETIQUETA_INTERVALO, formatearImporte, euroPorMes } from '@/lib/api/premium/ofertas'

export const maxDuration = 15
export const dynamic = 'force-dynamic'

async function _GET(request: NextRequest): Promise<NextResponse> {
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

export const GET = withErrorLogging('/api/v2/premium/mi-oferta', _GET)
