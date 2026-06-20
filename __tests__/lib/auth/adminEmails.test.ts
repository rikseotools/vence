import { isAdminEmail, ADMIN_EMAILS } from '@/lib/auth/adminEmails'

// Unit test de la allowlist de admin (Fase A3). Es la fuente única usada por el
// gate de servidor (requireAdmin) y el gating de UI en cliente.
describe('isAdminEmail', () => {
  it('acepta los emails de la allowlist explícita', () => {
    for (const e of ADMIN_EMAILS) expect(isAdminEmail(e)).toBe(true)
    // El único admin por rol en BD (verificado 2026-06-20) está cubierto:
    expect(isAdminEmail('manueltrader@gmail.com')).toBe(true)
  })

  it('acepta cualquier dirección @vencemitfg.es', () => {
    expect(isAdminEmail('quien.sea@vencemitfg.es')).toBe(true)
  })

  it('rechaza emails no admin', () => {
    expect(isAdminEmail('user@gmail.com')).toBe(false)
    expect(isAdminEmail('manueltrader@gmail.com.evil.com')).toBe(false)
  })

  it('no es vulnerable a subdominio/sufijo falso del dominio admin', () => {
    expect(isAdminEmail('evil@vencemitfg.es.attacker.com')).toBe(false)
    expect(isAdminEmail('evil@sub.vencemitfg.es')).toBe(false)
  })

  it('rechaza null / undefined / vacío', () => {
    expect(isAdminEmail(null)).toBe(false)
    expect(isAdminEmail(undefined)).toBe(false)
    expect(isAdminEmail('')).toBe(false)
  })
})
