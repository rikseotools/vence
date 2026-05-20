/**
 * Bug (20/05/2026, reportado por Mayte): al reanudar un simulacro o examen
 * oficial pendiente, las preguntas psicotécnicas con `image_url` perdían la
 * imagen porque las páginas de cliente no copiaban ese campo del payload al
 * objeto que se guardaba en estado. Sólo se notaba en simulacros que el
 * usuario interrumpía y retomaba más tarde — los hechos de un tirón no
 * fallaban.
 *
 * Bug secundario: la pantalla de revisión (`/test/revisar-examen`) usa
 * `getOfficialExamReview` y el schema/query no incluían `imageUrl` ni
 * `contentData`, por lo que tras completar el simulacro las psicotécnicas con
 * imagen también aparecían en blanco.
 *
 * Estos tests son estáticos (lectura de archivos) y previenen regresiones
 * sin requerir setup de BD ni levantar Next.
 */
import { describe, expect, it } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

const ROOT = path.join(__dirname, '..', '..')
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf-8')

describe('Simulacro page — loadResume preserva imageUrl', () => {
  const file = read('app/[oposicion]/test/simulacro/page.tsx')

  it('loadResume copia imageUrl del payload al objeto formateado', () => {
    // Match dentro de la función loadResume (no en loadNew).
    const match = file.match(/async function loadResume\([\s\S]*?\n\s{4}\}/)
    expect(match).not.toBeNull()
    expect(match![0]).toMatch(/imageUrl:\s*q\.imageUrl/)
  })

  it('loadResume copia contentData (no regresión)', () => {
    const match = file.match(/async function loadResume\([\s\S]*?\n\s{4}\}/)
    expect(match![0]).toMatch(/contentData:\s*q\.contentData/)
  })

  it('loadResume propaga examCase* (cohesión con loadNew)', () => {
    const match = file.match(/async function loadResume\([\s\S]*?\n\s{4}\}/)
    expect(match![0]).toMatch(/examCaseId:\s*q\.examCaseId/)
    expect(match![0]).toMatch(/examCaseText:\s*q\.examCaseText/)
    expect(match![0]).toMatch(/examCaseTitle:\s*q\.examCaseTitle/)
  })
})

describe('Examen oficial page — loadResumeExam preserva imageUrl', () => {
  const file = read('app/[oposicion]/test/examen-oficial/page.tsx')

  it('loadResumeExam copia imageUrl del payload', () => {
    const match = file.match(/async function loadResumeExam\([\s\S]*?\n\s{4}\}/)
    expect(match).not.toBeNull()
    expect(match![0]).toMatch(/imageUrl:\s*q\.imageUrl/)
  })

  it('loadResumeExam copia contentData', () => {
    const match = file.match(/async function loadResumeExam\([\s\S]*?\n\s{4}\}/)
    expect(match![0]).toMatch(/contentData:\s*q\.contentData/)
  })
})

describe('Schema review — incluye imageUrl y contentData', () => {
  const file = read('lib/api/official-exams/schemas.ts')

  it('officialExamReviewQuestionSchema declara imageUrl', () => {
    const match = file.match(
      /officialExamReviewQuestionSchema\s*=\s*z\.object\(\{[\s\S]*?\}\)/,
    )
    expect(match).not.toBeNull()
    expect(match![0]).toMatch(/imageUrl:\s*z\.string\(\)\.nullable\(\)/)
  })

  it('officialExamReviewQuestionSchema declara contentData', () => {
    const match = file.match(
      /officialExamReviewQuestionSchema\s*=\s*z\.object\(\{[\s\S]*?\}\)/,
    )
    expect(match![0]).toMatch(/contentData:\s*z\.unknown\(\)\.nullable\(\)/)
  })
})

describe('Query getOfficialExamReview — SELECT y mapeo de imageUrl/contentData', () => {
  const file = read('lib/api/official-exams/queries.ts')

  // Extraer solo el cuerpo de getOfficialExamReview para no contaminar con
  // otras funciones de la misma file que ya tenían los campos correctos.
  const startIdx = file.indexOf('export async function getOfficialExamReview')
  const nextFnIdx = file.indexOf('\nexport async function', startIdx + 1)
  const fnBody =
    startIdx === -1
      ? null
      : file.slice(startIdx, nextFnIdx === -1 ? file.length : nextFnIdx)

  it('la función existe y se puede aislar', () => {
    expect(fnBody).not.toBeNull()
    expect(fnBody!.length).toBeGreaterThan(500)
  })

  it('SELECT legislativo incluye imageUrl y contentData', () => {
    // Hay dos SELECTs en la función (legis + psico). El legis es el primero.
    const body = fnBody!
    const firstSelect = body.match(
      /db\s*\.select\(\{[\s\S]*?\}\)\s*\.from\(questions\)/,
    )
    expect(firstSelect).not.toBeNull()
    expect(firstSelect![0]).toMatch(/imageUrl:\s*questions\.imageUrl/)
    expect(firstSelect![0]).toMatch(/contentData:\s*questions\.contentData/)
  })

  it('SELECT psicotécnico incluye imageUrl y contentData', () => {
    const body = fnBody!
    const psyMatch = body.match(
      /db\s*\.select\(\{[\s\S]*?\}\)\s*\.from\(psychometricQuestions\)/,
    )
    expect(psyMatch).not.toBeNull()
    expect(psyMatch![0]).toMatch(/imageUrl:\s*psychometricQuestions\.imageUrl/)
    expect(psyMatch![0]).toMatch(
      /contentData:\s*psychometricQuestions\.contentData/,
    )
  })

  it('objeto questionData legislativo asigna imageUrl/contentData', () => {
    const body = fnBody!
    // Bloque del isLegislative — empieza con "if (isLegislative)" y termina en
    // la primera "} else {".
    const legBlock = body.match(/if \(isLegislative\)[\s\S]*?\} else \{/)
    expect(legBlock).not.toBeNull()
    expect(legBlock![0]).toMatch(/imageUrl:\s*legQ\.imageUrl/)
    expect(legBlock![0]).toMatch(/contentData:\s*legQ\.contentData/)
  })

  it('objeto questionData psicotécnico asigna imageUrl/contentData', () => {
    const body = fnBody!
    // Bloque del else psicotécnico — desde "} else {" hasta cerrar el if.
    const psyBlock = body.match(/\} else \{[\s\S]*?\n\s{6}\}\n/)
    expect(psyBlock).not.toBeNull()
    expect(psyBlock![0]).toMatch(/imageUrl:\s*psyQ\.imageUrl/)
    expect(psyBlock![0]).toMatch(/contentData:\s*psyQ\.contentData/)
  })
})

describe('ExamReviewLayout consume imageUrl/contentData', () => {
  // Doble verificación: comprobamos que el consumidor sigue pidiendo los
  // campos. Si alguien quita el ContentDataRenderer del layout, no vale de
  // nada arreglar el backend.
  const file = read('components/ExamReviewLayout.tsx')

  it('pasa imageUrl al ContentDataRenderer en la lista de preguntas', () => {
    expect(file).toMatch(
      /<ContentDataRenderer[\s\S]{0,200}imageUrl=\{question\.imageUrl\}/,
    )
  })

  it('pasa contentData al ContentDataRenderer', () => {
    expect(file).toMatch(
      /<ContentDataRenderer[\s\S]{0,200}contentData=\{question\.contentData/,
    )
  })
})
