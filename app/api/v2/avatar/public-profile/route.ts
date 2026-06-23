// app/api/v2/avatar/public-profile/route.ts
// Actualiza el avatar del usuario AUTENTICADO en public_user_profiles (la tabla que
// alimenta el ranking). Cubre los 3 flujos de AvatarChanger: predefinido (emoji),
// imagen subida y reset a por defecto — todos escriben las mismas 5 columnas.
//
// AGNÓSTICO (Fase C1): sustituye 3 supabase.from('public_user_profiles').update/upsert
// de cliente por un único UPDATE Drizzle. El id sale SIEMPRE del TOKEN.
//
// NOTA: UPDATE-only (no upsert) — display_name es NOT NULL en public_user_profiles,
// así que el insert del upsert original nunca podía crear una fila nueva; el registro
// ya existe (se crea con el alta del usuario). Fiel al único camino que funcionaba.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v3'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

const bodySchema = z.object({
  avatarType: z.string().max(50).nullable(),
  avatarUrl: z.string().max(2048).nullable(),
  avatarEmoji: z.string().max(50).nullable(),
  avatarColor: z.string().max(50).nullable(),
  avatarName: z.string().max(255).nullable(),
})

async function _POST(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/avatar/public-profile')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'invalid_payload' }, { status: 400 })
  }
  const b = parsed.data

  const res = await getAdminDb().execute(sql`
    UPDATE public_user_profiles
    SET avatar_type = ${b.avatarType},
        avatar_url = ${b.avatarUrl},
        avatar_emoji = ${b.avatarEmoji},
        avatar_color = ${b.avatarColor},
        avatar_name = ${b.avatarName},
        updated_at = now()
    WHERE id = ${auth.userId}::uuid
    RETURNING id
  `)
  const updated = (Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []).length > 0

  return NextResponse.json({ success: updated, updated })
}

export const POST = withErrorLogging('/api/v2/avatar/public-profile', _POST)
