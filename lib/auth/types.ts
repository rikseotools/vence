// lib/auth/types.ts — Puertos y tipos AGNÓSTICOS de Auth (ports & adapters).
// CERO dependencias de Supabase. Este es el contrato que cambiaría al migrar
// de proveedor (Supabase → Auth.js / Cognito / …). Ver docs/roadmap/agnosticismo-supabase.md (Fase 4).

/** Usuario normalizado. Solo los campos que la app realmente consume. */
export interface AuthUser {
  id: string
  email: string | null
  /** Metadata del proveedor OAuth. La app solo lee fullName/avatarUrl. */
  metadata?: {
    fullName?: string | null
    avatarUrl?: string | null
    [k: string]: unknown
  }
  /** Claims/objeto crudo del proveedor. SOLO depuración/casos límite — no usar en lógica. */
  raw?: unknown
}

/** Sesión normalizada. */
export interface AuthSession {
  user: AuthUser
  accessToken: string
  /** epoch en segundos, o null si el proveedor no lo expone. */
  expiresAt: number | null
  refreshToken?: string | null
  raw?: unknown
}

/** Evento de cambio de estado de auth, normalizado entre proveedores. */
export type AuthEvent =
  | 'INITIAL_SESSION'
  | 'SIGNED_IN'
  | 'SIGNED_OUT'
  | 'TOKEN_REFRESHED'
  | 'USER_UPDATED'
  | 'PASSWORD_RECOVERY'

export interface AuthChange {
  event: AuthEvent
  session: AuthSession | null
  /** true si el proveedor indicó que es un registro nuevo (no solo login). */
  isNewUser?: boolean
}

export type Unsubscribe = () => void

export interface SignInOptions {
  funnel?: string
}

export interface SignInResult {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Puerto CLIENTE (browser). Lo implementa un adapter por proveedor.
 * Superficie = exactamente lo que la app usa (no añadir métodos "por si acaso").
 */
export interface AuthClientPort {
  /** Sesión persistida (sin red, salvo que el proveedor lo requiera). */
  getSession(): Promise<AuthSession | null>
  /** Valida el usuario (puede hacer red). Usado antes de getSession en fix iOS/Android. */
  getUser(): Promise<AuthUser | null>
  /** Token válido para `Authorization: Bearer`. Implementa singleflight+cooldown. */
  getAccessToken(): Promise<string | undefined>
  /** Inicia OAuth Google (único proveedor social en uso). */
  signInWithGoogle(options?: SignInOptions): Promise<SignInResult>
  signOut(): Promise<void>
  refreshSession(): Promise<AuthSession | null>
  updateUser(attrs: Record<string, unknown>): Promise<AuthUser | null>
  /** Suscripción a cambios de auth con evento normalizado. Devuelve unsubscribe. */
  onAuthStateChange(cb: (change: AuthChange) => void): Unsubscribe
}
