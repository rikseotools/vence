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
    // read-only: NO debe importar getAdminDb (escritura) ni crear el código (getOrCreateReferralCode)
    expect(src).not.toMatch(/getAdminDb/)
    expect(src).not.toMatch(/getOrCreateReferralCode/)
  })

  it('el badge "toca pagar" exige admin y cuenta SOLO saldo pagable (respeta hold)', () => {
    const src = readFileSync(join(ROOT, 'app/api/admin/referrals/payouts-pending-count/route.ts'), 'utf8')
    // gate admin
    expect(src).toMatch(/requireAdmin\s*\(/)
    // DEBE usar la query que respeta el hold (payable + submissions tras hold − pagado);
    // NUNCA un sum crudo de reward_earnings, que incluiría dinero aún retenido → avisos falsos.
    expect(src).toMatch(/getEmbajadoresWithBalance/)
    expect(src).not.toMatch(/reward_earnings/)
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
