// lib/finance/auth.ts
// Dual-auth para endpoints financieros (/api/finance/transfers/*).
// Acepta:
//   - Cookie de sesión de /armando (rol 'armando'), O
//   - Bearer token de Supabase + role admin/super_admin
//
// Usado por /armando/page.tsx y /admin/cobros/page.tsx para llamar a las
// mismas APIs server-side con service_role.
//
// REFACTOR 2026-05-11: vía 2 (Bearer) delegada a verifyAuth (Fase 0.7).
// El check de admin sigue requiriendo client Supabase para llamar la
// RPC `is_current_user_admin` que opera contra auth.uid() del JWT.

import type { NextRequest } from 'next/server'
import { readSession } from '@/lib/armando/session'
import { verifyAuth } from '@/lib/api/auth/verifyAuth'
import { isAdminEmail } from '@/lib/auth/adminEmails'

export type FinanceCaller =
  | { kind: 'armando' }
  | { kind: 'admin'; userId: string }

export interface FinanceAuthResult {
  ok: boolean
  caller?: FinanceCaller
  status?: number
  error?: string
}

/**
 * Verifica el caller. Resultado:
 *   { ok: true, caller } si autenticado
 *   { ok: false, status, error } si no
 */
export async function authenticateFinanceRequest(req: NextRequest): Promise<FinanceAuthResult> {
  // Vía 1: cookie de armando
  const sess = readSession(req)
  if (sess) {
    return { ok: true, caller: { kind: 'armando' } }
  }

  // Vía 2: Bearer token + admin (wrapper verifyAuth Fase 0.7)
  const auth = await verifyAuth(req, '/lib/finance/auth')
  if (!auth.success) {
    return {
      ok: false,
      status: 401,
      error: auth.reason === 'no_bearer_token' ? 'No autenticado' : 'Token inválido',
    }
  }

  // Admin vía allowlist de email (agnóstico, del token verifyAuth). Sustituye a
  // la RPC is_current_user_admin (auth.uid(), no portable). Mismo gate que
  // requireAdmin en el resto de la API.
  if (!isAdminEmail(auth.email)) {
    return { ok: false, status: 403, error: 'Solo admins' }
  }

  return { ok: true, caller: { kind: 'admin', userId: auth.userId } }
}
