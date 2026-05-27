// app/api/v2/admin/feedback/upload-image/route.ts
// Sube una imagen al storage de feedback. Reemplaza upload directo de
// Supabase Storage con service_role en cliente — usa el adapter agnóstico
// lib/storage (S3 en prod, Supabase Storage en legacy).
//
// Roadmap: docs/roadmap/agnosticismo-supabase.md — Fase 1 (mismo PR).

import { NextResponse, type NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/shared/auth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getStorage } from '@/lib/storage'

const BUCKET = 'feedback-images'
const MAX_BYTES = 8 * 1024 * 1024 // 8 MB

async function _POST(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (!auth.ok) return auth.response

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `Archivo demasiado grande (${file.size}b > ${MAX_BYTES}b)` },
      { status: 413 },
    )
  }

  const ext = file.name.split('.').pop() || 'bin'
  const path = `admin-chat-images/${Date.now()}-${Math.random().toString(36).substring(2)}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const storage = getStorage()
  const result = await storage.upload({
    bucket: BUCKET,
    path,
    data: buffer,
    contentType: file.type || 'application/octet-stream',
    cacheControl: '3600',
    upsert: true,
  })

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    publicUrl: result.publicUrl,
    path: result.path,
  })
}

export const POST = withErrorLogging('/api/v2/admin/feedback/upload-image', _POST as any)
