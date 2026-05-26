// __tests__/lib/temario/updatedAt.test.ts

import { formatUpdatedAt } from '@/lib/temario/updatedAt'

describe('formatUpdatedAt', () => {
  it('formatea en estilo "DD de MES de YYYY" en español', () => {
    // 15 de mayo de 2026 al mediodía UTC — sin ambigüedad de timezone
    const d = new Date('2026-05-15T12:00:00Z')
    expect(formatUpdatedAt(d)).toBe('15 de mayo de 2026')
  })

  it('usa timezone Europe/Madrid (no UTC) → elimina drift de zona', () => {
    // 25 de mayo 22:30 UTC = 26 de mayo 00:30 en Madrid (CEST +2).
    // Si usáramos UTC, saldría "25 de mayo". Con Europe/Madrid, "26 de mayo".
    const d = new Date('2026-05-25T22:30:00Z')
    expect(formatUpdatedAt(d)).toBe('26 de mayo de 2026')
  })

  it('usa timezone Europe/Madrid en invierno (CET +1)', () => {
    // 10 de enero 23:30 UTC = 11 de enero 00:30 Madrid (CET +1)
    const d = new Date('2026-01-10T23:30:00Z')
    expect(formatUpdatedAt(d)).toBe('11 de enero de 2026')
  })

  it('default = new Date() (no lanza)', () => {
    const result = formatUpdatedAt()
    expect(result).toMatch(/^\d{1,2} de \w+ de \d{4}$/)
  })

  it('es determinista: misma entrada → mismo resultado', () => {
    const d = new Date('2026-12-31T15:00:00Z')
    expect(formatUpdatedAt(d)).toBe(formatUpdatedAt(d))
  })
})
