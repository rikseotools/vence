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
  isShuffleServeEligible,
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

describe('isShuffleServeEligible (gate de serve: verificación robusta)', () => {
  const { isShuffleServeEligible } = require('@/lib/shuffle/classifyShuffleMode')
  it('safe + full + limpia → elegible en serve', () => {
    expect(isShuffleServeEligible({ shuffle_mode: 'full', explanation: 'Plazo de quince días.', shuffle_safety: 'safe' })).toBe(true)
  })
  it.each(['unverified', 'unsafe', 'stale', null, undefined])('shuffle_safety=%s → NO elegible aunque full+limpia', (s) => {
    expect(isShuffleServeEligible({ shuffle_mode: 'full', explanation: 'Plazo de quince días.', shuffle_safety: s as any })).toBe(false)
  })
  it('safe pero explicación cita letras → NO elegible (última línea determinista)', () => {
    expect(isShuffleServeEligible({ shuffle_mode: 'full', explanation: 'La opción B es correcta.', shuffle_safety: 'safe' })).toBe(false)
  })
  it('safe pero no full → NO elegible', () => {
    expect(isShuffleServeEligible({ shuffle_mode: 'no_shuffle', explanation: 'Limpia.', shuffle_safety: 'safe' })).toBe(false)
  })
})

describe('explanationReferencesLetters — referencias por POSICIÓN (28/07)', () => {
  // Hueco medido el 28/07 al preparar el encendido del barajado: de 28 explicaciones `safe` que
  // razonan por posición, el detector solo cazaba 3. Se le escapaban dos formas, ambas frecuentes
  // en el banco clínico (enfermería/TCAE), donde el ordinal va DETRÁS del sustantivo.
  test.each([
    ['orden invertido singular', 'es la opción de respuesta primera'],
    ['orden invertido plural', 'Las opciones de respuesta segunda, tercera y cuarta están relacionadas'],
    ['sin "de respuesta"', 'En las opciones primera y cuarta no especifican la connotación'],
    ['artículo + ordinal detrás', 'la respuesta dada en su día por el tribunal fue la opción tercera'],
    ['última + de respuesta', 'nos quedamos con la última opción de respuesta'],
    ['respuesta anterior', 'no del mismo como se indica en la respuesta anterior'],
    ['opciones anteriores con cuantificador', 'ninguna de las tres opciones anteriores representa una limitación'],
  ])('caza: %s', (_, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(true)
  })

  test('«última» CON TILDE casa igual que sin ella', () => {
    // El agujero que escondía 19 de las 36: en JS `\b` se define sobre [A-Za-z0-9_], así que entre
    // un espacio y una «ú» no hay frontera de palabra y `\b(?:…|[úu]ltima)` nunca casaba «última».
    // Ningún test lo veía porque todos los ejemplos se habían escrito sin acento.
    expect(explanationReferencesLetters('todo es cierto salvo la última opción de respuesta')).toBe(true)
    expect(explanationReferencesLetters('todo es cierto salvo la ultima opcion de respuesta')).toBe(true)
  })

  // Lo que el detector deja pasar A PROPÓSITO: «siguiente(s)» no es una referencia posicional a
  // otra opción del test sino una enumeración o un menú de software. Los 3 casos son reales y
  // salían del banco al calibrar; incluir «siguiente» habría marcado explicaciones correctas.
  test.each([
    ['menú de software', 'elegir una de las siguientes opciones en el grupo Formato'],
    ['enunciado citado', 'PREGUNTA ORIGINAL: De las siguientes respuestas sobre los pasos en la RCP'],
    ['enumeración', 'como nos señalan las siguientes opciones de respuesta: - Control del peso'],
  ])('NO caza: %s', (_, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(false)
  })

  // Y lo que marca aunque sea un falso positivo, porque el sesgo es deliberado: en la EXPLICACIÓN
  // un falso negativo deja un texto roto a la vista del opositor, mientras que un falso positivo
  // solo hace que esa pregunta no se baraje. Con 36 de 73.469 (0,05% de cobertura), el cambio sale
  // barato. Distinguir «la última opción para la punción arterial» de «la última opción de
  // respuesta» exigiría entender la frase, no reconocerla.
  test.each([
    ['«opción» en su sentido corriente', 'Es la primera opción que prevé el precepto para este caso'],
    ['último recurso clínico', 'La arteria femoral es la última opción para la punción arterial'],
  ])('falso positivo ACEPTADO: %s', (_, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(true)
  })
})

