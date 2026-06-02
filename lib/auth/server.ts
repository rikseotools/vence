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

  async deleteUser(userId: string): Promise<{ error: Error | null }> {
    const { error } = await getServiceClient().auth.admin.deleteUser(userId)
    return { error: error ?? null }
  },
}
