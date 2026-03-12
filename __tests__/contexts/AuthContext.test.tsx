// __tests__/contexts/AuthContext.test.tsx
// Tests de integración para AuthContext — verifica que loading/isPremium no hagan flash
// Refactored para INITIAL_SESSION como fuente de verdad

import React from 'react'
import { render, act } from '@testing-library/react'

// --- Mocks ---

// Mock de useSessionControl (debe ir antes del import de AuthContext)
jest.mock('../../hooks/useSessionControl', () => ({
  useSessionControl: () => ({ showWarning: false }),
}))

// Mock de SessionWarningModal
jest.mock('../../components/SessionWarningModal', () => {
  return function MockSessionWarningModal() {
    return null
  }
})

// Mock de notificationTracker y emailTracker
jest.mock('../../lib/services/notificationTracker', () => ({
  __esModule: true,
  default: { setSupabaseInstance: jest.fn() },
}))
jest.mock('../../lib/services/emailTracker', () => ({
  __esModule: true,
  default: { setSupabaseInstance: jest.fn() },
}))

// Mock de campaignTracker
jest.mock('../../lib/campaignTracker', () => ({
  shouldForceCheckout: () => false,
  forceCampaignCheckout: jest.fn(),
}))

// Mock de GoogleAdsEvents
jest.mock('../../utils/googleAds', () => ({
  GoogleAdsEvents: { SIGNUP: jest.fn() },
}))

// --- Supabase mock factory ---

type AuthCallback = (event: string, session: { user: { id: string; email: string } } | null) => void

let authCallback: AuthCallback | null = null
const mockUnsubscribe = jest.fn()

function createMockSupabase(options: {
  user?: { id: string; email: string } | null
  profileData?: Record<string, unknown> | null
  profileDelay?: number
  profileError?: boolean
}) {
  const { user = null, profileData = null, profileDelay = 0, profileError = false } = options

  const mockSingle = jest.fn().mockImplementation(() => {
    const result = profileError
      ? { data: null, error: { message: 'DB error', code: 'UNKNOWN' } }
      : { data: profileData, error: null }

    if (profileDelay > 0) {
      return new Promise(resolve => setTimeout(() => resolve(result), profileDelay))
    }
    return Promise.resolve(result)
  })

  const mockAbortSignal = jest.fn().mockReturnValue({ single: mockSingle })
  const mockEq = jest.fn().mockReturnValue({ abortSignal: mockAbortSignal })
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })

  return {
    auth: {
      getUser: jest.fn().mockResolvedValue(
        user
          ? { data: { user }, error: null }
          : { data: { user: null }, error: null }
      ),
      onAuthStateChange: jest.fn().mockImplementation((cb: AuthCallback) => {
        authCallback = cb
        // 🎯 Emitir INITIAL_SESSION asíncronamente (como hace Supabase real)
        // setTimeout(0) simula que _initialize() completa y luego emite el evento
        setTimeout(() => {
          cb('INITIAL_SESSION', user ? { user } : null)
        }, 0)
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
      }),
    },
    from: jest.fn().mockReturnValue({ select: mockSelect }),
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  }
}

// Mock getSupabaseClient — will be set per test
let mockSupabase: ReturnType<typeof createMockSupabase>

jest.mock('../../lib/supabase', () => ({
  getSupabaseClient: () => mockSupabase,
}))

// --- Import after mocks ---
import { AuthProvider, useAuth } from '../../contexts/AuthContext'

// Type for the auth context value
interface AuthValue {
  loading: boolean
  isPremium: boolean
  userProfile: Record<string, unknown> | null
  isAuthenticated: boolean
  [key: string]: unknown
}

// --- Test helper component ---
function AuthConsumer({ onRender }: { onRender: (value: Record<string, unknown>) => void }) {
  const auth = useAuth() as unknown as AuthValue
  onRender({
    loading: auth.loading,
    isPremium: auth.isPremium,
    userProfile: auth.userProfile,
    isAuthenticated: auth.isAuthenticated,
  })
  return null
}

// --- Tests ---

