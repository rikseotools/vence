// app/api/v2/oposicion-personalizada/route.ts — guardar tu propio temario. (T-327)
//
// El `userId` sale SIEMPRE del token, nunca del cuerpo: quien manda la petición no decide de
// quién es la oposición. Es la misma regla que ya siguen las preguntas guardadas.

import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'
import { emitFireAndForget } from '@/lib/observability/emit'
import { guardarOposicionPersonalizada } from '@/lib/api/oposicionPersonalizada/guardar'
import type { TemarioEntrada } from '@/lib/api/oposicionPersonalizada/plan'

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/oposicion-personalizada')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const cuerpo = (await request.json().catch(() => null)) as TemarioEntrada | null
  if (!cuerpo || typeof cuerpo !== 'object') {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  // El nombre público del autor se compone en el SERVIDOR con lo que hay en la BD. Si viniera del
  // cliente, cualquiera podría publicar una oposición firmada con el nombre de otra persona.
  let autor: string | null = null
  try {
    const r = (await getAdminDb().execute(sql`
      SELECT coalesce(nickname, full_name) AS nombre FROM user_profiles WHERE id = ${auth.userId}::uuid LIMIT 1
    `)) as unknown as Array<{ nombre: string | null }>
    autor = r[0]?.nombre ?? null
  } catch {
    // Sin autor la oposición se guarda igual y sale sin el «by …». Perder la firma es molesto;
    // perder el temario que el usuario acaba de construir, no.
    autor = null
  }

  const res = await guardarOposicionPersonalizada(auth.userId, cuerpo, autor)

  if (!res.ok) {
    if (res.motivo === 'error_bd') {
      // Se emite porque, si esto falla, el usuario pierde un trabajo largo (armar un temario son
      // muchos minutos) y sin señal no nos enteraríamos hasta que alguien escriba.
      emitFireAndForget({
        source: 'vercel',
        severity: 'error',
        eventType: 'oposicion_personalizada_no_guardada',
        endpoint: '/api/v2/oposicion-personalizada',
        metadata: { detalle: res.detalle ?? null, temas: cuerpo?.temas?.length ?? 0 },
      })
      return NextResponse.json({ success: false, error: 'error_bd' }, { status: 500 })
    }
    return NextResponse.json({ success: false, errores: res.errores ?? [] }, { status: 400 })
  }

  emitFireAndForget({
    source: 'vercel',
    severity: 'info',
    eventType: 'oposicion_personalizada_creada',
    endpoint: '/api/v2/oposicion-personalizada',
    metadata: { temas: res.temas ?? 0, positionType: res.positionType ?? null },
  })

  return NextResponse.json({
    success: true,
    id: res.id,
    positionType: res.positionType,
    nombre: res.nombre,
    temas: res.temas,
  })
}

export const POST = withErrorLogging('/api/v2/oposicion-personalizada', _POST)

// ── Listar LAS MÍAS ─────────────────────────────────────────────────────────────────────────
//
// Alimenta la tira de «tus oposiciones» del creador. Va en el MISMO fichero que el POST porque es
// el mismo recurso: separar el listado en otra ruta duplicaría la resolución de identidad y el
// día que cambie una, la otra se queda atrás.
async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/oposicion-personalizada')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const { misOposiciones } = await import('@/lib/api/oposicionPersonalizada/consultas')
  return NextResponse.json({ success: true, oposiciones: await misOposiciones(auth.userId) })
}

export const GET = withErrorLogging('/api/v2/oposicion-personalizada', _GET)
