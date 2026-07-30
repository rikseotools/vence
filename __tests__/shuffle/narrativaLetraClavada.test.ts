/**
 * @jest-environment node
 */
// __tests__/shuffle/narrativaLetraClavada.test.ts
//
// T-262 — la NARRATIVA (`intro`/`outro`) de una explicación estructurada se emite VERBATIM en
// cualquier orden, así que una letra escrita ahí queda clavada y contradice a la que calcula el
// render. Todas las capas daban por bueno "tiene estructura ⇒ es segura" mirando solo las
// RAZONES; estos tests fijan el trozo que faltaba.
//
// Caso raíz: pregunta 1e8b2595 (RD 366/2007 art. 10), transcrita con
// `intro = "La respuesta correcta es la **C**."`. Barajada decía **C** arriba y **A** en la
// cabecera, en el mismo recuadro.
import {
  podarAperturaConLetra,
  podarAnuncioAlTranscribir,
  renderStructuredExplanation,
  structuredNarrative,
  structuredNarrativeStaleLetters,
  parseLetterFormatExplanation,
  parseImpugnacionFormatExplanation,
  type StructuredExplanation,
} from '@/lib/shuffle/structuredExplanation'
import { isShuffleServeEligible } from '@/lib/shuffle/classifyShuffleMode'

const base = (extra: Partial<StructuredExplanation> = {}): StructuredExplanation => ({
  v: 1,
  options: {
    '0': 'Exige dos sistemas que el precepto no impone.',
    '1': 'Omite el requisito de accesibilidad.',
    '2': 'El art. 10.1 exige al menos un área higiénico-sanitaria accesible.',
    '3': 'Habla de los sistemas contra incendios, que regula otro apartado.',
  },
  ...extra,
})

describe('structuredNarrative — qué se considera narrativa', () => {
  it('recoge intro y outro, y NADA más', () => {
    const campos = structuredNarrative(base({ intro: 'Contexto.', outro: '**Clave:** lo importante.' }))
    expect(campos.map((c) => c.campo)).toEqual(['intro', 'outro'])
  })

  it('ignora los vacíos y los que son solo espacios', () => {
    expect(structuredNarrative(base({ intro: '   ', outro: '' }))).toEqual([])
    expect(structuredNarrative(null)).toEqual([])
  })
})

describe('structuredNarrativeStaleLetters — el detector', () => {
  it('caza la apertura canónica del caso raíz', () => {
    expect(structuredNarrativeStaleLetters(base({ intro: 'La respuesta correcta es la **C**.' }))).toEqual(['intro'])
  })

  it('caza también el outro, que es donde viven los "**Clave:**"', () => {
    expect(structuredNarrativeStaleLetters(base({ outro: '**Clave:** la opción B es la única que exige accesibilidad.' })))
      .toEqual(['outro'])
  })

  // FRONTERA CONOCIDA, medida el 29/07 — no es un descuido, es una decisión.
  // El detector compartido pide un complemento del tipo correcta/incorrecta/falsa tras el verbo,
  // así que «la B es la única…» (sin ese complemento) se le escapa. Se comprobó si compensaba
  // afinarlo y NO: en las 5.019 estructuradas `safe` y en las planas `safe` hay **0 casos** de esa
  // forma, mientras que la regla amplia («cualquier letra suelta en mayúscula») añadía 26
  // hallazgos que eran todos falsos positivos —`M.C.D`, `D+1`, `Ctrl+A`, «C de contacto»—.
  // Si algún día aparece de verdad, se arregla en `explanationReferencesLetters` (fuente única)
  // y este test cambia de expectativa; NO se añade un detector paralelo aquí.
  it('deja constancia del hueco del detector compartido: «la B es …» sin complemento no casa', () => {
    expect(structuredNarrativeStaleLetters(base({ outro: 'Recuerda: la B es la única con esa exigencia.' })))
      .toEqual([])
  })

  it('caza los DOS a la vez y los nombra, para que el informe diga dónde está', () => {
    expect(
      structuredNarrativeStaleLetters(base({ intro: 'La respuesta correcta es la A.', outro: 'Recuerda: la opción D no aplica.' })),
    ).toEqual(['intro', 'outro'])
  })

  it('NO marca una narrativa escrita por contenido (que es como debe escribirse)', () => {
    expect(
      structuredNarrativeStaleLetters(
        base({
          intro: 'El artículo 10.1 del RD 366/2007 fija el equipamiento mínimo de las Oficinas de Atención al Ciudadano.',
          outro: '**Clave:** la accesibilidad del área higiénico-sanitaria es parte indisoluble de la exigencia.',
        }),
      ),
    ).toEqual([])
  })

  it('NO marca «la respuesta correcta es la que…» — sin letra, es contenido legítimo', () => {
    expect(structuredNarrativeStaleLetters(base({ intro: 'La respuesta correcta es la que exige acreditar la accesibilidad.' })))
      .toEqual([])
  })

  // 29/07: al reparar el banco quedaron 8 marcadas que eran TODAS narrativa impecable citando el
  // articulado por letra. La exención ya existía para las RAZONES desde el 28/07 (art. 9.1 LPRL) y
  // vivía suelta en `aplicar-explicacion.ts`; subirla al núcleo la comparte con el gate de serve y
  // el sweep. Una bandeja que grita todos los días se deja de mirar.
  it('NO marca la cita del articulado por letra («la letra a) del artículo 218.6»)', () => {
    expect(
      structuredNarrativeStaleLetters(
        base({ intro: 'Se exige aprobación del Parlamento en los supuestos de la letra a) del artículo 218.6 TFUE.' }),
      ),
    ).toEqual([])
  })

  it('…pero sigue marcando la referencia a una OPCIÓN, que es lo que rompe al barajar', () => {
    expect(structuredNarrativeStaleLetters(base({ intro: 'Como se ve en la opción B, el plazo es otro.' })))
      .toEqual(['intro'])
  })

  it('la CITA no se mira: el articulado se cita por letras en lenguaje jurídico corriente', () => {
    // Si la cita entrara al detector, este blockquote impecable marcaría la pregunta como rota.
    const conCitaPorLetras = base({
      cita: { ref: 'Artículo 9.1 LPRL', texto: 'Corresponde a la Inspección de Trabajo… conforme a la letra b) de este apartado.' },
    })
    expect(structuredNarrativeStaleLetters(conCitaPorLetras)).toEqual([])
  })
})