describe('AuthContext — INITIAL_SESSION refactor', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    authCallback = null
    mockUnsubscribe.mockClear()
    // Ensure fetch returns a proper Promise (used by trackSessionIP)
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('loading permanece true hasta que INITIAL_SESSION carga el perfil', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'test@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'test@test.com' },
      profileDelay: 100,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Initially loading=true (before INITIAL_SESSION fires)
    expect(renders[0]?.loading).toBe(true)

    // Fire INITIAL_SESSION (setTimeout(0)) and advance past profile delay
    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    // After profile loads, loading should be false
    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
  })

  test('isPremium es true cuando perfil premium carga via INITIAL_SESSION', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'premium@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'premium@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(true)
  })

  test('isPremium es true para plan trial', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'trial@test.com' },
      profileData: { id: 'u1', plan_type: 'trial', email: 'trial@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.isPremium).toBe(true)
  })

  test('isPremium es false para plan free', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'free@test.com' },
      profileData: { id: 'u1', plan_type: 'free', email: 'free@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.isPremium).toBe(false)
  })

  test('sin flash: isPremium nunca es false mientras loading=false para usuario premium', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'premium@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'premium@test.com' },
      profileDelay: 80,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Advance in small steps to capture intermediate renders
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        jest.advanceTimersByTime(10)
      })
    }

    // KEY ASSERTION: there must be NO render where loading=false AND isPremium=false
    // (that would be the flash bug)
    const flashRenders = renders.filter(r => !r.loading && !r.isPremium)
    expect(flashRenders).toHaveLength(0)

    // And we should eventually have loading=false with isPremium=true
    const correctFinalRenders = renders.filter(r => !r.loading && r.isPremium)
    expect(correctFinalRenders.length).toBeGreaterThan(0)
  })

  test('error de perfil no bloquea loading (INITIAL_SESSION finaliza loading)', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'error@test.com' },
      profileError: true,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // INITIAL_SESSION fires at setTimeout(0), profile query fails immediately
    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
  })

  test('usuario sin sesion: INITIAL_SESSION con null -> loading=false rapido', async () => {
    const renders: Array<{ loading: boolean; isAuthenticated: boolean }> = []

    mockSupabase = createMockSupabase({
      user: null,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isAuthenticated: v.isAuthenticated as boolean })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isAuthenticated).toBe(false)
  })

  test('SIGNED_IN post-login espera perfil antes de setLoading(false)', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    // Start with no user
    mockSupabase = createMockSupabase({
      user: null,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Let INITIAL_SESSION (null) fire
    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    // Now reconfigure the mock for profile fetch (when SIGNED_IN fires)
    const premiumProfile = { id: 'u2', plan_type: 'premium', email: 'new@test.com' }
    const mockSingle = jest.fn().mockImplementation(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({ data: premiumProfile, error: null }), 60)
      )
    )
    const mockAbortSignal = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq = jest.fn().mockReturnValue({ abortSignal: mockAbortSignal })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    mockSupabase.from = jest.fn().mockReturnValue({ select: mockSelect })

    // Clear renders to track only what happens after SIGNED_IN
    renders.length = 0

    // Simulate SIGNED_IN event (user logs in after page load)
    if (authCallback) {
      await act(async () => {
        authCallback!('SIGNED_IN', { user: { id: 'u2', email: 'new@test.com' } })
      })

      // Advance past profile delay
      await act(async () => {
        jest.advanceTimersByTime(100)
      })
    }

    // After the auth event + profile load, verify no flash
    const flashRenders = renders.filter(r => !r.loading && !r.isPremium)
    expect(flashRenders).toHaveLength(0)
  })

  test('TOKEN_REFRESHED carga perfil si no estaba cargado', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    // User exists but profile fails on INITIAL_SESSION
    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'retry@test.com' },
      profileError: true,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Let INITIAL_SESSION fire (profile will fail)
    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    // Verify loading=false after INITIAL_SESSION even with error
    expect(renders[renders.length - 1].loading).toBe(false)

    // Now fix the profile mock and simulate TOKEN_REFRESHED
    const premiumProfile = { id: 'u1', plan_type: 'premium', email: 'retry@test.com' }
    const mockSingle = jest.fn().mockResolvedValue({ data: premiumProfile, error: null })
    const mockAbortSignal = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq = jest.fn().mockReturnValue({ abortSignal: mockAbortSignal })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    mockSupabase.from = jest.fn().mockReturnValue({ select: mockSelect })

    if (authCallback) {
      await act(async () => {
        authCallback!('TOKEN_REFRESHED', { user: { id: 'u1', email: 'retry@test.com' } })
      })

      await act(async () => {
        jest.advanceTimersByTime(50)
      })
    }

    // After TOKEN_REFRESHED retries, profile should be loaded
    const finalRender = renders[renders.length - 1]
    expect(finalRender.isPremium).toBe(true)
  })

  test('TOKEN_REFRESHED NO recarga perfil si ya estaba cargado', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'loaded@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'loaded@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Let INITIAL_SESSION load profile
    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    expect(renders[renders.length - 1].isPremium).toBe(true)
    const fromCallsBefore = mockSupabase.from.mock.calls.length

    // Fire TOKEN_REFRESHED — should NOT call from() again since profile is loaded
    if (authCallback) {
      await act(async () => {
        authCallback!('TOKEN_REFRESHED', { user: { id: 'u1', email: 'loaded@test.com' } })
      })
      await act(async () => {
        jest.advanceTimersByTime(50)
      })
    }

    // from() should NOT have been called again
    expect(mockSupabase.from.mock.calls.length).toBe(fromCallsBefore)
    // isPremium should still be true
    expect(renders[renders.length - 1].isPremium).toBe(true)
  })

  test('SIGNED_OUT limpia perfil y pone loading=false', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean; isAuthenticated: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'logout@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'logout@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({
            loading: v.loading as boolean,
            isPremium: v.isPremium as boolean,
            isAuthenticated: v.isAuthenticated as boolean,
          })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    // Verify premium loaded
    expect(renders[renders.length - 1].isPremium).toBe(true)
    expect(renders[renders.length - 1].isAuthenticated).toBe(true)

    // Fire SIGNED_OUT
    if (authCallback) {
      await act(async () => {
        authCallback!('SIGNED_OUT', null)
      })
      await act(async () => {
        jest.advanceTimersByTime(10)
      })
    }

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(false)
    expect(finalRender.isAuthenticated).toBe(false)
  })

  test('perfil con delay largo: loading=true durante carga, false despues', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'slow@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'slow@test.com' },
      profileDelay: 500,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Fire INITIAL_SESSION but profile still loading
    await act(async () => {
      jest.advanceTimersByTime(10)
    })

    // Should still be loading (profile takes 500ms)
    const midRender = renders[renders.length - 1]
    expect(midRender.loading).toBe(true)

    // Advance past 500ms
    await act(async () => {
      jest.advanceTimersByTime(600)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(true)
  })

  test('safety timeout fires si INITIAL_SESSION nunca llega', async () => {
    const renders: Array<{ loading: boolean }> = []

    // Custom mock that does NOT emit INITIAL_SESSION
    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        onAuthStateChange: jest.fn().mockImplementation((cb: AuthCallback) => {
          authCallback = cb
          // Deliberately NOT emitting INITIAL_SESSION
          return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
        }),
      },
      from: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ abortSignal: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: null, error: null }) }) }) }) }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    }

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean })} />
        </AuthProvider>
      )
    })

    // After 1 second, still loading (INITIAL_SESSION hasn't fired)
    await act(async () => {
      jest.advanceTimersByTime(1000)
    })
    expect(renders[renders.length - 1].loading).toBe(true)

    // After 12s safety timeout, should force loading=false
    await act(async () => {
      jest.advanceTimersByTime(12000)
    })

    expect(renders[renders.length - 1].loading).toBe(false)
  })

  test('INITIAL_SESSION seguido inmediatamente de SIGNED_IN no causa flash', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    // Supabase a veces emite INITIAL_SESSION + SIGNED_IN rápidamente
    const user = { id: 'u1', email: 'double@test.com' }
    const profile = { id: 'u1', plan_type: 'premium', email: 'double@test.com' }

    mockSupabase = createMockSupabase({
      user,
      profileData: profile,
      profileDelay: 30,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Fire INITIAL_SESSION (setTimeout(0)) and SIGNED_IN quickly after
    await act(async () => {
      jest.advanceTimersByTime(5)
    })

    // Manually fire SIGNED_IN right after INITIAL_SESSION
    if (authCallback) {
      await act(async () => {
        authCallback!('SIGNED_IN', { user })
      })
    }

    // Advance past profile delay
    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    // NO flash: never loading=false + isPremium=false
    const flashRenders = renders.filter(r => !r.loading && !r.isPremium)
    expect(flashRenders).toHaveLength(0)

    // Should end with loaded premium
    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(true)
  })

  test('cambio de usuario: SIGNED_OUT seguido de SIGNED_IN con otro usuario', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean; isAuthenticated: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'first@test.com' },
      profileData: { id: 'u1', plan_type: 'free', email: 'first@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({
            loading: v.loading as boolean,
            isPremium: v.isPremium as boolean,
            isAuthenticated: v.isAuthenticated as boolean,
          })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    // First user loaded: free plan
    expect(renders[renders.length - 1].isPremium).toBe(false)
    expect(renders[renders.length - 1].isAuthenticated).toBe(true)

    // Sign out
    if (authCallback) {
      await act(async () => {
        authCallback!('SIGNED_OUT', null)
      })
      await act(async () => {
        jest.advanceTimersByTime(10)
      })
    }

    expect(renders[renders.length - 1].isAuthenticated).toBe(false)

    // Reconfigure mock for new premium user
    const premiumProfile = { id: 'u2', plan_type: 'premium', email: 'second@test.com' }
    const mockSingle = jest.fn().mockResolvedValue({ data: premiumProfile, error: null })
    const mockAbortSignal = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq = jest.fn().mockReturnValue({ abortSignal: mockAbortSignal })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    mockSupabase.from = jest.fn().mockReturnValue({ select: mockSelect })

    // Sign in as new user
    if (authCallback) {
      await act(async () => {
        authCallback!('SIGNED_IN', { user: { id: 'u2', email: 'second@test.com' } })
      })
      await act(async () => {
        jest.advanceTimersByTime(50)
      })
    }

    const finalRender = renders[renders.length - 1]
    expect(finalRender.isAuthenticated).toBe(true)
    expect(finalRender.isPremium).toBe(true)
    expect(finalRender.loading).toBe(false)
  })
})

