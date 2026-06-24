// app/api/v2/user-public-profile/route.ts
// Perfil PÚBLICO de un usuario cualquiera para el UserProfileModal (se abre desde
// el ranking y desde mis-estadísticas). El viewer debe estar autenticado.
//
// AGNÓSTICO (Fase C1): sustituye 3 supabase.from de cliente por Drizzle.
//
// 🔒 PRIVACIDAD (replica la RLS existente, NO la rompe):
//   - public_user_profiles  → RLS `USING true` (público) → se expone a cualquier viewer.
//   - user_avatar_settings  → RLS "Anyone can view" (público) → se expone.
//   - tests                 → RLS `auth.uid() = user_id` (+admin) → SOLO se devuelven
//     si el viewer ES el dueño o es admin; para otros viewers, [] (igual que hoy).
//   ⚠️ getAdminDb() bypassa RLS, así que la restricción de `tests` se hace AQUÍ a
//   mano. Sin este gate, migrar filtraría los tests privados de cualquier usuario.
import { NextRequest, NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { isAdminEmail } from '@/lib/auth/adminEmails'
import { withErrorLogging } from '@/lib/api/withErrorLogging'
import { getAdminDb } from '@/db/client'

export const maxDuration = 15

function rowsOf(res: unknown): unknown[] {
  return Array.isArray(res) ? res : (res as { rows?: unknown[] }).rows || []
}

async function _GET(request: NextRequest): Promise<NextResponse> {
  const auth = await verifyAuth(request, '/api/v2/user-public-profile')
  if (!auth.success) {
    return NextResponse.json({ success: false, error: 'unauthorized' }, { status: auth.status })
  }

  const url = new URL(request.url)
  const targetUserId = url.searchParams.get('userId')
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: 'missing_userId' }, { status: 400 })
  }
  const todayStart = url.searchParams.get('todayStart')
  const todayEnd = url.searchParams.get('todayEnd')

  const db = getAdminDb()

  // Datos públicos (cualquier viewer authed).
  const profileRes = await db.execute(sql`
    SELECT display_name, ciudad, avatar_type, avatar_emoji, avatar_color, avatar_url
    FROM public_user_profiles WHERE id = ${targetUserId}::uuid LIMIT 1
  `)
  const avatarRes = await db.execute(sql`
    SELECT current_emoji, current_profile, mode
    FROM user_avatar_settings WHERE user_id = ${targetUserId}::uuid LIMIT 1
  `)

  // tests: SOLO el dueño o un admin (replica la RLS `auth.uid() = user_id` + admin).
  const canSeeTests = auth.userId === targetUserId || isAdminEmail(auth.email)
  let todayTests: unknown[] = []
  if (canSeeTests && todayStart && todayEnd) {
    const testsRes = await db.execute(sql`
      SELECT title, test_type, is_completed, score, total_questions
      FROM tests
      WHERE user_id = ${targetUserId}::uuid
        AND created_at >= ${todayStart}::timestamptz
        AND created_at < ${todayEnd}::timestamptz
    `)
    todayTests = rowsOf(testsRes)
  }

  return NextResponse.json({
    success: true,
    publicProfile: rowsOf(profileRes)[0] ?? null,
    avatarSettings: rowsOf(avatarRes)[0] ?? null,
    todayTests,
  })
}

export const GET = withErrorLogging('/api/v2/user-public-profile', _GET)
