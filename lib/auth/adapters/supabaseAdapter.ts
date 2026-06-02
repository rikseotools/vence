// lib/auth/adapters/supabaseAdapter.ts — Adapter de Supabase para el AuthClientPort.
// ENVUELVE el singleton existente getSupabaseClient() (lib/supabase.ts) — que sigue
// siendo la única fuente del cliente (PKCE, persistSession, listeners tab-sync/visibility,
// eventos custom, fixes iOS/Android). Aquí solo se traduce su superficie auth a tipos
// agnósticos. Cambiar de proveedor = escribir otro adapter y cambiar la fábrica en client.ts.
import { getSupabaseClient, signInWithGoogle as supabaseSignInWithGoogle } from '@/lib/supabase'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import type {
  AuthChange,
  AuthClientPort,
  AuthEvent,
  AuthSession,
  AuthUser,
  SignInOptions,
} from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawUser = any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawSession = any

function mapUser(u: RawUser): AuthUser | null {
  if (!u) return null
  return {
    id: u.id,
    email: u.email ?? null,
    metadata: {
      fullName: u.user_metadata?.full_name ?? null,
      avatarUrl: u.user_metadata?.avatar_url ?? null,
    },
    raw: u,
  }
}

function mapSession(s: RawSession): AuthSession | null {
  if (!s) return null
  const user = mapUser(s.user)
  if (!user) return null
  return {
    user,
    accessToken: s.access_token,
    expiresAt: s.expires_at ?? null,
    refreshToken: s.refresh_token ?? null,
    raw: s,
  }
}

// Mapea el zoo de eventos de Supabase a los eventos normalizados del port.
// SIGNED_UP (si el proveedor lo emitiera) colapsa a SIGNED_IN + isNewUser=true.
const EVENT_MAP: Record<string, AuthEvent | undefined> = {
  INITIAL_SESSION: 'INITIAL_SESSION',
  SIGNED_IN: 'SIGNED_IN',
  SIGNED_UP: 'SIGNED_IN',
  SIGNED_OUT: 'SIGNED_OUT',
  TOKEN_REFRESHED: 'TOKEN_REFRESHED',
  USER_UPDATED: 'USER_UPDATED',
  PASSWORD_RECOVERY: 'PASSWORD_RECOVERY',
}

export function createSupabaseAuthAdapter(): AuthClientPort {
  // Acceso perezoso al singleton: no se instancia en import-time (client-only).
  const sb = () => getSupabaseClient()

  return {
    async getSession() {
      const { data } = await sb().auth.getSession()
      return mapSession(data.session)
    },

    async getUser() {
      const { data } = await sb().auth.getUser()
      return mapUser(data.user)
    },

    async getAccessToken() {
      // Delega en getAuthHeaders() — conserva el singleflight + cooldown 30s anti-429.
      const headers = await getAuthHeaders()
      const authz = headers['Authorization']
      return authz?.startsWith('Bearer ') ? authz.slice('Bearer '.length) : undefined
    },

    signInWithGoogle(options?: SignInOptions) {
      return supabaseSignInWithGoogle(options ?? {})
    },

    async signOut() {
      await sb().auth.signOut()
    },

    async refreshSession() {
      const { data } = await sb().auth.refreshSession()
      return mapSession(data.session)
    },

    async updateUser(attrs: Record<string, unknown>) {
      const { data } = await sb().auth.updateUser(attrs)
      return mapUser(data.user)
    },

    onAuthStateChange(cb: (change: AuthChange) => void) {
      const { data } = sb().auth.onAuthStateChange((rawEvent: string, session: RawSession) => {
        const event = EVENT_MAP[rawEvent]
        if (!event) return // ignora eventos no soportados por el port
        cb({ event, session: mapSession(session), isNewUser: rawEvent === 'SIGNED_UP' })
      })
      return () => data.subscription.unsubscribe()
    },
  }
}