// === Tests adicionales de robustez ===

describe('AuthContext — StrictMode (double mount)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    authCallback = null
    mockUnsubscribe.mockClear()
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('React StrictMode double-mount converge a estado correcto', async () => {
    // StrictMode en dev hace mount/unmount/remount. Los renders intermedios
    // durante el ciclo de double-mount no son visibles al usuario.
    // Lo importante es que el estado FINAL sea correcto.
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'strict@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'strict@test.com' },
      profileDelay: 20,
    })

    await act(async () => {
      render(
        <React.StrictMode>
          <AuthProvider>
            <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
          </AuthProvider>
        </React.StrictMode>
      )
    })

    // Advance to let INITIAL_SESSION fire and profile load
    for (let i = 0; i < 10; i++) {
      await act(async () => {
        jest.advanceTimersByTime(10)
      })
    }

    // Estado final debe ser correcto
    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(true)

    // Verificar que NO hay flash DESPUÉS de la estabilización
    // (renders que ocurran post-loading=false deben mantener isPremium=true)
    let foundStable = false
    for (const r of renders) {
      if (!r.loading && r.isPremium) {
        foundStable = true
      }
      // Una vez estable, no debe regresar a isPremium=false
      if (foundStable && !r.loading) {
        expect(r.isPremium).toBe(true)
      }
    }
    expect(foundStable).toBe(true)
  })
})

