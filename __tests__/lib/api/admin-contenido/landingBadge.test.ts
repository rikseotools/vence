import { landingBadge, LANDING_TONE_CLS, LANDING_TRIGGER } from '@/lib/api/admin-contenido/landingBadge'
import { RUNBOOK_BY_KIND } from '@/lib/admin/runbookRegistry'
import { kindsCubiertos } from '@/lib/admin/landingSurfaces'

describe('landingBadge — salud de la landing en la fila de su oposición', () => {
  it('sin hallazgos → verde', () => {
    const b = landingBadge({ landing_errores: 0, landing_avisos: 0 })
    expect(b.tone).toBe('ok')
    expect(b.label).toBe('✓')
  })

  it('solo avisos → ámbar, y no dice que el opositor vea nada mal', () => {
    const b = landingBadge({ landing_errores: 0, landing_avisos: 3 })
    expect(b.tone).toBe('warn')
    expect(b.label).toBe('3 ⚠')
    expect(b.title).not.toMatch(/VE mal|defecto/)
  })

  it('un error manda sobre los avisos (es lo que el opositor VE)', () => {
    const b = landingBadge({ landing_errores: 1, landing_avisos: 5 })
    expect(b.tone).toBe('error')
    expect(b.label).toBe('1 ✕')
    expect(b.title).toContain('5 aviso')
    expect(b.title).toContain('audit:landing')
  })

  it('tolera contadores ausentes (fila sin datos de landing)', () => {
    const b = landingBadge({} as never)
    expect(b.tone).toBe('ok')
  })

  it('cada tono tiene clases para claro y oscuro', () => {
    for (const t of ['ok', 'warn', 'error'] as const) {
      expect(LANDING_TONE_CLS[t]).toMatch(/dark:/)
    }
  })
})

describe('anti-silo: el badge y el resto del sistema hablan del mismo trabajo', () => {
  it('la frase-gatillo del badge EXISTE en el registro de runbooks', () => {
    const frases = new Set(Object.values(RUNBOOK_BY_KIND).map((e) => e.triggerPhrase))
    expect(frases.has(LANDING_TRIGGER)).toBe(true)
  })

  it('los kinds que cuenta la columna salen del inventario de superficies, no de otra lista', () => {
    // Si alguien añade un detector de landing y lo asigna a su superficie, la columna lo cuenta
    // sola. Este test fija esa dependencia: sin ella volvería a haber dos listas que mantener.
    const kinds = kindsCubiertos()
    expect(kinds).toContain('landing_incompleta')
    expect(kinds).toContain('convocatoria_enlace_no_boletin')
    expect(kinds.every((k) => RUNBOOK_BY_KIND[k])).toBe(true)
  })
})
