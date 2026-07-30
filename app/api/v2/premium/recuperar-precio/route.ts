// app/api/v2/premium/recuperar-precio/route.ts — «recupera el precio que tenías» (T-341).
//
// Lo llama el botón del perfil de quien se quedó colgado al vaciar la cuenta de cobro
// antigua: deriva su tarifa anterior de su histórico en Stripe y le deja la oferta lista en
// la cuenta actual. Después, la página `/premium/personal` la enseña y la contrata.
//
// ## Por qué POST y no un GET perezoso
//
// Crea recursos (un price, un enlace de pago y una fila). Colgarlo del GET que ya lee las
// ofertas habría sido más cómodo —la página lo llama sola— pero entonces **escribir
// dependería de una lectura**: cualquier visita crearía ofertas, y una sesión de
// suplantación, que es de solo lectura y por tanto puede hacer GET, generaría ofertas de
// Stripe a nombre de la persona mirada sin que nadie lo pidiera. Eso es exactamente el
// fallo que se acaba de arreglar en los endpoints de pago (T-340); no se repite aquí.
//
// El `userId` sale del token. Nunca del cuerpo.
import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { asegurarOfertaHeredada } from '@/lib/api/premium/ofertaHeredada'
import { ETIQUETA_INTERVALO, formatearImporte, euroPorMes } from '@/lib/api/premium/ofertas'
import { emitFireAndForget } from '@/lib/observability/emit'

export const maxDuration = 30
export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/premium/recuperar-precio')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const resultado = await asegurarOfertaHeredada(auth.userId)

  if (!resultado.ok) {
    // No es un error: hay gente que sencillamente no tiene precio anterior que recuperar.
    // Se responde 200 con el motivo para que la interfaz mande a la tarifa normal en vez de
    // enseñar un fallo que no lo es.
    emitFireAndForget({
      source: 'vercel',
      severity: 'info',
      eventType: 'precio_heredado_no_procede',
      endpoint: '/api/v2/premium/recuperar-precio',
      userId: auth.userId,
      metadata: { motivo: resultado.motivo },
    })
    return NextResponse.json({ success: true, tieneOferta: false, motivo: resultado.motivo })
  }

  return NextResponse.json({
    success: true,
    tieneOferta: true,
    creada: resultado.creada,
    ofertas: resultado.ofertas.map((o) => ({
      priceId: o.stripePriceId,
      intervalo: o.intervalo,
      periodicidad: ETIQUETA_INTERVALO[o.intervalo],
      importe: formatearImporte(o.importeCentimos),
      importeCentimos: o.importeCentimos,
      euroPorMes: euroPorMes(o.importeCentimos, o.intervalo),
    })),
  })
}

export const POST = withErrorLogging('/api/v2/premium/recuperar-precio', _POST)
export { _POST }