describe('el daño real: qué se serviría barajado', () => {
  const conLetraClavada = base({ intro: 'La respuesta correcta es la **C**.' })

  it('sin la poda, el texto se contradice dentro del mismo recuadro', () => {
    // La correcta (índice 2) se muestra en la posición A.
    const texto = renderStructuredExplanation(conLetraClavada, {
      correctOption: 2,
      optionOrder: [2, 0, 1, 3],
      nOptions: 4,
    })
    expect(texto).toContain('La respuesta correcta es la **C**.')
    expect(texto).toContain('**Por qué A es correcta:**')
  })

  it('el gate de serve se NIEGA a barajarla mientras la letra siga ahí', () => {
    expect(
      isShuffleServeEligible({
        shuffle_mode: 'full',
        shuffle_safety: 'safe',
        has_structured_explanation: true,
        options: ['a', 'b', 'c', 'd'],
        structuredReasons: Object.values(conLetraClavada.options),
        structuredNarrative: structuredNarrative(conLetraClavada).map((c) => c.texto),
      }),
    ).toBe(false)
  })

  it('…y SÍ la baraja cuando la narrativa está limpia (no se rompe lo que funcionaba)', () => {
    const limpia = base({ intro: 'El artículo 10.1 fija el equipamiento mínimo.' })
    expect(
      isShuffleServeEligible({
        shuffle_mode: 'full',
        shuffle_safety: 'safe',
        has_structured_explanation: true,
        options: ['a', 'b', 'c', 'd'],
        structuredReasons: Object.values(limpia.options),
        structuredNarrative: structuredNarrative(limpia).map((c) => c.texto),
      }),
    ).toBe(true)
  })

  it('una razón sucia sigue vetando aunque la narrativa esté limpia (no se pisa T-201)', () => {
    expect(
      isShuffleServeEligible({
        shuffle_mode: 'full',
        shuffle_safety: 'safe',
        has_structured_explanation: true,
        options: ['a', 'b', 'c', 'd'],
        structuredReasons: ['El plazo que cita la opción D es otro.'],
        structuredNarrative: ['El artículo 10.1 fija el equipamiento mínimo.'],
      }),
    ).toBe(false)
  })
})

