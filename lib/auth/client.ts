// lib/auth/client.ts — Singleton del puerto de Auth CLIENTE (browser).
// Punto único agnóstico que consume la app: `import { auth } from '@/lib/auth'`.
// Para migrar de proveedor se cambia SOLO la fábrica de abajo.
import { createSupabaseAuthAdapter } from './adapters/supabaseAdapter'
import type { AuthClientPort } from './types'

let instance: AuthClientPort | null = null

export function getAuthClient(): AuthClientPort {
  if (!instance) {
    // 👇 Único punto de acoplamiento al proveedor. Swap = aquí.
    instance = createSupabaseAuthAdapter()
  }
  return instance
}

/** Conveniencia: `import { auth } from '@/lib/auth'`. */
export const auth: AuthClientPort = getAuthClient()
