// GUARDARRAÍL: el número de artículos no se deduce de las preguntas.
//
// ## Qué pasó (30/07/2026)
//
// `app/leyes/[law]/LawTestConfigurator.tsx` construía los datos de la ley así:
//
//     total_articles:          lawStats?.totalQuestions || 0,
//     questions_count:         lawStats?.totalQuestions || 0,
//     articles_with_questions: lawStats?.totalQuestions || 0,   ← preguntas en el hueco de artículos
//
// El resultado, visible en producción: «798 artículos disponibles» para la LO 3/2007, que
// tiene 134, con un selector de 136 casillas justo debajo. Nadie lo cazó porque el tipo
// exigía un `number` y cualquier número lo satisface: el campo estaba relleno, solo que con
// otra cosa. Salió al verificar una pregunta de un usuario sobre el filtro de artículos.
//
// Este test fija que ese fichero no vuelva a rellenar un campo de artículos con el total de
// preguntas. Es estático a propósito: la comprobación de comportamiento vive en
// `__tests__/lib/laws/contadorArticulos.test.ts`, pero el error de aquí es de ESCRITURA
// (poner un valor en el sitio de otro), y eso se ve en el texto.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

describe('el contador de artículos no se rellena con preguntas', () => {
  const CONFIGURADOR = leer('app/leyes/[law]/LawTestConfigurator.tsx')

  it('ningún campo de artículos toma su valor de totalQuestions', () => {
    const culpables = CONFIGURADOR.split('\n')
      .map((linea, i) => ({ linea: linea.trim(), n: i + 1 }))
      .filter(({ linea }) => /^(total_articles|articles_with_questions)\s*:/.test(linea))
      .filter(({ linea }) => /totalQuestions/.test(linea))
      .map(({ linea, n }) => `LawTestConfigurator.tsx:${n} → ${linea}`)
    expect(culpables.join('\n') || 'ninguno').toBe('ninguno')
  })

  it('el contador sale de la consulta, no de una deducción', () => {
    expect(CONFIGURADOR).toContain('articlesWithQuestions')
    expect(CONFIGURADOR).toContain('decidirContadorArticulos')
  })

  it('la consulta cuenta artículos DISTINTOS de verdad', () => {
    const QUERY = leer('lib/api/law-stats/queries.ts')
    expect(QUERY).toMatch(/count\(distinct/i)
    expect(QUERY).toContain('articlesWithQuestions')
  })

  it('un contador contradictorio deja rastro (si no, el próximo es invisible otra vez)', () => {
    expect(CONFIGURADOR).toContain('ui_contador_incoherente')
    expect(CONFIGURADOR).toContain('emitClientEvent')
  })

  it('el campo es OPCIONAL: poder omitirlo es lo que permite callarlo en vez de inventarlo', () => {
    const TIPOS = leer('components/TestConfigurator.types.ts')
    expect(TIPOS).toMatch(/articles_with_questions\?:\s*number/)
  })
})
