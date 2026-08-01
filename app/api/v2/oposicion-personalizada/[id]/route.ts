// app/api/v2/oposicion-personalizada/[id]/route.ts — cargar y actualizar UNA oposición. (T-327)
//
// La propiedad se comprueba SIEMPRE contra el token, y dentro de la propia consulta: estas
// oposiciones son públicas y elegibles por cualquiera, así que sin ese filtro cualquiera podría
// abrir —o peor, reescribir— el temario de otra persona.

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { emitFireAndForget } from '@/lib/observability/emit'
import { cargarOposicion, reemplazarTemario } from '@/lib/api/oposicionPersonalizada/consultas'
import type { TemarioEntrada } from '@/lib/api/oposicionPersonalizada/plan'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/oposicion-personalizada/[id]')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const { id } = await params
  if (!UUID.test(id)) {
    return NextResponse.json({ success: false, error: 'id_invalido' }, { status: 400 })
  }

  const temario = await cargarOposicion(auth.userId, id)
  // 404 tanto si no existe como si no es suya: distinguirlas le diría a cualquiera qué
  // oposiciones existen y de quién son.
  if (!temario) {
    return NextResponse.json({ success: false, error: 'no_encontrada' }, { status: 404 })
  }
  return NextResponse.json({ success: true, ...temario })
}

async function _PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/oposicion-personalizada/[id]')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }
  const { id } = await params
  if (!UUID.test(id)) {
    return NextResponse.json({ success: false, error: 'id_invalido' }, { status: 400 })
  }

  const cuerpo = (await request.json().catch(() => null)) as TemarioEntrada | null
  if (!cuerpo || typeof cuerpo !== 'object') {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }

  const res = await reemplazarTemario(auth.userId, id, cuerpo)

  if (!res.ok) {
    if (res.motivo === 'no_es_tuya') {
      return NextResponse.json({ success: false, error: 'no_encontrada' }, { status: 404 })
    }
    if (res.motivo === 'error_bd') {
      // Misma razón que al crear: editar un temario son muchos minutos y, si se pierde, esa
      // persona no vuelve. Sin señal, el fallo es invisible hasta que alguien escriba.
      emitFireAndForget({
        source: 'vercel',
        severity: 'error',
        eventType: 'oposicion_personalizada_no_guardada',
        endpoint: '/api/v2/oposicion-personalizada/[id]',
        metadata: { detalle: res.detalle ?? null, temas: cuerpo?.temas?.length ?? 0, edicion: true },
      })
      return NextResponse.json({ success: false, error: 'error_bd' }, { status: 500 })
    }
    return NextResponse.json({ success: false, errores: res.errores ?? [] }, { status: 400 })
  }

  emitFireAndForget({
    source: 'vercel',
    severity: 'info',
    eventType: 'oposicion_personalizada_editada',
    endpoint: '/api/v2/oposicion-personalizada/[id]',
    metadata: { temas: res.temas ?? 0 },
  })

  return NextResponse.json({ success: true, temas: res.temas })
}

export const GET = withErrorLogging('/api/v2/oposicion-personalizada/[id]', _GET)
export const PUT = withErrorLogging('/api/v2/oposicion-personalizada/[id]', _PUT)
