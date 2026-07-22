// Guardarraíl del clasificador de barajabilidad (barajar-opciones Fase 1).
//
// El riesgo REAL es el falso negativo: clasificar 'full' (barajable) algo que se
// refiere a otras opciones por posición → al barajar se rompe la pregunta. Estos
// casos son los que hundieron a las versiones v1/v2 durante la validación a escala
// (5.000 preguntas) y que v3.2 debe seguir cazando. Ver
// docs/roadmap/barajar-opciones-fase1-spec.md §2.

import {
  classifyShuffleMode,
  explanationReferencesLetters,
  isShuffleEligible,
  type QuestionOptions,
} from '@/lib/shuffle/classifyShuffleMode'

// helper: mete la opción meta como D y rellena A/B/C con contenido inocuo
const withMeta = (meta: string, a = 'Contenido inocuo uno', b = 'Contenido inocuo dos', c = 'Contenido inocuo tres'): QuestionOptions =>
  ({ A: a, B: b, C: c, D: meta })

describe('classifyShuffleMode — no_shuffle (cruces por letra/número/ordinal)', () => {
  const cases = [
    'A y B son correctas.',
    'A) y B) son correctas',
    'Las respuestas A) y B) son correctas.',
    'Las opciones a) y b) son correctas.',
    'Son correctas la B y la C.',
    'La A y la B.',
    'C) y B) son correctas.',
    'Las respuestas 1, 2 y 3 son ciertas.',
    'Ambas son correctas.',
    'Ambas.',
    'Las dos primeras son correctas.',
    'Las dos últimas.',
    'La primera y la segunda.',
  ]
  it.each(cases)('%s → no_shuffle', (meta) => {
    expect(classifyShuffleMode(withMeta(meta))).toBe('no_shuffle')
  })
})

describe('classifyShuffleMode — anchor_last (genéricas todo/nada)', () => {
  const cases = [
    'Ninguna es correcta.',
    'Ninguna de las anteriores.',
    'Ninguna de las respuestas anteriores es correcta.',
    'Todas son correctas',
    'Todas son falsas.',
    'Todas son incorrectas.',
    'Todas las respuestas son correctas.',
    'Todas las anteriores son incorrectas.',
    // los que se escapaban en v1/v2 (validación a escala):
    'Todas las definiciones son correctas.',
    'Todas las proposiciones anteriores son correctas.',
    'Todas las alternativas anteriores son falsas.',
    'Todas las demás respuestas son correctas.',
    'Todas las repuestas anteriores son correctas.', // typo "repuestas" real en BD
    'Todos los diagnósticos anteriores son correctos.',
    'Son todas ciertas.',
    'Todas pueden.',
    'Todos los instrumentos anteriores.',
    'En todos los anteriores.',
    'Todas estas afirmaciones definen un Estudio Descriptivo.',
  ]
  it.each(cases)('%s → anchor_last', (meta) => {
    expect(classifyShuffleMode(withMeta(meta))).toBe('anchor_last')
  })
})

describe('classifyShuffleMode — full (contenido que NO debe capturarse)', () => {
  // Contenido legítimo que contiene "todas/todos/ambas/anteriores" como palabra normal.
  const contentSets: QuestionOptions[] = [
    { A: 'La asistencia sanitaria para todas las contingencias, excepto accidente no laboral.', B: 'El desempleo contributivo.', C: 'La jubilación.', D: 'La incapacidad temporal.' },
    { A: 'Prevención y control del dolor en todas las etapas de la vida.', B: 'Seguridad en la contención física.', C: 'Prevención de caídas.', D: 'Higiene de manos.' },
    { A: 'En todos los casos deberá informar.', B: 'Solo cuando lo requiera el juez.', C: 'Nunca.', D: 'A petición de parte.' },
    { A: 'Todos los ciudadanos españoles mayores de edad.', B: 'Solo los funcionarios.', C: 'Los residentes.', D: 'Los mayores de 65.' },
  ]
  it.each(contentSets)('contenido con palabra suelta → full (%#)', (opts) => {
    expect(classifyShuffleMode(opts)).toBe('full')
  })

  it('cuatro opciones independientes normales → full', () => {
    expect(
      classifyShuffleMode({ A: 'Diez días', B: 'Quince días', C: 'Un mes', D: 'Tres meses' }),
    ).toBe('full')
  })
})

