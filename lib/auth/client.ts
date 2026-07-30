// lib/auth/client.ts — Singleton del puerto de Auth CLIENTE (browser).
// Punto único agnóstico que consume la app: `import { auth } from '@/lib/auth'`.
// Para migrar de proveedor se cambia SOLO la fábrica de abajo.
//
// El FLIP de Fase B se hizo el 03/07/2026: producción corre con Auth.js
// (`NEXT_PUBLIC_AUTH_PROVIDER=authjs`, inyectado como build-arg en el workflow).
//
// ⚠️ El DEFAULT siguió en 'supabase' cuatro semanas después del flip, y eso no era una
// reserva prudente: significaba que **todo entorno que no pusiera la variable —local y
// previews— entraba por el proveedor LEGACY, el mismo que está congelado**. Es decir,
// desarrollábamos y probábamos contra una auth distinta de la que corre en producción; se
// vio el 30/07 al mirar por qué una sesión local hablaba con Supabase. Un default que
// apunta a un proveedor concreto tampoco es agnóstico: el puerto existe para que la app no
// sepa quién hay detrás, y el valor por defecto tiene que ser el que está VIVO.
//
// Ahora el default es 'authjs' = lo que corre en producción. Volver atrás sigue siendo un
// cambio de una variable (`NEXT_PUBLIC_AUTH_PROVIDER=supabase`), así que el rollback no se
// pierde — solo deja de ser el camino por omisión.
import { createSupabaseAuthAdapter } from './adapters/supabaseAdapter'
import { createAuthjsAuthAdapter } from './adapters/authjsAdapter'
import type { AuthClientPort } from './types'

let instance: AuthClientPort | null = null

/** Proveedor de auth activo. Por defecto el que corre en producción (Auth.js). */
function getProvider(): 'supabase' | 'authjs' {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === 'supabase' ? 'supabase' : 'authjs'
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