describe('AuthContext — initialUser prop (SSR)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    authCallback = null
    mockUnsubscribe.mockClear()
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('initialUser se usa inmediatamente y perfil carga via INITIAL_SESSION', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean; isAuthenticated: boolean }> = []

    const ssrUser = { id: 'ssr1', email: 'ssr@test.com' } as any

    mockSupabase = createMockSupabase({
      user: ssrUser,
      profileData: { id: 'ssr1', plan_type: 'premium', email: 'ssr@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider initialUser={ssrUser}>
          <AuthConsumer onRender={(v) => renders.push({
            loading: v.loading as boolean,
            isPremium: v.isPremium as boolean,
            isAuthenticated: v.isAuthenticated as boolean,
          })} />
        </AuthProvider>
      )
    })

    // User is set immediately from initialUser
    expect(renders[0]?.isAuthenticated).toBe(true)

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(true)
    expect(finalRender.isAuthenticated).toBe(true)
  })
})

describe('AuthContext — eventos rápidos y concurrencia', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    authCallback = null
    mockUnsubscribe.mockClear()
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('múltiples SIGNED_IN rápidos (double-click login) no causan duplicados', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean }> = []

    mockSupabase = createMockSupabase({
      user: null,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
        </AuthProvider>
      )
    })

    // Let INITIAL_SESSION (null) fire
    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    // Set up profile mock
    const premiumProfile = { id: 'u1', plan_type: 'premium', email: 'double@test.com' }
    const mockSingle = jest.fn().mockImplementation(() =>
      new Promise(resolve =>
        setTimeout(() => resolve({ data: premiumProfile, error: null }), 30)
      )
    )
    const mockAbortSignal = jest.fn().mockReturnValue({ single: mockSingle })
    const mockEq = jest.fn().mockReturnValue({ abortSignal: mockAbortSignal })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })
    mockSupabase.from = jest.fn().mockReturnValue({ select: mockSelect })

    renders.length = 0

    // Fire two SIGNED_IN events rapidly
    if (authCallback) {
      await act(async () => {
        authCallback!('SIGNED_IN', { user: { id: 'u1', email: 'double@test.com' } })
      })
      // Second one fires 5ms later
      await act(async () => {
        jest.advanceTimersByTime(5)
        authCallback!('SIGNED_IN', { user: { id: 'u1', email: 'double@test.com' } })
      })

      await act(async () => {
        jest.advanceTimersByTime(100)
      })
    }

    // Should end loaded with premium
    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(true)
  })

  test('SIGNED_OUT durante carga de perfil no deja estado inconsistente', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean; isAuthenticated: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'interrupted@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'interrupted@test.com' },
      profileDelay: 200, // slow profile load
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({
            loading: v.loading as boolean,
            isPremium: v.isPremium as boolean,
            isAuthenticated: v.isAuthenticated as boolean,
          })} />
        </AuthProvider>
      )
    })

    // INITIAL_SESSION fires, starts loading profile (200ms)
    await act(async () => {
      jest.advanceTimersByTime(10)
    })

    // User signs out WHILE profile is loading
    if (authCallback) {
      await act(async () => {
        authCallback!('SIGNED_OUT', null)
      })
    }

    // Advance past the original profile delay
    await act(async () => {
      jest.advanceTimersByTime(300)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isAuthenticated).toBe(false)
  })

  test('evento desconocido no rompe el flujo', async () => {
    const renders: Array<{ loading: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'unknown@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'unknown@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    expect(renders[renders.length - 1].loading).toBe(false)

    // Fire an unknown event
    if (authCallback) {
      await act(async () => {
        authCallback!('SOME_FUTURE_EVENT' as any, { user: { id: 'u1', email: 'unknown@test.com' } })
      })
      await act(async () => {
        jest.advanceTimersByTime(50)
      })
    }

    // Should not crash and loading should remain false
    expect(renders[renders.length - 1].loading).toBe(false)
  })
})

