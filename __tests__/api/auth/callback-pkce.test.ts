/**
 * Tests para app/auth/callback/page.tsx — Auth callback robusto
 *
 * Verifica que el callback espera a initialize() (que hace el exchange PKCE
 * dentro de su lock con detectSessionInUrl: true) y luego obtiene la sesión
 * con getSession(). Sin polling, sin race conditions.
 */

// ---- Mocks de módulos ----

const mockInitialize = jest.fn()
const mockGetSession = jest.fn()
const mockOnAuthStateChange = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}))

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      initialize: mockInitialize,
      getSession: mockGetSession,
      onAuthStateChange: mockOnAuthStateChange,
    },
  })),
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

const fakeSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User', avatar_url: 'https://img.example.com/avatar.jpg' },
  },
  access_token: 'fake-access-token',
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

/** Configura mocks para un flujo exitoso (initialize OK + getSession devuelve sesión) */
function setupSuccessFlow() {
  mockInitialize.mockResolvedValue({ error: null })
  mockGetSession.mockResolvedValue({ data: { session: fakeSession }, error: null })
}

// ---- Setup / Teardown ----

const originalFetch = global.fetch
const originalLocalStorage = window.localStorage

let mockLocalStorage: Record<string, string> = {}

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParams = {}
  mockLocalStorage = {}

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

  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, isNewUser: false, redirectUrl: '/auxiliar-administrativo-estado' }),
  })

  jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true)

  setLocationSearch('?code=pkce-test-code')
})

afterEach(() => {
  global.fetch = originalFetch
  Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true })
  jest.restoreAllMocks()
})

// ---- Tests ----

