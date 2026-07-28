/**
 * El validador de impugnaciones acepta la cita en su forma CANÓNICA (T-204, cabo 1).
 *
 * Qué defiende: `aplicar-explicacion.ts` escribe la cita como `{ref, texto}` y el render la compone
 * en DOS líneas de blockquote —la referencia en negrita y debajo el literal—. `validateQuotes`
 * unía todas las líneas y exigía que el conjunto apareciera literal en el artículo, así que la
 * línea de la referencia («**Artículo 4.1 CE**», que obviamente no está dentro del artículo)
 * tumbaba la explicación como *«posible cita inventada o de otro artículo»*. Pasó en las TRES
 * impugnaciones con las que se verificó T-201 (art. 4 CE, art. 53.2 CE, art. 38.11 EBEP): el
 * guardarraíl que el manual declara obligatorio frenaba justo la forma que el manual manda usar.
 *
 * El equilibrio que fija este test: ignorar la referencia NO puede aflojar la caza de citas
 * inventadas, que es para lo que existe el check. Por eso los dos casos van juntos.
 */
const path = require('path')
const { validateQuotes } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs')
)

const ART_4_CE =
  'Artículo 4. 1. La bandera de España está formada por tres franjas horizontales, roja, amarilla y ' +
  'roja, siendo la amarilla de doble anchura que cada una de las rojas.'

describe('validateQuotes — la referencia del blockquote no es texto de la ley', () => {
  test('CASO REAL art. 4 CE: cita canónica (ref + literal en dos líneas) → VERDE', () => {
    const expl = [
      'La respuesta correcta es la A).', '',
      '> **Artículo 4.1 CE**',
      '> «La bandera de España está formada por tres franjas horizontales, roja, amarilla y roja, siendo la amarilla de doble anchura que cada una de las rojas.»',
      '', '- **A)** CORRECTA.',
    ].join('\n')
    expect(validateQuotes(expl, ART_4_CE)).toEqual([])
  })

  test('sigue cazando la cita INVENTADA aunque lleve referencia delante', () => {
    const expl = '> **Artículo 4.1 CE**\n> «La bandera de España tiene cuatro franjas verticales de color verde.»'
    expect(validateQuotes(expl, ART_4_CE)).toHaveLength(1)
  })

  test('una cita multilínea sin referencia se sigue validando entera (no se rompe lo de antes)', () => {
    const expl = '> «La bandera de España está formada por tres franjas horizontales, roja, amarilla y roja,\n> siendo la amarilla de doble anchura que cada una de las rojas.»'
    expect(validateQuotes(expl, ART_4_CE)).toEqual([])
  })

  test('un blockquote que SOLO trae la referencia no inventa un problema (no hay literal que verificar)', () => {
    expect(validateQuotes('> **Artículo 4.1 CE**', ART_4_CE)).toEqual([])
  })
})

// ── T-212: el validador y el render comparten las etiquetas del marco «señale la INCORRECTA» ──
//
// Por qué va aquí y no en un fichero aparte: es el MISMO acoplamiento que el de la cita. Si el
// render cambia una etiqueta y el validador no se entera, el guardarraíl obligatorio tumba un
// texto impecable — y quien escribe acaba desactivándolo, que es como se pierde un guardarraíl.
const { validateFormat } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs')
)

const OPTS_33CE = {
  A: 'La propiedad privada puede expropiarse sin indemnización alguna.',
  B: 'Se reconoce el derecho a la propiedad privada y a la herencia.',
  C: 'La función social delimita su contenido.',
  D: 'Nadie puede ser privado de sus bienes salvo causa justificada.',
}
const MARCO_INCORRECTA = [
  'La respuesta correcta es la **A**.', '',
  '> **Artículo 33 CE**', '> «Se reconoce el derecho a la propiedad privada y a la herencia.»', '',
  '**A)** ES LA INCORRECTA — El art. 33.3 exige indemnización.', '',
  '**B)** VERDADERA — Reproduce el art. 33.1.', '',
  '**C)** VERDADERA — Es el art. 33.2.', '',
  '**D)** VERDADERA — Recoge el art. 33.3.',
].join('\n')

describe('validateFormat — marco «señale la INCORRECTA»', () => {
  test('acepta el texto que produce el render con frame select_incorrect', () => {
    expect(validateFormat(MARCO_INCORRECTA, OPTS_33CE, 'A')).toEqual([])
  })

  test('sigue cazando la incoherencia clave↔explicación dentro de ese marco', () => {
    const p = validateFormat(MARCO_INCORRECTA, OPTS_33CE, 'C')
    expect(p).toHaveLength(1)
    expect(p[0]).toMatch(/ES LA INCORRECTA la A.*clave real.*es la C/)
  })

  test('el marco clásico no se ve afectado', () => {
    const clasico = [
      'La respuesta correcta es la **B**.', '', '> **Art. 1** «cita»', '',
      '**A)** INCORRECTA — no.', '', '**B)** CORRECTA — sí.', '',
      '**C)** INCORRECTA — no.', '', '**D)** INCORRECTA — no.',
    ].join('\n')
    expect(validateFormat(clasico, OPTS_33CE, 'B')).toEqual([])
    expect(validateFormat(clasico, OPTS_33CE, 'D')).toHaveLength(1)
  })
})
