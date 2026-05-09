import { NextRequest, NextResponse } from 'next/server'
import { getOposicion } from '@/lib/config/oposiciones'
import { compareTemariosCached } from '@/lib/api/oposiciones-compatibles/queries'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 30

async function _GET(request: NextRequest) {
  const a = request.nextUrl.searchParams.get('a')
  const b = request.nextUrl.searchParams.get('b')

  if (!a || !b) {
    return NextResponse.json(
      { success: false, error: 'Params a y b son obligatorios (slugs de oposiciones)' },
      { status: 400 }
    )
  }

  if (a === b) {
    return NextResponse.json(
      { success: false, error: 'Las dos oposiciones deben ser distintas' },
      { status: 400 }
    )
  }

  const configA = getOposicion(a)
  const configB = getOposicion(b)

  if (!configA) {
    return NextResponse.json({ success: false, error: `Oposición "${a}" no encontrada` }, { status: 404 })
  }
  if (!configB) {
    return NextResponse.json({ success: false, error: `Oposición "${b}" no encontrada` }, { status: 404 })
  }

  const comparison = await compareTemariosCached(configA.positionType, configB.positionType)

  return NextResponse.json({
    success: true,
    oposicionA: { slug: configA.slug, nombre: configA.name, shortName: configA.shortName, badge: configA.badge },
    oposicionB: { slug: configB.slug, nombre: configB.name, shortName: configB.shortName, badge: configB.badge },
    comparison,
  })
}

export const GET = withErrorLogging('/api/v2/comparar-temarios', _GET)
