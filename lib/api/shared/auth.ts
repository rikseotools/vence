// lib/api/shared/auth.ts
// Centraliza el patrón de autenticación duplicado en 30+ rutas API.
// Nada lo importa aún — se usará en futuras migraciones.

import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

// ============================================
// Tipos
// ============================================

export type AuthResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

export type AdminResult =
  | { ok: true; user: User; supabase: SupabaseClient }
  | { ok: false; response: NextResponse }

// ============================================
// Service client (bypass RLS)
// ============================================

export function getServiceClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ============================================
// Autenticación de usuario via Bearer token
// ============================================

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      ),
    }
  }

  const token = authHeader.slice(7)
  const supabase = getServiceClient()

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token)

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Usuario no autenticado' },
        { status: 401 }
      ),
    }
  }

  return { ok: true, user, supabase }
}

// ============================================
// Verificación de admin (email whitelist)
// ============================================

const ADMIN_EMAILS = [
  'admin@vencemitfg.es',
  'manuel@vencemitfg.es',
  'manueltrader@gmail.com',
]

function isAdminEmail(email: string | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email) || email.endsWith('@vencemitfg.es')
}

export async function requireAdmin(
  request: NextRequest
): Promise<AdminResult> {
  const auth = await getAuthenticatedUser(request)
  if (!auth.ok) return auth

  if (!isAdminEmail(auth.user.email)) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      ),
    }
  }

  return auth
}
