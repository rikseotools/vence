// Guardarraíl (fix 13/07 — bug Alfonso): /leyes mostraba "No hay leyes
// disponibles" (dead-end) cuando la query de leyes TIMEABA bajo carga. La causa:
// el código confundía ERROR de query (!success) con vacío real (length 0). Y no
// había stale-on-error, así que un transitorio vaciaba la página.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const comp = readFileSync(join(ROOT, 'components', 'LeyesServerComponent.tsx'), 'utf-8')
const queries = readFileSync(join(ROOT, 'lib', 'api', 'laws', 'queries.ts'), 'utf-8')

describe('/leyes — error ≠ vacío + stale-on-error (anti dead-end)', () => {
  it('el componente distingue !success (reintentar) de laws vacío', () => {
    // rama de error separada, con estado de reintento
    expect(comp).toMatch(/if\s*\(\s*!result\.success\s*\)/)
    expect(comp).toMatch(/Reintentar|Estamos cargando/)
    // el chequeo de vacío real (length === 0) se evalúa DESPUÉS del de error
    const idxError = comp.indexOf('!result.success')
    const idxEmptyCheck = comp.indexOf('result.laws.length === 0')
    expect(idxError).toBeGreaterThanOrEqual(0)
    expect(idxEmptyCheck).toBeGreaterThan(idxError)
  })

  it('la condición vieja combinada (!success || length===0 → mismo dead-end) ya NO existe', () => {
    expect(comp).not.toMatch(/!result\.success\s*\|\|[^)]*length === 0/)
  })

  it('getLawsWithQuestionCounts lee de la MV precomputada (no agregado pesado por request)', () => {
    // fix robusto: el conteo por ley vive en la materialized view law_question_counts
    // (refrescada con el resto de MVs) → lectura de ms, el timeout deja de ser un riesgo.
    expect(queries).toMatch(/law_question_counts/)
    // el parche en memoria _lastGoodLaws ya NO existe (lo hace innecesario la MV)
    expect(queries).not.toMatch(/_lastGoodLaws/)
  })
})