describe('podarAperturaConLetra — la reparación', () => {
  it('quita la apertura y deja el resto del intro intacto', () => {
    expect(podarAperturaConLetra('La respuesta correcta es la **C**.\n\nEl art. 10.1 fija el mínimo.'))
      .toBe('El art. 10.1 fija el mínimo.')
  })

  it('acepta las variantes de escritura del banco', () => {
    for (const v of [
      'La respuesta correcta es la **C**.',
      'La respuesta correcta es C',
      'la respuesta correcta es la c.',
      'La respuesta correcta es la **D**:',
    ]) {
      expect(podarAperturaConLetra(v)).toBeUndefined()
    }
  })

  // El fallo que la reparación tuvo el 29/07 y que solo apareció comprobándola contra datos
  // reales: el formato §5.1 abre nombrando la opción ENTERA, y recortar el prefijo dejaba su
  // texto suelto, en minúscula y con los asteriscos descolgados. Esas van a revisión humana.
  it('sin saber el texto de la opción, NO poda una apertura con cola (mutilaría la frase)', () => {
    const t = 'La respuesta correcta es **B) Podrá aprobarse el remate en favor de una mejor postura.**'
    expect(podarAperturaConLetra(t)).toBe(t)
  })

  // Las tres redacciones que usa el banco para lo mismo (medidas el 29/07 sobre las 1.211). La
  // cola se poda SOLO si es la repetición del enunciado de la opción, que el opositor ya tiene
  // delante; si fuera razonamiento propio se perdería contenido.
  it('con el texto de la opción, poda las variantes de redacción del banco', () => {
    const casos: Array<[string, string]> = [
      ['La respuesta correcta es **B) 21.**', '21.'],
      ['**Respuesta correcta: C) Una ordenanza fiscal.**', 'Una ordenanza fiscal.'],
      ['**La respuesta correcta es A.**', 'El cotejo de las copias aportadas por el interesado.'],
      ['La respuesta correcta es **B) Podrá aprobarse el remate.**', 'Podrá aprobarse el remate.'],
    ]
    for (const [intro, textoCorrecta] of casos) {
      expect(podarAperturaConLetra(intro, { textoCorrecta })).toBeUndefined()
    }
  })

  it('NO poda si tras la letra hay RAZONAMIENTO, no el enunciado de la opción', () => {
    const t = 'La respuesta correcta es la **C** porque el precepto exige además la accesibilidad.'
    expect(podarAperturaConLetra(t, { textoCorrecta: 'Al menos con un área higiénico-sanitaria accesible' })).toBe(t)
  })

  it('NO poda una mención en MEDIO del párrafo (tiene contexto alrededor)', () => {
    const t = 'El precepto es tajante. La respuesta correcta es la **C**, como se deduce del apartado 1.'
    expect(podarAperturaConLetra(t)).toBe(t)
  })

  it('NO toca un intro sin letra (no destruye contenido legítimo)', () => {
    const t = 'La respuesta correcta es la que exige acreditación previa.'
    expect(podarAperturaConLetra(t)).toBe(t)
  })

  it('es idempotente: aplicarla dos veces da lo mismo', () => {
    const una = podarAperturaConLetra('La respuesta correcta es la **A**. Contexto.')
    expect(podarAperturaConLetra(una)).toBe(una)
  })

  it('tras podar, el estilo impugnación regenera la apertura CON la letra mostrada', () => {
    const podada = base({ estilo: 'impugnacion', intro: podarAperturaConLetra('La respuesta correcta es la **C**.') })
    const texto = renderStructuredExplanation(podada, { correctOption: 2, optionOrder: [2, 0, 1, 3], nOptions: 4 })
    expect(texto).toContain('La respuesta correcta es la **A**.')
    expect(texto).not.toContain('**C**.')
    expect(structuredNarrativeStaleLetters(podada)).toEqual([])
  })
})

// La FUGA del 29/07 por la tarde: el backfill transcribió ~1.200 preguntas y 89 entraron con la
// letra clavada PESE al arreglo de la mañana, porque aquel solo cubría el anuncio DESNUDO y el
// formato §5.1 nombra la opción entera en la misma línea. Las dos podas se separan a propósito:
// reparar de más mutila lo que ya lee el opositor; transcribir de más no puede romper nada,
// porque la guarda de no-regresión rechaza la migración y la pregunta se queda como estaba.
describe('podarAnuncioAlTranscribir — la poda de la TRANSCRIPCIÓN es más agresiva a propósito', () => {
  const conCola = 'La respuesta correcta es **C) De «habeas corpus».**\n\nEl artículo 17.4 CE lo llama así.'

  it('poda el anuncio aunque arrastre el texto de la opción', () => {
    expect(podarAnuncioAlTranscribir(conCola)).toBe('El artículo 17.4 CE lo llama así.')
  })

  it('la poda de REPARACIÓN, en cambio, NO lo toca (mutilaría lo que ya se sirve)', () => {
    expect(podarAperturaConLetra(conCola)).toBe(conCola)
  })

  it('respeta el intro sin anuncio', () => {
    const t = 'El artículo 17.4 de la Constitución regula el habeas corpus.'
    expect(podarAnuncioAlTranscribir(t)).toBe(t)
  })
})