describe('explanationReferencesLetters — grados y locuciones (T-301, 30/07)', () => {
  // Artefactos MEDIDOS ejecutando el detector real durante la campaña de T-291, no razonados.
  // La causa es la misma de las tildes: `\b` se define sobre [A-Za-z0-9_], así que entre «º» y
  // «C» hay frontera de palabra y `\b[ABCDE]\)` casaba dentro de «(2-8 ºC)». Era un falso
  // positivo SISTEMÁTICO: dejaba fuera del barajado a todo el banco clínico que escribe la
  // magnitud entre paréntesis (constantes vitales, cadena de frío).
  test.each([
    ['ordinal masculino en cadena de frío', 'Se conserva en frigorífico (2-8 ºC) hasta su administración.'],
    ['símbolo de grado real', 'La temperatura corporal normal es de (36-37 °C) en axila.'],
    ['sin paréntesis (ya pasaba antes)', 'Se conserva entre 2 y 8 ºC.'],
    ['grados Fahrenheit', 'El umbral se fija en (100 °F) según la fuente citada.'],
    ['locución adverbial «letra a letra»', 'Basta con cambiar mayúsculas y minúsculas sin retocarlo letra a letra.'],
  ])('NO caza: %s', (_, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(false)
  })

  // Y lo que la exención NO puede llevarse por delante: la referencia de verdad sigue marcando.
  test.each([
    ['«opción C» explícita', 'Como se ve en la opción C, el plazo es de tres meses.'],
    ['letra con paréntesis', 'La respuesta correcta es la B).'],
    ['«letra B» sin locución', 'Es la letra B la que recoge el plazo.'],
    // La exención es solo para el símbolo de grado: una palabra que empiece por C tras «º» no
    // desactiva el patrón (el lookahead exige que no venga otra letra).
    ['grado seguido de palabra', 'El artículo 5º Continúa diciendo que la opción D es válida.'],
  ])('sigue cazando: %s', (_, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(true)
  })
})

// La familia entera de este defecto —la letra A-E pegada a otra letra, con o sin tilde— y con
// TEXTOS REALES del banco, que es lo que faltaba. El endurecimiento del 28/07 (`\b` → lookahead
// Unicode) no llevaba ninguno: sus casos de ejemplo estaban escritos a mano. Consecuencia medida
// el 30/07 al re-evaluar los veredictos (T-306): **21 preguntas seguían `unsafe`** desde el 22/07
// por textos como estos, ocho días después de que el detector se arreglara. Un arreglo sin caso
// real no impide la reincidencia: ya van cuatro sitios (tildes, «la Cámara», grados, «letra a
// letra»). Si aparece un quinto, que salga aquí en rojo y no en la cara del opositor.
describe('explanationReferencesLetters — textos REALES que NO son referencias (familia frontera/tilde)', () => {
  test.each([
    ['«es la cámara alta» (CE art. 69)', 'El Senado (art. 69 de la CE) es la cámara alta y tiene la representación territorial.'],
    ['«son las células óseas»', 'Los osteocitos son las células óseas maduras, y los osteoclastos reabsorben el tejido óseo.'],
    ['«es la Décima Revisión» (CIE-10)', 'La CIE-10 es la Décima Revisión de la Clasificación Internacional de Enfermedades.'],
    ['«es la estructura de datos»', 'Una tabla de dispersión es la estructura de datos que asocia claves con valores.'],
    ['«es la Cámara de representación territorial» (literal del art. 69.1)', 'Constitución Española. Artículo 69. 1. El Senado es la Cámara de representación territorial.'],
  ])('NO caza: %s', (_, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(false)
  })

  // El contraste que da valor a los de arriba: la MISMA construcción con una letra de verdad
  // detrás sigue marcando. Si un día se «arregla» ensanchando la exención, esto se pone rojo.
  test.each([
    ['«es la C» a secas', 'Tras leer el precepto, la correcta es la C.'],
    ['«son las A y C»', 'Según el artículo, son las A y C las que recogen el supuesto.'],
  ])('sigue cazando: %s', (_, texto) => {
    expect(explanationReferencesLetters(texto)).toBe(true)
  })
})

describe('isShuffleServeEligible — tener estructura NO basta (28/07)', () => {
  const base = { shuffle_mode: 'full', shuffle_safety: 'safe', has_structured_explanation: true,
    options: ['Doce meses', 'Seis meses', 'Un año', 'Dos años'] }

  test('una RAZÓN que cita otra opción por su letra bloquea el barajado', () => {
    // Caso real (22850dcd): al transcribir el histórico, la razón se trajo dentro la mención a
    // otra opción. La estructura garantiza que cada razón viaja con SU opción, no que la razón
    // no hable de las demás — y barajando, «la opción D» pasa a señalar otra cosa.
    expect(isShuffleServeEligible({ ...base,
      structuredReasons: ['Doce meses es el plazo que cita la opción D y no corresponde a ningún precepto', 'ok', 'ok', 'ok'],
    })).toBe(false)
  })

  test('una RAZÓN que razona por posición también lo bloquea', () => {
    expect(isShuffleServeEligible({ ...base,
      structuredReasons: ['Como se vio en la última opción de respuesta, el plazo es anual', 'ok', 'ok', 'ok'],
    })).toBe(false)
  })

  test('razones limpias siguen siendo barajables (no se rompe la cobertura)', () => {
    expect(isShuffleServeEligible({ ...base,
      structuredReasons: ['El art. 41.3 fija doce meses', 'No hay plazo semestral', 'Coincide con doce meses', 'No existe plazo bienal'],
    })).toBe(true)
  })

  test('sin razones (sin estructura) el comportamiento es el de siempre', () => {
    expect(isShuffleServeEligible({ shuffle_mode: 'full', shuffle_safety: 'safe', explanation: 'Texto limpio.' })).toBe(true)
    expect(isShuffleServeEligible({ shuffle_mode: 'full', shuffle_safety: 'unsafe', explanation: 'Texto limpio.' })).toBe(false)
  })
})
