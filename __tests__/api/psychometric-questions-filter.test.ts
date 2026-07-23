/**
 * @jest-environment node
 */
// Filtro de psicotécnicas por sección.
//
// Bug (Laura Zurdo, 18/07/2026): al querer practicar SOLO "Analogías verbales"
// se colaban sinónimos/antónimos, definiciones y ordenación de frases (toda la
// categoría "Razonamiento verbal").
//
// Causa raíz (3 defectos): (1) el cliente solo mandaba `sections` cuando la
// categoría estaba PARCIALMENTE seleccionada; (2) el backend filtraba por sección
// XOR categoría (no componían); (3) secciones fantasma (0 preguntas) contaminaban
// el estado. Fix: la SECCIÓN es la unidad de selección; el cliente manda SIEMPRE
// las secciones exactas y el backend filtra por el conjunto de section_id.

import * as fs from 'fs'
import * as path from 'path'
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

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

  describe('Query filtra SIEMPRE por sección (sin XOR categoría)', () => {
    const queryContent = fs.readFileSync(
      path.join(ROOT, 'lib/api/psychometric-test-data/queries.ts'),
      'utf-8'
    )
    it('getPsychometricQuestions acepta sectionKeys', () => {
      expect(queryContent).toContain('sectionKeys?: string[]')
    })
    it('filtra las preguntas por sectionId (unidad de selección = sección)', () => {
      expect(queryContent).toContain('inArray(psychometricQuestions.sectionId, sectionIds)')
    })
    it('resuelve la categoría a sus secciones (categoría = sus secciones)', () => {
      expect(queryContent).toContain('inArray(psychometricSections.categoryId, categoryIds)')
    })
    it('ya NO filtra las preguntas por categoryId (se eliminó el XOR)', () => {
      expect(queryContent).not.toContain('inArray(psychometricQuestions.categoryId, categoryIds)')
    })
    it('excluye secciones fantasma (0 preguntas) del árbol', () => {
      expect(queryContent).toContain('.filter(section => section.count > 0)')
    })
  })

  describe('Cliente envía SIEMPRE las secciones exactas (sin heurística)', () => {
    const clientContent = fs.readFileSync(
      path.join(ROOT, 'app/psicotecnicos/test/PsicotecnicosTestClient.tsx'),
      'utf-8'
    )
    it('construye el parámetro sections', () => {
      expect(clientContent).toContain("urlParams.set('sections'")
    })
    it('eliminó la heurística frágil hasPartialSelection', () => {
      expect(clientContent).not.toContain('hasPartialSelection')
    })
    it('solo incluye secciones con preguntas (count > 0)', () => {
      expect(clientContent).toContain('sec.count > 0 && selectedSections[sec.key]')
    })
    it('ofrece "Solo esta sección" de un clic (UX)', () => {
      expect(clientContent).toContain('selectOnlySection')
    })
    it('muestra resumen exacto de lo que se va a practicar (UX)', () => {
      expect(clientContent).toContain('getSelectedSectionsSummary')
    })
  })

  // ── Guardarraíl de COMPORTAMIENTO contra BD (el invariante que se rompió) ──
  const hasDb = !!process.env.DATABASE_URL
  const describeIf = hasDb ? describe : describe.skip

  describeIf('Comportamiento real (BD): la sección manda', () => {
    let client: Client
    let analogiasId: string
    beforeAll(async () => {
      client = new Client({ connectionString: process.env.DATABASE_URL })
      await client.connect()
      const { rows } = await client.query(
        `SELECT id FROM psychometric_sections WHERE section_key = 'analogias-verbales' LIMIT 1`
      )
      analogiasId = rows[0]?.id
    })
    afterAll(async () => { if (client) await client.end() })

    it('pedir SOLO "analogias-verbales" no trae otras secciones verbales', async () => {
      const { getPsychometricQuestions } = await import('@/lib/api/psychometric-test-data/queries')
      const res = await getPsychometricQuestions(['razonamiento-verbal'], 500, ['analogias-verbales'])
      expect(res.success).toBe(true)
      expect((res.questions || []).length).toBeGreaterThan(0)
      // TODAS las preguntas devueltas deben ser de la sección analogias-verbales
      for (const q of res.questions || []) {
        expect((q as any).sectionId).toBe(analogiasId)
      }
    })

    it('la categoría entera (sin sections) SÍ trae varias secciones (contraste)', async () => {
      const { getPsychometricQuestions } = await import('@/lib/api/psychometric-test-data/queries')
      const res = await getPsychometricQuestions(['razonamiento-verbal'], 500)
      const sectionIds = new Set((res.questions || []).map((q: any) => q.sectionId))
      expect(sectionIds.size).toBeGreaterThan(1)
    })

    it('componibilidad: mezclar dos categorías por sección no descarta ninguna (fin del XOR)', async () => {
      const { getPsychometricQuestions } = await import('@/lib/api/psychometric-test-data/queries')
      // una sección de otra categoría (numérico) para el caso mixto
      const { rows } = await client.query(
        `SELECT s.section_key FROM psychometric_sections s
         JOIN psychometric_categories c ON c.id = s.category_id
         WHERE c.category_key = 'razonamiento-numerico' AND s.is_active
           AND EXISTS (SELECT 1 FROM psychometric_questions q WHERE q.section_id = s.id AND q.is_active)
         LIMIT 1`
      )
      const numericSection = rows[0]?.section_key
      if (!numericSection) return // sin datos → nada que afirmar
      const res = await getPsychometricQuestions(
        ['razonamiento-verbal', 'razonamiento-numerico'],
        1000,
        ['analogias-verbales', numericSection]
      )
      const secIds = new Set((res.questions || []).map((q: any) => q.sectionId))
      // Debe haber preguntas de AMBAS secciones (el XOR viejo tiraba una)
      expect(secIds.has(analogiasId)).toBe(true)
      expect(secIds.size).toBeGreaterThanOrEqual(2)
    })
  })
})
