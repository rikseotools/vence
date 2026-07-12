/**
 * @jest-environment node
 */
// __tests__/guardrails/active-signup-money-safety.test.ts
// GUARDARRAÍL de SEGURIDAD DE DINERO del bonus de registro activo:
//  1. Sin ACTIVE_SIGNUP_REWARD=1 NO concede nada (deploy seguro; se habilita a conciencia).
//  2. La lógica exige anti-fraude en el SQL: IP distinta + >=N tests + tope por embajador.
//  3. El cron de referidos invoca la concesión.

import { readFileSync } from 'fs'
import { join } from 'path'
import { grantActiveSignupRewards } from '@/lib/referrals/activeSignup'

const ROOT = join(__dirname, '..', '..')

describe('guardarraíl — registro activo (dinero real)', () => {
  it('sin ACTIVE_SIGNUP_REWARD=1 → no concede nada (no gasta)', async () => {
    delete process.env.ACTIVE_SIGNUP_REWARD
    const r = await grantActiveSignupRewards()
    expect(r.enabled).toBe(false)
    expect(r.granted).toBe(0)
  })

  it('el SQL de concesión incluye las capas anti-fraude/tope', () => {
    const src = readFileSync(join(ROOT, 'lib/referrals/activeSignup.ts'), 'utf8')
    expect(src).toMatch(/registration_ip IS DISTINCT FROM/) // IP distinta = no auto-registro
    expect(src).toMatch(/ACTIVE_SIGNUP_MIN_TESTS/) // >=N tests reales
    expect(src).toMatch(/ACTIVE_SIGNUP_MONTHLY_CAP/) // tope por embajador
    expect(src).toMatch(/ACTIVE_SIGNUP_MONTHLY_BUDGET_EUR/) // presupuesto global
    expect(src).toMatch(/activeSignupEnabled/) // gate
    expect(src).toMatch(/fraud_flags/) // no fraud-flagged
  })

  it('el filtro anti-fraude acepta el DEFAULT real de fraud_flags ([] array vacío)', () => {
    // Regresión (bug 2026-07-11): la columna nace con '[]'::jsonb, no '{}'. Si el filtro
    // solo aceptaba NULL/{}/'null' JSON, NINGUNA referral real pasaba y el bono nunca se
    // concedía (0 en toda la historia pese a elegibles). El filtro DEBE aceptar '[]'::jsonb.
    const src = readFileSync(join(ROOT, 'lib/referrals/activeSignup.ts'), 'utf8')
    expect(src).toMatch(/fraud_flags\s*=\s*'\[\]'::jsonb/)
  })

  it('el cron de referidos invoca grantActiveSignupRewards', () => {
    const src = readFileSync(join(ROOT, 'app/api/cron/referrals-promote/route.ts'), 'utf8')
    expect(src).toMatch(/grantActiveSignupRewards/)
  })

  it('el bono activo GANADO es PAGABLE al concederse, SIMÉTRICO en ambas queries de saldo', () => {
    // Regresión (bug 2026-11/12-07): las 2 queries de saldo (getUserOwedBalance = balance personal,
    // getEmbajadoresWithBalance = panel admin) DEBEN contar el bono activo de forma IDÉNTICA, si no
    // un saldo aparece en un sitio y no en el otro. Decisión Manuel 12/07: el bono de 2€ es DISPONIBLE
    // en cuanto se concede (active_reward_at IS NOT NULL), SIN el hold del premium (es captación, no
    // venta; ya pasó anti-fraude al concederse). Antes getEmbajadoresWithBalance lo gateaba por
    // status in('payable','paid') → asimetría. Ambas DEBEN usar solo `active_reward_at is not null`.
    const src = readFileSync(join(ROOT, 'lib/referrals/queries.ts'), 'utf8')
    const hits = src.match(/sum\(active_reward_amount\)[\s\S]{0,120}?active_reward_at is not null/g) || []
    expect(hits.length).toBeGreaterThanOrEqual(2)
    // y NINGUNA de las 2 debe volver a gatear el bono activo por el status del premium (hold)
    const gatedByStatus = src.match(/sum\(active_reward_amount\)[\s\S]{0,120}?status in \('payable','paid'\)/g) || []
    expect(gatedByStatus.length).toBe(0)
  })
})
