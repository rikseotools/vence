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

  test('CASO REAL fc7defa6: la atribución va DETRÁS de la cita, entre paréntesis', () => {
    // «El Centro Directivo podrá conceder […] traslados de Establecimiento por motivos educativos.»
    // (Art. 121.1 RP), en una pregunta colgada del art. 120. Así cita media doctrina, y el filtro
    // que solo miraba delante la daba por cita falsa.
    expect(refDeclaradaDistinta('> «El Centro Directivo podrá conceder traslados de Establecimiento.» (Art. 121.1 RP)', '120')).toBe('121')
  })

  test('sin referencia declarada, se verifica contra el artículo vinculado (comportamiento de siempre)', () => {
    expect(refDeclaradaDistinta('> "El Rey recibe de los Presupuestos del Estado"', '65')).toBeNull()
  })

  test('solo cuenta la referencia ANTES de la cita: un artículo nombrado DENTRO del texto citado no redirige', () => {
    // «…conforme al artículo 30» dentro de la cita no significa que la cita sea del artículo 30.
    expect(refDeclaradaDistinta('> "Cualquier ciudadano podrá recabar la tutela conforme al artículo 30"', '53')).toBeNull()
  })
})

// ── El guard de `aplicar-explicacion.ts`: apartado de un precepto ≠ opción del test ──────────────
//
// «la letra d) no pide acreditar, sino poseer» cita el ARTICULADO; «la opción D» cita el test. La
// diferencia es la mayúscula, y sin ella el guard frena explicaciones jurídicas normales: pasó el
// 28/07 con el art. 29.2 del Decreto 7/2013 CyL, cuyos cuatro requisitos van por letras y cuyos
// distractores cambian justo el verbo de cada una.
describe('guard anti-letra: distingue el apartado legal de la opción', () => {
  const REFERENCIA_A_OPCION_LETRA = /\b(?:[Ll]a|[Oo]pci[óo]n|[Rr]espuesta|[Ll]etra)\s+[A-E]\b/
  test('«la letra d) no pide acreditar» NO es referencia a una opción', () => {
    expect(REFERENCIA_A_OPCION_LETRA.test('La letra d) no pide «acreditar» los mecanismos, sino poseerlos')).toBe(false)
  })
  test('«la opción D» y «la B es correcta» SÍ lo son', () => {
    expect(REFERENCIA_A_OPCION_LETRA.test('Como se vio en la opción D, el plazo es anual')).toBe(true)
    expect(REFERENCIA_A_OPCION_LETRA.test('La B es correcta porque reproduce el precepto')).toBe(true)
  })
})

// ── La RÚBRICA entrecomillada no es la cita (28/07) ──────────────────────────────────────────────
describe('citaLiteralPretendida — de varios entrecomillados, la cita es el más largo', () => {
  const { citaAusente } = require(path.join(process.cwd(), 'scripts/impugnaciones/barrido-citas.cjs'))
  const ART_405 = 'A la autoridad o funcionario público que, en el ejercicio de su competencia y a sabiendas de su ilegalidad, propusiere, nombrare o diere posesión para el ejercicio de un determinado cargo público a cualquier persona sin que concurran los requisitos legalmente establecidos'
  test('CASO REAL b0731e5b: el primer entrecomillado es el título del CAPÍTULO, no la cita', () => {
    // Coger el primero daba por «cita inventada» un texto copiado letra por letra: el título de un
    // capítulo no aparece, por definición, dentro del articulado.
    const rubrica = 'De la prevaricación de los funcionarios públicos y otros comportamientos injustos'
    expect(citaAusente(rubrica, ART_405)).toBe(true)                       // la rúbrica NO está en el artículo
    expect(citaAusente(ART_405.slice(0, 120), ART_405)).toBe(false)        // la cita real SÍ
  })
})
