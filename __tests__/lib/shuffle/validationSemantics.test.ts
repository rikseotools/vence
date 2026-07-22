// Guardarraíl de la SEMÁNTICA del barajado en las fronteras serve↔validación
// (barajar-opciones Fase 1). No importa los módulos con dependencias de BD; replica
// EXACTAMENTE las fórmulas usadas en:
//   - lib/api/filtered-questions/queries.ts (transformQuestion): al servir permuta
//     opciones, adjunta option_order y remapea correct_option a la POSICIÓN MOSTRADA.
//   - lib/api/v2/answer-and-save/queries.ts (validateAndSaveAnswer): al validar mapea
//     la posición mostrada → índice ORIGINAL y compara contra questions.correct_option.
//
// Cubre el checklist del spec §8: mapeo mostrada→original con permutación no trivial,
// user_answer en índice ORIGINAL, option_order NULL ⇒ identidad, D=null (3 opciones).

import { permutationFor, applyOrder, displayedToOriginal, isValidOrder } from '@/lib/shuffle/permute'

// --- Réplica de la parte de SERVE (transformQuestion) ---
function serve(naturalOptions: string[], dbCorrect: number, nonce: string) {
  const order = permutationFor('q-id', nonce, naturalOptions.length)
  const displayOptions = applyOrder(naturalOptions, order)
  const displayedCorrect = order.indexOf(dbCorrect) // correct_option remapeado a mostrada
  return { displayOptions, option_order: order, correct_option: displayedCorrect }
}

// --- Réplica de la parte de VALIDACIÓN (answer-and-save) ---
function validate(params: {
  options: string[]
  optionOrder: number[] | null
  userAnswerDisplayed: number | null
  dbCorrect: number
}) {
  const n = params.options.length
  const hasShuffle = isValidOrder(params.optionOrder, n)
  const order = hasShuffle ? params.optionOrder : null
  const originalUserAnswer =
    params.userAnswerDisplayed === null ? null : displayedToOriginal(order, params.userAnswerDisplayed)
  const displayedCorrect =
    order && order.indexOf(params.dbCorrect) !== -1 ? order.indexOf(params.dbCorrect) : params.dbCorrect
  const isCorrect = originalUserAnswer === params.dbCorrect
  return { originalUserAnswer, displayedCorrect, isCorrect }
}

describe('serve→validate round-trip (permutación no trivial)', () => {
  const natural = ['opción original A', 'opción original B', 'opción original C', 'opción original D']

  test('el usuario que pincha la opción correcta MOSTRADA acierta, y se guarda el índice ORIGINAL', () => {
    for (let seed = 0; seed < 40; seed++) {
      const dbCorrect = seed % 4
      const served = serve(natural, dbCorrect, `n${seed}`)

      // El cliente resalta/valida por la correct_option remapeada → pincha esa posición.
      const userClicksDisplayed = served.correct_option
      const v = validate({
        options: served.displayOptions,
        optionOrder: served.option_order,
        userAnswerDisplayed: userClicksDisplayed,
        dbCorrect,
      })

      expect(v.isCorrect).toBe(true)
      // user_answer se guarda en coordenadas ORIGINALES (coherente con la BD).
      expect(v.originalUserAnswer).toBe(dbCorrect)
      // La opción mostrada en esa posición ES realmente la correcta original.
      expect(served.displayOptions[userClicksDisplayed]).toBe(natural[dbCorrect])
      // El server devuelve la correcta en coordenadas MOSTRADAS (para resaltar).
      expect(v.displayedCorrect).toBe(userClicksDisplayed)
    }
  })

  test('pinchar una opción MOSTRADA incorrecta falla y guarda su índice original real', () => {
    const dbCorrect = 1
    const served = serve(natural, dbCorrect, 'fixed-nonce')
    const wrongDisplayed = (served.correct_option + 1) % 4
    const v = validate({
      options: served.displayOptions,
      optionOrder: served.option_order,
      userAnswerDisplayed: wrongDisplayed,
      dbCorrect,
    })
    expect(v.isCorrect).toBe(false)
    // El índice original guardado corresponde a la opción realmente mostrada ahí.
    expect(natural[v.originalUserAnswer as number]).toBe(served.displayOptions[wrongDisplayed])
  })
})

describe('retrocompatibilidad: option_order NULL ⇒ identidad', () => {
  const natural = ['A', 'B', 'C', 'D']
  test('sin option_order, la posición mostrada = índice original (histórico intacto)', () => {
    const v = validate({ options: natural, optionOrder: null, userAnswerDisplayed: 2, dbCorrect: 2 })
    expect(v.isCorrect).toBe(true)
    expect(v.originalUserAnswer).toBe(2)
    expect(v.displayedCorrect).toBe(2)
  })

  test('order corrupto (no permutación) se ignora → identidad, nunca marca mal por confiar en basura', () => {
    const v = validate({ options: natural, optionOrder: [0, 0, 1, 2], userAnswerDisplayed: 3, dbCorrect: 3 })
    expect(v.originalUserAnswer).toBe(3) // tratado como natural
    expect(v.isCorrect).toBe(true)
  })
})

describe('D=null: permutar solo las opciones presentes (3 opciones)', () => {
  const natural3 = ['uno', 'dos', 'tres']
  test('el round-trip funciona con 3 opciones', () => {
    for (let seed = 0; seed < 20; seed++) {
      const dbCorrect = seed % 3
      const served = serve(natural3, dbCorrect, `t${seed}`)
      expect(served.option_order).toHaveLength(3)
      expect(served.displayOptions).toHaveLength(3)
      const v = validate({
        options: served.displayOptions,
        optionOrder: served.option_order,
        userAnswerDisplayed: served.correct_option,
        dbCorrect,
      })
      expect(v.isCorrect).toBe(true)
      expect(v.originalUserAnswer).toBe(dbCorrect)
    }
  })
})

describe('blanco: userAnswer null → nunca acierta, sin romper el mapeo', () => {
  test('isBlank equivalente: userAnswerDisplayed null', () => {
    const served = serve(['a', 'b', 'c', 'd'], 0, 'blank')
    const v = validate({
      options: served.displayOptions,
      optionOrder: served.option_order,
      userAnswerDisplayed: null,
      dbCorrect: 0,
    })
    expect(v.originalUserAnswer).toBeNull()
    expect(v.isCorrect).toBe(false)
  })
})
