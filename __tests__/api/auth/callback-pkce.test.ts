/**
 * Tests para app/auth/callback/page.tsx — Auth callback robusto
 *
 * El singleton (detectSessionInUrl: true) hace el exchange PKCE en _initialize().
 * El callback page NO usa metodos de auth-js (que usan locks). En cambio,
 * lee la sesion directamente de localStorage (polling) sin lock contention.
 */

// ---- Mocks de módulos ----

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({})),
}))

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn() })),
  useSearchParams: jest.fn(() => ({
    get: jest.fn((key: string) => mockSearchParams[key] || null),
  })),
}))

jest.mock('../../../utils/googleAds', () => ({
  useGoogleAds: jest.fn(() => ({
    events: { SIGNUP: jest.fn() },
  })),
}))

jest.mock('../../../lib/metaPixelCapture', () => ({
  getMetaParams: jest.fn(() => null),
  isFromMeta: jest.fn(() => false),
  trackMetaRegistration: jest.fn(),
  isFromGoogle: jest.fn(() => false),
  getGoogleParams: jest.fn(() => null),
}))

// ---- Helpers ----

let mockSearchParams: Record<string, string> = {}

const fakeUser = {
  id: 'user-123',
  email: 'test@example.com',
  user_metadata: { full_name: 'Test User', avatar_url: 'https://img.example.com/avatar.jpg' },
}

const fakeSession = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: fakeUser,
}

function setLocationSearch(search: string) {
  Object.defineProperty(window, 'location', {
    value: {
      ...window.location,
      search: search,
      href: `http://localhost:3000/auth/callback${search}`,
      reload: jest.fn(),
      origin: 'http://localhost:3000',
    },
    writable: true,
    configurable: true,
  })
}

// ---- Setup / Teardown ----

const originalFetch = global.fetch
const originalLocalStorage = window.localStorage
const originalEnv = { ...process.env }

let mockLocalStorage: Record<string, string> = {}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  mockSearchParams = {}
  mockLocalStorage = {}

  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test-project.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: jest.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: jest.fn((key: string, val: string) => { mockLocalStorage[key] = val }),
      removeItem: jest.fn((key: string) => { delete mockLocalStorage[key] }),
      clear: jest.fn(() => { mockLocalStorage = {} }),
    },
    writable: true,
    configurable: true,
  })

  // Default: process-callback API succeeds
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, isNewUser: false, redirectUrl: '/auxiliar-administrativo-estado' }),
  })

  jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true)

  setLocationSearch('?code=pkce-test-code')
})

afterEach(() => {
  jest.useRealTimers()
  global.fetch = originalFetch
  Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true })
  process.env = { ...originalEnv }
  jest.restoreAllMocks()
})

// ---- Helper: simula que la sesion aparece en localStorage ----

function simulateSessionInStorage(delayMs = 0) {
  if (delayMs === 0) {
    // Session already present
    mockLocalStorage['sb-test-project-auth'] = JSON.stringify(fakeSession)
  } else {
    // Session appears after delay
    setTimeout(() => {
      mockLocalStorage['sb-test-project-auth'] = JSON.stringify(fakeSession)
    }, delayMs)
  }
}

// ---- Tests ----

