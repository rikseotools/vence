// GUARDARRAÍL: la estimación "por tema" es UNA, en dos copias. [T-566]
//
// POR QUÉ EXISTE, y no es teórico: [T-507] llevó `buildOfficialExamFilter` (una oficial
// solo se sirve si su exam_position es de TU oposición) y el filtro de supuestos
// prácticos (`exam_case_id IS NULL`) a `estimateAvailableQuestions` del FRONTEND
// (`lib/api/test-config/queries.ts`). El fix nunca llegó al gemelo del backend
// (`backend/src/test-config/test-config.service.ts`), que es el que producción
// ejecuta de verdad: la familia `test-config` está enrutada al backend NestJS
// (`lib/api/backend-router.ts`, flag `test-config: true`). Mismo patrón de fallo que
// [T-326]/[T-551] con `estimateByLaws` — un fix de un solo lado llega a producción
// INERTE porque nadie preguntó qué copia se ejecuta de verdad.
//
// Caso real: Sergio (premium, feedback 87e987d8) pedía 10 preguntas `hard` de su
// tema 1 (contador real en producción, 05/08: 10) y el test solo le servía 3 —
// porque el serve SÍ aplica los dos filtros y el contador (backend) no aplicaba
// ninguno. Medido contra la BD real: con los dos filtros aplicados el contador debe
// bajar de 10 a 4 (quedan 6 oficiales de otra oposición fuera).
//
// Este guardarraíl compara lo que IMPORTA —los filtros que se aplican— y no el
// formato: uno es TypeScript de Nest con `this.db` y el otro una función suelta con
// `db`, así que exigir identidad textual haría fallar el test por un punto y coma.

import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = process.cwd()
const front = readFileSync(join(raiz, 'lib/api/test-config/queries.ts'), 'utf8')
const back = readFileSync(join(raiz, 'backend/src/test-config/test-config.service.ts'), 'utf8')
const backHelpers = readFileSync(
  join(raiz, 'backend/src/test-config/test-config.helpers.ts'),
  'utf8',
)

/** El cuerpo de `estimateAvailableQuestions` en cada copia, sin el resto del fichero. */
function cuerpoEstimateAvailableQuestions(src: string): string {
  const i = src.indexOf('estimateAvailableQuestions(')
  expect(i).toBeGreaterThan(-1)
  const resto = src.slice(i)
  // Siguiente método/función a nivel de bloque tras éste.
  const finFront = resto.indexOf('\n// ============================================')
  const finBack = resto.indexOf('\n  // ============================================')
  const fin = [finFront, finBack].filter((n) => n > 0).sort((a, b) => a - b)[0]
  return fin > 0 ? resto.slice(0, fin) : resto.slice(0, 8000)
}

describe('paridad de la estimación por tema (frontend ↔ backend)', () => {
  it('LAS DOS existen — tenerla en un solo lado es exactamente el defecto de T-507/T-566', () => {
    expect(front).toContain('estimateAvailableQuestions')
    expect(back).toContain('estimateAvailableQuestions')
  })

  it('las dos excluyen oficiales de OTRA oposición — el filtro que el serve aplica SIEMPRE', () => {
    // Sin este filtro, el contador cuenta oficiales que el test nunca sirve (caso Laura,
    // caso Sergio): la tarjeta promete preguntas que no existen para esa oposición.
    for (const src of [front, back]) {
      const cuerpo = cuerpoEstimateAvailableQuestions(src)
      expect(cuerpo).toContain('buildOfficialExamFilter')
    }
  })

  it('el backend tiene su PROPIA copia de buildOfficialExamFilter (no puede importar lib/)', () => {
    // El backend compila con rootDir:src — igual que alcance-de-ley.ts es el espejo de
    // decidirAlcanceDeLey/esDegradacion, éste es el espejo de buildOfficialExamFilter.
    expect(backHelpers).toContain('export function buildOfficialExamFilter')
    // Mismo fail-safe que el frontend: sin posiciones válidas, CERO oficiales — nunca
    // omitir el filtro (eso contaría las de todas las demás oposiciones).
    expect(backHelpers).toMatch(/validPositions\.length === 0/)
  })

  it('las dos excluyen supuestos prácticos (exam_case_id) — sin su narrativa no se sirven', () => {
    for (const src of [front, back]) {
      const cuerpo = cuerpoEstimateAvailableQuestions(src)
      expect(cuerpo).toMatch(/examCaseId/)
    }
  })

  it('las dos aplican el mismo filtro de dificultad (coalesce global_difficulty_category)', () => {
    for (const src of [front, back]) {
      const cuerpo = cuerpoEstimateAvailableQuestions(src)
      expect(cuerpo).toContain('globalDifficultyCategory')
      expect(cuerpo).toContain('difficultyMode')
    }
  })

  it('el backend declara exam_case_id en su schema — si no, buildOfficialExamFilter no compila', () => {
    const schema = readFileSync(join(raiz, 'backend/src/db/schema.ts'), 'utf8')
    expect(schema).toContain("uuid('exam_case_id')")
  })
})
