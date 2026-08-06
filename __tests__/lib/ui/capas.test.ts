/**
 * Las relaciones entre capas que de verdad importan (T-608).
 *
 * No se prueban los números —dan igual mientras el orden se respete— sino QUIÉN tapa a QUIÉN.
 * Cada caso aquí fija una decisión que ya se pagó con un fallo reportado por una persona.
 */
import { CAPAS, tapaA } from '@/lib/ui/capas'

describe('CAPAS — quién se lleva los toques', () => {
  it('un modal tapa al aviso legal: mientras bloquea, es lo único con lo que se interactúa', () => {
    // El fallo de Laura (06/08): con el modal por debajo, el banner de cookies se quedaba
    // los toques del cuarto inferior y las opciones se veían sin poder pulsarse.
    expect(tapaA('modal', 'avisoLegal')).toBe(true)
  })

  it('el aviso legal tapa al contenido y a la cabecera: tiene que verse', () => {
    expect(tapaA('avisoLegal', 'contenido')).toBe(true)
    expect(tapaA('avisoLegal', 'cabecera')).toBe(true)
  })

  it('los avisos del sistema tapan incluso a un modal', () => {
    // Saber en la cuenta de quién estás (franja de suplantación) no es negociable.
    expect(tapaA('sistema', 'modal')).toBe(true)
  })

  it('la cabecera tapa al contenido, y el contenido no tapa a nadie', () => {
    expect(tapaA('cabecera', 'contenido')).toBe(true)
    expect(tapaA('contenido', 'cabecera')).toBe(false)
  })

  it('«tapar» es ESTRICTO: con el mismo z gana el orden del DOM, y eso es azar', () => {
    // Justo la clase de azar que este módulo existe para evitar: el banner de cookies y el
    // modal estuvieron los dos a 9999 en otros sitios del código, y quién ganaba dependía
    // de dónde estuviera cada uno en el árbol.
    for (const c of Object.keys(CAPAS) as Array<keyof typeof CAPAS>) {
      expect(tapaA(c, c)).toBe(false)
    }
  })

  it('la escala está ordenada de abajo arriba, sin empates', () => {
    const valores = Object.values(CAPAS)
    expect(new Set(valores).size).toBe(valores.length)
    expect([...valores].sort((a, b) => a - b)).toEqual(valores)
  })
})
