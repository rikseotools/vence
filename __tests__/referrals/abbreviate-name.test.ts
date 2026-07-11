// __tests__/referrals/abbreviate-name.test.ts — privacidad del nombre del referido.
import { abbreviateReferredName } from '@/lib/referrals/logic'

describe('abbreviateReferredName', () => {
  it('nombre + apellidos → nombre + iniciales', () => {
    expect(abbreviateReferredName('Rubén Martínez López')).toBe('Rubén M. L.')
  })
  it('un solo apellido', () => {
    expect(abbreviateReferredName('Ana García')).toBe('Ana G.')
  })
  it('solo nombre → igual', () => {
    expect(abbreviateReferredName('Ana')).toBe('Ana')
  })
  it('null/empty → null', () => {
    expect(abbreviateReferredName(null)).toBeNull()
    expect(abbreviateReferredName('')).toBeNull()
  })
})
