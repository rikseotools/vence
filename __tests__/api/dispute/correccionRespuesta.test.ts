/**
 * @jest-environment node
 */
// Núcleo puro de la puerta de CORRECCIÓN de una respuesta ya enviada [T-394].
//
// Lo que se fija aquí es la asimetría que hace que la puerta sea una puerta y no un `force`: la
// guarda anti re-resolver sigue cortando igual (existe para no duplicar el email ni pagar dos veces
// el euro), y solo se abre declarando QUÉ se corrige.
//
// Caso de origen: `6c8a13af` (María José, premium). Se le respondió que en el Explorador el atajo
// de «seleccionar todo» es `Ctrl+A`; era correcto para Windows 11 e INCOMPLETO — el atajo cambió de
// versión y en Windows 10 es `Ctrl+E`, como ella decía. La pregunta se corrigió el mismo día; lo que
// no se pudo fue decírselo, y volvió a escribir por eso.
import { decidirReResolucion } from '@/lib/api/v2/dispute/correccionRespuesta'

describe('decidirReResolucion — la guarda sigue cortando', () => {
  it.each(['resolved', 'rejected'] as const)('%s sin motivo declarado: NO se re-resuelve', (estado) => {
    const v = decidirReResolucion(estado, null)
    expect(v.permitir).toBe(false)
    if (!v.permitir) {
      expect(v.error).toContain('no se puede re-resolver')
      // El mensaje tiene que ENSEÑAR la salida: un error que no dice cómo seguir es el que empuja a
      // saltarse el flujo, que es justo lo que este subsistema evita.
      expect(v.error).toContain('correccionDeRespuesta')
    }
  })

  it('una cadena vacía o solo espacios no abre la puerta', () => {
    // El endpoint recorta antes de llamar; aquí se fija que `''` NO cuenta como motivo.
    expect(decidirReResolucion('rejected', '').permitir).toBe(false)
  })
})

describe('decidirReResolucion — la puerta, cuando se declara', () => {
  it('con motivo declarado deja corregir, y lo marca como CORRECCIÓN', () => {
    const v = decidirReResolucion('rejected', 'El atajo cambió entre Windows 10 y 11: tenía razón')
    expect(v.permitir).toBe(true)
    if (v.permitir) {
      expect(v.esCorreccion).toBe(true)
      if (v.esCorreccion) expect(v.motivo).toContain('Windows 10')
    }
  })

  it('funciona igual sobre una `resolved`: corregirse no depende del signo de la respuesta', () => {
    const v = decidirReResolucion('resolved', 'faltaba el matiz de versión')
    expect(v.permitir && v.esCorreccion).toBe(true)
  })
})

describe('decidirReResolucion — el camino normal no se toca', () => {
  it.each(['pending', 'appealed', null] as const)('%s se resuelve como siempre', (estado) => {
    const v = decidirReResolucion(estado, null)
    expect(v.permitir).toBe(true)
    if (v.permitir) expect(v.esCorreccion).toBe(false)
  })

  it('un motivo sobrante en una impugnación ABIERTA se ignora, no rompe el cierre', () => {
    // Deliberado: si sigue abierta, se responde y se cierra por la vía de siempre. Convertir un
    // parámetro de más en un error bloquearía una resolución legítima por un despiste del que llama.
    const v = decidirReResolucion('pending', 'vengo a corregir')
    expect(v.permitir).toBe(true)
    if (v.permitir) expect(v.esCorreccion).toBe(false)
  })
})
