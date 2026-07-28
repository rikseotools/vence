/**
 * El servidor debe dejar constancia de QUÉ sirvió barajado.
 *
 * Por qué (28/07/2026): la permutación se genera al servir y hasta hoy **solo quedaba registrada si
 * el cliente la devolvía** al guardar. Cuando `test_questions.option_order` apareció a NULL en el
 * 100 % de las filas mientras el servidor SÍ barajaba, no se pudo demostrar qué se le mostró a cada
 * usuario **ni reparar los datos**: el orden usa un nonce aleatorio por exposición y no se puede
 * reconstruir. Este evento es lo que convierte ese tipo de fallo en reparable.
 *
 * Se prueba lo que importa de un registro: que registra cuando hay algo que registrar, que no
 * ensucia cuando no lo hay, que no se desborda, y que NUNCA puede tumbar el servir preguntas.
 */
const mockEmitir = jest.fn()
jest.mock('@/lib/observability/emit', () => ({
  emitFireAndForget: (...args: unknown[]) => mockEmitir(...args),
}))

import { registrarBarajadoServido } from '@/lib/api/filtered-questions/queries'

type Q = { id: string; option_order: number[] | null }
const pregunta = (id: string, order: number[] | null) => ({ id, option_order: order }) as unknown as Parameters<typeof registrarBarajadoServido>[0][number]

describe('registro de lo que se sirvió barajado', () => {
  beforeEach(() => mockEmitir.mockClear())

  it('registra el orden POR PREGUNTA (lo que no se podía reconstruir)', () => {
    const qs = [pregunta('q1', [2, 0, 1, 3]), pregunta('q2', null), pregunta('q3', [1, 0])]
    registrarBarajadoServido(qs, { positionType: 'auxiliar_administrativo_valencia', userId: 'u1' })

    expect(mockEmitir).toHaveBeenCalledTimes(1)
    const ev = mockEmitir.mock.calls[0][0]
    expect(ev.eventType).toBe('shuffle_options_served')
    expect(ev.userId).toBe('u1')
    expect(ev.metadata.servidas).toBe(3)
    expect(ev.metadata.barajadas).toBe(2)
    expect(ev.metadata.ordenes).toEqual([
      { q: 'q1', o: [2, 0, 1, 3] },
      { q: 'q3', o: [1, 0] },
    ])
  })

  it('NO emite nada cuando no se barajó ninguna (el caso normal cuesta cero)', () => {
    registrarBarajadoServido([pregunta('q1', null), pregunta('q2', null)], { positionType: 'x' })
    expect(mockEmitir).not.toHaveBeenCalled()
  })

  it('acota el volumen: como mucho 50 órdenes por petición', () => {
    const muchas = Array.from({ length: 120 }, (_, i) => pregunta(`q${i}`, [1, 0]))
    registrarBarajadoServido(muchas, { positionType: 'x' })
    const ev = mockEmitir.mock.calls[0][0]
    expect(ev.metadata.barajadas).toBe(120) // el CONTEO no se recorta…
    expect(ev.metadata.ordenes).toHaveLength(50) // …pero el detalle sí
  })

  it('devuelve las mismas preguntas: es un envoltorio transparente', () => {
    const qs = [pregunta('q1', [1, 0])]
    expect(registrarBarajadoServido(qs, { positionType: 'x' })).toBe(qs)
  })

  it('si la observabilidad explota, servir preguntas NO se rompe', () => {
    // Un registro que puede tumbar la funcionalidad que observa no es un registro, es un riesgo.
    mockEmitir.mockImplementationOnce(() => { throw new Error('sink caído') })
    const qs = [pregunta('q1', [1, 0])]
    expect(() => registrarBarajadoServido(qs, { positionType: 'x' })).not.toThrow()
    expect(registrarBarajadoServido(qs, { positionType: 'x' })).toBe(qs)
  })
})
