import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

// ============================================================================
// GUARDRAIL / CANARY — la pregunta a impugnar NUNCA se adivina de estado ambiente
// ============================================================================
// Anti-regresión del bug del 21/07 (caso María José, premium): FeedbackModal detectaba la
// pregunta con `localStorage.getItem('currentQuestionId')` y un scan `querySelector('[data-question-id]')`.
// Esos valores persisten/flotan entre páginas, así que en /soporte colgaban la impugnación de
// una pregunta VIEJA. La regla: solo fuentes explícitas y vivas (prop → URL → QuestionContext),
// encapsuladas en lib/api/dispute/resolveQuestionId.ts.

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'lib', 'components', 'contexts', 'hooks']
const EXT = /\.(ts|tsx|js)$/
const SKIP = /node_modules|\.next|\.open-next|\.backup|backup-|__tests__|\.test\./

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

function walk(rel: string): string[] {
  let out: string[] = []
  let entries: string[]
  try { entries = readdirSync(join(ROOT, rel)) } catch { return [] }
  for (const e of entries) {
    const childRel = `${rel}/${e}`
    if (SKIP.test(childRel)) continue
    const st = statSync(join(ROOT, childRel))
    if (st.isDirectory()) out = out.concat(walk(childRel))
    else if (EXT.test(e)) out.push(childRel)
  }
  return out
}

describe('GUARDRAIL: nadie adivina la pregunta a impugnar desde estado ambiente (repo-wide)', () => {
  const files = SCAN_DIRS.flatMap(walk).map((rel) => ({ rel, src: stripComments(readFileSync(join(ROOT, rel), 'utf8')) }))

  it('ningún fichero usa localStorage con la clave currentQuestionId (read o write)', () => {
    // Acotado al patrón PELIGROSO (localStorage.{get,set,remove}Item('currentQuestionId')); no
    // señalamos usos del identificador sin localStorage (p.ej. un parámetro local homónimo en
    // app/debug/question/[id]/page.tsx, ajeno a la impugnación).
    const offenders = files.filter((f) => /(get|set|remove)Item\(\s*['"]currentQuestionId['"]\s*\)/.test(f.src))
      .map((f) => f.rel)
    expect(offenders).toEqual([])
  })

  it('ningún fichero escanea el DOM buscando data-question-id (querySelector)', () => {
    const offenders = files.filter((f) => /querySelector\(\s*['"]\[data-question-id\]/.test(f.src))
      .map((f) => f.rel)
    expect(offenders).toEqual([])
  })
})

describe('GUARDRAIL: FeedbackModal usa el resolver central', () => {
  const src = stripComments(readFileSync(join(ROOT, 'components/FeedbackModal.tsx'), 'utf8'))
  it('usa resolveDisputeQuestionId + useQuestionContext', () => {
    expect(src).toMatch(/resolveDisputeQuestionId/)
    expect(src).toMatch(/useQuestionContext/)
  })
})

describe('GUARDRAIL: el guard de servidor va DESACOPLADO del path de latencia', () => {
  const src = stripComments(readFileSync(join(ROOT, 'lib/api/dispute/queries.ts'), 'utf8'))
  it('createDispute llama a checkDisputeEngagement SIN await (endpoint con historial de 504)', () => {
    expect(src).toMatch(/checkDisputeEngagement\(/)
    expect(src).not.toMatch(/await\s+checkDisputeEngagement\(/)
  })
})
