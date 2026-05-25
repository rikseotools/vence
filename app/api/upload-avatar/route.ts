// app/api/upload-avatar/route.ts
//
// Bloque 5 Fase A — sustituye el upload directo de avatares que
// `components/AvatarChanger.js` hacía contra `supabase.storage` desde el
// navegador (no agnóstico). Ahora el navegador POSTea aquí y el server
// usa el adapter `lib/storage` (provider 's3' | 'supabase').
//
// Seguridad: requiere Bearer token válido del usuario. Filename siempre
// incluye `user.id` para impedir colisiones y trazar autoría.

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getStorage } from '@/lib/storage'

const BUCKET = 'user-avatars'
const MAX_BYTES = 2 * 1024 * 1024 // 2 MB (mismo límite que el component viejo)

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/upload-avatar')
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
      { error: 'La imagen no debe superar los 2MB' },
      { status: 400 },
    )
  }

  const fileExt = (file.name.split('.').pop() ?? 'png').toLowerCase()
  const fileName = `${auth.userId}-${Date.now()}.${fileExt}`
  const filePath = `avatars/${fileName}`

  const storage = getStorage()
  const result = await storage.upload({
    bucket: BUCKET,
    path: filePath,
    data: await file.arrayBuffer(),
    contentType: file.type,
    cacheControl: '3600',
    upsert: true,
  })

  if (!result.success) {
    return NextResponse.json(
      { error: `Error subiendo avatar: ${result.error}` },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    url: result.publicUrl,
    path: filePath,
  })
}

export const POST = withErrorLogging('/api/upload-avatar', _POST)
