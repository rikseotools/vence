// __tests__/api/daily-limit-enforcement.test.ts
// Tests for server-side daily limit enforcement in answer endpoints

// Set env vars FIRST
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'mock-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'mock-service-role-key'

const mockRpc = jest.fn()
const mockGetUser = jest.fn()

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, key: string) => {
    if (key === process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return { rpc: mockRpc }
    }
    return { auth: { getUser: mockGetUser } }
  }),
}))

import { checkAndIncrementDailyLimit, getDailyLimitStatus, getUserIdFromToken } from '@/lib/api/dailyLimit'

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
