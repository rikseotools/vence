/**
 * Una explicación puede citar OTRO artículo, y decirlo. Eso no es una cita falsa.
 *
 * Casos reales del inventario del 28/07, verificados a mano:
 *  · `5a0795d0` (109 exposiciones) — pregunta colgada del art. 65 CE (actos del Rey exceptuados de
 *    refrendo) cuya explicación cita «Art. 56.3: "La persona del Rey es inviolable…"». La cita es
 *    correcta y pertinente; el artículo vinculado es otro.
 *  · `6aa51432` — pregunta de nulidad (art. 47 Ley 39/2015) que cita «Art. 48.2 (anulabilidad por
 *    defecto de forma)» para contrastar.
 *
 * El barrido las contaba como «cita ajena». Un cubo lleno de aciertos marcados como defectos es un
 * cubo que nadie drena — y el detector que lo llena acaba desactivado. Filtrarlas bajó las
 * «ajenas» de 39 a 25.
 */
import path from 'path'
const { refDeclaradaDistinta } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/barrido-citas.cjs')
)

describe('refDeclaradaDistinta — ¿la cita atribuye su texto a otro artículo?', () => {
  test('CASO REAL 5a0795d0: cita el art. 56.3 en una pregunta del art. 65', () => {
    expect(refDeclaradaDistinta('> Art. 56.3: "La persona del Rey es inviolable"', '65')).toBe('56')
  })

  test('CASO REAL 6aa51432: referencia en negrita con paréntesis explicativo', () => {
    expect(refDeclaradaDistinta('> **Art. 48.2 Ley 39/2015 (anulabilidad por defecto de forma)**\n> "El defecto de forma…"', '47')).toBe('48')
  })

  test('si declara el MISMO artículo que el vinculado, no hay nada que redirigir', () => {
    expect(refDeclaradaDistinta('> Art. 65: "El Rey recibe de los Presupuestos…"', '65')).toBeNull()
  })

  test('sin referencia declarada, se verifica contra el artículo vinculado (comportamiento de siempre)', () => {
    expect(refDeclaradaDistinta('> "El Rey recibe de los Presupuestos del Estado"', '65')).toBeNull()
  })

  test('solo cuenta la referencia ANTES de la cita: un artículo nombrado DENTRO del texto citado no redirige', () => {
    // «…conforme al artículo 30» dentro de la cita no significa que la cita sea del artículo 30.
    expect(refDeclaradaDistinta('> "Cualquier ciudadano podrá recabar la tutela conforme al artículo 30"', '53')).toBeNull()
  })
})
