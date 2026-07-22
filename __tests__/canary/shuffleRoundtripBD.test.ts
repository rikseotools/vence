/**
 * @jest-environment node
 */
// CANARY + SIMULACIÓN con DATOS REALES del barajado de opciones (Fase 1/2).
//
// Entorno node (no jsdom): importar transformQuestion arrastra el driver postgres.js
// (@/db/client), que necesita setImmediate/clearImmediate del runtime Node.
//
// Verifica el INVARIANTE contra la BD viva usando las FUNCIONES REALES de producción
// (transformQuestion del serve + displayedToOriginal/isValidOrder del validador), NO
// copias. Recorre preguntas elegibles reales (shuffle_mode='full' + explicación sin
// letras), las sirve barajadas y comprueba end-to-end que:
//   - las opciones mostradas son una PERMUTACIÓN de las originales (nada se pierde),
//   - option_order es una permutación válida y describe exactamente ese reorden,
//   - la opción correcta se PRESERVA: correct_option remapeado apunta a la misma
//     opción original, y el round-trip de validación (mostrada→original) la recupera.
// Un fallo aquí = una pregunta real cuya clave se rompería al barajar.
//
// Guardado por DATABASE_URL (patrón oposicionIdentityBD): se SALTA en CI sin BD,
// corre en local/post-deploy con:
//   DATABASE_URL=... NODE_TLS_REJECT_UNAUTHORIZED=0 npx jest shuffleRoundtripBD
import { transformQuestion } from '@/lib/api/filtered-questions/queries'
import { isValidOrder, displayedToOriginal } from '@/lib/shuffle/permute'
import {
  explanationReferencesLetters,
  isShuffleEligible,
} from '@/lib/shuffle/classifyShuffleMode'

const HAS_DB = !!process.env.DATABASE_URL
const d = HAS_DB ? describe : describe.skip

type Row = {
  id: string
  question_text: string
  option_a: string | null
  option_b: string | null
  option_c: string | null
  option_d: string | null
  option_e: string | null
  correct_option: number
  explanation: string | null
  shuffle_mode: string | null
  primary_article_id: string | null
}

// Construye un QuestionRow del shape que espera transformQuestion (camelCase) a partir
// de la fila SQL. Solo hidrata lo que la función lee; el resto va con fallbacks.
const toQuestionRow = (r: Row): any => ({
  id: r.id,
  questionText: r.question_text,
  optionA: r.option_a,
  optionB: r.option_b,
  optionC: r.option_c,
  optionD: r.option_d,
  optionE: r.option_e,
  explanation: r.explanation ?? '',
  correctOption: r.correct_option,
  shuffleMode: r.shuffle_mode,
  // Forzamos safe para ejercitar la LÓGICA de permutación sobre contenido real; el
  // gate shuffle_safety se prueba aparte (transformQuestionShuffle.test.ts).
  shuffleSafety: 'safe',
  primaryArticleId: r.primary_article_id ?? '00000000-0000-0000-0000-000000000000',
  sourceTopic: null,
})

const naturalOptionsOf = (r: Row): string[] =>
  [r.option_a, r.option_b, r.option_c, r.option_d, r.option_e].filter(
    (v): v is string => v != null && v !== '',
  )

