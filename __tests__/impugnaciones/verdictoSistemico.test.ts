// La puerta que obliga a hacerse la pregunta sistémica en CADA cierre [T-520].
//
// Los casos no son inventados: son los tres verdictos reales de las impugnaciones de Marta
// Benito Padilla del 04/08/2026, que es lo que motivó mover la regla del manual al código.
const { validarVerdictoSistemico, MIN_RAZON } = require('../../lib/impugnaciones/verdictoSistemico.cjs')

describe('verdicto sistémico · la puerta del cierre', () => {
  it('sin verdicto NO se cierra: es justo lo que se olvidaba', () => {
    const v = validarVerdictoSistemico(undefined)
    expect(v.ok).toBe(false)
    expect(v.problema).toMatch(/falta el verdicto/)
  })

  it('rechaza el texto libre que no se compromete con ninguna de las tres salidas', () => {
    // «lo he mirado» no se puede contar ni revisar, y no distingue medir de suponer.
    expect(validarVerdictoSistemico('lo he mirado y parece que no hay más casos').ok).toBe(false)
  })

  describe('medido', () => {
    it('acepta el verdicto real de la impugnación 9e0d7418', () => {
      const v = validarVerdictoSistemico(
        'medido: preguntas activas del art. 2 LGSS que examinan la misma frase → 11 de 13')
      expect(v).toMatchObject({ ok: true, clase: 'medido' })
    })

    it('EXIGE la cifra: sin número, «medido» es decir que no se midió', () => {
      const v = validarVerdictoSistemico('medido: he mirado las hermanas del artículo y no veo un patrón')
      expect(v.ok).toBe(false)
      expect(v.problema).toMatch(/CIFRA/)
    })
  })

  describe('aislado', () => {
    it('acepta una razón de verdad', () => {
      const v = validarVerdictoSistemico(
        'aislado: es una errata de transcripción de esta pregunta concreta, no viene de ningún lote')
      expect(v).toMatchObject({ ok: true, clase: 'aislado' })
    })

    it('rechaza la coartada de una palabra', () => {
      const v = validarVerdictoSistemico('aislado: no')
      expect(v.ok).toBe(false)
      expect(v.problema).toMatch(new RegExp(String(MIN_RAZON)))
    })
  })

  describe('ficha', () => {
    it('acepta el verdicto real que abrió T-519', () => {
      const v = validarVerdictoSistemico(
        'ficha T-519: la clase entera es invisible para los dos detectores de duplicados')
      expect(v).toMatchObject({ ok: true, clase: 'ficha' })
    })

    it('EXIGE el id: sin él no hay nada que consultar después', () => {
      expect(validarVerdictoSistemico('ficha: he abierto una tarea para mirarlo con calma').ok).toBe(false)
    })
  })

  it('no se cuela por la caja de las mayúsculas ni por los espacios de más', () => {
    const v = validarVerdictoSistemico('  MEDIDO:  mismo patrón en el banco → 33 preguntas  ')
    expect(v).toMatchObject({ ok: true, clase: 'medido' })
  })
})
