// app/api/admin/revalidate-temario/route.ts
// Invalida la cache del temario. Se dispara:
// 1. Manualmente: POST sin body
// 2. Automáticamente: Supabase Database Webhook (topics, oposicion_bloques, topic_scope)
//
// El webhook de Supabase envía un payload con { type, table, record, old_record }.
// Verificamos con SUPABASE_WEBHOOK_SECRET para evitar llamadas no autorizadas.

import { NextRequest, NextResponse } from 'next/server'
import { revalidateTag } from 'next/cache'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET

async function _POST(request: NextRequest) {
  // Si viene con body (webhook de Supabase), verificar secret
  const authHeader = request.headers.get('x-webhook-secret') || request.headers.get('authorization')
  const contentType = request.headers.get('content-type') || ''
  const isWebhook = contentType.includes('application/json')

  if (isWebhook && WEBHOOK_SECRET) {
    const secret = authHeader?.replace('Bearer ', '')
    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  // Next.js 16 requiere segundo argumento con el profile de cacheLife
  revalidateTag('temario', 'max')

  // También revalidar landings (oposiciones usan datos de BD)
  revalidateTag('landing', 'max')

  return NextResponse.json({
    success: true,
    message: 'Cache temario + landing invalidada.',
    timestamp: new Date().toISOString(),
  })
}

export const POST = withErrorLogging('/api/admin/revalidate-temario', _POST)
