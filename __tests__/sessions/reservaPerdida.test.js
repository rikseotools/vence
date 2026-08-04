// __tests__/sessions/reservaPerdida.test.js — [T-516]
//
// El núcleo que decide si una sesión ha perdido lo que tenía, y si sus reservas están en riesgo
// por reclamar con una identidad que no late. Puro: ni BD ni reloj del sistema.

const {
  diffReservas,
  identidadSinLatido,
  lineasAviso,
} = require('../../lib/sessions/reservaPerdida.cjs')

const YO = 'sesion-03ago-b-fedora-574bda'
const OTRA = 'cola-feedback-fedora-a93183'

describe('diffReservas — qué se me ha ido de las manos', () => {
  it('el caso que lo estrena: tenía el feedback de Neus y lo tiene otra sesión', () => {
    const { perdidas } = diffReservas({
      antes: ['8b788ee0'],
      ahora: [{ id: '8b788ee0', cola: 'feedback', claimedBy: OTRA }],
      sid: YO,
    })
    expect(perdidas).toEqual([
      { id: '8b788ee0', cola: 'feedback', titulo: null, ahoraDe: OTRA },
    ])
  })

  it('lo que sigue siendo mío no se avisa (sería ruido en cada turno)', () => {
    const { perdidas, mias } = diffReservas({
      antes: ['T-516'],
      ahora: [{ id: 'T-516', cola: 'backlog', claimedBy: YO, titulo: 'Una sesión no se entera…' }],
      sid: YO,
    })
    expect(perdidas).toEqual([])
    expect(mias).toEqual(['T-516'])
  })

  it('caducó y volvió al pool SIN dueño: también se avisa (puedo estar hablando de ello igual)', () => {
    const { perdidas } = diffReservas({
      antes: ['T-042'],
      ahora: [{ id: 'T-042', cola: 'backlog', claimedBy: null, titulo: 'algo' }],
      sid: YO,
    })
    expect(perdidas).toHaveLength(1)
    expect(perdidas[0].ahoraDe).toBeNull()
  })

  it('un caso CERRADO no es una pérdida: desaparece de la consulta y se calla', () => {
    // Al cerrarse sale de los estados abiertos, así que la consulta no lo devuelve. Avisar aquí
    // convertiría cada trabajo TERMINADO en una alarma, que es la forma más rápida de que el
    // aviso se vuelva ruido y se deje de leer.
    const { perdidas } = diffReservas({ antes: ['ya-cerrado'], ahora: [], sid: YO })
    expect(perdidas).toEqual([])
  })

  it('la foto nueva son SOLO las mías, aunque la consulta traiga ajenas', () => {
    const { mias } = diffReservas({
      antes: [],
      ahora: [
        { id: 'a', cola: 'feedback', claimedBy: YO },
        { id: 'b', cola: 'feedback', claimedBy: OTRA },
        { id: 'c', cola: 'backlog', claimedBy: null },
      ],
      sid: YO,
    })
    expect(mias).toEqual(['a'])
  })

  it('primera vez (sin foto anterior) no inventa pérdidas', () => {
    const { perdidas } = diffReservas({
      antes: [],
      ahora: [{ id: 'x', cola: 'feedback', claimedBy: OTRA }],
      sid: YO,
    })
    expect(perdidas).toEqual([])
  })

  it('mantiene el orden de la foto anterior (el aviso no debe bailar entre turnos)', () => {
    const ahora = [
      { id: 'b', cola: 'feedback', claimedBy: OTRA },
      { id: 'a', cola: 'backlog', claimedBy: OTRA },
    ]
    const { perdidas } = diffReservas({ antes: ['a', 'b'], ahora, sid: YO })
    expect(perdidas.map((p) => p.id)).toEqual(['a', 'b'])
  })
})

describe('identidadSinLatido — la causa raíz del caso real', () => {
  const ahora = new Date('2026-08-04T09:00:00Z')

  it('reclamar con un id que lleva 10 h sin latir es riesgo (el fallo del 04/08)', () => {
    const r = identidadSinLatido({
      sid: YO,
      tengoReservas: true,
      ultimoLatido: new Date('2026-08-03T23:00:00Z'),
      ahora,
    })
    expect(r.riesgo).toBe(true)
    expect(r.motivo).toContain(YO)
  })

  it('si late, no molesta', () => {
    const r = identidadSinLatido({
      sid: YO,
      tengoReservas: true,
      ultimoLatido: new Date('2026-08-04T08:55:00Z'),
      ahora,
    })
    expect(r.riesgo).toBe(false)
  })

  it('sin reservas no hay nada en riesgo, aunque no lates', () => {
    const r = identidadSinLatido({ sid: YO, tengoReservas: false, ultimoLatido: null, ahora })
    expect(r.riesgo).toBe(false)
  })

  it('sin fila de latido NO se inventa un veredicto (mismo criterio que reserva.cjs)', () => {
    // Una sesión legítima que aún no ha latido nunca no puede declararse muerta: hacerlo
    // convertiría el aviso en un falso positivo permanente para toda sesión recién nacida.
    const r = identidadSinLatido({ sid: YO, tengoReservas: true, ultimoLatido: null, ahora })
    expect(r.riesgo).toBe(false)
    expect(r.motivo).toMatch(/no se opina/)
  })
})

describe('lineasAviso — corto a propósito', () => {
  it('nombra qué era, quién lo tiene y qué hacer', () => {
    const l = lineasAviso({
      perdidas: [{ id: '8b788ee0', cola: 'feedback', titulo: null, ahoraDe: OTRA }],
    })
    const txt = l.join('\n')
    expect(txt).toContain('YA NO ES TUYO')
    expect(txt).toContain('feedback 8b788ee0')
    expect(txt).toContain(OTRA)
    expect(txt).toMatch(/cede el contexto/i)
  })

  it('sin nada que decir, no dice nada (silencio = no hay problema)', () => {
    expect(lineasAviso({ perdidas: [], identidad: { riesgo: false } })).toEqual([])
  })

  it('el aviso de identidad explica la causa típica, no solo el síntoma', () => {
    const l = lineasAviso({ perdidas: [], identidad: { riesgo: true, motivo: 'no da señales' } })
    expect(l.join('\n')).toMatch(/checkout principal|worktree/)
  })

  it('no se pasa de largo: un aviso que ocupa media pantalla se aprende a saltar', () => {
    const perdidas = Array.from({ length: 3 }, (_, i) => ({
      id: `id-${i}`, cola: 'feedback', titulo: null, ahoraDe: OTRA,
    }))
    expect(lineasAviso({ perdidas }).length).toBeLessThanOrEqual(8)
  })
})
