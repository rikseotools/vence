// lib/auth/legacySupabaseStorage.ts
//
// El rastro de la sesión LEGACY de Supabase en `localStorage`: **una sola definición de cuál es
// y un solo modo de borrarlo**. [T-434]
//
// ── POR QUÉ EXISTE ESTE FICHERO ─────────────────────────────────────────────────────────────
//
// El criterio de «qué claves son la sesión legacy» estaba escrito **dos veces y distinto**:
//
//   · `lib/auth/adapters/authjsAdapter.ts` → `/^sb-.*-auth(-token)?$/`, que cubre también el
//     sufijo `-token` por defecto de supabase-js;
//   · `contexts/AuthContext.tsx` → `sb-${ref}-auth` compuesto a mano, que NO cubre el `-token`.
//
// Dos puertas al mismo recurso con criterios distintos no protegen el doble: se contradicen. Y
// aquí la contradicción tiene coste medido — el rastro que una rama no borra es el que resucita
// al usuario en la siguiente carga.
//
// ── LO QUE NUNCA SE BORRA, Y NO ES UN DETALLE ───────────────────────────────────────────────
//
// El `code_verifier` del intercambio PKCE vive en `sb-<ref>-auth-code-verifier`. La expresión
// termina en `$` justo para NO casarlo: borrarlo a mitad del callback de OAuth deja al usuario
// sin poder completar el login. Hay un test que lo fija.
//
// ── DÓNDE SE USA ────────────────────────────────────────────────────────────────────────────
//
//   · `signOut` del adapter Auth.js — si no se borra, el BRIDGE la relee y el usuario se
//     RE-LOGUEA solo tras cerrar sesión.
//   · `AuthContext` — al confirmarse que la sesión no existe, y al descubrir que el rastro
//     pre-hidratado es de OTRA identidad (`decidirIdentidadAjena`).

/**
 * Claves de la sesión Supabase legacy. La app usa un storageKey PERSONALIZADO `sb-<ref>-auth`
 * (sin sufijo, ver `lib/supabase.ts`); se acepta también el `-token` por defecto de supabase-js.
 * **No casa** `-code-verifier` (PKCE) a propósito.
 */
export const LEGACY_SB_KEY_RE = /^sb-.*-auth(-token)?$/

/**
 * ¿Esta clave de `localStorage` es la sesión legacy (y por tanto se puede borrar)?
 *
 * Es un *type predicate* a propósito: quien recorre `localStorage.key(i)` recibe `string | null`,
 * y sin el estrechamiento cada llamante acabaría poniendo su propio `if (!k) continue` — que es
 * exactamente cómo un criterio compartido se vuelve a fragmentar.
 */
export function esClaveSesionLegacy(clave: string | null | undefined): clave is string {
  return typeof clave === 'string' && LEGACY_SB_KEY_RE.test(clave)
}

/** Lo único que se lee del rastro legacy: quién dice ser. Nunca sus tokens. */
export interface UsuarioLegacy {
  id: string
  email?: string | null
  [k: string]: unknown
}

/**
 * Lee el usuario del rastro legacy, si lo hay. Mismo criterio de clave que el borrado —eran dos
 * y el lector componía `sb-<ref>-auth` a mano, así que **leía una clave que el borrado de otra
 * rama no limpiaba**. Devuelve `null` ante cualquier duda (sin `localStorage`, JSON roto, sin id).
 */
export function readLegacySupabaseUser(): UsuarioLegacy | null {
  if (typeof window === 'undefined') return null
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (!esClaveSesionLegacy(k)) continue
      const raw = window.localStorage.getItem(k)
      if (!raw) continue
      const parsed = JSON.parse(raw) as { user?: UsuarioLegacy }
      if (parsed?.user?.id) return parsed.user
    }
    return null
  } catch {
    return null
  }
}

/**
 * Borra la sesión Supabase legacy de `localStorage`. Idempotente y defensivo: recolecta las
 * claves ANTES de borrar, para no saltarse índices al mutar `localStorage` mientras se recorre.
 * Devuelve las claves borradas (útil para la traza; nunca su contenido, que lleva tokens).
 */
export function clearLegacySupabaseSession(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const claves: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (esClaveSesionLegacy(k)) claves.push(k)
    }
    claves.forEach((k) => window.localStorage.removeItem(k))
    return claves
  } catch {
    // localStorage inaccesible (Safari privado, cuota, cookies bloqueadas) → nada que limpiar.
    return []
  }
}
