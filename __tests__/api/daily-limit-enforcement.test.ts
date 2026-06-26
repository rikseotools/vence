// __tests__/api/daily-limit-enforcement.test.ts
// Tests for server-side daily limit enforcement in answer endpoints

// Set env vars FIRST
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

const mockRpc = jest.fn()      // contrato legacy {data,error}; lo configuran los tests
const mockGetUser = jest.fn()  // legacy supabase auth.getUser shape {data:{user},error}
const mockExecute = jest.fn()  // getAdminDb().execute(sql`...`)

// AGNÓSTICO (Fase C1): dailyLimit.ts dejó de usar supabase.rpc/createClient.
//  - las RPC plpgsql se invocan vía Drizzle: getAdminDb().execute(sql`SELECT * FROM fn(...)`)
//  - el userId del token sale de verifyAuthOptional (no de supabase.auth.getUser)
//  - getDailyLimitStatus/checkDeviceDailyUsage envuelven la lectura en cache Redis (getOrSet)
// Para NO reescribir los ~50 escenarios, un adaptador (ver beforeEach) traduce cada
// execute(sql) al viejo contrato mockRpc(rpcName, params): así los setups {data,error}
// y las aserciones toHaveBeenCalledWith('fn',{...}) siguen valiendo intactos.

// Extrae los params interpolados del objeto SQL de Drizzle: los chunks escalares en
// orden (los StringChunk del texto son objetos {value:[...]}, no escalares).
function sqlParams(sqlObj: unknown): unknown[] {
  try {
    const chunks = (JSON.parse(JSON.stringify(sqlObj)).queryChunks || []) as unknown[]
    return chunks.filter((c) => typeof c === 'string' || typeof c === 'number')
  } catch {
    return []
  }
}
function sqlText(sqlObj: unknown): string {
  try { return JSON.stringify(sqlObj) } catch { return '' }
}

jest.mock('@/db/client', () => ({
  getAdminDb: () => ({ execute: (...a: unknown[]) => mockExecute(...a) }),
}))

// verifyAuthOptional: lee el Bearer del request y delega en el shim mockGetUser
// (mantiene los setups {data:{user},error} de los escenarios de token/ataque).
jest.mock('@/lib/api/auth/verifyAuth', () => ({
  verifyAuthOptional: async (request: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      const authz = request?.headers?.get?.('authorization')
      if (!authz || !authz.startsWith('Bearer ')) return null
      const res = await mockGetUser()
      const user = res?.data?.user
      if (res?.error || !user?.id) return null
      return { userId: user.id }
    } catch {
      return null
    }
  },
}))

// Cache Redis: en test ejecuta SIEMPRE la función (sin cachear) para que cada llamada
// lea "de BD" (mockExecute), igual que el contrato original sin caché.
jest.mock('@/lib/cache/redis', () => ({
  getOrSet: (_k: string, _ttl: number, fn: () => unknown) => fn(),
  invalidate: jest.fn(),
}))

// Mock the graduated limit module to always return default limit (25)
// so existing tests that assume a fixed 25 limit still pass
jest.mock('@/lib/api/daily-limit', () => ({
  getDynamicLimit: jest.fn().mockResolvedValue({
    dailyLimit: 25,
    tierLabel: null,
    isGraduated: false,
    registrationAgeDays: 0,
    totalLimitHits: 0,
  }),
  invalidateLimitCache: jest.fn(),
  GRADUATED_LIMIT_CONFIG: { defaultLimit: 25 },
}))

import { checkAndIncrementDailyLimit, checkDeviceDailyUsage, getDailyLimitStatus, getUserIdFromToken, incrementDailyCount } from '@/lib/api/dailyLimit'

// Minimal NextRequest-like object for testing getUserIdFromToken
function fakeRequest(headers: Record<string, string> = {}) {
  return {
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
  } as any // eslint-disable-line @typescript-eslint/no-explicit-any
}