describe('classifyShuffleMode — "ambas" es conservador a propósito (FP inocuo, FN=0 sagrado)', () => {
  // "ambas" se marca no_shuffle aunque sea contenido ("ambas Cámaras"): pierde barajado
  // (inocuo) a cambio de no dejar escapar NUNCA un "ambas ... son correctas". Documentado.
  it.each([
    'Por ambas Cámaras conjuntamente.',
    'Ambas lenguas oficiales, contestando primero en euskera.',
  ])('%s → no_shuffle (conservador, inocuo)', (opt) => {
    expect(classifyShuffleMode(withMeta(opt))).toBe('no_shuffle')
  })
})

describe('classifyShuffleMode — precedencia', () => {
  it('cruce por letra gana a genérica (no_shuffle > anchor_last)', () => {
    // "A y B son correctas" (cruce) + "Ninguna es correcta" (genérica) en la misma pregunta
    expect(
      classifyShuffleMode({ A: 'Uno', B: 'Dos', C: 'Ninguna es correcta.', D: 'A y B son correctas.' }),
    ).toBe('no_shuffle')
  })

  it('preguntas de 3 opciones (D=null) se clasifican por las presentes', () => {
    expect(classifyShuffleMode({ A: 'Uno', B: 'Dos', C: 'Tres', D: null })).toBe('full')
    expect(classifyShuffleMode({ A: 'Uno', B: 'Dos', C: 'Todas son correctas.', D: null })).toBe('anchor_last')
  })
})

describe('explanationReferencesLetters', () => {
  it.each([
    'Por qué B) es correcta...',
    'La opción C es incorrecta porque...',
    'El apartado A recoge...',
    'La respuesta D no aparece en el artículo.',
    // Clases de FALSO NEGATIVO medidas sobre 77k elegibles reales (22/07) que el
    // patrón v1 dejaba escapar → romperían la explicación al barajar:
    'La respuesta correcta es la B: informar al Jefe de Servicios.', // "es la B"
    'Todas las opciones son correctas excepto la cuarta opción.', // ordinal
    'La tercera opción de respuesta es incorrecta debido a que...', // ordinal
    'La opción número 4 es la incorrecta porque la evaluación...', // "opción número N"
    'La B es correcta porque el artículo lo dice.', // "B es correcta"
    'La afirmación correcta es la C.', // "correcta es la C"
    'La segunda afirmación no se ajusta al precepto.', // ordinal afirmación
    'La respuesta correcta es la **B**: Mensaje, Destino y Fuente.', // letra en NEGRITA markdown
    'La opción **C** es la válida según el esquema.', // opción **C** (bold)
    'Las opciones de respuesta 1, 2 y 4 no pueden ser correctas.', // numeradas
    'La primera es falsa porque el origen no es vascular.', // ordinal + es falsa (sin sustantivo)
  ])('detecta referencia a letra/posición: %s', (e) => {
    expect(explanationReferencesLetters(e)).toBe(true)
  })

  it.each([
    'El artículo establece que el plazo es de quince días.',
    'La comunicación previa a la autoridad es obligatoria.',
    // Prosa que NO debe considerarse referencia a opción (letras dentro de palabras,
    // preposiciones): un falso positivo aquí solo perdería barajado, pero cuidamos
    // no excluir de más innecesariamente en casos obvios.
    'El plan de cuidados documenta la situación del paciente.',
    'La Administración debe resolver de forma expresa.',
    '',
    null,
    undefined,
  ])('sin referencia a letra: %s', (e) => {
    expect(explanationReferencesLetters(e as string | null | undefined)).toBe(false)
  })
})

describe('isShuffleEligible (predicado Fase 1)', () => {
  it('full + explicación sin letras → elegible', () => {
    expect(isShuffleEligible({ shuffle_mode: 'full', explanation: 'El plazo es de quince días.' })).toBe(true)
  })
  it('full pero explicación cita letras → NO elegible (espera Fase 2)', () => {
    expect(isShuffleEligible({ shuffle_mode: 'full', explanation: 'Por qué B) es correcta...' })).toBe(false)
  })
  it('anchor_last → NO elegible en Fase 1', () => {
    expect(isShuffleEligible({ shuffle_mode: 'anchor_last', explanation: 'Sin letras.' })).toBe(false)
  })
  it('no_shuffle → NO elegible', () => {
    expect(isShuffleEligible({ shuffle_mode: 'no_shuffle', explanation: null })).toBe(false)
  })
  it('sin explicación + full → elegible', () => {
    expect(isShuffleEligible({ shuffle_mode: 'full', explanation: null })).toBe(true)
  })
})
