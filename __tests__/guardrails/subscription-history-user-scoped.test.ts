// __tests__/guardrails/subscription-history-user-scoped.test.ts
// GUARDARRAÍL anti-regresión del historial de suscripción del usuario:
//  1. El endpoint resuelve la identidad del TOKEN (getAuthenticatedUser + auth.user.id), NUNCA de un
//     userId del cliente (query/body) → sin IDOR. Es lo que hace seguro exponerlo al usuario final.
//  2. La query del historial es READ-ONLY (getReadDb, sin getAdminDb ni escrituras).

import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')

describe('guardarraíl — historial de suscripción (user-scoped, read-only)', () => {
  it('el endpoint usa identidad del TOKEN, no un userId del cliente', () => {
    const src = readFileSync(join(ROOT, 'app/api/profile/subscription-history/route.ts'), 'utf8')
    expect(src).toMatch(/getAuthenticatedUser\s*\(/)
    expect(src).toMatch(/auth\.user\.id/)
    expect(src).not.toMatch(/searchParams\.get\(\s*['"]userId/)
    expect(src).not.toMatch(/body[.?]*\.userId/)
  })

  it('la query del historial es READ-ONLY (getReadDb, sin getAdminDb ni escrituras)', () => {
    const src = readFileSync(join(ROOT, 'lib/api/subscription/history.ts'), 'utf8')
    expect(src).toMatch(/getReadDb/)
    expect(src).not.toMatch(/getAdminDb/)
    expect(src).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/)
  })
})