beforeEach(() => {
  mockRpc.mockReset()
  mockGetUser.mockReset()
  mockExecute.mockReset()
  // Adaptador SQL→RPC: enruta por nombre de función y reconstruye los params legacy
  // para que mockRpc reciba exactamente ('fn', {p_user_id/p_limit/p_device_id}).
  // Un {error} del setup => execute lanza (Drizzle lanza ante error de query); un
  // {data} => se moldea a la forma que devuelve execute ({rows:[...]}). Así el código
  // real (try/catch fail-open/degraded/null) reacciona igual que con supabase.
  mockExecute.mockImplementation(async (sqlObj: unknown) => {
    const s = sqlText(sqlObj)
    const params = sqlParams(sqlObj)
    let name = 'unknown'
    let args: Record<string, unknown> = {}
    if (s.includes('increment_daily_questions')) {
      name = 'increment_daily_questions'
      args = { p_user_id: params[0], p_limit: params[1] }
    } else if (s.includes('get_device_daily_usage')) {
      name = 'get_device_daily_usage'
      args = { p_device_id: params[0] }
    } else if (s.includes('get_daily_question_status')) {
      name = 'get_daily_question_status'
      args = { p_user_id: params[0] }
    }
    const res = (await mockRpc(name, args)) as
      | { data?: unknown; error?: { message?: string; code?: string } }
      | undefined
    if (res?.error) {
      const e = new Error(res.error.message || 'db error') as Error & { code?: string }
      e.code = res.error.code
      throw e
    }
    const data = res?.data
    if (name === 'get_device_daily_usage') {
      // El código lee rowsOf(res)[0]?.total (escalar AS total).
      return { rows: data == null ? [] : [{ total: data }] }
    }
    // increment / status devuelven TABLE → rowsOf(res)[0].
    if (data == null) return { rows: [] }
    return { rows: Array.isArray(data) ? data : [data] }
  })
})

// ============================================
// getUserIdFromToken
// ============================================

describe('getUserIdFromToken', () => {
  it('returns null when no Authorization header', async () => {
    expect(await getUserIdFromToken(fakeRequest())).toBeNull()
  })

  it('returns null when Authorization is not Bearer', async () => {
    expect(await getUserIdFromToken(fakeRequest({ authorization: 'Basic abc' }))).toBeNull()
  })

  it('returns userId when valid Bearer token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-uuid-123' } }, error: null })
    expect(await getUserIdFromToken(fakeRequest({ authorization: 'Bearer valid-token' }))).toBe('user-uuid-123')
  })

  it('returns null when token is invalid/expired', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid' } })
    expect(await getUserIdFromToken(fakeRequest({ authorization: 'Bearer expired' }))).toBeNull()
  })

  it('returns null on exception (never throws)', async () => {
    mockGetUser.mockRejectedValue(new Error('network'))
    expect(await getUserIdFromToken(fakeRequest({ authorization: 'Bearer x' }))).toBeNull()
  })
})

// ============================================
// checkAndIncrementDailyLimit
// ============================================

