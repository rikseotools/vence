// Guardrail de CABLEADO extremo-a-extremo del barajado (barajar-opciones Fase 1/2).
//
// El typecheck no caza que un campo deje de propagarse por una capa (un `optional`
// que nadie lee, una columna que se quita del select, un schema que pierde el
// campo). Este guardrail lee el CÓDIGO REAL y afirma que `option_order`/`shuffle_mode`
// siguen cableados en CADA salto del recorrido:
//   serve (filtered) → schema respuesta → cliente → schema answer-and-save →
//   validador → persistencia (buildTestAnswerRow → columna Drizzle) → gap-fill.
// Si alguien rompe un salto, este test falla en CI (sin BD). Corre siempre.

const fs = require('fs')
const read = (p: string) => fs.readFileSync(p, 'utf-8')

describe('cableado shuffle: columna Drizzle (fuente de verdad del INSERT)', () => {
  const schema = read('db/schema.ts')
  it('test_questions.option_order está mapeado como integer[] en Drizzle', () => {
    expect(schema).toMatch(/optionOrder:\s*integer\(["']option_order["']\)\.array\(\)/)
  })
  it('questions.shuffle_mode está mapeado en Drizzle', () => {
    expect(schema).toMatch(/shuffleMode:\s*text\(["']shuffle_mode["']\)/)
  })
  it('questions.shuffle_safety está mapeado en Drizzle (dato verificado)', () => {
    expect(schema).toMatch(/shuffleSafety:\s*text\(["']shuffle_safety["']\)/)
  })
})

describe('verificación robusta: migración shuffle_safety (dato + trigger anti-drift)', () => {
  const mig = read('supabase/migrations/20260722_shuffle_safety_verification.sql')
  it('crea la columna con CHECK de estados', () => {
    expect(mig).toMatch(/ADD COLUMN IF NOT EXISTS shuffle_safety text/)
    expect(mig).toMatch(/CHECK \(shuffle_safety IN \('unverified','safe','unsafe','stale'\)\)/)
  })
  it('define el hash determinista de contenido', () => {
    expect(mig).toContain('FUNCTION public.compute_shuffle_safety_hash')
  })
  it('trigger BEFORE UPDATE de invalidación a stale por cambio de contenido', () => {
    expect(mig).toMatch(/BEFORE UPDATE ON public\.questions/)
    expect(mig).toMatch(/NEW\.shuffle_safety\s*:=\s*'stale'/)
    expect(mig).toMatch(/NEW\.shuffle_safety_hash IS DISTINCT FROM public\.compute_shuffle_safety_hash/)
  })
  it('única vía legítima de fijar veredicto captura hash actual + audit', () => {
    expect(mig).toContain('FUNCTION public.record_shuffle_safety')
    expect(mig).toContain('INSERT INTO public.question_shuffle_safety_history')
  })
})

describe('cableado shuffle: SERVE (lib/api/filtered-questions)', () => {
  const queries = read('lib/api/filtered-questions/queries.ts')
  const schemas = read('lib/api/filtered-questions/schemas.ts')

  it('questionColumns selecciona shuffleMode + shuffleSafety (gate de serve)', () => {
    expect(queries).toContain('shuffleMode: questions.shuffleMode')
    expect(queries).toContain('shuffleSafety: questions.shuffleSafety')
  })
  it('QuestionRow incluye shuffleMode y shuffleSafety', () => {
    const typeBlock = queries.match(/type QuestionRow = \{([^}]+)\}/s)?.[1] || ''
    expect(typeBlock).toContain('shuffleMode:')
    expect(typeBlock).toContain('shuffleSafety:')
  })
  it('transformQuestion usa el gate de serve (dato verificado safe + detector) y permuta', () => {
    expect(queries).toContain("from '@/lib/shuffle/classifyShuffleMode'")
    expect(queries).toContain("from '@/lib/shuffle/permute'")
    expect(queries).toContain("from '@/lib/shuffle/flag'")
    // El gate exige shuffle_safety='safe' (persistido) además del detector determinista, y desde
    // la Fase 2 le pasa también si la pregunta tiene explicación ESTRUCTURADA (que es shuffle-safe
    // por construcción). Se comprueban los cuatro campos por separado para no atar el guardarraíl
    // al formato del código (una sola línea vs multilínea), que fue lo que lo rompió al cablear.
    expect(queries).toContain('isShuffleServeEligible({')
    for (const campo of [
      'shuffle_mode: q.shuffleMode',
      'explanation: q.explanation',
      'shuffle_safety: q.shuffleSafety',
      'has_structured_explanation:',
    ]) {
      expect(queries).toContain(campo)
    }
    expect(queries).toContain('option_order: optionOrder')
  })

  it('FASE 2: la explicación se RENDERIZA desde explanation_data cuando existe (y no antes)', () => {
    // Los dos sistemas conviven mientras se transcribe el histórico: sin estructura se sirve
    // `q.explanation` tal cual —139.445 preguntas dependen de ello— y con estructura se compone
    // para el orden REALMENTE servido, para que cada opción viaje con su razón al barajar.
    expect(queries).toContain("from '@/lib/shuffle/structuredExplanation'")
    expect(queries).toContain('isStructuredExplanation(q.explanationData')
    expect(queries).toMatch(/renderStructuredExplanation\(estructurada, \{[\s\S]{0,200}optionOrder/)
    // La ventana es amplia a propósito: entre el render y el fallback hay comentarios que
    // explican por qué `nOptions` son las opciones SERVIDAS y no las del banco (T-267).
    // Lo que se protege es que exista el fallback, no cuánto se explique por medio.
    expect(queries).toMatch(/explanation: estructurada[\s\S]{0,900}: q\.explanation/)
    // Y la columna tiene que viajar en el SELECT, o nada de lo anterior se entera.
    expect(queries).toContain('explanationData: questions.explanationData')
  })
  it('el gate es OPT-IN: shuffleOn exige shuffleOptions del request + flag/scope', () => {
    expect(queries).toMatch(/shuffleOn\s*=\s*shuffleOptions === true && isShuffleEnabledFor\(positionType\)/)
  })
  it('NINGUNA llamada a transformQuestion olvida el shuffle NI el nº de opciones del examen', () => {
    // Una llamada sin `shuffleOn` barajaría=false SIEMPRE (gap silencioso); una sin
    // `opcionesExamen` serviría 4 opciones donde el examen tiene 3, que es justo el
    // fallo que reportó Pilar (T-267). Ambas cosas se comprueban en la misma línea.
    const calls = queries.match(/transformQuestion\((?![\s\S]{0,40}q: QuestionRow)[^;]*?\)/g) || []
    const invocations = calls.filter((c) => !c.includes('q: QuestionRow'))
    expect(invocations.length).toBeGreaterThanOrEqual(5)
    for (const c of invocations) {
      expect(c).toMatch(/,\s*shuffleOn,\s*opcionesExamen\)/)
    }
  })

  it('el nº de opciones del examen se resuelve UNA vez por request y solo con el motor activo', () => {
    // Si se resolviera por pregunta serían N consultas por test; y si se resolviera con el
    // motor apagado, se recortaría sin barajar — recortar y barajar comparten interruptor.
    expect(queries).toMatch(/const opcionesExamen = shuffleOn \? await opcionesExamenDe\(positionType\) : null/)
  })
  it('filteredQuestionSchema declara option_order (viaja al cliente)', () => {
    expect(schemas).toMatch(/option_order:\s*z\.array\(z\.number\(\)\.int\(\)\)\.nullable\(\)\.optional\(\)/)
  })
  it('el request acepta shuffleOptions (opt-in por caller)', () => {
    expect(schemas).toMatch(/shuffleOptions:\s*z\.boolean\(\)\.default\(false\)/)
  })
})

describe('cableado shuffle: CLIENTE (TestLayout reenvía option_order)', () => {
  const testLayout = read('components/TestLayout.tsx')
  // 28/07/2026: la construcción del payload se EXTRAJO del componente a `lib/answers/
  // buildAnswerPayload` para poder testear el viaje de ida y vuelta de la permutación (mientras
  // vivía aquí dentro, nadie podía comprobar que el dato llegaba). La intención de este
  // guardarraíl no cambia —el cliente debe reenviar `option_order`—, cambia dónde se comprueba:
  // el comportamiento lo fija ahora `__tests__/answers/viajeDeIdaYVueltaDelBarajado.test.ts`.
  it('el payload de answer-and-save se construye con el núcleo compartido (que reenvía optionOrder)', () => {
    expect(testLayout).toContain('buildAnswerPayload(')
    expect(testLayout).toMatch(/from '@\/lib\/answers\/buildAnswerPayload'/)
  })
  it('el detailedAnswer de complete-test reenvía optionOrder normalizado', () => {
    expect(testLayout).toMatch(/optionOrder:\s*normalizeOptionOrder\(\(qd as any\)\?\.option_order\)/)
  })
})

describe('cableado shuffle: RASTRO DEL SERVIDOR (qué se sirvió barajado)', () => {
  const queries = read('lib/api/filtered-questions/queries.ts')

  // 28/07/2026: hasta hoy la permutación SOLO quedaba registrada si el cliente la devolvía al
  // guardar. Cuando `option_order` apareció a NULL en el 100 % de las filas mientras el servidor SÍ
  // barajaba, no hubo forma de demostrar qué se mostró NI de reparar los datos (el orden usa un
  // nonce aleatorio por exposición). El servidor tiene que dejar su propio rastro.
  it('existe el registro de lo servido y emite un evento propio', () => {
    expect(queries).toContain('export function registrarBarajadoServido')
    expect(queries).toContain("eventType: 'shuffle_options_served'")
  })

  it('TODOS los caminos que sirven preguntas pasan por el registro', () => {
    // Un camino nuevo que devuelva preguntas sin registrar volvería a dejarnos a ciegas justo en
    // el flujo que más importa. Se cuentan los `transformQuestion(` de serve y se exige que cada
    // bloque que los agrupa esté envuelto por el registro.
    const usos = [...queries.matchAll(/registrarBarajadoServido\(/g)].length
    // 1 definición + 1 por cada camino de serve (5 en el momento de escribir esto).
    expect(usos).toBeGreaterThanOrEqual(6)
  })
})

describe('cableado shuffle: VALIDADOR (answer-and-save mapea mostrada→original)', () => {
  const schemas = read('lib/api/v2/answer-and-save/schemas.ts')
  const queries = read('lib/api/v2/answer-and-save/queries.ts')
  it('el request acepta optionOrder', () => {
    expect(schemas).toMatch(/optionOrder:\s*z\.array\(z\.number\(\)\.int\(\)\)\.nullable\(\)\.optional\(\)/)
  })
  it('valida con isValidExposureOrder y mapea con displayedToOriginal (funciones REALES)', () => {
    expect(queries).toContain("from '@/lib/shuffle/permute'")
    // Desde T-267 el orden puede ser un SUBCONJUNTO (3 de 4): `isValidOrder` exigía
    // permutación completa y habría tratado esos órdenes como corruptos → identidad →
    // corrección contra la clave equivocada.
    expect(queries).toMatch(/isValidExposureOrder\(params\.optionOrder, n\)/)
    expect(queries).toMatch(/displayedToOriginal\(order, params\.userAnswer\)/)
  })
  it('compara el índice ORIGINAL contra correct_option (no la posición mostrada)', () => {
    expect(queries).toMatch(/isCorrect\s*=\s*!isBlank && originalUserAnswer === correctOption/)
  })
  it('guarda el índice ORIGINAL en selectedAnswer y persiste optionOrder', () => {
    expect(queries).toMatch(/selectedAnswer:\s*isBlank \? -1 : \(originalUserAnswer as number\)/)
    expect(queries).toMatch(/optionOrder:\s*order/)
  })
  it('devuelve la correcta en coordenadas MOSTRADAS (para resaltar en el cliente)', () => {
    expect(queries).toContain('correctAnswer: displayedCorrect')
  })
})

describe('cableado shuffle: PERSISTENCIA (buildTestAnswerRow escribe la columna)', () => {
  const taSchemas = read('lib/api/test-answers/schemas.ts')
  const taQueries = read('lib/api/test-answers/queries.ts')
  it('answerData acepta optionOrder', () => {
    expect(taSchemas).toMatch(/optionOrder:\s*z\.array\(z\.number\(\)\.int\(\)\)\.nullable\(\)\.optional\(\)/)
  })
  it('la fila insertada escribe optionOrder en la columna', () => {
    expect(taQueries).toMatch(/optionOrder:\s*req\.answerData\.optionOrder\s*\?\?\s*null/)
  })
})

describe('cableado shuffle: GAP-FILL (complete-test coherente)', () => {
  const ctSchemas = read('lib/api/v2/complete-test/schemas.ts')
  const ctQueries = read('lib/api/v2/complete-test/queries.ts')
  it('detailedAnswer acepta optionOrder', () => {
    expect(ctSchemas).toMatch(/optionOrder:\s*z\.array\(z\.number\(\)\.int\(\)\)\.nullable\(\)\.optional\(\)/)
  })
  it('el gap-fill mapea selectedAnswer mostrada→original, recomputa isCorrect y persiste optionOrder', () => {
    expect(ctQueries).toContain("from '@/lib/shuffle/permute'")
    expect(ctQueries).toMatch(/displayedToOriginal\(validOrder, a\.selectedAnswer\)/)
    // isCorrect recomputado server-side (no confiar en el cliente).
    expect(ctQueries).toMatch(/recomputedIsCorrect\s*=\s*a\.selectedAnswer >= 0 && originalSelected === correctOption/)
    expect(ctQueries).toMatch(/isCorrect:\s*recomputedIsCorrect/)
    expect(ctQueries).toMatch(/optionOrder:\s*validOrder/)
  })
})

describe('observabilidad shuffle', () => {
  const serve = read('lib/api/filtered-questions/queries.ts')
  const validator = read('lib/api/v2/answer-and-save/queries.ts')
  it('serve emite evento cuando el barajado está activo', () => {
    expect(serve).toContain("eventType: 'shuffle_options_request_active'")
  })
  it('el validador emite warn ante un option_order corrupto (detector de clave rota)', () => {
    expect(validator).toContain("eventType: 'shuffle_option_order_invalid'")
    expect(validator).toMatch(/severity:\s*'warn'/)
  })
})
