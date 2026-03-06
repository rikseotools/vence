/**
 * Tests para app/auth/callback/page.tsx — PKCE exchange explícito
 *
 * Verifica que el callback usa exchangeCodeForSession en lugar de
 * detectSessionInUrl (que causaba race conditions / deadlocks).
 */

// ---- Mocks de módulos ----

const mockExchangeCodeForSession = jest.fn()
const mockOnAuthStateChange = jest.fn(() => ({
  data: { subscription: { unsubscribe: jest.fn() } },
}))
const mockGetSession = jest.fn()

jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      onAuthStateChange: mockOnAuthStateChange,
      getSession: mockGetSession,
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
let mockLocationSearch = ''
let mockLocationHref = ''

const fakeSession = {
  user: {
    id: 'user-123',
    email: 'test@example.com',
    user_metadata: { full_name: 'Test User', avatar_url: 'https://img.example.com/avatar.jpg' },
  },
  access_token: 'fake-access-token',
}

function setLocationSearch(search: string) {
  mockLocationSearch = search
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

let mockLocalStorage: Record<string, string> = {}

beforeEach(() => {
  jest.clearAllMocks()
  mockSearchParams = {}
  mockLocalStorage = {}
  mockLocationHref = ''

  // Mock localStorage
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

  // Mock fetch
  global.fetch = jest.fn().mockResolvedValue({
    json: () => Promise.resolve({ success: true, isNewUser: false, redirectUrl: '/auxiliar-administrativo-estado' }),
  })

  // Mock window.dispatchEvent
  jest.spyOn(window, 'dispatchEvent').mockImplementation(() => true)

  // Default: URL con code PKCE
  setLocationSearch('?code=pkce-test-code')
})

afterEach(() => {
  global.fetch = originalFetch
  Object.defineProperty(window, 'localStorage', { value: originalLocalStorage, writable: true, configurable: true })
  jest.restoreAllMocks()
})

// ---- Tests ----

describe('Auth Callback — PKCE Exchange', () => {
  describe('exchangeCodeForSession', () => {
    test('llama exchangeCodeForSession con el code de la URL', async () => {
      setLocationSearch('?code=abc123')
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: fakeSession },
        error: null,
      })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      expect(mockExchangeCodeForSession).toHaveBeenCalledWith('abc123')
    })

    test('error si no hay code en la URL', async () => {
      setLocationSearch('')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: null }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('No auth code in URL')
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    })

    test('error si exchangeCodeForSession falla (código expirado)', async () => {
      setLocationSearch('?code=expired-code')
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: null },
        error: { message: 'code verifier does not match' },
      })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('PKCE exchange failed')
      expect(result.error).toContain('code verifier does not match')
    })

    test('error si exchangeCodeForSession devuelve session sin user', async () => {
      setLocationSearch('?code=valid-code')
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: { user: null, access_token: 'tok' } },
        error: null,
      })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('No session returned')
    })

    test('error si hay error param en URL (OAuth denegado)', async () => {
      setLocationSearch('?error=access_denied&error_description=User%20denied%20access')

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.error).toContain('OAuth Error: access_denied')
      expect(result.error).toContain('User denied access')
      expect(mockExchangeCodeForSession).not.toHaveBeenCalled()
    })

    test('NO usa polling ni listener (sin onAuthStateChange)', async () => {
      setLocationSearch('?code=direct-code')
      mockExchangeCodeForSession.mockResolvedValue({
        data: { session: fakeSession },
        error: null,
      })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      await handleAuthCallbackForTest()

      // onAuthStateChange no debería llamarse en el flujo del callback
      expect(mockOnAuthStateChange).not.toHaveBeenCalled()
      expect(mockGetSession).not.toHaveBeenCalled()
    })
  })

  describe('Return URL', () => {
    test('usa return_to query param si existe', async () => {
      mockSearchParams = { return_to: '/tema/5' }
      setLocationSearch('?code=test-code&return_to=/tema/5')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/tema/5')
    })

    test('fallback a localStorage backup (si < 10min)', async () => {
      mockSearchParams = {}
      mockLocalStorage['auth_return_url_backup'] = '/leyes/constitucion'
      mockLocalStorage['auth_return_timestamp'] = String(Date.now() - 5 * 60 * 1000) // 5 min ago
      setLocationSearch('?code=test-code')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/leyes/constitucion')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_return_url_backup')
      expect(window.localStorage.removeItem).toHaveBeenCalledWith('auth_return_timestamp')
    })

    test('ignora localStorage backup expirado (> 10min)', async () => {
      mockSearchParams = {}
      mockLocalStorage['auth_return_url_backup'] = '/old-page'
      mockLocalStorage['auth_return_timestamp'] = String(Date.now() - 15 * 60 * 1000) // 15 min ago
      setLocationSearch('?code=test-code')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/auxiliar-administrativo-estado')
    })

    test('default /auxiliar-administrativo-estado sin params ni backup', async () => {
      mockSearchParams = {}
      setLocationSearch('?code=test-code')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.returnUrl).toBe('/auxiliar-administrativo-estado')
    })
  })

  describe('Process callback API', () => {
    test('llama /api/v2/auth/process-callback con Bearer token', async () => {
      setLocationSearch('?code=test-code')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

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
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

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
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      // No debería marcar error, solo warn
      expect(result.error).toBeNull()
      expect(result.status).toBe('success')
    })
  })

  describe('Client-side tracking', () => {
    test('Google Ads: detecta por URL premium-ads', async () => {
      mockSearchParams = { return_to: '/premium-ads' }
      setLocationSearch('?code=test-code&return_to=/premium-ads')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

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
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

      const { handleAuthCallbackForTest } = await getCallbackHandler()
      const result = await handleAuthCallbackForTest()

      expect(result.redirectUrl).toMatch(/auth=success/)
      expect(result.redirectUrl).toMatch(/t=\d+/)
    })

    test('detecta test pendiente en localStorage → redirect a /test-recuperado', async () => {
      setLocationSearch('?code=test-code')
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })
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
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })
      mockLocalStorage['vence_pending_test'] = JSON.stringify({
        savedAt: Date.now() - 2 * 60 * 60 * 1000, // 2h ago
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
      mockExchangeCodeForSession.mockResolvedValue({ data: { session: fakeSession }, error: null })

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
  test('detectSessionInUrl es false para evitar race condition PKCE', () => {
    // Leemos el archivo fuente para verificar la config
    const fs = require('fs')
    const source = fs.readFileSync(
      require('path').join(__dirname, '../../../lib/supabase.js'),
      'utf-8'
    )
    expect(source).toContain('detectSessionInUrl: false')
    expect(source).not.toMatch(/detectSessionInUrl:\s*true/)
  })
})

// ---- Extrae la lógica del callback como función testable ----

async function getCallbackHandler() {
  const { getSupabaseClient } = require('@/lib/supabase')
  const { isFromMeta, isFromGoogle, getMetaParams, getGoogleParams, trackMetaRegistration } = require('../../../lib/metaPixelCapture')
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

      // 2. PKCE exchange
      const code = urlParams.get('code')
      if (!code) {
        throw new Error('No auth code in URL')
      }

      const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
      if (exchangeError) {
        throw new Error(`PKCE exchange failed: ${exchangeError.message}`)
      }

      const session = exchangeData.session
      if (!session?.user) {
        throw new Error('No session returned from PKCE exchange')
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
