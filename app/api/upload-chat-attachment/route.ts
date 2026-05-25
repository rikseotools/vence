// app/api/upload-chat-attachment/route.ts
//
// Bloque 5 Fase A — sustituye el upload directo de adjuntos de chat que
// `components/ChatInterface.js` hacía contra `supabase.storage` desde el
// navegador. Server-side ahora pasa por el adapter `lib/storage`.
//
// Seguridad: requiere Bearer token válido. DELETE solo permite borrar paths
// dentro de `chat-images/` (el prefijo donde se sube — un usuario malicioso
// no puede usar este endpoint para borrar avatares).

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getStorage } from '@/lib/storage'

const BUCKET = 'support'
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const ALLOWED_PREFIX = 'chat-images/'

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/upload-chat-attachment')
  if (!auth.success) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }

  const formData = await request.formData().catch(() => null)
  const file = formData?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json(
      { error: 'Solo se permiten archivos de imagen' },
      { status: 400 },
    )
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: 'La imagen no puede ser mayor a 5MB' },
      { status: 400 },
    )
  }

  const fileExt = (file.name.split('.').pop() ?? 'png').toLowerCase()
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`
  const filePath = `${ALLOWED_PREFIX}${fileName}`

  const storage = getStorage()
  const result = await storage.upload({
    bucket: BUCKET,
    path: filePath,
    data: await file.arrayBuffer(),
    contentType: file.type,
    cacheControl: '3600',
  })

  if (!result.success) {
    return NextResponse.json(
      { error: `Error subiendo imagen: ${result.error}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    url: result.publicUrl,
    path: filePath,
    name: file.name,
  })
}

async function _DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/upload-chat-attachment')
  if (!auth.success) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status })
  }

  const { searchParams } = new URL(request.url)
  const path = searchParams.get('path')
  if (!path) {
    return NextResponse.json({ error: 'Path requerido' }, { status: 400 })
  }

  // Restringir al prefijo permitido: impide borrar objetos de otros usos.
  if (!path.startsWith(ALLOWED_PREFIX)) {
    return NextResponse.json(
      { error: 'Path fuera del scope permitido' },
      { status: 400 },
    )
  }

  const result = await getStorage().remove({ bucket: BUCKET, paths: [path] })
  if (!result.success) {
    return NextResponse.json(
      { error: `Error eliminando: ${result.error}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true })
}

export const POST = withErrorLogging('/api/upload-chat-attachment', _POST)
export const DELETE = withErrorLogging('/api/upload-chat-attachment', _DELETE)
