// __tests__/guardrails/referral-state-machine-ratchet.test.ts
// CAPA 5 (guardarraíl/ratchet) del programa de referidos — memoria feedback_feature_multiples_capas_seguridad.
//
// Blinda los invariantes de la state machine de `referrals` para que NADIE los cambie por accidente:
//   - el set de estados válidos,
//   - la matriz de transiciones legales,
//   - los estados terminales,
//   - y que la migración SQL enforce EXACTAMENTE los mismos estados (sin drift código↔BD).
// Si alguien toca logic.ts o la migración de forma incoherente, este test falla en CI.

import { readFileSync } from 'fs'
import { join } from 'path'
import { REFERRAL_STATES, isLegalTransition, type ReferralState } from '@/lib/referrals/logic'

const EXPECTED_STATES = ['pending', 'qualified', 'payable', 'paid', 'rejected', 'expired']

// Matriz congelada de transiciones legales (from → [to permitidos]).
const EXPECTED_TRANSITIONS: Record<string, string[]> = {
  pending: ['qualified', 'rejected', 'expired'],
  qualified: ['payable', 'rejected'],
  payable: ['paid', 'rejected'],
  paid: ['rejected'], // clawback
  rejected: [],
  expired: [],
}

describe('GUARDRAIL: state machine de referidos (ratchet)', () => {
  it('los estados válidos son EXACTAMENTE los esperados (cambiarlos = decisión consciente)', () => {
    expect([...REFERRAL_STATES].sort()).toEqual([...EXPECTED_STATES].sort())
  })

  it('la matriz de transiciones legales está congelada', () => {
    for (const from of REFERRAL_STATES) {
      for (const to of REFERRAL_STATES) {
        const legal = isLegalTransition(from, to)
        const shouldBe = EXPECTED_TRANSITIONS[from].includes(to)
        // Incluimos from/to en el aserto para que el fallo diga qué par se rompió.
        expect({ from, to, legal }).toEqual({ from, to, legal: shouldBe })
      }
    }
  })

  it('los estados terminales (rejected/expired) no tienen transiciones salientes', () => {
    for (const terminal of ['rejected', 'expired'] as ReferralState[]) {
      for (const to of REFERRAL_STATES) {
        expect(isLegalTransition(terminal, to)).toBe(false)
      }
    }
  })

  it('la migración SQL enforce los MISMOS estados que el código (sin drift código↔BD)', () => {
    const sql = readFileSync(
      join(__dirname, '..', '..', 'supabase', 'migrations', '20260710_referral_program.sql'),
      'utf8',
    )
    // Extrae todas las listas `status IN ('a','b',...)` del SQL.
    const lists = [...sql.matchAll(/status\s+IN\s*\(([^)]+)\)/gi)].map((m) =>
      m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, '')).sort(),
    )
    const codeStates = [...REFERRAL_STATES].sort()
    // Una de las listas del CHECK del SQL debe coincidir EXACTO con los estados del código.
    const match = lists.some((l) => JSON.stringify(l) === JSON.stringify(codeStates))
    expect(match).toBe(true)
  })
})