describe('la transcripción del histórico ya no importa la letra', () => {
  it('el parser del §5.1 (impugnaciones) poda la apertura', () => {
    const texto = [
      'La respuesta correcta es la **C**.',
      '',
      '**A)** INCORRECTA. No lo exige el precepto.',
      '',
      '**B)** INCORRECTA. Omite la accesibilidad.',
      '',
      '**C)** CORRECTA. El art. 10.1 lo exige expresamente.',
      '',
      '**D)** INCORRECTA. Habla de otra cosa.',
    ].join('\n')
    const parsed = parseImpugnacionFormatExplanation(texto, { correctOption: 2, nOptions: 4, questionText: '¿Con qué deberán contar?' })
    expect(parsed).not.toBeNull()
    expect(structuredNarrativeStaleLetters(parsed!)).toEqual([])
  })

  it('el parser del §5.1 tampoco deja entrar el anuncio CON el texto de la opción (fuga del 29/07)', () => {
    const texto = [
      'La respuesta correcta es **C) De «habeas corpus».**', '',
      '**A)** INCORRECTA. Otra cosa.', '', '**B)** INCORRECTA. Otra más.', '',
      '**C)** CORRECTA. El art. 17.4 CE lo llama así.', '', '**D)** INCORRECTA. No.',
    ].join('\n')
    const parsed = parseImpugnacionFormatExplanation(texto, { correctOption: 2, nOptions: 4 })
    expect(parsed).not.toBeNull()
    expect(structuredNarrativeStaleLetters(parsed!)).toEqual([])
  })

  it('el parser del §8.1 (boletín) tampoco la deja entrar', () => {
    const texto = [
      'La respuesta correcta es la **C**.',
      '',
      '**Por qué C es correcta:** El art. 10.1 lo exige expresamente.',
      '',
      '**Por qué las demás son incorrectas:**',
      '- **A)** No lo exige el precepto.',
      '- **B)** Omite la accesibilidad.',
      '- **D)** Habla de otra cosa.',
    ].join('\n')
    const parsed = parseLetterFormatExplanation(texto, { correctOption: 2, nOptions: 4 })
    if (parsed) expect(structuredNarrativeStaleLetters(parsed)).toEqual([])
  })
})

// ── Lo que se escribe con una letra A-E y NO es una opción del test (T-317, 30/07/2026) ──────────
//
// El detector marcaba 8 narrativas y **ninguna** era una referencia a una opción: eran letras del
// articulado que la exención de `CITA_DE_LA_NORMA` no cubría (pedía «art»/número detrás, así que
// «letra a) catálogo» se le escapaba), los grupos de clasificación del EBEP y referencias de celda
// de hoja de cálculo. Ocho hallazgos permanentes que ningún operador podía cerrar: una bandeja que
// grita todos los días se deja de mirar, y entonces también se deja de ver la de verdad.
//
// Lo que sostiene la exención es el CASO DE LA LETRA, no la palabra: los apartados de un precepto se
// citan en minúscula («letra a)») y las opciones del test en MAYÚSCULA («la opción D»). Por eso el
// último bloque de casos —el contraste— es la parte que importa de este test.
describe('exenciones: letras que no son opciones (T-317)', () => {
  const conIntro = (intro: string) => ({ v: 1 as const, options: { '0': 'x' }, intro })

  it.each([
    ['apartado del precepto en minúscula', 'El apartado b) define los Centros de Acogida:'],
    ['la palabra capitalizada no rompe la exención', 'Apartado d) = «Estudiar, promover e impulsar»'],
    ['letra + sustantivo (no «art» detrás)', '**Clave:** letra a) catálogo de procedimientos, letra b) cartas de servicios.'],
    ['grupos y subgrupos del EBEP', 'son 3 grupos (A, B, C); los subgrupos (A1, A2, C1, C2) son una subdivisión.'],
    ['referencia de celda', 'La referencia **=$C4** tiene la columna fija ($C) y la fila relativa (4).'],
  ])('exime: %s', (_, intro) => {
    expect(structuredNarrativeStaleLetters(conIntro(intro))).toEqual([])
  })

  // EL CONTRASTE. Si algún día se «arregla» un falso positivo ensanchando la exención hasta aquí,
  // esto se pone rojo — y debe ponerse: un falso negativo deja una explicación que miente al barajar.
  it.each([
    ['apartado con la letra en MAYÚSCULA (puede ser la opción)', 'El apartado D) es el que recoge el plazo.'],
    ['anuncio de la clave', 'La respuesta correcta es la **C**.'],
    ['opción nombrada en la narrativa', 'El plazo que cita la opción D no aparece en la ley.'],
  ])('sigue marcando: %s', (_, intro) => {
    expect(structuredNarrativeStaleLetters(conIntro(intro))).toEqual(['intro'])
  })
})
