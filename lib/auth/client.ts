// lib/auth/client.ts — Singleton del puerto de Auth CLIENTE (browser).
// Punto único agnóstico que consume la app: `import { auth } from '@/lib/auth'`.
// Para migrar de proveedor se cambia SOLO la fábrica de abajo.
//
// FLIP de Fase B = `NEXT_PUBLIC_AUTH_PROVIDER=authjs` (default 'supabase' →
// DORMIDO). Reversible en <5 min volviendo a 'supabase' (rollback de oro).
import { createSupabaseAuthAdapter } from './adapters/supabaseAdapter'
import { createAuthjsAuthAdapter } from './adapters/authjsAdapter'
import type { AuthClientPort } from './types'

let instance: AuthClientPort | null = null

/** Proveedor de auth activo. 'supabase' por defecto (dormido hasta el flip). */
function getProvider(): 'supabase' | 'authjs' {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === 'authjs' ? 'authjs' : 'supabase'
}

export function getAuthClient(): AuthClientPort {
  if (!instance) {
    // 👇 Único punto de acoplamiento al proveedor. Swap = aquí (por env, reversible).
    instance =
      getProvider() === 'authjs'
        ? createAuthjsAuthAdapter()
        : createSupabaseAuthAdapter()
  }
  return instance
}

/** Conveniencia: `import { auth } from '@/lib/auth'`. */
export const auth: AuthClientPort = getAuthClient()
