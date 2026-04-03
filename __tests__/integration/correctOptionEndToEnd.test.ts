// __tests__/integration/correctOptionEndToEnd.test.ts
// Verifica que correct_option llega a TestLayout por TODOS los paths de carga de preguntas.
// Si alguien añade un transformador nuevo y olvida correct_option, este test falla.

import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.resolve(__dirname, '../..')

// Todos los archivos que transforman preguntas antes de pasarlas a TestLayout
const TRANSFORMERS = [
  { name: 'testFetchers', file: 'lib/testFetchers.ts', pattern: /correct_option:\s*q\.correct_option/ },
  { name: 'lawFetchers', file: 'lib/lawFetchers.ts', pattern: /correct_option:\s*q\.correct_option/ },
  { name: 'filtered-questions queries', file: 'lib/api/filtered-questions/queries.ts', pattern: /correct_option:\s*q\.correctOption/ },
  { name: 'filtered-questions schema', file: 'lib/api/filtered-questions/schemas.ts', pattern: /correct_option:\s*z\.number/ },
  { name: 'LawTestPageWrapper', file: 'components/LawTestPageWrapper.tsx', pattern: /correct_option:\s*q\.correct_option/ },
  { name: 'multi-ley', file: 'app/test/multi-ley/page.tsx', pattern: /correct_option:\s*q\.correct_option/ },
  { name: 'repaso-fallos', file: 'app/test/repaso-fallos/page.tsx', pattern: /correct_option/ },
  { name: 'articulo', file: 'app/test/articulo/page.tsx', pattern: /correct_option/ },
  { name: 'create-test API', file: 'app/api/ai/create-test/route.ts', pattern: /correct_option/ },
  { name: 'psychometric schema', file: 'lib/api/psychometric-test-data/schemas.ts', pattern: /correctOption/ },
  { name: 'psychometric queries', file: 'lib/api/psychometric-test-data/queries.ts', pattern: /correctOption:\s*psychometricQuestions\.correctOption/ },
  { name: 'PsychometricTestExecutor', file: 'app/psicotecnicos/test/ejecutar/PsychometricTestExecutor.tsx', pattern: /correct_option:\s*q\.correctOption/ },
]

describe('correct_option end-to-end', () => {
  for (const t of TRANSFORMERS) {
    it(`${t.name} incluye correct_option en la transformación`, () => {
      const filePath = path.join(ROOT, t.file)
      expect(fs.existsSync(filePath)).toBe(true)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toMatch(t.pattern)
    })
  }

  // Verificar que TestLayout lee correct_option
  it('TestLayout lee correct_option del objeto de pregunta', () => {
    const content = fs.readFileSync(path.join(ROOT, 'components/TestLayout.tsx'), 'utf-8')
    expect(content).toContain('currentQ.correct_option')
  })

  // Verificar que PsychometricTestLayout lee correct_option
  it('PsychometricTestLayout lee correct_option del objeto de pregunta', () => {
    const content = fs.readFileSync(path.join(ROOT, 'components/PsychometricTestLayout.tsx'), 'utf-8')
    expect(content).toContain('currentQ.correct_option')
  })

  // Verificar que las interfaces FilteredQuestionResponse incluyen correct_option
  it('LawTestPageWrapper FilteredQuestionResponse tiene correct_option', () => {
    const content = fs.readFileSync(path.join(ROOT, 'components/LawTestPageWrapper.tsx'), 'utf-8')
    // Buscar dentro del interface
    const interfaceMatch = content.match(/interface FilteredQuestionResponse \{[\s\S]*?\}/)
    expect(interfaceMatch).not.toBeNull()
    expect(interfaceMatch![0]).toContain('correct_option')
  })

  it('multi-ley FilteredQuestionResponse tiene correct_option', () => {
    const content = fs.readFileSync(path.join(ROOT, 'app/test/multi-ley/page.tsx'), 'utf-8')
    const interfaceMatch = content.match(/interface FilteredQuestionResponse \{[\s\S]*?\}/)
    expect(interfaceMatch).not.toBeNull()
    expect(interfaceMatch![0]).toContain('correct_option')
  })
})
