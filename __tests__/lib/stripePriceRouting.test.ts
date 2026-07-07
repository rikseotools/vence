// __tests__/lib/stripePriceRouting.test.ts
// Normalización de precio entre cuentas Stripe (multi-cuenta: manuel/nila).
// Cubre el fix del half-flip 07/07: el frontend hornea NEXT_PUBLIC_STRIPE_PRICE_*
// en build-time y puede enviar el precio de otra cuenta que la que enruta el flag
// STRIPE_NEW_SIGNUPS_ACCOUNT; el backend debe traducir por tier, no rechazar.

const PRICES = {
  NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: 'price_m_manuel',
  NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY: 'price_q_manuel',
  NEXT_PUBLIC_STRIPE_PRICE_SEMESTER: 'price_s_manuel',
  NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA: 'price_m_nila',
  NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA: 'price_q_nila',
  NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA: 'price_s_nila',
}

beforeAll(() => {
  Object.assign(process.env, PRICES)
})

import { getPriceTier, resolvePriceForAccount, priceBelongsToAccount } from '@/lib/stripe'

describe('getPriceTier — reconoce el tier en cualquier cuenta', () => {
  it('precios de manuel', () => {
    expect(getPriceTier('price_m_manuel')).toBe('monthly')
    expect(getPriceTier('price_q_manuel')).toBe('quarterly')
    expect(getPriceTier('price_s_manuel')).toBe('semester')
  })
  it('precios de nila', () => {
    expect(getPriceTier('price_m_nila')).toBe('monthly')
    expect(getPriceTier('price_q_nila')).toBe('quarterly')
    expect(getPriceTier('price_s_nila')).toBe('semester')
  })
  it('precio desconocido → null', () => {
    expect(getPriceTier('price_desconocido')).toBeNull()
    expect(getPriceTier('')).toBeNull()
  })
})

describe('resolvePriceForAccount — traduce por tier a la cuenta destino', () => {
  it('manuel → nila (el caso del half-flip: altas nuevas a nila)', () => {
    expect(resolvePriceForAccount('price_m_manuel', 'nila')).toBe('price_m_nila')
    expect(resolvePriceForAccount('price_q_manuel', 'nila')).toBe('price_q_nila')
    expect(resolvePriceForAccount('price_s_manuel', 'nila')).toBe('price_s_nila')
  })
  it('nila → manuel (sobrevive al flip inverso sin rebuild)', () => {
    expect(resolvePriceForAccount('price_m_nila', 'manuel')).toBe('price_m_manuel')
    expect(resolvePriceForAccount('price_s_nila', 'manuel')).toBe('price_s_manuel')
  })
  it('mismo-a-mismo devuelve el propio precio', () => {
    expect(resolvePriceForAccount('price_q_nila', 'nila')).toBe('price_q_nila')
    expect(resolvePriceForAccount('price_q_manuel', 'manuel')).toBe('price_q_manuel')
  })
  it('precio desconocido → null (config realmente inválida, se aborta arriba)', () => {
    expect(resolvePriceForAccount('price_desconocido', 'nila')).toBeNull()
  })
})

describe('priceBelongsToAccount — coherencia con la traducción', () => {
  it('un precio pertenece solo a su cuenta', () => {
    expect(priceBelongsToAccount('price_m_manuel', 'manuel')).toBe(true)
    expect(priceBelongsToAccount('price_m_manuel', 'nila')).toBe(false)
    expect(priceBelongsToAccount('price_m_nila', 'nila')).toBe(true)
  })
  it('el precio traducido SÍ pertenece a la cuenta destino (invariante del fix)', () => {
    const translated = resolvePriceForAccount('price_m_manuel', 'nila')!
    expect(priceBelongsToAccount(translated, 'nila')).toBe(true)
  })
})
