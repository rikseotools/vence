/**
 * @jest-environment node
 */
// Test que verifica que examFrequency se asigna a secciones y categorías.
//
// Bug: examFrequency solo estaba en categorías, no en secciones.
// Los usuarios no veían qué secciones específicas son frecuentes en examen.

import * as fs from 'fs'
import * as path from 'path'

describe('Psicotécnicas — examFrequency en secciones', () => {
  const ROOT = path.resolve(__dirname, '../..')

  describe('Schema', () => {
    const schemaContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/psychometric-test-data/schemas.ts'),
      'utf-8'
    )

    it('PsychometricSection tiene examFrequency', () => {
      // Buscar examFrequency ANTES de PsychometricCategory
      const sectionSchemaEnd = schemaContent.indexOf('export type PsychometricSection')
      const sectionPart = schemaContent.slice(0, sectionSchemaEnd)
      expect(sectionPart).toContain('examFrequency')
    })

    it('PsychometricCategory sigue teniendo examFrequency', () => {
      const categoryStart = schemaContent.indexOf('psychometricCategorySchema')
      const categoryEnd = schemaContent.indexOf('export type PsychometricCategory')
      const categoryPart = schemaContent.slice(categoryStart, categoryEnd)
      expect(categoryPart).toContain('examFrequency')
    })
  })

  describe('Query asigna examFrequency a secciones', () => {
    const queryContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/psychometric-test-data/queries.ts'),
      'utf-8'
    )

    it('asigna examFrequency a cada sección', () => {
      expect(queryContent).toContain('(sec as any).examFrequency = freq')
    })

    it('sigue asignando examFrequency a categoría', () => {
      expect(queryContent).toContain('(cat as any).examFrequency = maxFreq')
    })

    it('la categoría hereda la mayor frecuencia de sus secciones', () => {
      // frequent > appears
      expect(queryContent).toContain("freq === 'frequent'")
      expect(queryContent).toContain("maxFreq !== 'frequent'")
    })
  })

  describe('Botón "Solo lo frecuente" selecciona por sección, no categoría', () => {
    const clientContent = fs.readFileSync(
      path.join(ROOT, 'app/psicotecnicos/test/PsicotecnicosTestClient.tsx'),
      'utf-8'
    )

    it('usa examFrequency de la sección individual, no de la categoría', () => {
      // Debe usar sec.examFrequency, no cat.examFrequency para seleccionar secciones
      expect(clientContent).toContain('(sec as any).examFrequency')
    })

    it('NO selecciona todas las secciones cuando la categoría es frecuente', () => {
      // El viejo código tenía: secSel[sec.key] = !!cat.examFrequency
      // No debe existir esa línea
      expect(clientContent).not.toMatch(/secSel\[sec\.key\]\s*=\s*!!cat\.examFrequency/)
    })
  })

  describe('UI muestra badges en secciones', () => {
    const clientContent = fs.readFileSync(
      path.join(ROOT, 'app/psicotecnicos/test/PsicotecnicosTestClient.tsx'),
      'utf-8'
    )

    it('muestra badge Frecuente en secciones', () => {
      // Debe haber un badge de examFrequency dentro del bloque de secciones
      expect(clientContent).toContain("examFrequency === 'frequent'")
      // Al menos 2 veces: una para categoría y otra para sección
      const matches = clientContent.match(/examFrequency === 'frequent'/g)
      expect(matches?.length).toBeGreaterThanOrEqual(2)
    })

    it('muestra badge En examen en secciones', () => {
      expect(clientContent).toContain("examFrequency === 'appears'")
      const matches = clientContent.match(/examFrequency === 'appears'/g)
      expect(matches?.length).toBeGreaterThanOrEqual(2)
    })
  })
})
