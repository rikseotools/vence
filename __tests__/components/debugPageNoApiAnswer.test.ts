/**
 * Regresión: /debug/question/[id]/page.tsx NO debe llamar al endpoint
 * deprecado /api/answer (devuelve 404 desde la migración a /api/v2/
 * answer-and-save). Debe usar /api/debug/validate-answer/[id] (endpoint
 * ligero específico para debug).
 *
 * Además, NO debe renderizar preguntas legislativas (text_question + type='law')
 * a través de ChartQuestion, porque éste muestra un mensaje psicotécnico
 * hardcodeado ("Los psicotécnicos son la parte más difícil…") que no aplica.
 */
import fs from 'node:fs'
import path from 'node:path'

const PAGE_PATH = path.join(
  process.cwd(),
  'app/debug/question/[id]/page.tsx'
)

function loadSource(): string {
  return fs.readFileSync(PAGE_PATH, 'utf-8')
}

describe('app/debug/question/[id]/page.tsx — contrato', () => {
  test('NO contiene la string deprecada "/api/answer" (sin sufijo)', () => {
    const src = loadSource()
    // Buscamos /api/answer que NO sea seguido por / (psychometric, spelling, ...)
    // ni precedido por v2/.
    const matches = src.match(/['"`]\/api\/answer(?!\/|-)['"`]/g)
    expect(matches).toBeNull()
  })

  test('llama al nuevo endpoint /api/debug/validate-answer', () => {
    const src = loadSource()
    expect(src).toContain('/api/debug/validate-answer/')
  })

  test('importa LegislativeQuestionDebug o renderiza sin pasar por ChartQuestion para text_question legislativas', () => {
    const src = loadSource()
    // Garantizamos que existe la rama que rutea legislativas a un componente
    // distinto de ChartQuestion.
    expect(src).toMatch(/LegislativeQuestionDebug/)
    expect(src).toMatch(/question_type === 'psychometric'/)
  })

  test('importa ContentDataRenderer para renderizar imagen / icono', () => {
    const src = loadSource()
    expect(src).toContain('ContentDataRenderer')
  })

  test('importa MarkdownExplanation para renderizar la explicación', () => {
    const src = loadSource()
    expect(src).toContain('MarkdownExplanation')
  })
})
