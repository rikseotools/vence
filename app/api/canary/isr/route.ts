// app/api/canary/isr/route.ts
//
// FIXTURE del canary de purga ISR cross-instancia. No sirve a usuarios: existe
// para que el canary pueda MEDIR el invariante en infra viva en vez de suponerlo.
//
// Es una ruta ISR de verdad (`force-static` + `revalidate: false`), así que cada
// instancia guarda su propia copia y solo se regenera cuando algo la purga —
// exactamente el comportamiento de las landings. Devuelve:
//   · renderedAt — cuándo generó ESTA copia (si tras purgar sigue siendo la de
//     antes, esa instancia NO se enteró de la purga)
//   · instance   — qué task respondió, para medir a cuántas se ha llegado
//
// Sin un fixture así el canary sería ciego: las landings reales no exponen cuándo
// se renderizaron, y un 200 no distingue "servido de nuevo" de "servido rancio",
// que es justo el fallo que se quiere cazar.

import { NextResponse } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { INSTANCE_ID } from '@/lib/observability/instanceId'

export const dynamic = 'force-static'
export const revalidate = false

// El id de instancia sale del helper compartido con la observabilidad: en Fargate
// `hostname#pid` es idéntico en las 8 tasks (0.0.0.0 y pid 1) y no distinguía nada.
// (En la copia prerenderizada en build todas comparten el del builder, que es justo
// el estado inicial que el canary espera ver.)

async function _GET() {
  return NextResponse.json({
    canary: 'isr-cross-instance',
    renderedAt: new Date().toISOString(),
    instance: INSTANCE_ID,
  })
}

// Con wrapper como el resto de endpoints (lo exige el guardarraíl de cobertura de
// `withErrorLogging`, que cazó este fichero al añadirlo).
export const GET = withErrorLogging('/api/canary/isr', _GET)
