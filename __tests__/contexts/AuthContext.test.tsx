// __tests__/contexts/AuthContext.test.tsx
// Tests de integración para AuthContext — verifica que loading/isPremium no hagan flash

import React from 'react'
import { render, act, waitFor } from '@testing-library/react'

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

// Type for the auth context value (AuthContext.js is JS, so we type it here)
interface AuthValue {
  loading: boolean
  isPremium: boolean
  userProfile: Record<string, unknown> | null
  isAuthenticated: boolean
  [key: string]: unknown
}

// --- Test helper component ---
function AuthConsumer({ onRender }: { onRender: (value: Record<string, unknown>) => void }) {
  const auth = useAuth() as AuthValue
  onRender({
    loading: auth.loading,
    isPremium: auth.isPremium,
    userProfile: auth.userProfile,
    isAuthenticated: auth.isAuthenticated,
  })
  return null
}

// --- Tests ---

describe('AuthContext — race condition fix', () => {
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

  test('loading permanece true hasta que el perfil carga', async () => {
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

    // Initially loading=true
    expect(renders[0]?.loading).toBe(true)

    // Advance past the profile delay
    await act(async () => {
      jest.advanceTimersByTime(200)
    })

    // After profile loads, loading should be false
    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
  })

  test('isPremium es true cuando perfil premium carga', async () => {
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

  test('error de perfil no bloquea loading', async () => {
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

    await act(async () => {
      jest.advanceTimersByTime(100)
    })

    const finalRender = renders[renders.length - 1]
    expect(finalRender.loading).toBe(false)
  })

  test('usuario sin sesion: loading=false rapido', async () => {
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

  test('onAuthStateChange SIGNED_IN espera perfil antes de setLoading(false)', async () => {
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

    // Simulate SIGNED_IN event
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
})
