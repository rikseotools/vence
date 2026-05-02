// lib/finance/auth.ts
// Dual-auth para endpoints financieros (/api/finance/transfers/*).
// Acepta:
//   - Cookie de sesión de /armando (rol 'armando'), O
//   - Bearer token de Supabase + role admin/super_admin
//
// Usado por /armando/page.tsx y /admin/cobros/page.tsx para llamar a las
// mismas APIs server-side con service_role.

import { createClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import { readSession } from '@/lib/armando/session'

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

  // Vía 2: Bearer token + admin
  const authHeader = req.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'No autenticado' }
  }
  const token = authHeader.slice('Bearer '.length)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anon) {
    return { ok: false, status: 500, error: 'Supabase no configurado' }
  }
  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Token inválido' }
  }

  const { data: isAdmin, error: roleError } = await supabase.rpc('is_current_user_admin')
  if (roleError) {
    console.error('[finance/auth] role check error:', roleError)
    return { ok: false, status: 500, error: 'Error verificando permisos' }
  }
  if (isAdmin !== true) {
    return { ok: false, status: 403, error: 'Solo admins' }
  }

  return { ok: true, caller: { kind: 'admin', userId: user.id } }
}
