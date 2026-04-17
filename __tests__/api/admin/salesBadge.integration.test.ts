/**
 * @jest-environment node
 */
// __tests__/api/admin/salesBadge.integration.test.ts
// Tests de integración que ejecutan queries reales contra la BD.
// Se salta si no hay DATABASE_URL (CI-safe).

import { config } from 'dotenv'
config({ path: '.env.local' })

const hasDb = !!process.env.DATABASE_URL
const describeIfDb = hasDb ? describe : describe.skip

import { getUnreadSalesCount, markSalesAsRead } from '@/lib/api/admin/salesBadge'

describeIfDb('salesBadge queries (integración)', () => {
  it('getUnreadSalesCount ejecuta sin error SQL y devuelve { count, totalAmount }', async () => {
    const result = await getUnreadSalesCount()
    expect(typeof result.count).toBe('number')
    expect(result.count).toBeGreaterThanOrEqual(0)
    expect(typeof result.totalAmount).toBe('number')
  })

  it('markSalesAsRead ejecuta sin error SQL', async () => {
    await expect(markSalesAsRead()).resolves.not.toThrow()
  })

  it('markSalesAsRead resetea el conteo a 0', async () => {
    await markSalesAsRead()
    const result = await getUnreadSalesCount()
    expect(result.count).toBe(0)
  })
})
