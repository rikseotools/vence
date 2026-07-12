// __tests__/guardrails/admin-embajador-panel-admin-gated.test.ts
// GUARDARRAÍL anti-regresión de seguridad de la vista admin del panel de embajador.
// Dos garantías que NO se pueden perder en un refactor:
//  1. El endpoint admin SIEMPRE pasa por requireAdmin y valida el userId como UUID.
//  2. /api/referrals/me NUNCA acepta identidad del cliente (userId por query/body): la resuelve
//     siempre del token (anti-IDOR). Es lo que hace seguro tener el otro endpoint admin aparte.

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

describe('guardarraíl — vista admin del panel de embajador', () => {
  it('el endpoint admin exige requireAdmin y valida el userId como UUID', () => {
    const src = readFileSync(join(ROOT, 'app/api/admin/embajadores/[userId]/panel/route.ts'), 'utf8')
    expect(src).toMatch(/requireAdmin\s*\(/)
    // debe validar el UUID antes de tocar la BD
    expect(src).toMatch(/UUID_RE/)
    // READ-ONLY de verdad = no MUTA (aunque lea del primario para datos en vivo, ver abajo): sin
    // insert/update/delete ni crear el código. Nota: usa getAdminDb (primario) a PROPÓSITO para
    // que el admin vea el dato EN VIVO (la réplica iba por detrás → "copia desactualizada").
    expect(src).not.toMatch(/\.(insert|update|delete)\s*\(/)
    expect(src).not.toMatch(/getOrCreateReferralCode/)
  })

  it('el badge "toca pagar" exige admin y cuenta SOLICITUDES pendientes (modelo pull)', () => {
    const src = readFileSync(join(ROOT, 'app/api/admin/referrals/payouts-pending-count/route.ts'), 'utf8')
    // gate admin
    expect(src).toMatch(/requireAdmin\s*\(/)
    // Modelo pull: el badge cuenta SOLICITUDES reales (reward_payouts pending), no saldos teóricos.
    expect(src).toMatch(/getPendingPayoutRequests/)
  })

  it('la solicitud de vale (pull) resuelve identidad del TOKEN y el importe del SERVIDOR (anti-abuso)', () => {
    const src = readFileSync(join(ROOT, 'app/api/referrals/payout-request/route.ts'), 'utf8')
    // identidad del token, nunca del cliente (anti-IDOR)
    expect(src).toMatch(/getAuthenticatedUser\s*\(/)
    expect(src).toMatch(/auth\.user\.id/)
    // el importe lo calcula el servidor (payoutDenomination sobre el saldo), NO el cliente
    expect(src).toMatch(/payoutDenomination/)
    expect(src).not.toMatch(/body[.?]*\.amount/)
  })

  it('cumplir una solicitud (pull, lado admin) exige admin', () => {
    const src = readFileSync(join(ROOT, 'app/api/admin/referrals/payout-requests/route.ts'), 'utf8')
    expect(src).toMatch(/requireAdmin\s*\(/)
    expect(src).toMatch(/fulfillPayoutRequest/)
  })

  it('SOLO USUARIOS NUEVOS: guard de cuenta nueva en atribución Y en el pago (doble capa)', () => {
    // El bounty solo cuenta para captación NUEVA: la cuenta del referido no puede ser preexistente
    // (creada hace > N días). Debe aplicarse al atribuir (refereeEligibility) y al cualificar el pago
    // (qualifyReferralOnPayment) — así ni entran nuevos casos ni pagan los pending viejos (p.ej. Marta).
    const logic = readFileSync(join(ROOT, 'lib/referrals/logic.ts'), 'utf8')
    expect(logic).toMatch(/referredAccountAgeDays[\s\S]*?>[\s\S]*?REFERRAL_NEW_ACCOUNT_MAX_AGE_DAYS/)
    const q = readFileSync(join(ROOT, 'lib/referrals/queries.ts'), 'utf8')
    expect(q).toMatch(/ageDaysAtAttribution[\s\S]*?>[\s\S]*?REFERRAL_NEW_ACCOUNT_MAX_AGE_DAYS/)
  })

  it('/api/referrals/me sigue resolviendo la identidad del TOKEN (no del cliente)', () => {
    const src = readFileSync(join(ROOT, 'app/api/referrals/me/route.ts'), 'utf8')
    expect(src).toMatch(/getAuthenticatedUser\s*\(/)
    expect(src).toMatch(/auth\.user\.id/)
    // no debe leer un userId del cliente
    expect(src).not.toMatch(/searchParams\.get\(\s*['"]userId/)
    expect(src).not.toMatch(/body[.?]*\.userId/)
  })
})
