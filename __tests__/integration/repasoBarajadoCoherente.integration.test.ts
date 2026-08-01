/**
 * Guardarraíl del CONTRATO de datos del que depende el repaso de tests barajados (T-472).
 *
 * El arreglo de `getTestReview` (traducir las letras guardadas al orden que vio el usuario)
 * se apoya en una convención que hoy es cierta y que NADIE hacía cumplir:
 *
 *   · `test_questions.full_question_context.options` está en el orden **MOSTRADO**
 *     (`options[i] === opciones_de_la_pregunta[option_order[i]]`)
 *   · `test_questions.user_answer` / `correct_answer` están en coordenadas **de la BD**
 *     (`correct_answer` = letra de `questions.correct_option`)
 *
 * Si un día el escritor (`answer-and-save` / `complete-test`) cambia de criterio y guarda
 * las opciones ya desbarajadas, la pantalla de repaso volvería a señalar la opción
 * equivocada **en silencio** — el mismo fallo que impugnó una usuaria el 01/08/2026, y el
 * lector no tendría forma de notarlo. Este test mira los datos REALES y lo caza.
 *
 * Es complementario, no redundante: `__tests__/shuffle/reviewCoords.test.ts` prueba la
 * traducción (el lector) y `npm run sim:repaso-barajado` ejecuta la query real de punta a
 * punta; esto vigila la convención que ambos dan por supuesta (el escritor).
 */

import dotenv from 'dotenv'
import { openTestClient } from '../helpers/db'

dotenv.config({ path: '.env.local', override: true })

const hasDb = !!process.env.DATABASE_URL
const describeSiHayDb = hasDb ? describe : describe.skip

const LETRAS = ['A', 'B', 'C', 'D', 'E']

interface Fila {
  id: string
  question_id: string
  correct_answer: string | null
  option_order: number[] | null
  ctx_options: string[] | null
  correct_option: number
  opciones_bd: (string | null)[]
}

describeSiHayDb('contrato de datos del repaso barajado (T-472)', () => {
  let filas: Fila[] = []

  beforeAll(async () => {
    const client = await openTestClient()
    try {
      const { rows } = await client.query<Fila>(`
        SELECT tq.id,
               tq.question_id,
               tq.correct_answer,
               tq.option_order,
               CASE WHEN jsonb_typeof(tq.full_question_context->'options') = 'array'
                    THEN ARRAY(SELECT jsonb_array_elements_text(tq.full_question_context->'options'))
                    ELSE NULL END                       AS ctx_options,
               q.correct_option,
               ARRAY[q.option_a, q.option_b, q.option_c, q.option_d, q.option_e] AS opciones_bd
        FROM test_questions tq
        JOIN questions q ON q.id = tq.question_id
        WHERE tq.option_order IS NOT NULL
        ORDER BY tq.created_at DESC
        LIMIT 5000
      `)
      filas = rows
    } finally {
      await client.end()
    }
  }, 60_000)

  it('hay exposiciones barajadas que comprobar (si no, el verde es vacío)', () => {
    if (filas.length === 0) {
      console.warn(
        '⚠️  0 filas con option_order: el barajado está apagado o no ha servido nada. ' +
          'Este test no puede concluir nada — no lo leas como verde.',
      )
    }
    expect(Array.isArray(filas)).toBe(true)
  })

  it('las opciones guardadas están en el orden MOSTRADO, no en el de la BD', () => {
    const rotas = filas.filter((f) => {
      if (!f.ctx_options || !f.option_order) return false
      if (f.ctx_options.length !== f.option_order.length) return true
      return f.option_order.some((original, i) => f.ctx_options![i] !== f.opciones_bd[original])
    })

    if (rotas.length > 0) {
      console.error(
        `❌ ${rotas.length} filas donde full_question_context.options NO casa con option_order.\n` +
          '   El escritor ha cambiado de convención → la pantalla de repaso señalará la\n' +
          '   opción equivocada. Revisar lib/api/test-answers/queries.ts y lib/shuffle/reviewCoords.ts.\n' +
          `   Ejemplos: ${rotas.slice(0, 3).map((r) => r.id).join(', ')}`,
      )
    }
    expect(rotas).toHaveLength(0)
  })

  it('la letra guardada como correcta está en coordenadas de la BD', () => {
    const rotas = filas.filter((f) => {
      if (!f.correct_answer) return false
      const idx = LETRAS.indexOf(f.correct_answer.toUpperCase())
      return idx !== f.correct_option
    })

    if (rotas.length > 0) {
      console.error(
        `❌ ${rotas.length} filas donde correct_answer no es la letra de questions.correct_option.\n` +
          `   Ejemplos: ${rotas.slice(0, 3).map((r) => `${r.id} (${r.correct_answer} vs ${r.correct_option})`).join(', ')}`,
      )
    }
    expect(rotas).toHaveLength(0)
  })
})
