/**
 * La sonda continua de scope (T-607): una comprobación INDEPENDIENTE, en memoria, del mismo
 * criterio que ya filtra en SQL (`articleInPositionScopeExists`) — para que un futuro desacuerdo
 * entre el SQL y el criterio puro (`fueraDeScope`) se vea al servir, no semanas después en una
 * impugnación.
 *
 * Hermana de `registrarBarajadoServido.test.ts` a propósito: mismo contrato (envoltorio
 * transparente, fire-and-forget, nunca tumba el servir), mismas comprobaciones.
 */
const mockEmitir = jest.fn()
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...args: unknown[]) => mockEmitir(...args),
}))

import { registrarScopeServido } from '@/lib/api/filtered-questions/queries'

type Q = { id: string; lawId: string | null; articleNumber: string | null }
const pregunta = (id: string, lawId: string | null, articleNumber: string | null): Q => ({
  id,
  lawId,
  articleNumber,
})

const LEY_CE = 'ley-ce'
const LEY_LOPD = 'ley-lopd'

describe('sonda de scope al servir (registrarScopeServido)', () => {
  beforeEach(() => mockEmitir.mockClear())

  it('emite cuando hay preguntas servidas fuera del scope', () => {
    const qs = [pregunta('q1', LEY_CE, '134'), pregunta('q2', LEY_CE, '9')]
    const scope = [{ lawId: LEY_CE, articleNumbers: ['1', '9', '55'] }] // el 134 NO está
    registrarScopeServido(qs, scope, { positionType: 'carm', userId: 'u1' })

    expect(mockEmitir).toHaveBeenCalledTimes(1)
    const ev = mockEmitir.mock.calls[0][0]
    expect(ev.eventType).toBe('question_served_out_of_topic_scope')
    expect(ev.severity).toBe('error')
    expect(ev.userId).toBe('u1')
    expect(ev.metadata.servidas).toBe(2)
    expect(ev.metadata.fuera).toBe(1)
    expect(ev.metadata.ids).toEqual(['q1'])
  })

  it('NO emite nada cuando todo lo servido cae dentro del scope (caso normal)', () => {
    const qs = [pregunta('q1', LEY_CE, '9'), pregunta('q2', LEY_CE, '55')]
    const scope = [{ lawId: LEY_CE, articleNumbers: ['1', '9', '55'] }]
    registrarScopeServido(qs, scope, { positionType: 'carm' })
    expect(mockEmitir).not.toHaveBeenCalled()
  })

  it('respeta article_numbers=NULL como "toda la ley" (misma convención que articleInScope)', () => {
    const qs = [pregunta('q1', LEY_LOPD, '99')]
    const scope = [{ lawId: LEY_LOPD, articleNumbers: null }]
    registrarScopeServido(qs, scope, { positionType: 'x' })
    expect(mockEmitir).not.toHaveBeenCalled()
  })

  it('sin scope (oposición sin temario) no opina — no es fuga, es temario sin construir', () => {
    const qs = [pregunta('q1', LEY_CE, '134')]
    registrarScopeServido(qs, [], { positionType: 'sin-temario' })
    expect(mockEmitir).not.toHaveBeenCalled()
  })

  it('acota el detalle a 50 ids, pero el conteo no se recorta', () => {
    const qs = Array.from({ length: 80 }, (_, i) => pregunta(`q${i}`, LEY_CE, '134'))
    const scope = [{ lawId: LEY_CE, articleNumbers: ['1'] }] // ninguna de las 80 está dentro
    registrarScopeServido(qs, scope, { positionType: 'x' })
    const ev = mockEmitir.mock.calls[0][0]
    expect(ev.metadata.fuera).toBe(80)
    expect(ev.metadata.ids).toHaveLength(50)
  })

  it('devuelve las mismas preguntas: es un envoltorio transparente, no un filtro', () => {
    const qs = [pregunta('q1', LEY_CE, '134')]
    const scope = [{ lawId: LEY_CE, articleNumbers: ['1'] }]
    expect(registrarScopeServido(qs, scope, { positionType: 'x' })).toBe(qs)
  })

  it('si la observabilidad explota, servir preguntas NO se rompe', () => {
    mockEmitir.mockImplementationOnce(() => { throw new Error('sink caído') })
    const qs = [pregunta('q1', LEY_CE, '134')]
    const scope = [{ lawId: LEY_CE, articleNumbers: ['1'] }]
    expect(() => registrarScopeServido(qs, scope, { positionType: 'x' })).not.toThrow()
    expect(registrarScopeServido(qs, scope, { positionType: 'x' })).toBe(qs)
  })
})
