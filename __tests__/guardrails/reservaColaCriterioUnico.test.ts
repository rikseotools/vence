/**
 * @jest-environment node
 */
// Trinquete: la cola de trabajo externo decide «reservada / libre» en UN solo sitio. (T-474)
//
// El defecto que fija: `cola.cjs list` pintaba con un reloj propio de 2 h mientras el claim decidía
// por señal de vida. Medido en simulación contra RDS el 01/08/2026, 1 de 5 casos divergía — y era
// justo el que importa: **una fila reservada hace 3 h por una sesión que sigue trabajando salía
// como «🟡 claim viejo (libre)»**, así que otra sesión la leía libre y se ponía con ella. Dos
// puertas al mismo recurso con criterios distintos no protegen: se contradicen (misma lección que
// T-375 en el backlog).
//
// Aquí se comprueban las dos mitades: que lo que se PINTA sale del mismo núcleo que lo que se
// CONCEDE (comportamiento), y que nadie ha vuelto a meter un reloj propio (trinquete textual).
import { readFileSync } from 'fs'
import { join } from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { estadoReserva, etiquetaReserva } = require('@/lib/impugnaciones/reserva.cjs')

const REPO = join(__dirname, '..', '..')
const leer = (p: string) => readFileSync(join(REPO, p), 'utf8')

const AHORA = new Date('2026-08-01T20:00:00Z')
const haceH = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString()
const YO = 'sid-yo'
const OTRA = 'sid-otra'

describe('lo que se PINTA coincide con lo que se CONCEDE', () => {
  const casos = [
    { nombre: 'sin reservar', claimedBy: null, claimedAt: null, sesiones: [] },
    { nombre: 'tuya', claimedBy: YO, claimedAt: haceH(3), sesiones: [] },
    { nombre: 'de otra, viva, 3 h (el caso que mentía)', claimedBy: OTRA, claimedAt: haceH(3), sesiones: [{ sid: OTRA, last_signal_at: haceMin(3) }] },
    { nombre: 'de otra, muerta, 3 h', claimedBy: OTRA, claimedAt: haceH(3), sesiones: [{ sid: OTRA, last_signal_at: haceH(12) }] },
    { nombre: 'de otra, sin latido publicado, 3 h', claimedBy: OTRA, claimedAt: haceH(3), sesiones: [] },
    { nombre: 'de otra, dentro del suelo', claimedBy: OTRA, claimedAt: haceMin(30), sesiones: [] },
  ]

  it.each(casos)('$nombre → la etiqueta no contradice al criterio', (c) => {
    const { libre } = estadoReserva({ ...c, sid: YO, ahora: AHORA })
    const etiqueta = etiquetaReserva({ ...c, sid: YO, ahora: AHORA })
    const pintaLibre = etiqueta.includes('🟢') || etiqueta.includes('🙋')
    expect(pintaLibre).toBe(libre)
  })

  it('el caso concreto de la simulación ya no miente', () => {
    const c = { claimedBy: OTRA, claimedAt: haceH(3), sesiones: [{ sid: OTRA, last_signal_at: haceMin(3) }], sid: YO, ahora: AHORA }
    expect(estadoReserva(c).libre).toBe(false)
    expect(etiquetaReserva(c)).toContain('🔒')
    expect(etiquetaReserva(c)).toMatch(/sigue viva/) // y además dice POR QUÉ
  })
})

describe('trinquete: nadie vuelve a meterle un reloj propio a la cola', () => {
  it('cola.cjs no calcula la antigüedad de una reserva por su cuenta', () => {
    const src = leer('scripts/impugnaciones/cola.cjs')
    expect(src).not.toMatch(/STALE_HOURS/)
    // El patrón exacto que había: comparar claimed_at contra un umbral en milisegundos.
    expect(src).not.toMatch(/claimed_at[\s\S]{0,80}3600e3/)
    expect(src).toContain('etiquetaReserva')
  })

  it('el criterio se importa, no se reescribe', () => {
    const src = leer('scripts/impugnaciones/cola.cjs')
    expect(src).toMatch(/require\(.*reserva\.cjs.*\)/)
  })
})

describe('trinquete: los DOS cierres pasan por la puerta', () => {
  // Que uno de los dos se quede sin puerta sería peor que no tenerla: la mitad protegida da la
  // sensación de estarlo entera.
  it.each(['scripts/impugnaciones/cerrar.ts', 'scripts/impugnaciones/cerrar-feedback.ts'])(
    '%s comprueba la reserva antes de escribir',
    (f) => {
      const src = leer(f)
      expect(src).toContain('comprobarReserva')
      expect(src).toContain('anunciar')
      // …y con el escape declarado, no apagando la puerta entera.
      expect(src).toContain('--igualmente')
    },
  )

  it('la puerta vive en un solo módulo compartido por los dos', () => {
    const helper = leer('scripts/impugnaciones/lib/comprobar-reserva.ts')
    expect(helper).toContain('puertaCierre.cjs')
    expect(helper).toContain('cierre-cola') // el guard con el que se cuenta la fricción
  })
})
