const { analizarCabecera } = require('../../../lib/generacion/cabeceraExplicacion')

// El caso que motiva el helper: el formato canónico §8.1 arranca con el
// blockquote de la cita, no con la cabecera. Medido sobre el batch
// gen_atc_t217_2026-07-24 (34 preguntas doblemente auditadas y aprobadas), que
// el gate mecánico daba 34/34 en rojo por comprobarlo con startsWith().
const EXPLICACION_CANONICA = `> **Exenciones en operaciones interiores (art. 10)**
> "Las exenciones en operaciones interiores de este impuesto se regulan en el artículo 50 de la Ley 4/2012 (...)."

**Por qué D es correcta:** la remisión legal es al artículo 50 de la Ley 4/2012 de Canarias.

**Por qué las demás son incorrectas:**
- **A)** El art. 25 de la Ley 19/1994 opera sin perjuicio.
- **B)** Los arts. 51 a 61 regulan los tipos de gravamen.
- **C)** La remisión del art. 10 es al art. 50.`

describe('analizarCabecera — coherencia cabecera ↔ clave', () => {
  it('acepta el formato canónico §8.1 con el blockquote DELANTE', () => {
    expect(analizarCabecera(EXPLICACION_CANONICA, 3)).toEqual({ ok: true, letras: ['D'] })
  })

  it('acepta la cabecera cuando abre la explicación (sin blockquote)', () => {
    const exp = '**Por qué B es correcta:** el artículo lo dice.\n\n- **A)** no\n- **C)** no\n- **D)** no'
    expect(analizarCabecera(exp, 1).ok).toBe(true)
  })

  it('RECHAZA cuando la cabecera nombra otra letra que la clave', () => {
    // Residuo de re-permutar tocando solo correct_option (§2.2-ter).
    const r = analizarCabecera(EXPLICACION_CANONICA, 0)
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('nombra D')
    expect(r.motivo).toContain('clave es A')
  })

  it('RECHAZA cuando no hay cabecera en absoluto', () => {
    const exp = 'La opción A es correcta porque el texto indica que se hace de dos modos.'
    const r = analizarCabecera(exp, 0)
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/no lleva cabecera/)
  })

  it('RECHAZA si hay dos cabeceras con letras distintas', () => {
    const exp = '**Por qué A es correcta:** x\n\n**Por qué C es correcta:** y'
    const r = analizarCabecera(exp, 0)
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('nombra C')
  })

  it('tolera explanation nula o vacía sin reventar', () => {
    expect(analizarCabecera(null, 2).ok).toBe(false)
    expect(analizarCabecera('', 2).ok).toBe(false)
  })
})
