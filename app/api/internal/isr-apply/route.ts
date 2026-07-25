// app/api/internal/isr-apply/route.ts
//
// Aplica en ESTA instancia las purgas de ISR que el daemon
// (`lib/cache/isrPurgeWatcher`) ha visto en el registro compartido.
//
// Existe porque `revalidatePath()` exige el contexto de request de Next y no se
// puede llamar desde el callback de un timer. El daemon hace POST a
// `127.0.0.1:$PORT` — su propio proceso — y aquí sí hay contexto para purgar.
//
// ⚠️ NO REGISTRA la purga (a diferencia de /api/purge-cache, que es la puerta de
// entrada pública). Si lo hiciera, la purga que una instancia aplica dispararía la
// de todas las demás, y esas la de las siguientes: un bucle de invalidación que no
// para nunca. La regla es: SOLO el endpoint público escribe en el registro.
//
// No está pensado para llamarse desde fuera del contenedor (el daemon usa loopback),
// pero exige `x-cron-secret` igual que el resto de endpoints de operaciones, por si
// alguna vez queda expuesto a través del ALB.

import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

/** Tope defensivo por petición, alineado con el lote del daemon. */
const MAX_PATHS = 50

async function _POST(request: NextRequest) {
  if (request.headers.get('x-cron-secret') !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as { paths?: unknown } | null
  const paths = Array.isArray(body?.paths) ? body.paths : []
  const validas = paths
    .filter((p): p is string => typeof p === 'string' && p.startsWith('/'))
    .slice(0, MAX_PATHS)

  if (!validas.length) {
    return NextResponse.json({ error: 'paths requerido (rutas que empiecen por /)' }, { status: 400 })
  }

  for (const path of validas) revalidatePath(path)

  return NextResponse.json({
    success: true,
    revalidated: validas,
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/internal/isr-apply', _POST)
