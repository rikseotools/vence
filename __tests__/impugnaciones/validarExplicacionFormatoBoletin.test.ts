/**
 * `validateFormat` reconocía UN solo formato: §5.1 del manual de impugnaciones ("La respuesta
 * correcta es …"). Pero `aplicar-explicacion.ts` —el escritor CANÓNICO desde T-080 Fase 2— escribe
 * también el formato §8.1 ("**Por qué X es correcta:**" + bullets "**A)**" para los distractores),
 * y el validador lo rechazaba SIEMPRE con los mismos 4 problemas: reproducido contra dos casos
 * reales, `f5f63871` (impugnación de Irene, art. 110 Ley 39/2015) y `9b51a517` (atajo de Windows).
 *
 * Un guardarraíl «obligatorio antes de aplicar» (manual §5.1) que rechaza lo que su propio escritor
 * canónico produce se acaba ignorando — es la misma lección de `validarExplicacionCitaCanonica`
 * (T-204) para el blockquote, aplicada aquí al formato general (T-462).
 *
 * El fix reutiliza el MISMO parser que decide si una pregunta es barajable
 * (`parseLetterFormatExplanation`, `lib/shuffle/structuredExplanation.ts`) en vez de reimplementar
 * un tercer criterio de "¿está bien estructurada?" en regex sueltas — evita que las dos
 * implementaciones diverjan, que es cómo se pierden estos guardarraíles.
 */
const path = require('path')
const { validateFormat } = require(
  path.join(process.cwd(), 'scripts/impugnaciones/validar-explicacion.cjs')
)

const OPTS_WINDOWS = {
  A: 'Alt + Enter',
  B: 'Shift + clic',
  C: 'Ctrl + A',
  D: 'Ctrl + E',
}

// Reconstrucción fiel del caso real 9b51a517 (id abreviado en los comentarios), estilo "boletin".
const EXPL_9B51A517 = [
  'El enunciado acota la versión a propósito, porque aquí se cruzan dos cosas distintas.', '',
  '**Por qué C es correcta:** Es el atajo que la documentación oficial de Microsoft recoge como «seleccionar todos los elementos de una ventana».', '',
  '**Por qué las demás son incorrectas:**',
  '- **A)** Alt + Enter abre las Propiedades del elemento seleccionado. No selecciona nada.',
  '- **B)** Shift + clic selecciona un rango: marca todo lo que hay entre el elemento activo y aquel sobre el que se hace clic.',
  '- **D)** En el Explorador de Windows 11, Ctrl+E lleva el foco al cuadro de búsqueda.', '',
  '**Para no perderse:** en Windows 11 dentro de una carpeta, Ctrl+A.',
].join('\n')

describe('validateFormat — formato §8.1 ("Por qué X es correcta:"), el que escribe aplicar-explicacion.ts', () => {
  test('CASO REAL 9b51a517: el escritor canónico ya no se rechaza a sí mismo', () => {
    expect(validateFormat(EXPL_9B51A517, OPTS_WINDOWS, 'C')).toEqual([])
  })

  test('sigue cazando la letra equivocada (la cabecera dice B, la clave real es C)', () => {
    const expl = [
      'Intro cualquiera.', '',
      '**Por qué B es correcta:** razón cualquiera.', '',
      '**Por qué las demás son incorrectas:**',
      '- **A)** algo', '- **C)** algo', '- **D)** algo',
    ].join('\n')
    const problems = validateFormat(expl, OPTS_WINDOWS, 'C')
    expect(problems.length).toBeGreaterThan(0)
    expect(problems[0]).toMatch(/§8\.1/)
  })

  test('sigue cazando un distractor sin razón (falta el bloque de D)', () => {
    const expl = [
      'Intro.', '',
      '**Por qué C es correcta:** razón.', '',
      '**Por qué las demás son incorrectas:**',
      '- **A)** algo', '- **B)** algo',
    ].join('\n')
    const problems = validateFormat(expl, OPTS_WINDOWS, 'C')
    expect(problems.some((p) => /Falta el análisis por opción/.test(p))).toBe(true)
  })

  test('el formato §5.1 clásico NO se ve afectado por reconocer el §8.1 (no regresión)', () => {
    const expl = [
      'La respuesta correcta es la **B**.', '',
      '**A)** INCORRECTA — no.', '',
      '**B)** CORRECTA — sí.', '',
      '**C)** INCORRECTA — no.', '',
      '**D)** INCORRECTA — no.',
    ].join('\n')
    expect(validateFormat(expl, OPTS_WINDOWS, 'B')).toEqual([])
  })

  test('prosa libre sin ninguno de los dos formatos sigue fallando, con mensaje que nombra los dos', () => {
    const problems = validateFormat('Esto es una explicación en prosa libre, sin estructura.', OPTS_WINDOWS, 'C')
    expect(problems[0]).toMatch(/§5\.1.*§8\.1|§8\.1.*§5\.1/)
  })

  test('el §8.1 sigue exigiendo al menos 3 párrafos (no apelotonado)', () => {
    const expl = '**Por qué C es correcta:** razón. **Por qué las demás son incorrectas:** - **A)** x - **B)** y - **D)** z'
    const problems = validateFormat(expl, OPTS_WINDOWS, 'C')
    expect(problems.some((p) => /Apelotonado/.test(p))).toBe(true)
  })
})
