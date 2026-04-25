// app/api/v2/devices/route.ts
// GET: lista dispositivos del usuario autenticado
// DELETE: elimina un dispositivo del usuario autenticado

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { listUserDevices, removeUserDevice } from '@/lib/api/v2/devices/queries'
import { removeDeviceRequestSchema } from '@/lib/api/v2/devices/schemas'

// ── Auth helper (same pattern as answer-and-save) ──

async function getUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null

  const token = authHeader.split(' ')[1]
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}

// ── GET: listar dispositivos ──

async function _GET(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const devices = await listUserDevices(userId)
  return NextResponse.json({ success: true, devices })
}

// ── DELETE: eliminar un dispositivo ──

async function _DELETE(request: NextRequest) {
  const userId = await getUserId(request)
  if (!userId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body inválido' }, { status: 400 })
  }

  const parsed = removeDeviceRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 },
    )
  }

  const removed = await removeUserDevice(userId, parsed.data.deviceId)
  return NextResponse.json({ success: true, removed })
}

export const GET = withErrorLogging('/api/v2/devices', _GET)
export const DELETE = withErrorLogging('/api/v2/devices', _DELETE)
