// app/api/impersonacion/salir/route.ts — SALIR de una sesión suplantada (T-289).
//
// ## Por qué vive FUERA de `/api/admin/*`
//
// Entrar es un acto de administrador; **salir no**. Y no es un matiz: mientras dura la
// suplantación el token de la sesión es el del USUARIO, así que el guard de `/api/admin/*`
// —que exige token de admin— rechazaba la salida con 401. El botón «Salir» de la franja no
// funcionaba y quedabas dentro de la cuenta ajena hasta que caducara sola (30 min) o
// borraras las cookies a mano. Se descubrió probando el ciclo entero antes de desplegar.
//
// Aquí no hay comprobación de identidad a propósito: esto solo **borra las cookies de quien
// llama**. No lee datos, no toca la base y no puede afectar a otra persona; lo peor que
// consigue alguien invocándolo es cerrar su propia sesión.

import { NextResponse, type NextRequest } from 'next/server'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { sessionCookieNameFor } from '@/lib/sim/session'
import { MARCA_IMPERSONACION } from '@/lib/admin/impersonacion'
import { emitFireAndForget } from '@/lib/observability/emit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function _POST(request: NextRequest): Promise<NextResponse> {
  const host = (request.headers.get('host') || 'www.vence.es').split(':')[0]
  const cookieName = sessionCookieNameFor(host)

  emitFireAndForget({
    source: 'vercel',
    severity: 'info',
    eventType: 'impersonacion_terminada',
    endpoint: '/api/impersonacion/salir',
  })

  const respuesta = NextResponse.json({ ok: true })
  // La sesión suplantada y su marca se van juntas: dejar la marca haría que la franja
  // siguiera preguntando por una suplantación que ya no existe.
  respuesta.cookies.set(cookieName, '', { httpOnly: true, path: '/', maxAge: 0 })
  respuesta.cookies.set(MARCA_IMPERSONACION, '', { httpOnly: false, path: '/', maxAge: 0 })
  return respuesta
}

export const POST = withErrorLogging('/api/impersonacion/salir', _POST)
// DELETE hace lo mismo: da igual el verbo con el que lo llamen, salir tiene que funcionar.
export const DELETE = withErrorLogging('/api/impersonacion/salir#delete', _POST)
export { _POST }
