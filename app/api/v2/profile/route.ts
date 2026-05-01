// app/api/v2/profile/route.ts
// Carga el perfil del usuario autenticado via Drizzle (no PostgREST).
// AuthContext usa este endpoint en vez de supabase.from('user_profiles')
// para evitar deadlocks con token refresh del SDK de Supabase.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getDb } from '@/db/client'
import { userProfiles } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { withErrorLogging } from '@/lib/api/withErrorLogging'

export const maxDuration = 10

async function _GET(request: NextRequest) {
  // Auth: verificar Bearer token
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const token = authHeader.split(' ')[1]
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Usuario no autenticado' }, { status: 401 })
  }

  // Cargar perfil via Drizzle (directo a PostgreSQL, sin PostgREST)
  const db = getDb()
  const [profile] = await db
    .select()
    .from(userProfiles)
    .where(eq(userProfiles.id, user.id))
    .limit(1)

  if (!profile) {
    return NextResponse.json({ profile: null })
  }

  return NextResponse.json({ profile })
}

export const GET = withErrorLogging('/api/v2/profile', _GET)
