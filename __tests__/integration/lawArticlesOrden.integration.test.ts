/**
 * @jest-environment node
 */
/**
 * El listado de artículos de una ley: ORDEN y forma. (T-327)
 *
 * ── POR QUÉ ESTO NO PUEDE SER UN UNITARIO ───────────────────────────────────────────────────
 *
 * Lo que se prueba es una consulta SQL, y el defecto que motivó el test **solo aparece con datos
 * reales**: al quitarle las letras a `DA1` queda `1`, así que con un `ORDER BY` ingenuo las
 * disposiciones se colaban entre el artículo 1 y el 2. Medido en la Constitución el 01/08/2026:
 *
 *     0 · 1 · DA1 · DT1 · 2 · DA2 …
 *
 * Quien busca el artículo 2 para meterlo en su temario no lo encuentra donde debe estar, y no hay
 * ningún error: la lista simplemente está mal ordenada. Con datos de mentira no sale, porque
 * nadie inventa un `DA1` al escribir un caso de prueba.
 *
 * Se lee, no se escribe.
 */
import { openTestClient } from '../helpers/db'
import type { Client } from 'pg'

const hayBd = !!process.env.DATABASE_URL
const d = hayBd ? describe : describe.skip

/** La misma consulta que sirve `/api/v2/laws/[lawId]/articles`. */
const SQL_ORDEN = `
  SELECT a.article_number,
         count(q.id) FILTER (WHERE q.is_active = true)::int AS question_count
    FROM articles a
    LEFT JOIN questions q ON q.primary_article_id = a.id
   WHERE a.law_id = $1::uuid AND a.is_active = true
   GROUP BY a.article_number
   ORDER BY (a.article_number ~ '^[0-9]+$') DESC,
            NULLIF(regexp_replace(a.article_number, '[^0-9]', '', 'g'), '')::int NULLS LAST,
            a.article_number
`

d('artículos de una ley — orden natural y disposiciones al final', () => {
  let c: Client
  let lawId: string

  beforeAll(async () => {
    c = await openTestClient()
    const { rows } = await c.query(
      `SELECT id FROM laws WHERE short_name = 'CE' AND is_active = true LIMIT 1`,
    )
    lawId = rows[0]?.id
  }, 30000)

  afterAll(async () => {
    await c?.end()
  })

  it('la ley de prueba existe y tiene artículos', async () => {
    expect(lawId).toBeTruthy()
    const { rows } = await c.query(SQL_ORDEN, [lawId])
    expect(rows.length).toBeGreaterThan(50)
  }, 30000)

  it('los artículos NUMÉRICOS van en orden natural: el 2 antes que el 10', async () => {
    const { rows } = await c.query(SQL_ORDEN, [lawId])
    const numericos = rows
      .map((r) => String(r.article_number))
      .filter((n) => /^[0-9]+$/.test(n))
      .map(Number)
    expect(numericos.length).toBeGreaterThan(10)
    // Estrictamente creciente: si estuvieran ordenados como texto, el 10 iría antes que el 2.
    for (let i = 1; i < numericos.length; i++) {
      expect(numericos[i]).toBeGreaterThan(numericos[i - 1])
    }
  }, 30000)

  it('NINGUNA disposición se cuela entre los artículos numerados', async () => {
    // El defecto exacto que motivó el test.
    const nums = (await c.query(SQL_ORDEN, [lawId])).rows.map((r) => String(r.article_number))
    const ultimoNumerico = nums.reduce(
      (acc, n, i) => (/^[0-9]+$/.test(n) ? i : acc),
      -1,
    )
    const colados = nums.slice(0, ultimoNumerico).filter((n) => !/^[0-9]+$/.test(n))
    expect(colados).toEqual([])
  }, 30000)

  it('cada artículo trae su conteo de preguntas (para poder desactivar los que sirven 0)', async () => {
    const { rows } = await c.query(SQL_ORDEN, [lawId])
    expect(rows.every((r) => Number.isInteger(Number(r.question_count)))).toBe(true)
    // Y al menos uno tiene preguntas: si TODOS salieran a 0, el conteo estaría roto.
    expect(rows.some((r) => Number(r.question_count) > 0)).toBe(true)
  }, 30000)

  it('no hay artículos repetidos en la lista', async () => {
    // Un repetido haría que el usuario añada dos veces el mismo artículo desde la pantalla.
    const nums = (await c.query(SQL_ORDEN, [lawId])).rows.map((r) => String(r.article_number))
    expect(new Set(nums).size).toBe(nums.length)
  }, 30000)
})
