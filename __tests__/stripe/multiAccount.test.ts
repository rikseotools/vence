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
  getConfiguredAccounts,
  STRIPE_ACCOUNTS,
  listSubscriptionsAllAccounts,
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

// ============================================================================
// LECTURAS AGREGADAS MULTI-CUENTA
// ----------------------------------------------------------------------------
// Regresión 29/07/2026: /admin/conversiones barría /v1/subscriptions con la
// secret key de la cuenta por defecto → MRR/ARR/renovaciones a 0€ mientras la
// cuenta de altas (Nila) tenía 53 subs vivas. Estos tests fijan que el barrido
// recorre TODAS las cuentas configuradas, etiqueta cada sub con la suya y no
// oculta el fallo parcial de una cuenta.
// ============================================================================

const sub = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  status: 'active',
  cancel_at_period_end: false,
  created: 1_700_000_000,
  items: { data: [{ price: { recurring: { interval: 'month', interval_count: 1 } } }] },
  ...extra,
})

describe('STRIPE_ACCOUNTS (cuentas conocidas)', () => {
  it('lista TODAS las cuentas conocidas, estén configuradas o no', () => {
    // El chequeo de salud del webhook compara conocidas vs configuradas para
    // delatar una cuenta sin vigilar; si esta lista se queda corta, esa cuenta
    // desaparece del radar en silencio.
    delete process.env.STRIPE_SECRET_KEY_NILA
    expect([...STRIPE_ACCOUNTS]).toEqual(['manuel', 'nila'])
  })
})

describe('getConfiguredAccounts', () => {
  it('solo devuelve cuentas con secret key configurada', () => {
    process.env.STRIPE_SECRET_KEY = 'sk_manuel'
    delete process.env.STRIPE_SECRET_KEY_NILA
    expect(getConfiguredAccounts()).toEqual(['manuel'])

    process.env.STRIPE_SECRET_KEY_NILA = 'sk_nila'
    expect(getConfiguredAccounts()).toEqual(['manuel', 'nila'])
  })
})

describe('listSubscriptionsAllAccounts', () => {
  beforeEach(() => {
    process.env.STRIPE_SECRET_KEY = 'sk_manuel'
    process.env.STRIPE_SECRET_KEY_NILA = 'sk_nila'
  })

  it('barre las dos cuentas y etiqueta cada sub con la suya', async () => {
    const seen: string[] = []
    const { subscriptions, accounts } = await listSubscriptionsAllAccounts({
      fetchPage: async ({ secretKey }) => {
        seen.push(secretKey)
        return secretKey === 'sk_manuel'
          ? { data: [sub('sub_m1')], has_more: false }
          : { data: [sub('sub_n1'), sub('sub_n2')], has_more: false }
      },
    })

    expect(seen.sort()).toEqual(['sk_manuel', 'sk_nila'])
    expect(subscriptions.map((s) => [s.id, s.stripe_account])).toEqual([
      ['sub_m1', 'manuel'],
      ['sub_n1', 'nila'],
      ['sub_n2', 'nila'],
    ])
    expect(accounts).toEqual([
      { account: 'manuel', ok: true, count: 1 },
      { account: 'nila', ok: true, count: 2 },
    ])
  })

  it('pagina con starting_after hasta agotar has_more', async () => {
    const paths: string[] = []
    const { subscriptions } = await listSubscriptionsAllAccounts({
      accounts: ['manuel'],
      fetchPage: async ({ path }) => {
        paths.push(path)
        return path.includes('starting_after=sub_a')
          ? { data: [sub('sub_b')], has_more: false }
          : { data: [sub('sub_a')], has_more: true }
      },
    })
    expect(subscriptions.map((s) => s.id)).toEqual(['sub_a', 'sub_b'])
    expect(paths[0]).toContain('status=all')
    expect(paths[1]).toContain('starting_after=sub_a')
  })

  it('una cuenta caída NO tumba la lectura, pero se marca ok:false', async () => {
    const { subscriptions, accounts } = await listSubscriptionsAllAccounts({
      fetchPage: async ({ secretKey }) => {
        if (secretKey === 'sk_nila') return { error: { message: 'Invalid API Key' } }
        return { data: [sub('sub_m1')], has_more: false }
      },
    })
    expect(subscriptions.map((s) => s.id)).toEqual(['sub_m1'])
    expect(accounts.find((a) => a.account === 'nila')).toEqual({
      account: 'nila', ok: false, count: 0, error: 'Invalid API Key',
    })
  })

  it('marca la cuenta sin secret key en vez de leerla en silencio', async () => {
    delete process.env.STRIPE_SECRET_KEY_NILA
    const { accounts } = await listSubscriptionsAllAccounts({
      accounts: ['manuel', 'nila'],
      fetchPage: async () => ({ data: [], has_more: false }),
    })
    expect(accounts.find((a) => a.account === 'nila')).toMatchObject({ ok: false })
  })

  it('corta la paginación si Stripe dice has_more con página vacía (anti bucle infinito)', async () => {
    const { subscriptions } = await listSubscriptionsAllAccounts({
      accounts: ['manuel'],
      fetchPage: async () => ({ data: [], has_more: true }),
    })
    expect(subscriptions).toEqual([])
  })
})
