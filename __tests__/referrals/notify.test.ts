/**
 * @jest-environment node
 */
// __tests__/referrals/notify.test.ts — CAPA unit de notifyEarning (email de ganancia, best-effort).
// Verifica: no-op sin RESEND_API_KEY / sin userId / amount<=0; y que con todo OK envía el email al
// usuario correcto. Nunca lanza (envuelve fallos).

const mockSend = jest.fn().mockResolvedValue({ id: 'em_1' })
jest.mock('resend', () => ({ Resend: jest.fn().mockImplementation(() => ({ emails: { send: mockSend } })) }))

const mockExecute = jest.fn()
jest.mock('@/db/client', () => ({ getReadDb: () => ({ execute: mockExecute }) }))

import { notifyEarning } from '@/lib/referrals/notify'

describe('notifyEarning', () => {
  const OLD = process.env
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...OLD, RESEND_API_KEY: 'test_key', EMAIL_FROM_ADDRESS: 'info@vence.es', EMAIL_FROM_NAME: 'Vence' }
    mockExecute.mockResolvedValue([{ email: 'emb@example.com', full_name: 'Ana López' }])
  })
  afterAll(() => { process.env = OLD })

  it('sin RESEND_API_KEY → no-op', async () => {
    delete process.env.RESEND_API_KEY
    await notifyEarning('u1', { source: 'referido', amount: 10 })
    expect(mockExecute).not.toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('sin userId → no-op', async () => {
    await notifyEarning(null, { source: 'bug', amount: 3 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('amount <= 0 → no-op', async () => {
    await notifyEarning('u1', { source: 'bug', amount: 0 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('usuario sin email → no envía', async () => {
    mockExecute.mockResolvedValue([{ email: null, full_name: 'X' }])
    await notifyEarning('u1', { source: 'ugc', amount: 5 })
    expect(mockSend).not.toHaveBeenCalled()
  })

  it('OK → envía email al destinatario correcto, SIN spoiler de importe/fuente', async () => {
    await notifyEarning('u1', { source: 'referido', amount: 10 })
    expect(mockSend).toHaveBeenCalledTimes(1)
    const arg = mockSend.mock.calls[0][0]
    expect(arg.to).toBe('emb@example.com')
    expect(arg.html).toContain('Ana') // primer nombre (no es spoiler)
    // NO revela importe ni fuente (el gancho es entrar a /embajadores a descubrirlo)
    expect(arg.subject).not.toContain('10')
    expect(arg.subject).not.toContain('€')
    expect(arg.html).not.toContain('10 €')
    expect(arg.html).toContain('/embajadores') // botón directo
  })

  it('nunca lanza aunque falle el envío', async () => {
    mockSend.mockRejectedValueOnce(new Error('resend down'))
    await expect(notifyEarning('u1', { source: 'bug', amount: 3 })).resolves.toBeUndefined()
  })
})
