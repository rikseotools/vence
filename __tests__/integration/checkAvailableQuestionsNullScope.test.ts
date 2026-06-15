/** @jest-environment node */
// __tests__/integration/checkAvailableQuestionsNullScope.test.ts
//
// Test de integración del CÓDIGO REAL (no del invariante SQL): ejercita
// checkAvailableQuestions() — la función que alimenta el feature "mezclar temas"
// (random-test/availability) — contra un tema con `topic_scope.article_numbers
// = NULL` ("toda la ley"). Antes del fix devolvía 0 ("no hay datos suficientes",
// feedback Rosa CARM 2026-06-15) porque reimplementaba el scope con `= ANY` suelto.
//
// Caso: policia_nacional T4 "La Unión Europea" (scope NULL sobre una ley con
// cientos de preguntas). Debe devolver > 0.
//
// CI-safe: se salta si no hay DATABASE_URL.

import dotenv from 'dotenv'
import { Client } from 'pg'
import {
  checkAvailableQuestions,
  invalidateAvailabilityCache,
} from '@/lib/api/random-test-data/queries'
import { getThemeIdFromTopicNumber } from '@/lib/api/random-test-data/schemas'
import type { OposicionKey } from '@/lib/api/random-test-data/schemas'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

// Tema 100% NULL (todas sus filas de topic_scope con article_numbers NULL):
// tcae_murcia T8 "Atención primaria y actividades del TCAE" (1 fila NULL, ~816
// preguntas). Es el caso puro donde el `= ANY` suelto servía 0.
// checkAvailableQuestions recibe el SLUG (key de SLUG_TO_POSITION_TYPE); el SQL
// de contraste usa el position_type.
const OPOSICION_SLUG = 'tcae-murcia'
const POSITION_TYPE = 'tcae_murcia'
const TOPIC_NUMBER = 8

describeIfDb('checkAvailableQuestions honra article_numbers NULL (toda la ley)', () => {
  it('devuelve > 0 para un tema con scope NULL (código real)', async () => {
    invalidateAvailabilityCache()
    const themeId = getThemeIdFromTopicNumber(TOPIC_NUMBER, OPOSICION_SLUG)
    const res = await checkAvailableQuestions(OPOSICION_SLUG as OposicionKey, [themeId])

    expect(res.success).toBe(true)
    expect(res.availableQuestions).toBeGreaterThan(0)
  }, 30000)

  it('la condición vieja (= ANY suelto, sin guarda NULL) habría dado 0 — confirma que el fix es lo que rescata', async () => {
    const client = new Client({ connectionString: DB_URL })
    await client.connect()
    try {
      const q = (nullSafe: boolean) =>
        client.query<{ n: string }>(
          `
          SELECT count(DISTINCT q.id)::text AS n
          FROM topics t
          JOIN topic_scope ts ON ts.topic_id = t.id
          JOIN articles a ON a.law_id = ts.law_id
           AND (${nullSafe ? 'ts.article_numbers IS NULL OR ' : ''} a.article_number = ANY(ts.article_numbers))
          JOIN questions q ON q.primary_article_id = a.id AND q.is_active = true
          WHERE t.position_type = $1 AND t.topic_number = $2 AND t.is_active = true
        `,
          [POSITION_TYPE, TOPIC_NUMBER],
        )

      const buggy = Number((await q(false)).rows[0].n)
      const fixed = Number((await q(true)).rows[0].n)

      expect(buggy).toBe(0) // el `= ANY(NULL)` suelto servía 0
      expect(fixed).toBeGreaterThan(0) // la guarda NULL rescata toda la ley
    } finally {
      await client.end()
    }
  }, 30000)
})
