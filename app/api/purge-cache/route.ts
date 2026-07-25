// app/api/purge-cache/route.ts
// Endpoint para invalidar cache ISR de páginas específicas.
// Uso: POST /api/purge-cache { "path": "/auxiliar-administrativo-cyl/test" }
//
// CROSS-INSTANCIA (26/07/2026): `revalidatePath()` solo purga el proceso que
// atiende esta petición. Con N tasks de Fargate, eso dejaba al resto sirviendo el
// HTML viejo hasta 24 h (medido: 1 de cada 6 peticiones servía lo nuevo tras una
// purga), y el remedio era repetir el POST 15-20 veces. Ahora, además de purgar
// aquí, se deja constancia en el registro compartido (`lib/cache/isrPurgeLog`):
// el daemon de cada instancia lo ve y se purga sola en ≤ un intervalo de sondeo.
//
// Esta es la ÚNICA puerta que escribe en el registro. El endpoint interno
// (/api/internal/isr-apply) solo aplica, para que no se realimente en bucle.
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { recordIsrPurge } from '@/lib/cache/isrPurgeLog'
import { emit } from '@/lib/observability/emit'

async function _POST(request: NextRequest) {
  const cronSecret = request.headers.get('x-cron-secret')
  if (cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { path } = await request.json()
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'path requerido' }, { status: 400 })
  }

  revalidatePath(path)

  // Best-effort: si el KV está caído, `broadcast` viene vacío y el comportamiento
  // degrada exactamente al de antes (purga local), nunca a algo peor.
  const broadcast = await recordIsrPurge([path])

  // OBSERVABILIDAD: una purga que no se registra degrada en SILENCIO a
  // per-instancia — el POST devuelve 200 y el operador cree que purgó la flota
  // entera mientras 7 de 8 tasks siguen sirviendo lo viejo. Es exactamente el tipo
  // de fallo que no queremos descubrir por un usuario. `warn` para que salte en
  // `/admin/salud-sistema` sin ser un 5xx.
  await emit({
    source: 'vercel',
    severity: broadcast.length ? 'info' : 'warn',
    eventType: 'isr_purge_broadcast',
    endpoint: '/api/purge-cache',
    errorMessage: broadcast.length ? undefined : `purga de ${path} NO registrada (KV inaccesible)`,
    metadata: { path, broadcast: broadcast.length > 0 },
  })

  return NextResponse.json({
    success: true,
    revalidated: path,
    broadcast: broadcast.length > 0,
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/purge-cache', _POST)
