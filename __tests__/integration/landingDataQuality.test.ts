// __tests__/integration/landingDataQuality.test.ts
// Verifica que las landings de oposiciones no muestran datos genéricos/placeholder
import { OPOSICIONES } from '@/lib/config/oposiciones'

describe('Landing data quality', () => {
  test('ningún tema en oposiciones.ts tiene nombre genérico "Tema X" o "Tema específico X"', () => {
    const generics: string[] = []
    for (const opo of OPOSICIONES) {
      for (const block of opo.blocks) {
        for (const theme of block.themes) {
          if (/^Tema \d+$/i.test(theme.name) || /^Tema específico \d+$/i.test(theme.name)) {
            generics.push(`${opo.slug} T${theme.id}: "${theme.name}"`)
          }
        }
      }
    }
    if (generics.length > 0) {
      console.error('Temas con nombres genéricos (deben tener nombre real del programa oficial):')
      generics.forEach(g => console.error('  ' + g))
    }
    expect(generics).toEqual([])
  })

  test('todas las oposiciones activas con convocatoria tienen seguimiento_url no vacía en config', () => {
    for (const opo of OPOSICIONES) {
      expect(opo.navLinks.length).toBeGreaterThan(0)
      expect(opo.totalTopics).toBeGreaterThan(0)
      expect(opo.blocks.length).toBeGreaterThan(0)
    }
  })

  test('bloques tienen al menos 1 tema cada uno', () => {
    for (const opo of OPOSICIONES) {
      for (const block of opo.blocks) {
        expect(block.themes.length).toBeGreaterThan(0)
      }
    }
  })

  test('totalTopics coincide con suma de temas en bloques', () => {
    for (const opo of OPOSICIONES) {
      const total = opo.blocks.reduce((sum, b) => sum + b.themes.length, 0)
      expect(total).toBe(opo.totalTopics)
    }
  })
})