describe('checkAndIncrementDailyLimit', () => {
  it('allows null userId (anonymous) without calling RPC', async () => {
    const r = await checkAndIncrementDailyLimit(null)
    expect(r.allowed).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('allows undefined userId (anonymous)', async () => {
    const r = await checkAndIncrementDailyLimit(undefined)
    expect(r.allowed).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('allows premium users', async () => {
    mockRpc.mockResolvedValue({
      data: { can_answer: true, questions_today: 0, questions_remaining: 999, is_premium: true },
      error: null,
    })
    const r = await checkAndIncrementDailyLimit('premium-id')
    expect(r.allowed).toBe(true)
    expect(r.isPremium).toBe(true)
  })

  it('allows free user under limit', async () => {
    mockRpc.mockResolvedValue({
      data: { can_answer: true, questions_today: 1, questions_remaining: 24, is_premium: false },
      error: null,
    })
    const r = await checkAndIncrementDailyLimit('free-id')
    expect(r.allowed).toBe(true)
    expect(r.questionsToday).toBe(1)
    expect(r.questionsRemaining).toBe(24)
  })

  it('allows free user on last question (25th)', async () => {
    mockRpc.mockResolvedValue({
      data: { can_answer: true, questions_today: 25, questions_remaining: 0, is_premium: false },
      error: null,
    })
    expect((await checkAndIncrementDailyLimit('free-id')).allowed).toBe(true)
  })

  it('BLOCKS free user on 26th attempt', async () => {
    mockRpc.mockResolvedValue({
      data: { can_answer: false, questions_today: 25, questions_remaining: 0, is_premium: false },
      error: null,
    })
    const r = await checkAndIncrementDailyLimit('free-id')
    expect(r.allowed).toBe(false)
    expect(r.questionsToday).toBe(25)
  })

  it('fails open on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db down' } })
    expect((await checkAndIncrementDailyLimit('id')).allowed).toBe(true)
  })

  it('fails open on unexpected exception', async () => {
    mockRpc.mockRejectedValue(new Error('timeout'))
    expect((await checkAndIncrementDailyLimit('id')).allowed).toBe(true)
  })

  it('handles array response (Supabase RETURNS TABLE)', async () => {
    mockRpc.mockResolvedValue({
      data: [{ can_answer: false, questions_today: 25, questions_remaining: 0, is_premium: false }],
      error: null,
    })
    expect((await checkAndIncrementDailyLimit('free-id')).allowed).toBe(false)
  })

  it('calls increment_daily_questions with correct params', async () => {
    mockRpc.mockResolvedValue({
      data: { can_answer: true, questions_today: 1, questions_remaining: 24, is_premium: false },
      error: null,
    })
    await checkAndIncrementDailyLimit('test-uuid')
    expect(mockRpc).toHaveBeenCalledWith('increment_daily_questions', {
      p_user_id: 'test-uuid',
      p_limit: 25,
    })
  })
})

// ============================================
// getDailyLimitStatus (read-only)
// ============================================

describe('getDailyLimitStatus', () => {
  it('returns allowed for null userId', async () => {
    expect((await getDailyLimitStatus(null)).allowed).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls get_daily_question_status RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { questions_today: 10, questions_remaining: 15, is_limit_reached: false, is_premium: false },
      error: null,
    })
    const r = await getDailyLimitStatus('uid')
    expect(r.allowed).toBe(true)
    expect(r.questionsToday).toBe(10)
    expect(mockRpc).toHaveBeenCalledWith('get_daily_question_status', { p_user_id: 'uid' })
  })

  it('returns not allowed when limit reached', async () => {
    mockRpc.mockResolvedValue({
      data: { questions_today: 25, questions_remaining: 0, is_limit_reached: true, is_premium: false },
      error: null,
    })
    expect((await getDailyLimitStatus('uid')).allowed).toBe(false)
  })

  it('fails open on error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'err' } })
    expect((await getDailyLimitStatus('uid')).allowed).toBe(true)
  })

  // Defensa (03/06/2026): un blip de BD no debe bloquear a nadie. El fallback
  // marca degraded=true y los endpoints saltan el device-daily-limit con él.
  it('marca degraded=true en error de RPC (fail-open, sin aplicar device-limit aguas abajo)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } })
    const r = await getDailyLimitStatus('uid-degraded-fresh')
    expect(r.allowed).toBe(true)
    expect(r.degraded).toBe(true)
    expect(r.isPremium).toBe(false)
  })

  it('una lectura real NO marca degraded', async () => {
    mockRpc.mockResolvedValue({
      data: { questions_today: 3, questions_remaining: 22, is_limit_reached: false, is_premium: false },
      error: null,
    })
    const r = await getDailyLimitStatus('uid-ok')
    expect(r.degraded).toBeFalsy()
  })
})

// ============================================
// ATTACK SCENARIO SIMULATIONS
// ============================================