d('CANARY BD: barajar preserva la clave en preguntas reales elegibles', () => {
  let rows: Row[] = []

  beforeAll(async () => {
    const { Client } = await import('pg')
    const url = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '')
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await c.connect()
    // Muestra amplia de preguntas elegibles (full). El filtro de explicación-sin-letras
    // se aplica en JS con la función real (más fiel que un LIKE).
    rows = (
      await c.query(`
        SELECT id, question_text, option_a, option_b, option_c, option_d, option_e,
               correct_option, explanation, shuffle_mode, primary_article_id
        FROM questions
        WHERE is_active = true
          AND shuffle_mode = 'full'
          AND correct_option IS NOT NULL
          AND option_a IS NOT NULL AND option_b IS NOT NULL AND option_c IS NOT NULL
        ORDER BY random()
        LIMIT 500`)
    ).rows as Row[]
    await c.end()
  }, 60000)

  it('trae una muestra no trivial de preguntas full', () => {
    expect(rows.length).toBeGreaterThan(50)
  })

  it('INVARIANTE: para cada pregunta elegible, barajar preserva la opción correcta y es reversible', () => {
    let shuffledCount = 0
    let reorderedCount = 0
    const failures: string[] = []

    rows.forEach((r, i) => {
      const natural = naturalOptionsOf(r)
      // Solo las que el predicado real considera elegibles (full + expl. sin letras).
      if (!isShuffleEligible({ shuffle_mode: r.shuffle_mode, explanation: r.explanation })) return
      if (r.correct_option < 0 || r.correct_option >= natural.length) return // dato raro → fuera

      const served = transformQuestion(toQuestionRow(r), i, true) as any
      const order: number[] | null = served.option_order

      // Si por meta-smell interno no barajó, se sirve natural (identidad) — válido.
      if (order == null) {
        if (served.options.join('') !== natural.join('')) {
          failures.push(`${r.id}: sin order pero opciones != naturales`)
        }
        return
      }
      shuffledCount++

      // 1) order es permutación válida del nº de opciones presentes.
      if (!isValidOrder(order, natural.length)) {
        failures.push(`${r.id}: option_order inválido ${JSON.stringify(order)} (n=${natural.length})`)
        return
      }
      // 2) options mostradas = misma multiset que las naturales (nada se pierde/duplica).
      if ([...served.options].sort().join('') !== [...natural].sort().join('')) {
        failures.push(`${r.id}: opciones mostradas no son permutación de las naturales`)
      }
      // 3) option_order describe EXACTAMENTE el reorden: options[i] === natural[order[i]].
      served.options.forEach((opt: string, pos: number) => {
        if (opt !== natural[order[pos]]) failures.push(`${r.id}: pos ${pos} no casa con order`)
      })
      // 4) La correcta se PRESERVA: la posición mostrada de la correcta muestra la
      //    opción correcta original, y el round-trip la recupera.
      if (served.options[served.correct_option] !== natural[r.correct_option]) {
        failures.push(`${r.id}: correct_option remapeado NO apunta a la opción correcta original`)
      }
      if (displayedToOriginal(order, served.correct_option) !== r.correct_option) {
        failures.push(`${r.id}: round-trip mostrada→original de la correcta != original`)
      }
      // 5) Round-trip para CUALQUIER posición mostrada (simula al usuario pinchando ahí).
      served.options.forEach((opt: string, displayed: number) => {
        const orig = displayedToOriginal(order, displayed)
        if (natural[orig] !== opt) failures.push(`${r.id}: displayed ${displayed} mapea mal`)
      })

      if (order.some((v, idx) => v !== idx)) reorderedCount++
    })

    if (failures.length) {
      console.error(`❌ ${failures.length} fallos de invariante (primeros 10):\n` + failures.slice(0, 10).join('\n'))
    }
    console.log(`ℹ️  barajadas ${shuffledCount}, con reorden real ${reorderedCount} de ${rows.length} muestreadas`)
    expect(failures).toEqual([])
    // Sanidad: el mecanismo REALMENTE baraja (no es un no-op silencioso).
    expect(shuffledCount).toBeGreaterThan(0)
    expect(reorderedCount).toBeGreaterThan(shuffledCount * 0.5)
  })

  it('RETROCOMPAT: con shuffle=false el output es idéntico al natural (0 cambio, flag off)', () => {
    for (let i = 0; i < Math.min(rows.length, 100); i++) {
      const r = rows[i]
      const natural = naturalOptionsOf(r)
      const served = transformQuestion(toQuestionRow(r), i, false) as any
      expect(served.options).toEqual(natural)
      expect(served.correct_option).toBe(r.correct_option)
      expect(served.option_order ?? null).toBeNull()
    }
  })

  it('SIMULACIÓN persistencia: al pinchar la correcta MOSTRADA, el índice ORIGINAL guardado = clave BD', () => {
    // Replica la coherencia de coordenadas del validador: user_answer se guarda en
    // índice ORIGINAL, así que letra(user_answer)===letra(correct_answer) cuando acierta.
    let checked = 0
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      if (!isShuffleEligible({ shuffle_mode: r.shuffle_mode, explanation: r.explanation })) continue
      const natural = naturalOptionsOf(r)
      if (r.correct_option < 0 || r.correct_option >= natural.length) continue
      const served = transformQuestion(toQuestionRow(r), i, true) as any
      const order = served.option_order
      if (!order) continue
      const userClicksDisplayed = served.correct_option // el cliente resalta/valida por aquí
      const originalUserAnswer = displayedToOriginal(order, userClicksDisplayed)
      expect(originalUserAnswer).toBe(r.correct_option) // guardado coherente con la BD
      checked++
      if (checked >= 100) break
    }
    expect(checked).toBeGreaterThan(0)
  })
})

// CANARY del GATE persistido: el dato shuffle_safety debe ser coherente con el detector
// determinista (ninguna 'safe' cita letras) y las 'safe' tienen hash de verificación.
d('CANARY BD: gate shuffle_safety coherente con el detector', () => {
  it('ninguna pregunta safe cita letras/posición (0-FN del backfill sobre datos reales)', async () => {
    const { isShuffleEligible } = await import('@/lib/shuffle/classifyShuffleMode')
    const { Client } = await import('pg')
    const url = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '')
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await c.connect()
    const safe = (
      await c.query(
        "SELECT explanation, shuffle_mode, shuffle_safety_hash FROM questions WHERE is_active=true AND shuffle_safety='safe' ORDER BY random() LIMIT 2000",
      )
    ).rows as { explanation: string | null; shuffle_mode: string; shuffle_safety_hash: string | null }[]
    await c.end()
    expect(safe.length).toBeGreaterThan(100)
    const violations = safe.filter(
      (r) => !isShuffleEligible({ shuffle_mode: r.shuffle_mode, explanation: r.explanation }) || !r.shuffle_safety_hash,
    )
    if (violations.length) console.error(`❌ ${violations.length} safe incoherentes (primera):`, violations[0])
    // Toda 'safe' debe ser full + explicación limpia + tener hash de verificación.
    expect(violations).toEqual([])
  }, 60000)
})

// Sanidad extra: la muestra NO debe contener elegibles con explicación que cite letras
// (si aparece, el predicado de elegibilidad estaría dejando escapar letra-ancladas).
d('CANARY BD: coherencia del predicado de elegibilidad', () => {
  it('ninguna full con explicación que cite letras se considera elegible', async () => {
    const { Client } = await import('pg')
    const url = (process.env.DATABASE_URL || '').replace(/[?&]sslmode=require/, '')
    const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await c.connect()
    const sample = (
      await c.query(`
        SELECT shuffle_mode, explanation FROM questions
        WHERE is_active = true AND shuffle_mode = 'full' AND explanation IS NOT NULL
        ORDER BY random() LIMIT 300`)
    ).rows as { shuffle_mode: string; explanation: string }[]
    await c.end()
    for (const s of sample) {
      const eligible = isShuffleEligible({ shuffle_mode: s.shuffle_mode, explanation: s.explanation })
      if (eligible) {
        // elegible ⇒ la explicación NO cita letras (por definición del predicado)
        expect(explanationReferencesLetters(s.explanation)).toBe(false)
      }
    }
    expect(sample.length).toBeGreaterThan(0)
  }, 60000)
})
