// __tests__/lib/config/getBlockForTopic.test.ts
// Verifica que getBlockForTopic devuelve el displayNum correcto para cada oposición

import { getBlockForTopic, OPOSICIONES } from '@/lib/config/oposiciones'

describe('getBlockForTopic', () => {
  describe('Auxiliar Administrativo Estado', () => {
    const opo = 'auxiliar-administrativo-estado'

    it('Bloque I: tema 1 → displayNum 1', () => {
      const r = getBlockForTopic(opo, 1)
      expect(r).not.toBeNull()
      expect(r!.displayNum).toBe(1)
      expect(r!.blockTitle).toContain('Bloque I')
    })

    it('Bloque I: tema 16 → displayNum 16', () => {
      const r = getBlockForTopic(opo, 16)
      expect(r).not.toBeNull()
      expect(r!.displayNum).toBe(16)
    })

    it('Bloque II: tema 101 → displayNum 1', () => {
      const r = getBlockForTopic(opo, 101)
      expect(r).not.toBeNull()
      expect(r!.displayNum).toBe(1)
      expect(r!.blockTitle).toContain('Bloque II')
    })

    it('Bloque II: tema 103 → displayNum 3 (Concepto de documento)', () => {
      const r = getBlockForTopic(opo, 103)
      expect(r).not.toBeNull()
      expect(r!.displayNum).toBe(3)
    })

    it('Bloque II: tema 112 → displayNum 12', () => {
      const r = getBlockForTopic(opo, 112)
      expect(r).not.toBeNull()
      expect(r!.displayNum).toBe(12)
    })

    it('tema inexistente → null', () => {
      expect(getBlockForTopic(opo, 999)).toBeNull()
    })

    it('tema 0 → null', () => {
      expect(getBlockForTopic(opo, 0)).toBeNull()
    })
  })

  describe('oposición inexistente', () => {
    it('devuelve null', () => {
      expect(getBlockForTopic('oposicion-inventada', 1)).toBeNull()
    })
  })

  describe('todas las oposiciones con bloques', () => {
    // Para cada oposición que tenga bloques, verificar que displayNum es coherente
    for (const opo of OPOSICIONES) {
      if (opo.blocks.length <= 1) continue

      describe(opo.nombre, () => {
        for (const block of opo.blocks) {
          for (const theme of block.themes) {
            it(`tema ${theme.id} tiene displayNum coherente`, () => {
              const r = getBlockForTopic(opo.slug, theme.id)
              expect(r).not.toBeNull()
              expect(r!.displayNum).toBeGreaterThan(0)
              // displayNum nunca debería ser > 100 (es para mostrar al usuario)
              expect(r!.displayNum).toBeLessThan(100)
            })
          }
        }
      })
    }
  })
})