describe('AuthContext — loadUserProfile edge cases', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    authCallback = null
    mockUnsubscribe.mockClear()
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('PGRST116 (perfil no existe) llama ensureUserProfile', async () => {
    const renders: Array<{ loading: boolean }> = []

    // loadUserProfile chain: from → select → eq → abortSignal → single (returns PGRST116)
    // ensureUserProfile chain: from → select → eq → single (also returns PGRST116)
    const mockSingle = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }
    })
    const mockAbortSignal = jest.fn().mockReturnValue({ single: mockSingle })
    // eq must return both .abortSignal() (for loadUserProfile) and .single() (for ensureUserProfile)
    const mockEq = jest.fn().mockReturnValue({ abortSignal: mockAbortSignal, single: mockSingle })
    const mockSelect = jest.fn().mockReturnValue({ eq: mockEq })

    mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'new1', email: 'new@test.com' } }, error: null }),
        onAuthStateChange: jest.fn().mockImplementation((cb: AuthCallback) => {
          authCallback = cb
          setTimeout(() => {
            cb('INITIAL_SESSION', { user: { id: 'new1', email: 'new@test.com' } })
          }, 0)
          return { data: { subscription: { unsubscribe: mockUnsubscribe } } }
        }),
      },
      from: jest.fn().mockReturnValue({ select: mockSelect }),
      rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
    }

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    // Loading should finish (not stuck)
    expect(renders[renders.length - 1].loading).toBe(false)

    // rpc should have been called (ensureUserProfile calls rpc for creating profile)
    expect(mockSupabase.rpc).toHaveBeenCalled()
  })

  test('perfil se carga correctamente con campos reales completos', async () => {
    const renders: Array<{ loading: boolean; isPremium: boolean; userProfile: Record<string, unknown> | null }> = []

    // Simulate a full realistic profile
    const fullProfile = {
      id: 'u1',
      email: 'full@test.com',
      full_name: 'Test User',
      plan_type: 'premium',
      is_premium: true,
      registration_source: 'organic',
      requires_payment: false,
      target_oposicion: 'auxiliar_administrativo_estado',
      created_at: '2025-01-01T00:00:00Z',
      stripe_customer_id: 'cus_123',
    }

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'full@test.com' },
      profileData: fullProfile,
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({
            loading: v.loading as boolean,
            isPremium: v.isPremium as boolean,
            userProfile: v.userProfile as Record<string, unknown> | null,
          })} />
        </AuthProvider>
      )
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
    expect(finalRender.isPremium).toBe(true)
    expect(finalRender.userProfile).not.toBeNull()
    expect(finalRender.userProfile?.plan_type).toBe('premium')
    expect(finalRender.userProfile?.email).toBe('full@test.com')
    expect(finalRender.userProfile?.target_oposicion).toBe('auxiliar_administrativo_estado')
  })
})

