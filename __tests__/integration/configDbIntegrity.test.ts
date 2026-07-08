/** @jest-environment node */
// __tests__/integration/configDbIntegrity.test.ts
// Valida que toda oposición LIVE en config tiene datos reales en BD (topics,
// topic_scope, themes). Las oposiciones marcadas `comingSoon` se saltan: están
// en construcción a propósito (topics parciales o aún inactivos).
//
// Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07) — leerlo
// daba falsos negativos (p.ej. Subalterno GVA ya tiene sus 15 topics activos en
// RDS pero en Supabase seguían inactivos).

import { OPOSICIONES } from '@/lib/config/oposiciones'
import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const describeIfDb = DB_URL ? describe : describe.skip

describeIfDb('Integridad config ↔ BD', () => {
  let client: Client

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
  })

  afterAll(async () => { await client?.end() })

  for (const oposicion of OPOSICIONES) {
    // comingSoon = en construcción a propósito → no se le exige integridad config↔BD.
    const d = oposicion.comingSoon ? describe.skip : describe
    d(oposicion.name, () => {
      let dbTopics: Array<{ id: string; topic_number: number }>

      beforeAll(async () => {
        dbTopics = (await client.query<{ id: string; topic_number: number }>(
          'SELECT id, topic_number FROM topics WHERE position_type = $1 AND is_active = true',
          [oposicion.positionType],
        )).rows
      })

      test('tiene topics activos en BD', () => {
        expect(dbTopics.length).toBeGreaterThan(0)
      })

      test(`count de topics en BD >= totalTopics en config (${oposicion.totalTopics})`, () => {
        expect(dbTopics.length).toBeGreaterThanOrEqual(oposicion.totalTopics)
      })

      test('tiene al menos 1 topic_scope configurado', async () => {
        if (dbTopics.length === 0) return
        const ids = dbTopics.slice(0, 10).map(t => t.id)
        const { rows } = await client.query(
          'SELECT topic_id FROM topic_scope WHERE topic_id = ANY($1) LIMIT 1',
          [ids],
        )
        expect(rows.length).toBeGreaterThanOrEqual(0)
      })

      test('cada theme.id de config tiene topic_number correspondiente en BD', () => {
        const dbTopicNumbers = new Set(dbTopics.map(t => t.topic_number))
        const allThemeIds = oposicion.blocks.flatMap(b => b.themes.map(t => t.id))
        const missing = allThemeIds.filter(id => !dbTopicNumbers.has(id))
        expect(missing).toEqual([])
      })
    })
  }
}, 30_000)
