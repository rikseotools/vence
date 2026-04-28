// __tests__/api/filtered-questions/nullTagsFilter.test.ts
// Tests para el fix del filtro de tags NULL-safe.
//
// Bug: NOT (tags && ARRAY['PN']::text[]) devuelve NULL cuando tags IS NULL,
// excluyendo silenciosamente 34k+ preguntas sin tags.
// Fix: (tags IS NULL OR NOT (tags && ARRAY['PN']::text[]))

import { EXCLUSIVE_QUESTION_TAGS, getOposicionByPositionType } from '@/lib/config/oposiciones'

// Simula el comportamiento de PostgreSQL para el operador &&
// NULL && ARRAY[...] → null, NOT null → null
function pgArrayOverlap(tags: string[] | null, exclusive: string[]): boolean | null {
  if (tags === null) return null
  return tags.some(t => exclusive.includes(t))
}

/** Filtro VIEJO (bug): NOT (tags && ARRAY[...]) */
function oldTagFilter(tags: string[] | null, exclusive: string[]): boolean {
  const overlap = pgArrayOverlap(tags, exclusive)
  if (overlap === null) return false // NULL en WHERE → excluido (bug!)
  return !overlap
}

/** Filtro NUEVO (fix): tags IS NULL OR NOT (tags && ARRAY[...]) */
function fixedTagFilter(tags: string[] | null, exclusive: string[]): boolean {
  if (tags === null) return true // NULL-safe
  return !tags.some(t => exclusive.includes(t))
}

describe('Tag filter NULL-safety', () => {
  const exclusive = ['PN']

  describe('comportamiento PostgreSQL del operador &&', () => {
    it('NULL && ARRAY devuelve null', () => {
      expect(pgArrayOverlap(null, exclusive)).toBeNull()
    })

    it('[] && ARRAY devuelve false', () => {
      expect(pgArrayOverlap([], exclusive)).toBe(false)
    })

    it('[PN] && ARRAY[PN] devuelve true', () => {
      expect(pgArrayOverlap(['PN'], exclusive)).toBe(true)
    })

    it('[InnoTest] && ARRAY[PN] devuelve false', () => {
      expect(pgArrayOverlap(['InnoTest'], exclusive)).toBe(false)
    })
  })

  describe('filtro VIEJO (bug)', () => {
    it('tags null → EXCLUIDA (bug!)', () => {
      expect(oldTagFilter(null, exclusive)).toBe(false)
    })

    it('tags vacío → incluida', () => {
      expect(oldTagFilter([], exclusive)).toBe(true)
    })

    it('tags [InnoTest] → incluida', () => {
      expect(oldTagFilter(['InnoTest'], exclusive)).toBe(true)
    })

    it('tags [PN] → excluida (correcto)', () => {
      expect(oldTagFilter(['PN'], exclusive)).toBe(false)
    })

    it('tags [InnoTest, PN] → excluida (correcto)', () => {
      expect(oldTagFilter(['InnoTest', 'PN'], exclusive)).toBe(false)
    })
  })

  describe('filtro NUEVO (fix)', () => {
    it('tags null → INCLUIDA (fix!)', () => {
      expect(fixedTagFilter(null, exclusive)).toBe(true)
    })

    it('tags vacío → incluida', () => {
      expect(fixedTagFilter([], exclusive)).toBe(true)
    })

    it('tags [InnoTest] → incluida', () => {
      expect(fixedTagFilter(['InnoTest'], exclusive)).toBe(true)
    })

    it('tags [PN] → excluida', () => {
      expect(fixedTagFilter(['PN'], exclusive)).toBe(false)
    })

    it('tags [InnoTest, PN] → excluida', () => {
      expect(fixedTagFilter(['InnoTest', 'PN'], exclusive)).toBe(false)
    })

    it('tags [CE, Galicia] → incluida', () => {
      expect(fixedTagFilter(['CE', 'Galicia'], exclusive)).toBe(true)
    })
  })

  describe('consistencia viejo vs nuevo', () => {
    const scenarios: Array<{ tags: string[] | null; label: string }> = [
      { tags: null, label: 'null' },
      { tags: [], label: 'vacío' },
      { tags: ['InnoTest'], label: 'tag normal' },
      { tags: ['PN'], label: 'tag exclusivo' },
      { tags: ['PN', 'InnoTest'], label: 'mixto con exclusivo' },
      { tags: ['CE', 'Galicia'], label: 'varios normales' },
    ]

    it('la ÚNICA diferencia es para tags null', () => {
      for (const { tags, label } of scenarios) {
        const oldResult = oldTagFilter(tags, exclusive)
        const newResult = fixedTagFilter(tags, exclusive)
        if (tags === null) {
          expect(oldResult).toBe(false)
          expect(newResult).toBe(true)
        } else {
          expect(oldResult).toBe(newResult)
        }
      }
    })
  })

  describe('config integridad', () => {
    it('EXCLUSIVE_QUESTION_TAGS contiene al menos PN', () => {
      expect(EXCLUSIVE_QUESTION_TAGS).toContain('PN')
    })

    it('auxiliar_administrativo_estado NO tiene questionTag', () => {
      const config = getOposicionByPositionType('auxiliar_administrativo_estado')
      expect(config?.questionTag).toBeUndefined()
    })

    it('policia_nacional SÍ tiene questionTag PN', () => {
      const config = getOposicionByPositionType('policia_nacional')
      expect(config?.questionTag).toBe('PN')
    })
  })

  describe('código fuente — patrón NULL-safe presente', () => {
    const fs = require('fs')
    const files = [
      'lib/api/filtered-questions/queries.ts',
      'lib/api/random-test-data/queries.ts',
      'lib/api/random-test/queries.ts',
    ]

    for (const file of files) {
      it(`${file} usa tags IS NULL OR NOT`, () => {
        const content = fs.readFileSync(file, 'utf-8')
        // Debe tener el patrón NULL-safe
        expect(content).toContain('tags} IS NULL OR NOT')
        // No debe tener el patrón viejo sin protección NULL
        // (buscar NOT (tags && sin el IS NULL precedente)
        const lines = content.split('\n')
        for (const line of lines) {
          if (line.includes('NOT (${questions.tags} &&') && line.includes('EXCLUSIVE_QUESTION_TAGS')) {
            expect(line).toContain('IS NULL')
          }
        }
      })
    }
  })
})
