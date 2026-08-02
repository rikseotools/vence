/**
 * Regla de visibilidad del feed de avisos de oposición (T-480).
 *
 * Nace del feedback `d7c1bd2a` (Marta Pérez, 01/08/2026): *«se me ha quedado
 * enganchada esta notificación, no se cierra»*. La ✕ marcaba `read_at` y el feed
 * seguía devolviendo la fila, así que la notificación no se iba nunca. La cerró
 * el 15/07 y la seguía viendo 18 días después; medido: 126 avisos cerrados
 * sirviéndose a 98 usuarios.
 *
 * Lo que fija este fichero es la regla con nombre. El invariante contra datos
 * reales (que el feed NO devuelva nada cerrado) lo comprueba
 * `npm run sim:avisos-campana`, que ejecuta la consulta de verdad.
 */

import { avisoSigueEnLaCampana, FEED_AVISOS_LIMIT } from '@/lib/api/notifications/queries'

describe('avisoSigueEnLaCampana — qué sigue viéndose en la campana', () => {
  it('un aviso sin cerrar sigue en la campana', () => {
    expect(avisoSigueEnLaCampana({ readAt: null })).toBe(true)
  })

  it('un aviso cerrado NO vuelve (el defecto que reportó la usuaria)', () => {
    expect(avisoSigueEnLaCampana({ readAt: new Date('2026-07-15T21:51:00Z') })).toBe(false)
  })

  it('acepta la fecha como cadena (así llega por JSON)', () => {
    expect(avisoSigueEnLaCampana({ readAt: '2026-07-15T21:51:00.000Z' })).toBe(false)
  })

  it('undefined se trata como no cerrado (fila recién creada, campo ausente)', () => {
    expect(avisoSigueEnLaCampana({ readAt: undefined })).toBe(true)
  })

  it('una cadena vacía NO cuenta como cerrado: sin fecha, no hubo cierre', () => {
    // `'' == null` es false en JS, así que esto documenta el comportamiento real
    // en vez de dejarlo a la interpretación de quien lo lea.
    expect(avisoSigueEnLaCampana({ readAt: '' })).toBe(true)
  })

  it('el corte del feed es un número sensato y explícito', () => {
    // Importa porque el filtro va ANTES del corte: si se filtrara después, a
    // quien acumule 30 cerrados no le llegaría ningún aviso nuevo.
    expect(FEED_AVISOS_LIMIT).toBeGreaterThan(0)
    expect(FEED_AVISOS_LIMIT).toBeLessThanOrEqual(100)
  })
})

describe('el orden filtrar→cortar, que es lo que decide si llegan los nuevos', () => {
  // Simula las dos formas de combinar filtro y límite sobre el mismo historial:
  // 30 avisos cerrados (viejos) y 2 vivos (nuevos). Es el caso de un usuario
  // veterano, y es donde el orden equivocado deja la campana vacía.
  const historial = [
    ...Array.from({ length: 2 }, (_, i) => ({ id: `vivo-${i}`, readAt: null })),
    ...Array.from({ length: 30 }, (_, i) => ({ id: `cerrado-${i}`, readAt: new Date('2026-06-04') })),
  ]

  it('cortar y luego filtrar (lo incorrecto) puede dejar fuera avisos vivos', () => {
    const alReves = [...historial]
      .sort((a, b) => (a.readAt ? 1 : -1) - (b.readAt ? 1 : -1))
      .reverse() // los cerrados primero, como si el orden los pusiera delante
      .slice(0, FEED_AVISOS_LIMIT)
      .filter(avisoSigueEnLaCampana)
    expect(alReves).toHaveLength(0)
  })

  it('filtrar y luego cortar (lo que hace la consulta) los conserva', () => {
    const bien = historial.filter(avisoSigueEnLaCampana).slice(0, FEED_AVISOS_LIMIT)
    expect(bien).toHaveLength(2)
    expect(bien.every((a) => a.id.startsWith('vivo-'))).toBe(true)
  })
})