describe('Attack scenarios', () => {
  it('ATTACK: Scraper sends fake premium userId in body — server uses token userId', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'real-free-user' } }, error: null })
    const realUserId = await getUserIdFromToken(fakeRequest({ authorization: 'Bearer real-token' }))
    expect(realUserId).toBe('real-free-user')

    mockRpc.mockResolvedValue({
      data: { can_answer: false, questions_today: 25, questions_remaining: 0, is_premium: false },
      error: null,
    })
    expect((await checkAndIncrementDailyLimit(realUserId)).allowed).toBe(false)
  })

  it('ATTACK: No Bearer token — passes as anonymous (IP rate limit applies)', async () => {
    const userId = await getUserIdFromToken(fakeRequest())
    expect(userId).toBeNull()
    const r = await checkAndIncrementDailyLimit(userId)
    expect(r.allowed).toBe(true)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('ATTACK: Free user exhausts 25 questions, 26th blocked', async () => {
    for (let i = 1; i <= 25; i++) {
      mockRpc.mockResolvedValueOnce({
        data: { can_answer: true, questions_today: i, questions_remaining: 25 - i, is_premium: false },
        error: null,
      })
    }
    mockRpc.mockResolvedValueOnce({
      data: { can_answer: false, questions_today: 25, questions_remaining: 0, is_premium: false },
      error: null,
    })

    for (let i = 1; i <= 25; i++) {
      expect((await checkAndIncrementDailyLimit('free')).allowed).toBe(true)
    }
    expect((await checkAndIncrementDailyLimit('free')).allowed).toBe(false)
  })

  it('ATTACK: Sends another users userId in body — server ignores it, uses token', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a-at-limit' } }, error: null })
    mockRpc.mockResolvedValue({
      data: { can_answer: false, questions_today: 25, questions_remaining: 0, is_premium: false },
      error: null,
    })

    const realUserId = await getUserIdFromToken(fakeRequest({ authorization: 'Bearer a-token' }))
    const r = await checkAndIncrementDailyLimit(realUserId)
    expect(r.allowed).toBe(false)
    expect(mockRpc).toHaveBeenCalledWith('increment_daily_questions', {
      p_user_id: 'user-a-at-limit',
      p_limit: 25,
    })
  })

  it('RESILIENCE: DB down mid-session — fail open, user not blocked', async () => {
    for (let i = 0; i < 5; i++) {
      mockRpc.mockResolvedValueOnce({
        data: { can_answer: true, questions_today: i + 1, questions_remaining: 24 - i, is_premium: false },
        error: null,
      })
    }
    mockRpc.mockRejectedValueOnce(new Error('connection refused'))

    for (let i = 0; i < 5; i++) {
      expect((await checkAndIncrementDailyLimit('u')).allowed).toBe(true)
    }
    expect((await checkAndIncrementDailyLimit('u')).allowed).toBe(true)
  })
})

// ============================================
// checkDeviceDailyUsage (shared device limit)
// ============================================

describe('checkDeviceDailyUsage', () => {
  it('returns null for null deviceId (fail open)', async () => {
    expect(await checkDeviceDailyUsage(null)).toBeNull()
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('returns null for undefined deviceId', async () => {
    expect(await checkDeviceDailyUsage(undefined)).toBeNull()
  })

  it('allows when device total < 25', async () => {
    mockRpc.mockResolvedValue({ data: 10, error: null })
    const r = await checkDeviceDailyUsage('device-1')
    expect(r).not.toBeNull()
    expect(r!.allowed).toBe(true)
    expect(r!.deviceTotal).toBe(10)
  })

  it('BLOCKS when device total >= 25', async () => {
    mockRpc.mockResolvedValue({ data: 25, error: null })
    const r = await checkDeviceDailyUsage('device-1')
    expect(r!.allowed).toBe(false)
    expect(r!.deviceTotal).toBe(25)
  })

  it('BLOCKS when device total > 25 (over limit)', async () => {
    mockRpc.mockResolvedValue({ data: 30, error: null })
    expect((await checkDeviceDailyUsage('device-1'))!.allowed).toBe(false)
  })

  it('returns null if function does not exist (PGRST202)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'not found' } })
    expect(await checkDeviceDailyUsage('device-1')).toBeNull()
  })

  it('returns null if table does not exist (42P01)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { code: '42P01', message: 'not found' } })
    expect(await checkDeviceDailyUsage('device-1')).toBeNull()
  })

  it('returns null on exception (fail open)', async () => {
    mockRpc.mockRejectedValue(new Error('timeout'))
    expect(await checkDeviceDailyUsage('device-1')).toBeNull()
  })

  it('calls get_device_daily_usage with correct param', async () => {
    mockRpc.mockResolvedValue({ data: 0, error: null })
    await checkDeviceDailyUsage('my-device-uuid')
    expect(mockRpc).toHaveBeenCalledWith('get_device_daily_usage', { p_device_id: 'my-device-uuid' })
  })
})

