// app/api/v2/admin/feedback/delete-image/route.ts
// Borra una imagen del storage. Reemplaza delete directo de Supabase
// Storage con service_role en cliente.
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1 (mismo PR).

import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod/v3'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getStorage } from '@/lib/storage'

const bodySchema = z.object({
  imagePath: z.string().min(1).max(500),
})

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Body inválido: requiere imagePath' }, { status: 400 })
  }

  const storage = getStorage()
  const result = await storage.remove({
    bucket: 'feedback-images',
    paths: [parsed.data.imagePath],
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/delete-image', _POST as any)
