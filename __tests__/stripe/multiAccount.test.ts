/**
 * Tests del registro multi-cuenta de Stripe (lib/stripe.ts).
 *
 * Cubre la lógica de ENRUTADO que decide qué cuenta atiende cada operación —
 * el núcleo del que dependen create-checkout, webhook, cancelar/portal, etc.
 * No golpea la API de Stripe: solo verifica resolución de cuenta, guardrails de
 * precio y descubrimiento de secrets de webhook desde el entorno.
 */

import {
  resolveAccount,
  newSignupAccount,
  priceBelongsToAccount,
  getWebhookAccounts,
  getPricesFor,
  getPriceTier,
  resolvePriceForAccount,
  DEFAULT_ACCOUNT,
} from '@/lib/stripe'

const ORIGINAL_ENV = process.env

beforeEach(() => {
  // Copia aislada por test para poder mutar sin filtrar entre casos.
  process.env = { ...ORIGINAL_ENV }
})

afterAll(() => {
  process.env = ORIGINAL_ENV
})

describe('resolveAccount', () => {
  it('mapea valores conocidos a su cuenta', () => {
    expect(resolveAccount('manuel')).toBe('manuel')
    expect(resolveAccount('nila')).toBe('nila')
  })

  it('cae al default con null/undefined/desconocido (filas legacy)', () => {
    expect(resolveAccount(null)).toBe(DEFAULT_ACCOUNT)
    expect(resolveAccount(undefined)).toBe(DEFAULT_ACCOUNT)
    expect(resolveAccount('')).toBe(DEFAULT_ACCOUNT)
    expect(resolveAccount('paddle')).toBe(DEFAULT_ACCOUNT)
  })

  it('el default es manuel (cuenta histórica)', () => {
    expect(DEFAULT_ACCOUNT).toBe('manuel')
  })
})

describe('newSignupAccount (flag STRIPE_NEW_SIGNUPS_ACCOUNT)', () => {
  it('default manuel cuando el flag no está puesto (= comportamiento actual)', () => {
    delete process.env.STRIPE_NEW_SIGNUPS_ACCOUNT
    expect(newSignupAccount()).toBe('manuel')
  })

  it('desvía a nila cuando el flag = nila', () => {
    process.env.STRIPE_NEW_SIGNUPS_ACCOUNT = 'nila'
    expect(newSignupAccount()).toBe('nila')
  })

  it('un valor inválido cae al default (fail-safe, no cobra en cuenta fantasma)', () => {
    process.env.STRIPE_NEW_SIGNUPS_ACCOUNT = 'typo'
    expect(newSignupAccount()).toBe('manuel')
  })
})

describe('priceBelongsToAccount (guardrail anti half-flip)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY = 'price_manuel_m'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY = 'price_manuel_q'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_SEMESTER = 'price_manuel_s'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL = 'price_manuel_a'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_NILA = 'price_nila_m'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_QUARTERLY_NILA = 'price_nila_q'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_SEMESTER_NILA = 'price_nila_s'
    process.env.NEXT_PUBLIC_STRIPE_PRICE_ANNUAL_NILA = 'price_nila_a'
  })

  it('acepta precios de la propia cuenta', () => {
    expect(priceBelongsToAccount('price_manuel_q', 'manuel')).toBe(true)
    expect(priceBelongsToAccount('price_nila_s', 'nila')).toBe(true)
    expect(priceBelongsToAccount('price_nila_a', 'nila')).toBe(true) // anual
  })

  it('rechaza un precio de la OTRA cuenta (cobraría en la equivocada)', () => {
    expect(priceBelongsToAccount('price_manuel_q', 'nila')).toBe(false)
    expect(priceBelongsToAccount('price_nila_m', 'manuel')).toBe(false)
    expect(priceBelongsToAccount('price_manuel_a', 'nila')).toBe(false) // anual
  })

  it('rechaza un priceId inventado', () => {
    expect(priceBelongsToAccount('price_desconocido', 'manuel')).toBe(false)
  })

  it('getPricesFor devuelve los 4 precios de la cuenta (incl. anual)', () => {
    expect(getPricesFor('nila')).toEqual({
      monthly: 'price_nila_m',
      quarterly: 'price_nila_q',
      semester: 'price_nila_s',
      annual: 'price_nila_a',
    })
  })

  it('getPriceTier reconoce el anual en cualquier cuenta', () => {
    expect(getPriceTier('price_manuel_a')).toBe('annual')
    expect(getPriceTier('price_nila_a')).toBe('annual')
    expect(getPriceTier('price_nila_m')).toBe('monthly')
  })

  it('resolvePriceForAccount traduce el anual entre cuentas por su tier (lo que hace el checkout tras el flip)', () => {
    // Frontend horneado con precio anual de Manuel, flip activo a Nila →
    // el checkout debe cobrar el anual EQUIVALENTE de Nila, no rechazar.
    expect(resolvePriceForAccount('price_manuel_a', 'nila')).toBe('price_nila_a')
    expect(resolvePriceForAccount('price_nila_a', 'manuel')).toBe('price_manuel_a')
  })
})

describe('getWebhookAccounts', () => {
  it('solo devuelve cuentas con webhook secret configurado', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_manuel'
    delete process.env.STRIPE_WEBHOOK_SECRET_NILA
    const accounts = getWebhookAccounts()
    expect(accounts.map((a) => a.account)).toEqual(['manuel'])
    expect(accounts[0].secret).toBe('whsec_manuel')
  })

  it('devuelve ambas cuando ambas tienen secret (verifica firma contra las dos)', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_manuel'
    process.env.STRIPE_WEBHOOK_SECRET_NILA = 'whsec_nila'
    const accounts = getWebhookAccounts()
    const map = Object.fromEntries(accounts.map((a) => [a.account, a.secret]))
    expect(map).toEqual({ manuel: 'whsec_manuel', nila: 'whsec_nila' })
  })
})
