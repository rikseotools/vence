// __tests__/security/questionsServed.test.ts
//
// Policy anti-scraping de volumen: gate por SUJETO (usuario logueado o IP
// anónima) con umbral anónimo más bajo. Redis mockeado.

const mockGetCounter = jest.fn<Promise<number>, [string]>()
jest.mock('@/lib/cache/redis', () => ({
  getCounter: (k: string) => mockGetCounter(k),
  incrementCounterWithTtl: jest.fn().mockResolvedValue(1),
}))

import {
  subjectFor,
  shouldChallengeForQuestions,
} from '@/lib/security/challengePolicy/questionsServed'

const ORIGINAL_ENV = { ...process.env }

beforeEach(() => {
  mockGetCounter.mockReset()
  process.env = { ...ORIGINAL_ENV }
  delete process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD
  delete process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD_ANON
})
afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('subjectFor', () => {
  it('usuario logueado → su userId', () => {
    expect(subjectFor('uuid-123', '1.2.3.4')).toBe('uuid-123')
  })
  it('anónimo → ip:<ip> (no colisiona con UUID)', () => {
    expect(subjectFor(null, '1.2.3.4')).toBe('ip:1.2.3.4')
    expect(subjectFor(undefined, null)).toBe('ip:unknown')
  })
})

describe('shouldChallengeForQuestions — umbral por tipo de sujeto', () => {
  it('ANÓNIMO supera su umbral (300) → reta', async () => {
    mockGetCounter.mockResolvedValue(300)
    expect(await shouldChallengeForQuestions('ip:9.9.9.9')).toBe(true)
  })

  it('ANÓNIMO con 299 (justo por debajo) → NO reta', async () => {
    mockGetCounter.mockResolvedValue(299)
    expect(await shouldChallengeForQuestions('ip:9.9.9.9')).toBe(false)
  })

  it('LOGUEADO con 300 (umbral anónimo) NO reta — su umbral es 500', async () => {
    mockGetCounter.mockResolvedValue(300)
    expect(await shouldChallengeForQuestions('uuid-abc')).toBe(false)
  })

  it('LOGUEADO con 500 → reta', async () => {
    mockGetCounter.mockResolvedValue(500)
    expect(await shouldChallengeForQuestions('uuid-abc')).toBe(true)
  })

  it('umbrales configurables por env', async () => {
    process.env.CAPTCHA_QUESTIONS_SERVED_THRESHOLD_ANON = '50'
    mockGetCounter.mockResolvedValue(60)
    expect(await shouldChallengeForQuestions('ip:1.1.1.1')).toBe(true)
  })

  it('Redis caído (getCounter=0) → fail-open, no reta', async () => {
    mockGetCounter.mockResolvedValue(0)
    expect(await shouldChallengeForQuestions('ip:9.9.9.9')).toBe(false)
  })
})