describe('AuthContext — invariantes globales', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    authCallback = null
    mockUnsubscribe.mockClear()
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  test('INVARIANTE: isPremium=true implica loading=false en estado estable', async () => {
    // For all plan types, verify that once we reach stable state,
    // isPremium and loading are consistent
    const planTypes = ['premium', 'trial', 'free', 'legacy_free']

    for (const planType of planTypes) {
      const renders: Array<{ loading: boolean; isPremium: boolean }> = []

      mockSupabase = createMockSupabase({
        user: { id: 'u1', email: `${planType}@test.com` },
        profileData: { id: 'u1', plan_type: planType, email: `${planType}@test.com` },
      })

      authCallback = null

      await act(async () => {
        render(
          <AuthProvider>
            <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean, isPremium: v.isPremium as boolean })} />
          </AuthProvider>
        )
      })

      await act(async () => {
        jest.advanceTimersByTime(100)
      })

      const stableRenders = renders.filter(r => !r.loading)
      const expectedPremium = planType === 'premium' || planType === 'trial'

      for (const r of stableRenders) {
        expect(r.isPremium).toBe(expectedPremium)
      }
    }
  })

  test('INVARIANTE: loading siempre inicia como true', async () => {
    const renders: Array<{ loading: boolean }> = []

    mockSupabase = createMockSupabase({
      user: { id: 'u1', email: 'init@test.com' },
      profileData: { id: 'u1', plan_type: 'premium', email: 'init@test.com' },
    })

    await act(async () => {
      render(
        <AuthProvider>
          <AuthConsumer onRender={(v) => renders.push({ loading: v.loading as boolean })} />
        </AuthProvider>
      )
    })

    // First render must be loading=true
    expect(renders[0]?.loading).toBe(true)
  })

  test('INVARIANTE: unsubscribe se llama en cleanup', async () => {
    mockSupabase = createMockSupabase({
      user: null,
    })

    let unmount: (() => void) | undefined

    await act(async () => {
      const result = render(
        <AuthProvider>
          <AuthConsumer onRender={() => {}} />
        </AuthProvider>
      )
      unmount = result.unmount
    })

    await act(async () => {
      jest.advanceTimersByTime(50)
    })

    mockUnsubscribe.mockClear()

    await act(async () => {
      unmount!()
    })

    expect(mockUnsubscribe).toHaveBeenCalledTimes(1)
  })
})
