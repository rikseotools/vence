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

// ============================================
// Verificar que las páginas de test NO usan {tema} directamente en textos visibles
// ============================================
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../../..')

describe('Páginas de test no usan topic_number raw en textos', () => {
  const pagesWithBlocks = [
    'app/auxiliar-administrativo-estado/test/tema/[numero]/page.tsx',
  ]

  for (const file of pagesWithBlocks) {
    it(`${file} no tiene "Tema {tema}" ni "Tema \${tema}" en textos visibles`, () => {
      const content = fs.readFileSync(path.join(ROOT, file), 'utf-8')

      // Buscar patrones peligrosos: "Tema" seguido de {tema} o ${tema} o ${temaNumber}
      // Excluir comentarios y console.log
      const lines = content.split('\n')
      const problems: string[] = []

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()
        // Ignorar comentarios, console, y mensajes de error 404 (tema no existe → no hay display)
        if (line.startsWith('//') || line.startsWith('*') || line.includes('console.')) continue
        if (line.includes('no existe') || line.includes('no está disponible')) continue

        // Buscar "Tema" + variable raw (no temaDisplay, no temaLabel, no temaDisplayLocal)
        if (/Tema.*\{tema\}/.test(line) || /Tema.*\$\{tema\b[^DL]/.test(line) || /Tema.*\$\{temaNum/.test(line)) {
          problems.push(`  L${i + 1}: ${line.slice(0, 100)}`)
        }
      }

      if (problems.length > 0) {
        fail(`Encontrados ${problems.length} usos de topic_number raw en textos:\n${problems.join('\n')}`)
      }
    })
  }
})