// ============================================
// MULTI-ACCOUNT ATTACK SCENARIO
// ============================================

describe('Multi-account on same device', () => {
  it('ATTACK: 2 free accounts on same device, each uses 13 questions = 26 total — device blocked', async () => {
    // User A answers 13 questions (under per-user limit)
    // User B answers 13 questions (under per-user limit)
    // But device total = 26 → over 25 → BLOCKED on next attempt

    // Device daily usage check returns 26
    mockRpc.mockResolvedValue({ data: 26, error: null })
    const r = await checkDeviceDailyUsage('shared-device')
    expect(r!.allowed).toBe(false)
    expect(r!.deviceTotal).toBe(26)
  })

  it('LEGITIMATE: Premium user on shared device — not counted in device total', async () => {
    // The SQL function excludes premium accounts from the sum
    // So even if premium user answered 100 questions, device total only counts free users
    mockRpc.mockResolvedValue({ data: 5, error: null }) // Only free user's 5 questions
    const r = await checkDeviceDailyUsage('family-device')
    expect(r!.allowed).toBe(true)
    expect(r!.deviceTotal).toBe(5)
  })
})

// ============================================
// incrementDailyCount (post-save increment)
// ============================================

describe('incrementDailyCount', () => {
  it('does nothing for null userId', async () => {
    await incrementDailyCount(null)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('does nothing for undefined userId', async () => {
    await incrementDailyCount(undefined)
    expect(mockRpc).not.toHaveBeenCalled()
  })

  it('calls increment_daily_questions RPC', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null })
    await incrementDailyCount('user-123')
    expect(mockRpc).toHaveBeenCalledWith('increment_daily_questions', {
      p_user_id: 'user-123',
      p_limit: 25,
    })
  })

  it('does not throw on RPC error (fail silent)', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db error' } })
    await expect(incrementDailyCount('user-123')).resolves.toBeUndefined()
  })

  it('does not throw on network exception (fail silent)', async () => {
    mockRpc.mockRejectedValue(new Error('network timeout'))
    await expect(incrementDailyCount('user-123')).resolves.toBeUndefined()
  })
})

// ============================================
// FLOW SIMULATION: check → save → increment
// ============================================

