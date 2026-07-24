/**
 * Contrato del configurador de leyes (fix 24/07 David/Galicia: la ruta acotada
 * ahora lee de topic_law_question_summary). Este test fija el shape público
 * independiente de la fuente de datos.
 */
import { buildLawsResponse, type LawStatRow } from '@/lib/api/laws-configurator/transform'

const row = (lawShortName: string | null, totalQuestions: number, articlesWithQuestions = 1, lawName: string | null = null): LawStatRow =>
  ({ lawShortName, lawName, totalQuestions, articlesWithQuestions })

describe('buildLawsResponse', () => {
  it('filtra leyes con 0 preguntas y sin short_name', () => {
    const r = buildLawsResponse([row('CE', 100), row('Vacía', 0), row(null, 50)])
    expect(r.data.map((l) => l.lawShortName)).toEqual(['CE'])
    expect(r.totalLaws).toBe(1)
  })

  it('ordena DESC por nº de preguntas', () => {
    const r = buildLawsResponse([row('B', 10), row('A', 300), row('C', 50)])
    expect(r.data.map((l) => l.lawShortName)).toEqual(['A', 'C', 'B'])
  })

  it('lawName cae a shortName si falta, y suma totales', () => {
    const r = buildLawsResponse([row('CE', 100, 5, null), row('LPRL', 50, 3, 'Ley de PRL')])
    expect(r.data[0]).toMatchObject({ lawShortName: 'CE', lawName: 'CE', articlesWithQuestions: 5 })
    expect(r.data[1].lawName).toBe('Ley de PRL')
    expect(r.totalQuestions).toBe(150)
  })

  it('tolera counts que llegan como string (SUM::int por driver)', () => {
    const r = buildLawsResponse([{ lawShortName: 'CE', lawName: null, totalQuestions: '200' as unknown as number, articlesWithQuestions: '9' as unknown as number }])
    expect(r.data[0].totalQuestions).toBe(200)
    expect(r.data[0].articlesWithQuestions).toBe(9)
  })

  it('sin filas → respuesta vacía coherente (dispara el aviso empty_scope aguas arriba)', () => {
    const r = buildLawsResponse([])
    expect(r).toEqual({ success: true, data: [], totalLaws: 0, totalQuestions: 0 })
  })
})
