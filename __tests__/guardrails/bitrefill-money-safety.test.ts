/**
 * @jest-environment node
 */
// __tests__/guardrails/bitrefill-money-safety.test.ts
// GUARDARRAÍL de SEGURIDAD DE DINERO del sistema de vales:
//  1. purchaseAmazonGiftCard NUNCA gasta sin BITREFILL_LIVE=1 → por defecto dry-run y NO toca la red.
//  2. El endpoint de emisión es admin-only (requireAdmin).
//  3. /api/referrals/vouchers es user-scoped (identidad del token, no del cliente).
// Si alguien rompe cualquiera de estas, este test falla antes de tocar dinero real.

import { readFileSync } from 'fs'
import { join } from 'path'
import { purchaseAmazonGiftCard, bitrefillLive } from '@/lib/referrals/bitrefill'

const ROOT = join(__dirname, '..', '..')

describe('guardarraíl — seguridad de dinero (vales Bitrefill)', () => {
  it('sin BITREFILL_LIVE=1 → dry-run: NO llama a la red (no gasta ni un céntimo)', async () => {
    delete process.env.BITREFILL_LIVE
    const spy = jest.spyOn(global, 'fetch')
    const r = await purchaseAmazonGiftCard(5)
    expect(r.dryRun).toBe(true)
    expect(r.ok).toBe(true)
    expect(String(r.code)).toContain('DRYRUN')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('bitrefillLive() es false salvo el flag EXACTO "1"', () => {
    delete process.env.BITREFILL_LIVE
    expect(bitrefillLive()).toBe(false)
    process.env.BITREFILL_LIVE = 'true'
    expect(bitrefillLive()).toBe(false)
    process.env.BITREFILL_LIVE = '1'
    expect(bitrefillLive()).toBe(true)
    delete process.env.BITREFILL_LIVE
  })

  it('el endpoint de emisión exige requireAdmin', () => {
    const src = readFileSync(join(ROOT, 'app/api/admin/rewards/issue-giftcard/route.ts'), 'utf8')
    expect(src).toMatch(/requireAdmin\s*\(/)
  })

  it('/api/referrals/vouchers usa identidad del TOKEN, no del cliente', () => {
    const src = readFileSync(join(ROOT, 'app/api/referrals/vouchers/route.ts'), 'utf8')
    expect(src).toMatch(/getAuthenticatedUser\s*\(/)
    expect(src).toMatch(/auth\.user\.id/)
    expect(src).not.toMatch(/searchParams\.get\(\s*['"]userId/)
  })
})
