/**
 * La guarda anti-letra de `aplicar-explicacion.ts` no puede confundir las letras de la LEY con las
 * de las OPCIONES.
 *
 * Qué defiende: en Derecho los apartados se citan por letra («la letra e) del artículo 9.1», «el
 * apartado b) del 4.1»). Eso nombra la norma, no la pantalla, así que al barajar sigue siendo
 * cierto. La guarda lo tomaba por una referencia a la opción E o a la B y rechazaba explicaciones
 * impecables, obligando a redactar peor para esquivarla: pasó el 28/07 al reescribir la explicación
 * del art. 9.1 LPRL, cuyas funciones de la Inspección de Trabajo se enumeran precisamente por
 * letras, y hubo que rodearlo con perífrasis.
 *
 * El equilibrio: la excepción NO puede abrir la mano a lo que la guarda existe para cazar, que es
 * la razón anclada a la letra o a la posición de la opción. Por eso los dos grupos van juntos.
 */

// La EXENCIÓN ya no se replica: vive en `lib/shuffle/classifyShuffleMode.ts` y la comparten el
// ESCRITOR (`aplicar-explicacion.ts`) y el GATE DE SERVE (T-324, 30/07). Mientras estuvo replicada
// aquí y en el script, el gate no eximía nada y frenaba el barajado de 82 preguntas cuyo único
// pecado era citar el articulado por sus letras. Sigue replicado solo `REFERENCIA_A_OPCION`, que
// es el criterio propio del escritor (más estricto que el del gate: exige mayúscula).
const { neutralizaCitasLegales } = require('../../lib/shuffle/classifyShuffleMode')
const REFERENCIA_A_OPCION =
  /\b(la|opci[óo]n|respuesta|letra)\s+[A-E]\b|\b(primera|segunda|tercera|cuarta|[úu]ltima|anterior|siguiente)\s+(opci[óo]n|respuesta)\b|\b(opci[óo]n|respuesta|alternativa)\s+(anterior|previa|siguiente)\b/i

const rechazada = (razon: string): boolean =>
  REFERENCIA_A_OPCION.test(neutralizaCitasLegales(razon))

describe('citar la ley por letra NO es citar una opción', () => {
  it.each([
    'Reproduce la letra e) del artículo 9.1: comprobar y favorecer el cumplimiento de las obligaciones.',
    'La letra c) del artículo 9.1 limita esos informes a los que soliciten los Juzgados de lo Social.',
    'El apartado b) del artículo 4.1 lo reserva a universidades de especiales características.',
    'El párrafo a) del artículo 20 exige la publicidad de la convocatoria.',
  ])('se acepta: %s', (razon) => {
    expect(rechazada(razon)).toBe(false)
  })
})

describe('lo que la guarda sí tiene que seguir cazando', () => {
  it.each([
    'La respuesta B es correcta porque reproduce el artículo.',
    'La opción C invierte el orden de las franjas.',
    'Como se vio en la primera opción, el plazo es de diez días.',
    'Coincide con la respuesta anterior.',
  ])('se rechaza: %s', (razon) => {
    expect(rechazada(razon)).toBe(true)
  })
})

describe('texto legal corriente, sin letras de apartado', () => {
  it('no se rechaza por mencionar secciones o capítulos', () => {
    expect(rechazada('El artículo 33 está en la Sección 2ª del Capítulo II del Título I.')).toBe(false)
  })
})

// ── El GATE DE SERVE aplica la MISMA exención desde el 30/07 (T-324). Antes solo la aplicaba el
// escritor, así que una explicación podía escribirse y aun así no barajarse nunca: dos puertas
// mirando el mismo texto con criterios distintos.
describe('el gate de serve exime la letra de la LEY igual que el escritor (T-324)', () => {
  const { isShuffleServeEligible } = require('../../lib/shuffle/classifyShuffleMode')
  const base = {
    shuffle_mode: 'full' as const,
    explanation: null,
    has_structured_explanation: true,
    options: ['Uno.', 'Dos.', 'Tres.', 'Cuatro.'],
  }

  it.each([
    'reproduce literalmente la letra a) del artículo 11.',
    'La letra d) del artículo 25.1 atribuye a la presidencia el voto de calidad.',
    'Cita literal de la letra a) del apartado 2 del artículo 54.',
  ])('se PUEDE barajar pese a citar el articulado por letras: %s', (razon) => {
    expect(isShuffleServeEligible({ ...base, structuredReasons: [razon] })).toBe(true)
  })

  it.each([
    'La opción C reproduce textualmente el contenido del artículo 26.',
    'El plazo que cita la respuesta D es el del artículo 21.',
    'Como se vio en la primera opción, el plazo es de diez días.',
  ])('sigue SIN poder barajarse si la razón habla de una opción: %s', (razon) => {
    expect(isShuffleServeEligible({ ...base, structuredReasons: [razon] })).toBe(false)
  })

  it('la exención NO se abre a «la letra B) del enunciado» (mayúscula y sin artículo detrás)', () => {
    expect(
      isShuffleServeEligible({ ...base, structuredReasons: ['Lo que dice la letra B) del enunciado.'] })
    ).toBe(false)
  })

  it('la narrativa recibe el mismo trato que las razones', () => {
    expect(
      isShuffleServeEligible({ ...base, structuredNarrative: ['Todo sale de la letra c) del artículo 7.'] })
    ).toBe(true)
    expect(
      isShuffleServeEligible({ ...base, structuredNarrative: ['La respuesta correcta es la C.'] })
    ).toBe(false)
  })
})
