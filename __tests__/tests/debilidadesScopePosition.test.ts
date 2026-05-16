/**
 * Tests para la nueva card "Mis Debilidades" del hub de tests.
 *
 * Feature (16/05/2026): scope 'position' en getFailedQuestionsForUser + 2 órdenes
 * nuevos ('oldest', 'random') + componente DebilidadesCard en TestHubClient.
 *
 * Resuelve la sugerencia 5 de Mayte (vayarolloderegistro@gmail.com, 15/05/2026):
 * poder repasar fallos de toda la oposición con varios criterios de ordenación,
 * no solo "más recientes".
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8')
}

// ============================================
// SCHEMA: scope 'position' añadido + orden 'oldest'/'random'
// ============================================
describe('failedQuestionsScopeSchema — scope position', () => {
  const schema = read('lib/api/tests/schemas.ts')

  it('incluye discriminator type=position en el discriminatedUnion', () => {
    expect(schema).toContain("type: z.literal('position')")
  })

  it('scope position exige positionType (anti cross-oposición)', () => {
    // El scope 'position' debe estar dentro del discriminatedUnion y exigir positionType
    const positionScopeMatch = schema.match(
      /type:\s*z\.literal\('position'\)[\s\S]{0,200}positionType:\s*z\.string\(\)/,
    )
    expect(positionScopeMatch).toBeTruthy()
  })

  it('mantiene scopes block y topic existentes (retrocompatible)', () => {
    expect(schema).toContain("type: z.literal('block')")
    expect(schema).toContain("type: z.literal('topic')")
  })
})

describe('failedQuestionsOrderSchema — órdenes oldest y random', () => {
  const schema = read('lib/api/tests/schemas.ts')

  it("añade 'oldest' como modo de ordenación", () => {
    expect(schema).toMatch(/failedQuestionsOrderSchema[\s\S]*?'oldest'/)
  })

  it("añade 'random' como modo de ordenación", () => {
    expect(schema).toMatch(/failedQuestionsOrderSchema[\s\S]*?'random'/)
  })

  it('mantiene órdenes anteriores recent/most_failed/worst_accuracy', () => {
    expect(schema).toMatch(/failedQuestionsOrderSchema[\s\S]*?'recent'/)
    expect(schema).toMatch(/failedQuestionsOrderSchema[\s\S]*?'most_failed'/)
    expect(schema).toMatch(/failedQuestionsOrderSchema[\s\S]*?'worst_accuracy'/)
  })
})

// ============================================
// QUERY: handler para scope 'position' + ordenadores nuevos
// ============================================
describe('getFailedQuestionsForUser — scope position', () => {
  const queries = read('lib/api/tests/queries.ts')

  it("trata scope.type === 'position' como caso explícito", () => {
    expect(queries).toContain("params.scope.type === 'position'")
  })

  it('aplica filtro EXISTS contra topic_scope×topics con position_type', () => {
    // El filtro para 'position' debe incluir un JOIN con topics filtrando por
    // position_type (anti cross-oposición) y is_active=true.
    expect(queries).toMatch(
      /scope\.type === 'position'[\s\S]{0,800}EXISTS[\s\S]{0,400}position_type[\s\S]{0,200}is_active\s*=\s*true/,
    )
  })

  it('no requiere bloque ni temas en scope position', () => {
    // El branch de 'position' no debe usar topicNumbers ni bloqueNumber
    const positionBranch = queries.match(
      /scope\.type === 'position'[\s\S]{0,500}?(?=else|}\s*else|\s*}\s*\n)/,
    )
    expect(positionBranch).toBeTruthy()
    if (positionBranch) {
      const branch = positionBranch[0]
      expect(branch).not.toContain('topicNumber')
      expect(branch).not.toContain('bloqueNumber')
    }
  })
})

describe('getFailedQuestionsForUser — orderBy oldest y random', () => {
  const queries = read('lib/api/tests/queries.ts')

  it("case 'oldest' ordena por lastFail ASC (más antiguas primero)", () => {
    expect(queries).toMatch(
      /case\s+'oldest':[\s\S]{0,400}new Date\(a\.lastFail\)\.getTime\(\)\s*-\s*new Date\(b\.lastFail\)\.getTime\(\)/,
    )
  })

  it("case 'random' usa Fisher–Yates in-place (Math.random)", () => {
    expect(queries).toMatch(
      /case\s+'random':[\s\S]{0,400}Math\.random/,
    )
  })

  it('mantiene case most_failed y default recent existentes', () => {
    expect(queries).toContain("case 'most_failed':")
    expect(queries).toContain("default: // 'recent'")
  })
})

// ============================================
// PÁGINA repaso-fallos-v2: detecta positionType sin bloque
// ============================================
describe('repaso-fallos-v2 — fallback a scope position', () => {
  const page = read('app/test/repaso-fallos-v2/page.tsx')

  it("si recibe positionType sin bloque, envía scope { type: 'position' }", () => {
    expect(page).toMatch(
      /else if \(positionTypeParam\)[\s\S]{0,300}type:\s*'position'[\s\S]{0,100}positionType:\s*positionTypeParam/,
    )
  })

  it('el tipo Scope local incluye position', () => {
    expect(page).toMatch(/type Scope[\s\S]{0,400}type:\s*'position'/)
  })

  it('mantiene comportamiento previo: bloque + positionType usa scope block', () => {
    expect(page).toMatch(/if \(bloqueParam && positionTypeParam\)[\s\S]{0,300}type:\s*'block'/)
  })
})

// ============================================
// COMPONENTE DebilidadesCard: estructura UX
// ============================================
describe('DebilidadesCard en TestHubClient', () => {
  const hub = read('components/test/TestHubClient.tsx')

  it('existe la función DebilidadesCard', () => {
    expect(hub).toContain('function DebilidadesCard(')
  })

  it('se renderiza después del map de bloques', () => {
    // BlockSection map → DebilidadesCard (después pueden venir SimulacroCard,
    // OfficialExamsSection, Ortografía, etc. — orden actualizado 2026-05-16)
    expect(hub).toMatch(
      /bloques\.map[\s\S]{0,2000}<DebilidadesCard/,
    )
  })

  it('ofrece 4 modos de ordenación (most_failed, recent, oldest, random)', () => {
    expect(hub).toMatch(/id:\s*'most_failed'/)
    expect(hub).toMatch(/id:\s*'recent'/)
    expect(hub).toMatch(/id:\s*'oldest'/)
    expect(hub).toMatch(/id:\s*'random'/)
  })

  it('ofrece 3 períodos (Todo=365d, Último mes=30d, Última semana=7d)', () => {
    expect(hub).toMatch(/days:\s*365[\s\S]{0,80}label:\s*'Todo'/)
    expect(hub).toMatch(/days:\s*30[\s\S]{0,80}label:\s*'Último mes'/)
    expect(hub).toMatch(/days:\s*7[\s\S]{0,80}label:\s*'Última semana'/)
  })

  it('ofrece 4 opciones de cantidad (10/20/30/50)', () => {
    expect(hub).toMatch(/COUNT_OPTIONS[\s\S]{0,80}\[\s*10\s*,\s*20\s*,\s*30\s*,\s*50\s*\]/)
  })

  it('defaults sensatos: selectedDays=365 (Todo) y selectedCount=20', () => {
    expect(hub).toContain('useState<number>(365)')
    expect(hub).toContain('useState<number>(20)')
  })

  it('construye href con positionType + order + n + days', () => {
    expect(hub).toMatch(
      /buildHref[\s\S]{0,500}positionType[\s\S]{0,100}order[\s\S]{0,100}n:\s*String\(selectedCount\)[\s\S]{0,100}days:\s*String\(selectedDays\)/,
    )
  })

  it('navega a /test/repaso-fallos-v2 con los params elegidos', () => {
    expect(hub).toContain('/test/repaso-fallos-v2?')
  })
})