describe('Correct flow: getDailyLimitStatus → save → incrementDailyCount', () => {
  it('Scenario: free user answers 1 question successfully', async () => {
    // Step 1: Check (read-only) — user has 10/25
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 10, questions_remaining: 15, is_limit_reached: false, is_premium: false },
      error: null,
    })
    const limit = await getDailyLimitStatus('free-user')
    expect(limit.allowed).toBe(true)
    expect(limit.questionsToday).toBe(10)
    expect(mockRpc).toHaveBeenCalledWith('get_daily_question_status', { p_user_id: 'free-user' })

    // Step 2: Save succeeds (simulated)
    const saveSuccess = true

    // Step 3: Increment only if save OK
    if (saveSuccess && !limit.isPremium) {
      mockRpc.mockResolvedValueOnce({ data: null, error: null })
      await incrementDailyCount('free-user')
    }
    expect(mockRpc).toHaveBeenCalledTimes(2)
    expect(mockRpc).toHaveBeenLastCalledWith('increment_daily_questions', {
      p_user_id: 'free-user',
      p_limit: 25,
    })
  })

  it('Scenario: save FAILS — counter NOT incremented', async () => {
    // Step 1: Check — user has 24/25 (last question)
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 24, questions_remaining: 1, is_limit_reached: false, is_premium: false },
      error: null,
    })
    const limit = await getDailyLimitStatus('free-user')
    expect(limit.allowed).toBe(true)

    // Step 2: Save FAILS
    const saveSuccess = false

    // Step 3: Do NOT increment
    if (saveSuccess && !limit.isPremium) {
      await incrementDailyCount('free-user')
    }
    // Only 1 RPC call (the check), no increment
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('Scenario: retry after failure — counter only increments ONCE', async () => {
    // Attempt 1: check passes, save fails, no increment
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 20, questions_remaining: 5, is_limit_reached: false, is_premium: false },
      error: null,
    })
    const limit1 = await getDailyLimitStatus('free-user')
    expect(limit1.allowed).toBe(true)
    const save1 = false // save fails
    if (save1 && !limit1.isPremium) await incrementDailyCount('free-user')

    // Attempt 2 (retry): check passes again, save succeeds, increment once
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 20, questions_remaining: 5, is_limit_reached: false, is_premium: false },
      error: null,
    })
    const limit2 = await getDailyLimitStatus('free-user')
    expect(limit2.allowed).toBe(true)
    const save2 = true // save succeeds
    if (save2 && !limit2.isPremium) {
      mockRpc.mockResolvedValueOnce({ data: null, error: null })
      await incrementDailyCount('free-user')
    }

    // 3 RPC calls: check, check, increment (NOT check, increment, check, increment)
    expect(mockRpc).toHaveBeenCalledTimes(3)
  })

  it('Scenario: premium user — never increments, never blocked', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 0, questions_remaining: 999, is_limit_reached: false, is_premium: true },
      error: null,
    })
    const limit = await getDailyLimitStatus('premium-user')
    expect(limit.allowed).toBe(true)
    expect(limit.isPremium).toBe(true)

    // Save succeeds
    const saveSuccess = true

    // Premium: skip increment
    if (saveSuccess && !limit.isPremium) {
      await incrementDailyCount('premium-user')
    }
    // Only 1 call (the check), no increment for premium
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('Scenario: free user at limit (25/25) — blocked before save', async () => {
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 25, questions_remaining: 0, is_limit_reached: true, is_premium: false },
      error: null,
    })
    const limit = await getDailyLimitStatus('free-user')
    expect(limit.allowed).toBe(false)
    // Should return 403 — never reaches save or increment
    expect(mockRpc).toHaveBeenCalledTimes(1)
  })

  it('Scenario: Lidia bug — OLD flow would double-count, NEW flow does not', async () => {
    // Simulate 12 questions where OLD flow would count 24 (2x each)
    // but NEW flow counts exactly 12
    let incrementCount = 0

    for (let i = 0; i < 12; i++) {
      // Check (read-only)
      mockRpc.mockResolvedValueOnce({
        data: { questions_today: i, questions_remaining: 25 - i, is_limit_reached: false, is_premium: false },
        error: null,
      })
      const limit = await getDailyLimitStatus('lidia')
      expect(limit.allowed).toBe(true)

      // Save succeeds
      const saveSuccess = true

      // Increment once per successful save
      if (saveSuccess && !limit.isPremium) {
        mockRpc.mockResolvedValueOnce({ data: null, error: null })
        await incrementDailyCount('lidia')
        incrementCount++
      }
    }

    // Exactly 12 increments for 12 questions (not 24)
    expect(incrementCount).toBe(12)
    // 24 total RPC calls: 12 checks + 12 increments
    expect(mockRpc).toHaveBeenCalledTimes(24)
  })

  it('Scenario: device limit — premium bypasses, free gets checked', async () => {
    // Premium user: getDailyLimitStatus returns isPremium=true → skip device check
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 0, questions_remaining: 999, is_limit_reached: false, is_premium: true },
      error: null,
    })
    const premiumLimit = await getDailyLimitStatus('premium')
    expect(premiumLimit.isPremium).toBe(true)
    // Should NOT call checkDeviceDailyUsage for premium

    // Free user: getDailyLimitStatus returns isPremium=false → check device
    mockRpc.mockResolvedValueOnce({
      data: { questions_today: 5, questions_remaining: 20, is_limit_reached: false, is_premium: false },
      error: null,
    })
    const freeLimit = await getDailyLimitStatus('free')
    expect(freeLimit.isPremium).toBe(false)

    // Device check for free user — device at 24
    mockRpc.mockResolvedValueOnce({ data: 24, error: null })
    const deviceUsage = await checkDeviceDailyUsage('shared-device')
    expect(deviceUsage!.allowed).toBe(true) // 24 < 25

    // Device check for free user — device at 25
    mockRpc.mockResolvedValueOnce({ data: 25, error: null })
    const deviceBlocked = await checkDeviceDailyUsage('shared-device')
    expect(deviceBlocked!.allowed).toBe(false) // 25 >= 25
  })
})
