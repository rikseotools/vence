/** @jest-environment node */
// __tests__/integration/placeholderTemarioGuard.test.ts
//
// GUARDARRAÍL del problema sistémico "temario placeholder" (descubierto 10/06/2026
// al migrar policia_nacional T39 "Redes informáticas"): leyes VIRTUALES (contenedores
// de contenido) cuyos artículos están VACÍOS (placeholder, <120 caracteres) pero con
// preguntas activas colgando. Esas preguntas no tienen temario que las respalde.
//
// Inventario en el momento del descubrimiento: 51 leyes virtuales, ~17.504 preguntas
// activas sobre placeholders (Inglés PN 5071, Ciencias Sociales PN 1990, Correos ~9000…).
// Es un backlog grande (ver memoria project-placeholder-temario-backlog). NO se puede
// poner a 0 de golpe; cada ley necesita que se le ESCRIBA el temario en los artículos
// (como se hizo con "La Red Internet" para redes).
//
// Este test es un RATCHET: el nº de preguntas sobre placeholders solo puede BAJAR
// (a medida que se escribe temario), nunca subir. Si sube, alguien ha vuelto a colgar
// preguntas de un artículo vacío (la regresión que queremos cortar). Además, bloquea
// específicamente la regresión de la migración de redes ya hecha.
//
// CI-safe: se salta sin DATABASE_URL.

import { Client } from 'pg'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

// Baseline capturado el 2026-06-10 tras migrar redes. Bajar este número conforme se
// escriba temario para más leyes virtuales (Correos, Inglés PN, Ciencias Sociales PN…).
const BASELINE_PLACEHOLDER_QUESTIONS = 17504

describeIfDb('Guardarraíl: temario placeholder en leyes virtuales', () => {
  let client: Client
  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })
  afterAll(async () => {
    if (client) await client.end()
  })

  // Preguntas activas colgadas de artículos de leyes VIRTUALES con contenido placeholder
  // (<120 chars), excluyendo el "Artículo 0" (contenedor estructural, vacío por diseño).
  const countQuery = `
    SELECT count(q.id)::int AS n
    FROM questions q
    JOIN articles a ON a.id = q.primary_article_id
    JOIN laws l ON l.id = a.law_id
    WHERE q.is_active = true
      AND l.is_virtual = true
      AND length(a.content) < 120
      AND a.article_number <> '0'
  `

  it('el nº de preguntas sobre placeholders no crece (ratchet, solo puede bajar)', async () => {
    const { rows } = await client.query<{ n: number }>(countQuery)
    const actual = rows[0].n
    if (actual > BASELINE_PLACEHOLDER_QUESTIONS) {
      // listar las leyes que más aportan para el diagnóstico
      const { rows: top } = await client.query<{ short_name: string; nq: number }>(`
        SELECT l.short_name, count(q.id)::int AS nq
        FROM questions q JOIN articles a ON a.id = q.primary_article_id JOIN laws l ON l.id = a.law_id
        WHERE q.is_active = true AND l.is_virtual = true AND length(a.content) < 120 AND a.article_number <> '0'
        GROUP BY l.short_name ORDER BY nq DESC LIMIT 10
      `)
      const detalle = top.map((r) => `  ${r.short_name}: ${r.nq}`).join('\n')
      throw new Error(
        `Preguntas sobre placeholders subió a ${actual} (baseline ${BASELINE_PLACEHOLDER_QUESTIONS}). ` +
          `Alguien ha colgado preguntas de un artículo virtual VACÍO. Top:\n${detalle}\n` +
          `Si has migrado/añadido temario, BAJA el baseline; nunca lo subas para tapar esto.`,
      )
    }
    expect(actual).toBeLessThanOrEqual(BASELINE_PLACEHOLDER_QUESTIONS)
  }, 30000)

  it('regresión: "Redes Informáticas PN" sigue vacío (migrado a "La Red Internet")', async () => {
    const { rows } = await client.query<{ n: number }>(`
      SELECT count(q.id)::int AS n
      FROM questions q JOIN articles a ON a.id = q.primary_article_id JOIN laws l ON l.id = a.law_id
      WHERE q.is_active = true AND l.short_name = 'Redes Informáticas PN'
    `)
    expect(rows[0].n).toBe(0)
  }, 30000)

  it('policia_nacional T39 "Redes informáticas" sirve preguntas con contenido real', async () => {
    const { rows } = await client.query<{ n: number }>(`
      SELECT count(DISTINCT q.id)::int AS n
      FROM topics t
      JOIN topic_scope ts ON ts.topic_id = t.id
      JOIN articles a ON a.law_id = ts.law_id AND a.article_number = ANY(ts.article_numbers)
      JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
      WHERE t.position_type = 'policia_nacional' AND t.topic_number = 39
    `)
    expect(rows[0].n).toBeGreaterThan(100)
  }, 30000)
})