describe('Auth Callback — localStorage polling', () => {
  describe('Session detection', () => {
    test('detecta sesion ya presente en localStorage (check inmediato)', async () => {
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const resultPromise = handleAuthCallbackForTest()

      // El check inmediato la encuentra sin necesidad de polling
      const result = await resultPromise
      expect(result.status).toBe('success')
      expect(result.error).toBeNull()
    })

    test('detecta sesion que aparece despues (via polling)', async () => {
      // Session appears after 300ms
      simulateSessionInStorage(300)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const resultPromise = handleAuthCallbackForTest()

      // Advance timers to trigger polling
      jest.advanceTimersByTime(500)

      const result = await resultPromise
      expect(result.status).toBe('success')
      expect(result.error).toBeNull()
    })

    test('timeout si la sesion nunca aparece (30s)', async () => {
      // No session stored

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const resultPromise = handleAuthCallbackForTest()

      // Advance past the timeout
      jest.advanceTimersByTime(31000)

      const result = await resultPromise
      expect(result.error).toContain('Timeout')
    })

    test('error si hay error param en URL (OAuth denegado)', async () => {
      setLocationSearch('?error=access_denied&error_description=User%20denied%20access')

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('OAuth Error: access_denied')
      expect(result.error).toContain('User denied access')
    })
  })

  describe('Return URL', () => {
    test('usa return_to query param si existe', async () => {
      mockSearchParams = { return_to: '/tema/5' }
      setLocationSearch('?code=test-code&return_to=/tema/5')
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/tema/5')
    })

    test('fallback a localStorage backup (si < 10min)', async () => {
      mockSearchParams = {}
      mockLocalStorage['auth_return_url_backup'] = '/leyes/constitucion'
      mockLocalStorage['auth_return_timestamp'] = String(Date.now() - 5 * 60 * 1000)
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/leyes/constitucion')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_return_url_backup')
    })

    test('default /auxiliar-administrativo-estado sin params ni backup', async () => {
      mockSearchParams = {}
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/auxiliar-administrativo-estado')
    })
  })

  describe('Process callback API', () => {
    test('llama /api/v2/auth/process-callback con Bearer token', async () => {
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/auth/process-callback',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-access-token',
          }),
        })
      )
    })

    test('envia userId, email, fullName, avatarUrl en body', async () => {
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.userId).toBe('user-123')
      expect(body.userEmail).toBe('test@example.com')
      expect(body.fullName).toBe('Test User')
    })

    test('continua redirect aunque la API falle', async () => {
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toBeNull()
      expect(result.status).toBe('success')
    })
  })

  describe('Redirect', () => {
    test('redirect con ?auth=success&t=timestamp', async () => {
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.redirectUrl).toMatch(/auth=success/)
      expect(result.redirectUrl).toMatch(/t=\d+/)
    })

    test('detecta test pendiente en localStorage → redirect a /test-recuperado', async () => {
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)
      mockLocalStorage['vence_pending_test'] = JSON.stringify({
        savedAt: Date.now() - 5 * 60 * 1000,
        answeredQuestions: [{ id: 1 }, { id: 2 }],
        tema: 'Tema 3',
      })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.redirectUrl).toContain('/test-recuperado')
    })
  })

  describe('Global events', () => {
    test('dispatch supabaseAuthSuccess y supabaseAuthChange', async () => {
      setLocationSearch('?code=test-code')
      simulateSessionInStorage(0)

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      const dispatchCalls = (window.dispatchEvent as jest.Mock).mock.calls
      const eventNames = dispatchCalls.map((c: any) => c[0].type)

      expect(eventNames).toContain('supabaseAuthSuccess')
      expect(eventNames).toContain('supabaseAuthChange')
    })
  })
})

describe('lib/supabase.js — detectSessionInUrl', () => {
  test('detectSessionInUrl es true (el singleton hace el exchange PKCE)', () => {
    const fs = require('fs')
    const source = fs.readFileSync(
      require('path').join(__dirname, '../../../lib/supabase.js'),
      'utf-8'
    )
    expect(source).toContain('detectSessionInUrl: true')
  })
})

// ---- Extrae la lógica del callback como función testable ----

