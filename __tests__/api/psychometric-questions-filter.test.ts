/**
 * @jest-environment node
 */
// Verifica el CABLEADO del filtro por secciones de psicotécnicas (que las
// piezas siguen conectadas). El comportamiento fino (qué params se generan
// para cada selección) se testea en __tests__/lib/psychometric/buildTestParams.test.ts.
//
// Historia del bug:
//  - v1: seleccionar "Raíces" devolvía toda la categoría "Razonamiento
//    numérico" (1519) en vez de solo raíces (20). Fix parcial: mandar
//    `sections` sólo si la selección era "parcial" (heurística allSelected).
//  - v2 (17/07/2026, Laura): con la categoría ENTERA seleccionada la heurística
//    NO mandaba sections → volvía a servir la categoría completa mezclada.
//    Fix robusto: selección AUTORITATIVA (helper puro buildPsychometricTestParams)
//    + filtro por UNIÓN en el backend con defensa anti-leak.

import * as fs from 'fs'
import * as path from 'path'

describe('Psicotécnicas — Filtro por secciones (cableado)', () => {
  const ROOT = path.resolve(__dirname, '../..')

  describe('Schema acepta categorías y/o secciones', () => {
    const schemaContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/psychometric-test-data/schemas.ts'),
      'utf-8'
    )

    it('schema tiene campo sections opcional', () => {
      expect(schemaContent).toContain('sections:')
    })

    it('exige al menos una categoría o sección (categories puede ir vacío)', () => {
      expect(schemaContent).toContain('.refine(')
      expect(schemaContent).toMatch(/categories\.length > 0 \|\| \(d\.sections/)
    })
  })

  describe('Query filtra por unión sección + categoría-sin-secciones', () => {
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

    it('filtra por categorías SÓLO wholesale (las que no tienen sección seleccionada)', () => {
      expect(queryContent).toContain('wholesaleCategoryIds')
      expect(queryContent).toContain('inArray(psychometricQuestions.categoryId, wholesaleCategoryIds)')
    })

    it('combina por UNIÓN (or), no de forma excluyente', () => {
      expect(queryContent).toContain('or(...scopeClauses)')
    })

    it('defensa anti-leak: excluye del wholesale categorías con sección seleccionada', () => {
      expect(queryContent).toContain('categoriesWithSelectedSections')
    })

    it('resuelve sectionKeys a IDs desde psychometricSections', () => {
      expect(queryContent).toContain('inArray(psychometricSections.sectionKey, sectionKeys)')
    })
  })

  describe('API route acepta categorías y/o secciones', () => {
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

    it('acepta petición sólo-secciones (no exige categories a secas)', () => {
      expect(routeContent).toContain('"categories" o "sections" requerido')
    })
  })

  describe('Cliente construye la selección de forma AUTORITATIVA', () => {
    const clientContent = fs.readFileSync(
      path.join(ROOT, 'app/psicotecnicos/test/PsicotecnicosTestClient.tsx'),
      'utf-8'
    )

    it('usa el helper puro buildPsychometricTestParams', () => {
      expect(clientContent).toContain('buildPsychometricTestParams')
    })

    it('ya NO usa la heurística frágil allSelected/hasPartialSelection', () => {
      expect(clientContent).not.toContain('hasPartialSelection')
    })

    it('setea sections en la URL cuando hay secciones seleccionadas', () => {
      expect(clientContent).toContain("urlParams.set('sections'")
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
