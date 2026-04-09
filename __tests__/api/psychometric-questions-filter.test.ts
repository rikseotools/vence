/**
 * @jest-environment node
 */
// Test que verifica que la API de psicotécnicas filtra correctamente por sección.
//
// Bug: seleccionar "Raíces" devolvía preguntas de toda la categoría
// "Razonamiento numérico" (1519) en vez de solo las de raíces (20).
// Fix: pasar sections en la URL para filtrar por section_id.

import * as fs from 'fs'
import * as path from 'path'

describe('Psicotécnicas — Filtro por secciones', () => {
  const ROOT = path.resolve(__dirname, '../..')

  describe('Schema acepta sections opcional', () => {
    const schemaContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/psychometric-test-data/schemas.ts'),
      'utf-8'
    )

    it('schema tiene campo sections opcional', () => {
      expect(schemaContent).toContain('sections:')
      expect(schemaContent).toContain('.optional()')
    })

    it('schema mantiene categories como requerido', () => {
      expect(schemaContent).toContain("categories: z.array(z.string().min(1)).min(1")
    })
  })

  describe('Query soporta filtro por sección', () => {
    const queryContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/psychometric-test-data/queries.ts'),
      'utf-8'
    )

    it('getPsychometricQuestions acepta sectionKeys como tercer parámetro', () => {
      expect(queryContent).toContain('sectionKeys?: string[]')
    })

    it('filtra por sectionId cuando se pasan secciones', () => {
      expect(queryContent).toContain('inArray(psychometricQuestions.sectionId, sectionIds)')
    })

    it('filtra por categoryId cuando NO se pasan secciones (retrocompatible)', () => {
      expect(queryContent).toContain('inArray(psychometricQuestions.categoryId, categoryIds)')
    })

    it('resuelve sectionKeys a IDs desde psychometricSections', () => {
      expect(queryContent).toContain('inArray(psychometricSections.sectionKey, sectionKeys)')
    })
  })

  describe('API route acepta parámetro sections', () => {
    const routeContent = fs.readFileSync(
      path.join(ROOT, 'app/api/psychometric-test-data/questions/route.ts'),
      'utf-8'
    )

    it('lee parámetro sections de la URL', () => {
      expect(routeContent).toContain("searchParams.get('sections')")
    })

    it('pasa sections a getPsychometricQuestions', () => {
      expect(routeContent).toContain('parseResult.data.sections')
    })

    it('mantiene categories como obligatorio', () => {
      expect(routeContent).toContain("'Parámetro \"categories\" requerido'")
    })
  })

  describe('Cliente pasa secciones cuando hay selección parcial', () => {
    const clientContent = fs.readFileSync(
      path.join(ROOT, 'app/psicotecnicos/test/PsicotecnicosTestClient.tsx'),
      'utf-8'
    )

    it('construye parámetro sections en la URL', () => {
      expect(clientContent).toContain("urlParams.set('sections'")
    })

    it('solo envía sections cuando hay selección parcial', () => {
      expect(clientContent).toContain('hasPartialSelection')
    })

    it('no envía sections cuando todas las secciones están seleccionadas', () => {
      // Si allSelected es true, no se marca hasPartialSelection
      expect(clientContent).toContain('allSelected')
    })
  })

  describe('Executor pasa sections a la API', () => {
    const executorContent = fs.readFileSync(
      path.join(ROOT, 'app/psicotecnicos/test/ejecutar/PsychometricTestExecutor.tsx'),
      'utf-8'
    )

    it('lee sections de searchParams', () => {
      expect(executorContent).toContain("searchParams.get('sections')")
    })

    it('añade sections a los params de la API', () => {
      expect(executorContent).toContain("params.set('sections'")
    })
  })
})