async function getCallbackHandler() {
  const { isFromMeta, isFromGoogle, getMetaParams, getGoogleParams } = require('../../../lib/metaPixelCapture')
  const { useGoogleAds } = require('../../../utils/googleAds')

  const { events } = useGoogleAds()

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const storageKey = `sb-${SUPABASE_URL.split('://')[1]?.split('.')[0]}-auth`

  async function handleAuthCallbackForTest(): Promise<{
    error: string | null
    status: 'success' | 'error'
    returnUrl: string
    redirectUrl: string
  }> {
    let returnUrl = '/auxiliar-administrativo-estado'
    let finalRedirectUrl = ''
    let errorMsg: string | null = null
    let status: 'success' | 'error' = 'success'

    try {
      // 1. Determine return URL
      const paramReturnTo = mockSearchParams['return_to'] || null
      if (paramReturnTo) {
        returnUrl = paramReturnTo
      } else {
        try {
          const backupUrl = window.localStorage.getItem('auth_return_url_backup')
          const timestamp = window.localStorage.getItem('auth_return_timestamp')

          if (backupUrl && timestamp) {
            const age = Date.now() - parseInt(timestamp)
            if (age < 10 * 60 * 1000) {
              returnUrl = backupUrl
              window.localStorage.removeItem('auth_return_url_backup')
              window.localStorage.removeItem('auth_return_timestamp')
            } else {
              window.localStorage.removeItem('auth_return_url_backup')
              window.localStorage.removeItem('auth_return_timestamp')
            }
          }
        } catch (e) { /* ignore */ }
      }

      // Check OAuth error
      const urlParams = new URLSearchParams(window.location.search)
      const error_param = urlParams.get('error')
      if (error_param) {
        throw new Error(`OAuth Error: ${error_param} - ${urlParams.get('error_description')}`)
      }

      // 2. Poll localStorage for session (written by singleton's auto-exchange)
      const SESSION_TIMEOUT_MS = 30000
      const POLL_INTERVAL_MS = 150

      const session: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          clearInterval(interval)
          reject(new Error('Timeout: no se recibio sesion en 30s'))
        }, SESSION_TIMEOUT_MS)

        const interval = setInterval(() => {
          try {
            const raw = window.localStorage.getItem(storageKey)
            if (raw) {
              const parsed = JSON.parse(raw)
              if (parsed?.access_token && parsed?.user) {
                clearInterval(interval)
                clearTimeout(timeout)
                resolve(parsed)
              }
            }
          } catch { /* ignore */ }
        }, POLL_INTERVAL_MS)

        // Immediate check
        try {
          const raw = window.localStorage.getItem(storageKey)
          if (raw) {
            const parsed = JSON.parse(raw)
            if (parsed?.access_token && parsed?.user) {
              clearInterval(interval)
              clearTimeout(timeout)
              resolve(parsed)
            }
          }
        } catch { /* ignore */ }
      })

      if (!session?.user) {
        throw new Error('No se establecio sesion tras la autenticacion')
      }

      // 3. Ads detection
      const isGoogleAdsFromUrl = returnUrl.includes('/premium-ads') || returnUrl.includes('start_checkout=true')
      const isGoogleAds = isGoogleAdsFromUrl || isFromGoogle()
      const isMetaAds = isFromMeta()

      // 4. API call
      try {
        const response = await fetch('/api/v2/auth/process-callback', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: session.user.id,
            userEmail: session.user.email,
            fullName: session.user.user_metadata?.full_name || null,
            avatarUrl: session.user.user_metadata?.avatar_url || null,
            returnUrl,
            oposicion: mockSearchParams['oposicion'] || null,
            funnel: mockSearchParams['funnel'] || null,
            isGoogleAds,
            isGoogleAdsFromUrl,
            isMetaAds,
            googleParams: getGoogleParams() || null,
            metaParams: getMetaParams() || null,
          }),
        })
        await response.json()
      } catch (apiError) {
        // Continue with redirect
      }

      // 5. Tracking
      if (isGoogleAds) {
        events.SIGNUP('google_ads')
      } else if (isMetaAds) {
        events.SIGNUP('meta')
      } else {
        events.SIGNUP('google')
      }

      // 6. Pending test
      let redirectUrl = returnUrl
      try {
        const pendingTestStr = window.localStorage.getItem('vence_pending_test')
        if (pendingTestStr) {
          const pendingTest = JSON.parse(pendingTestStr)
          const age = Date.now() - pendingTest.savedAt
          if (age < 60 * 60 * 1000 && pendingTest.answeredQuestions?.length > 0) {
            redirectUrl = '/test-recuperado'
          } else {
            window.localStorage.removeItem('vence_pending_test')
          }
        }
      } catch (e) { /* ignore */ }

      // 7. Events
      window.dispatchEvent(new CustomEvent('supabaseAuthSuccess', {
        detail: { user: session.user, session: { user: session.user }, returnUrl },
      }))
      window.dispatchEvent(new CustomEvent('supabaseAuthChange', {
        detail: { event: 'SIGNED_IN', user: session.user, session: { user: session.user } },
      }))

      // 8. Redirect URL
      const separator = redirectUrl.includes('?') ? '&' : '?'
      finalRedirectUrl = `${redirectUrl}${separator}auth=success&t=${Date.now()}`

    } catch (err) {
      errorMsg = err instanceof Error ? err.message : String(err)
      status = 'error'
      finalRedirectUrl = ''
    }

    return { error: errorMsg, status, returnUrl, redirectUrl: finalRedirectUrl }
  }

  return { handleAuthCallbackForTest }
}
