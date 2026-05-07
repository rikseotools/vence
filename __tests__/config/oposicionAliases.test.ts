/**
 * Garantiza que las oposiciones implementadas con tráfico real tienen
 * aliases de búsqueda definidos. Si añades una oposición nueva con tráfico
 * y olvidas los aliases, este test te avisa.
 *
 * Bug histórico: tras añadir Administrativo GVA C1-01 (07-may-2026) la
 * usuaria fzanonp escribió "gva" en el modal de cambio de oposición y no
 * encontraba nada porque los aliases estaban en otro sitio (OnboardingModal)
 * y no se aplicaban en el modal de cambio. Refactor: aliases viven en cada
 * OposicionConfig y matchesOposicion las usa.
 */

import { OPOSICIONES } from '@/lib/config/oposiciones'

describe('Aliases de búsqueda en OPOSICIONES', () => {
  // Oposiciones implementadas que tienen suficiente tráfico para
  // requerir aliases. Excluimos las muy nuevas o de baja prioridad.
  const REQUIRES_ALIASES = [
    'auxiliar_administrativo_estado',
    'administrativo_estado',
    'auxiliar_administrativo_madrid',
    'auxiliar_administrativo_valencia',
    'administrativo_gva',
    'auxiliar_administrativo_andalucia',
    'auxiliar_administrativo_carm',
    'auxiliar_administrativo_cyl',
    'auxiliar_administrativo_galicia',
    'administrativo_galicia',
    'tramitacion_procesal',
    'auxilio_judicial',
  ]

  test.each(REQUIRES_ALIASES)('%s tiene al menos 3 aliases', (id) => {
    const opo = OPOSICIONES.find(o => o.id === id)
    expect(opo).toBeDefined()
    expect(opo!.aliases).toBeDefined()
    expect(opo!.aliases!.length).toBeGreaterThanOrEqual(3)
  })

  test('los aliases son strings no vacíos', () => {
    for (const opo of OPOSICIONES) {
      if (!opo.aliases) continue
      for (const alias of opo.aliases) {
        expect(typeof alias).toBe('string')
        expect(alias.trim().length).toBeGreaterThan(0)
      }
    }
  })

  test('no hay aliases duplicados dentro de la misma oposición', () => {
    for (const opo of OPOSICIONES) {
      if (!opo.aliases) continue
      const set = new Set(opo.aliases.map(a => a.toLowerCase()))
      expect(set.size).toBe(opo.aliases.length)
    }
  })
})