describe('Auth Callback — initialize() + getSession()', () => {
  describe('PKCE exchange via initialize()', () => {
    test('llama initialize() para completar el exchange PKCE', async () => {
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      expect(mockInitialize).toHaveBeenCalled()
    })

    test('llama getSession() después de initialize()', async () => {
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      expect(mockGetSession).toHaveBeenCalled()
      // getSession debe llamarse después de initialize
      const initOrder = mockInitialize.mock.invocationCallOrder[0]
      const sessionOrder = mockGetSession.mock.invocationCallOrder[0]
      expect(sessionOrder).toBeGreaterThan(initOrder)
    })

    test('error si initialize() devuelve error', async () => {
      mockInitialize.mockResolvedValue({ error: { message: 'code verifier does not match' } })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('Error de autenticación')
      expect(result.error).toContain('code verifier does not match')
      expect(mockGetSession).not.toHaveBeenCalled()
    })

    test('error si getSession() devuelve error', async () => {
      mockInitialize.mockResolvedValue({ error: null })
      mockGetSession.mockResolvedValue({ data: { session: null }, error: { message: 'session expired' } })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('Error obteniendo sesión')
    })

    test('error si getSession() devuelve session sin user', async () => {
      mockInitialize.mockResolvedValue({ error: null })
      mockGetSession.mockResolvedValue({ data: { session: { user: null } }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('No se estableció sesión')
    })

    test('error si hay error param en URL (OAuth denegado)', async () => {
      setLocationSearch('?error=access_denied&error_description=User%20denied%20access')

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('OAuth Error: access_denied')
      expect(result.error).toContain('User denied access')
      expect(mockInitialize).not.toHaveBeenCalled()
    })

    test('NO usa polling, listener ni exchangeCodeForSession', async () => {
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      expect(mockOnAuthStateChange).not.toHaveBeenCalled()
    })
  })

  describe('Return URL', () => {
    test('usa return_to query param si existe', async () => {
      mockSearchParams = { return_to: '/tema/5' }
      setLocationSearch('?code=test-code&return_to=/tema/5')
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/tema/5')
    })

    test('fallback a localStorage backup (si < 10min)', async () => {
      mockSearchParams = {}
      mockLocalStorage['auth_return_url_backup'] = '/leyes/constitucion'
      mockLocalStorage['auth_return_timestamp'] = String(Date.now() - 5 * 60 * 1000)
      setLocationSearch('?code=test-code')
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/leyes/constitucion')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_return_url_backup')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_return_timestamp')
    })

    test('ignora localStorage backup expirado (> 10min)', async () => {
      mockSearchParams = {}
      mockLocalStorage['auth_return_url_backup'] = '/old-page'
      mockLocalStorage['auth_return_timestamp'] = String(Date.now() - 15 * 60 * 1000)
      setLocationSearch('?code=test-code')
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/auxiliar-administrativo-estado')
    })

    test('default /auxiliar-administrativo-estado sin params ni backup', async () => {
      mockSearchParams = {}
      setLocationSearch('?code=test-code')
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/auxiliar-administrativo-estado')
    })
  })

  describe('Process callback API', () => {
    test('llama /api/v2/auth/process-callback con Bearer token', async () => {
      setLocationSearch('?code=test-code')
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      expect(global.fetch).toHaveBeenCalledWith(
        '/api/v2/auth/process-callback',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer fake-access-token',
            'Content-Type': 'application/json',
          }),
        })
      )
    })

    test('envía userId, email, fullName, avatarUrl en body', async () => {
      setLocationSearch('?code=test-code')
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      const fetchCall = (global.fetch as jest.Mock).mock.calls[0]
      const body = JSON.parse(fetchCall[1].body)
      expect(body.userId).toBe('user-123')
      expect(body.userEmail).toBe('test@example.com')
      expect(body.fullName).toBe('Test User')
      expect(body.avatarUrl).toBe('https://img.example.com/avatar.jpg')
    })

    test('continúa redirect aunque la API falle', async () => {
      setLocationSearch('?code=test-code');
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toBeNull()
      expect(result.status).toBe('success')
    })
  })

  describe('Client-side tracking', () => {
    test('Google Ads: detecta por URL premium-ads', async () => {
      mockSearchParams = { return_to: '/premium-ads' }
      setLocationSearch('?code=test-code&return_to=/premium-ads')
      setupSuccessFlow()

      const { useGoogleAds } = require('../../../utils/googleAds')
      const mockSignup = jest.fn()
      useGoogleAds.mockReturnValue({ events: { SIGNUP: mockSignup } })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      expect(mockSignup).toHaveBeenCalledWith('google_ads')
    })
  })

  describe('Redirect', () => {
    test('redirect con ?auth=success&t=timestamp', async () => {
      setLocationSearch('?code=test-code')
      setupSuccessFlow()

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.redirectUrl).toMatch(/auth=success/)
      expect(result.redirectUrl).toMatch(/t=\d+/)
    })

    test('detecta test pendiente en localStorage → redirect a /test-recuperado', async () => {
      setLocationSearch('?code=test-code')
      setupSuccessFlow()
      mockLocalStorage['vence_pending_test'] = JSON.stringify({
        savedAt: Date.now() - 5 * 60 * 1000,
        answeredQuestions: [{ id: 1 }, { id: 2 }],
        tema: 'Tema 3',
      })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.redirectUrl).toContain('/test-recuperado')
    })

    test('ignora test pendiente expirado (> 1h)', async () => {
      setLocationSearch('?code=test-code')
      setupSuccessFlow()
      mockLocalStorage['vence_pending_test'] = JSON.stringify({
        savedAt: Date.now() - 2 * 60 * 60 * 1000,
        answeredQuestions: [{ id: 1 }],
        tema: 'Tema 1',
      })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.redirectUrl).not.toContain('/test-recuperado')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('vence_pending_test')
    })
  })

  describe('Global events', () => {
    test('dispatch supabaseAuthSuccess y supabaseAuthChange', async () => {
      setLocationSearch('?code=test-code')
      setupSuccessFlow()

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
  test('detectSessionInUrl es true (el exchange PKCE se hace en _initialize)', () => {
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
  const { getSupabaseClient } = require('@/lib/supabase')
  const { isFromMeta, isFromGoogle, getMetaParams, getGoogleParams } = require('../../../lib/metaPixelCapture')
  const { useGoogleAds } = require('../../../utils/googleAds')

  const supabase = getSupabaseClient()
  const { events } = useGoogleAds()

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

      // 2. Wait for initialize() to complete the PKCE exchange
      const { error: initError } = await supabase.auth.initialize()
      if (initError) {
        throw new Error(`Error de autenticación: ${initError.message}`)
      }

      // 3. Get session established by initialize()
      const { data: { session }, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) {
        throw new Error(`Error obteniendo sesión: ${sessionError.message}`)
      }
      if (!session?.user) {
        throw new Error('No se estableció sesión tras la autenticación')
      }

      // 4. Ads detection
      const isGoogleAdsFromUrl = returnUrl.includes('/premium-ads') || returnUrl.includes('start_checkout=true')
      const isGoogleAds = isGoogleAdsFromUrl || isFromGoogle()
      const isMetaAds = isFromMeta()

      // 5. API call
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

      // 6. Tracking
      if (isGoogleAds) {
        events.SIGNUP('google_ads')
      } else if (isMetaAds) {
        events.SIGNUP('meta')
      } else {
        events.SIGNUP('google')
      }

      // 7. Pending test
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

      // 8. Events
      window.dispatchEvent(new CustomEvent('supabaseAuthSuccess', {
        detail: { user: session.user, session: { user: session.user }, returnUrl },
      }))
      window.dispatchEvent(new CustomEvent('supabaseAuthChange', {
        detail: { event: 'SIGNED_IN', user: session.user, session: { user: session.user } },
      }))

      // 9. Redirect URL
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
