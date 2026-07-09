// lib/auth/server.ts — Puerto de Auth SERVIDOR (runtime Node, service_role / Bearer).
// Fachada DELGADA sobre la capa server-side ya agnóstica (no reimplementa nada):
//   - verifyAuth/verifyJwtLocal: verificación de JWT con modos off/shadow/on.
//   - shared/auth: getAuthenticatedUser/requireAdmin/getServiceClient (27+ callers).
// NO se importa desde el bundle del navegador (usa next/server + service_role).
import { getServiceClient } from '@/lib/api/shared/auth'

export {
  getAuthenticatedUser,
  getAuthenticatedUserWithOposicion,
  requireAdmin,
  isAdminEmail,
  getServiceClient,
  type AuthResult,
  type AdminResult,
  type AuthWithOposicionResult,
} from '@/lib/api/shared/auth'

export { verifyAuth } from '@/lib/api/auth/verifyAuth'

/** Verified admin user (id, email) — shape mínimo agnóstico. */
export interface AdminAuthUser {
  id: string
  email: string | null
}

/**
 * Operaciones admin de Auth (service_role). Único punto que toca
 * `getServiceClient().auth.admin.*` — al migrar de proveedor se reescribe aquí.
 */
export const authAdmin = {
  async getUserById(userId: string): Promise<AdminAuthUser | null> {
    const { data, error } = await getServiceClient().auth.admin.getUserById(userId)
    if (error || !data?.user) return null
    return { id: data.user.id, email: data.user.email ?? null }
  },

  /**
   * Revoca la identidad en el store de auth LEGACY (Supabase GoTrue).
   *
   * Tras el flip a Auth.js (Fase B), el SSOT de la cuenta es `user_profiles`
   * (RDS, indexado por email); los usuarios NUEVOS no tienen fila GoTrue. Por eso
   * hay que distinguir 3 desenlaces, no un booleano:
   *   - 'deleted'      → existía en el store legacy y se borró.
   *   - 'not_present'  → no existe en el store legacy (usuario post-flip o ya
   *                      ausente). NO es fallo: no hay nada que revocar aquí →
   *                      idempotente. El caller NO debe tratarlo como error.
   *   - 'error'        → fallo REAL (red, permisos): el registro legacy podría
   *                      seguir vivo → el caller lo marca crítico.
   */
  async deleteUser(
    userId: string,
  ): Promise<{ outcome: 'deleted' | 'not_present' | 'error'; error: Error | null }> {
    const { error } = await getServiceClient().auth.admin.deleteUser(userId)
    if (!error) return { outcome: 'deleted', error: null }
    // SOLO señales ESTRUCTURADAS de "no existe" cuentan como not_present. Un match
    // por substring del message ('not found') sería laxo: un fallo REAL (5xx de
    // gateway, permisos, DNS) cuyo texto contenga "not found" se clasificaría como
    // benigno y ocultaría una fila de auth legacy VIVA (PII + credencial de login)
    // → brecha RGPD. Ante la duda: 'error' (el caller lo marca crítico → 500).
    const status = (error as { status?: number }).status
    const code = (error as { code?: string }).code
    if (status === 404 || code === 'user_not_found') {
      return { outcome: 'not_present', error: null }
    }
    return { outcome: 'error', error }
  },
}
