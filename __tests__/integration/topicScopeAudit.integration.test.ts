/**
 * @jest-environment node
 */
// __tests__/integration/topicScopeAudit.integration.test.ts
//
// Auditoría de `topic_scope` (T-222, migración 20260728_topic_scope_history.sql).
//
// ## Qué protege
//
// `topic_scope` decide QUÉ ENTRA EN CADA TEMA. Tenía 31 escritores y cero rastro de quién
// cambiaba el temario. El caso que lo destapó: el Decreto 53/1989 del Tema 9 de
// `auxiliar_administrativo_sms` con sus 32 artículos cuando el epígrafe pide los Capítulos
// II y III (arts. 5-25) — y nadie podía saber quién los puso.
//
// El trigger es la ÚNICA garantía: si dependiera de que cada uno de los 31 escritores se
// acuerde de escribir su fila, la auditoría nacería incompleta. Por eso lo que se verifica
// aquí es que **el registro ocurre sin colaboración del escritor**.
//
// ## Cómo corre
//
// Todo dentro de una TRANSACCIÓN que termina en ROLLBACK: ejercita el trigger contra el
// motor real (un trigger no se puede testear con mocks) sin dejar rastro. Aun así va
// detrás de INTEGRATION_DB_WRITABLE=1, como el resto de tests que escriben.
//
//   INTEGRATION_DB_WRITABLE=1 npx jest __tests__/integration/topicScopeAudit
//
// Un caso concreto merece explicación: `changed_at` usa `clock_timestamp()` y NO `now()`.
// `now()` es la hora de la TRANSACCIÓN, así que varios cambios en una misma tx —lo normal
// en `verify:scope apply`— saldrían con el mismo instante y el historial no se podría
// ordenar. Lo cazó este test antes de que la migración llegara a producción.

import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const postgres = require('postgres')

const DB_URL = process.env.DATABASE_URL
const canRun = !!DB_URL && process.env.INTEGRATION_DB_WRITABLE === '1'
const MIGRATION = path.join(process.cwd(), 'supabase/migrations/20260728_topic_scope_history.sql')

const describeIntegration = canRun ? describe : describe.skip

describeIntegration('auditoría de topic_scope (trigger real, TX con rollback)', () => {
  jest.setTimeout(120000)
  let sql: any

  beforeAll(() => {
    sql = postgres(DB_URL, { ssl: { rejectUnauthorized: false }, max: 1, connect_timeout: 20, onnotice: () => {} })
  })
  afterAll(async () => { if (sql) await sql.end({ timeout: 5 }) })

  /**
   * Corre `fn` en una transacción con la migración ya aplicada, y siempre revierte.
   * Que el rollback sea incondicional es lo que permite escribir sobre filas REALES.
   */
  async function enTxRevertida(fn: (t: any) => Promise<void>) {
    const mig = fs.readFileSync(MIGRATION, 'utf8')
    const SENTINEL = '__ROLLBACK_OK__'
    try {
      await sql.begin(async (t: any) => {
        await t.unsafe(mig)
        await fn(t)
        throw new Error(SENTINEL)
      })
    } catch (e: any) {
      if (e.message !== SENTINEL) throw e
    }
  }

  async function filaDePrueba(t: any) {
    const [row] = await t`
      SELECT ts.id, ts.topic_id, ts.article_numbers
      FROM topic_scope ts
      JOIN topics tp ON tp.id = ts.topic_id
      WHERE tp.position_type = 'auxiliar_administrativo_sms'
        AND ts.article_numbers IS NOT NULL
      LIMIT 1`
    return row
  }

  it('registra el ANTES y el DESPUÉS de un cambio de temario, con actor y motivo', async () => {
    await enTxRevertida(async (t) => {
      const row = await filaDePrueba(t)
      await t`SELECT set_config('app.actor', 'test-suite', true)`
      await t`SELECT set_config('app.change_reason', 'prueba de integración', true)`
      await t`UPDATE topic_scope SET article_numbers = ARRAY['5','6'] WHERE id = ${row.id}`

      const h = await t`SELECT * FROM topic_scope_history WHERE topic_id = ${row.topic_id}`
      expect(h).toHaveLength(1)
      expect(h[0].operation).toBe('UPDATE')
      expect(h[0].articles_before).toEqual(row.article_numbers)
      expect(h[0].articles_after).toEqual(['5', '6'])
      expect(h[0].delta_count).toBe(2 - row.article_numbers.length)
      expect(h[0].changed_by).toBe('test-suite')
      expect(h[0].change_reason).toBe('prueba de integración')
    })
  })

  it('NO ensucia el historial cuando el escritor reescribe el mismo valor', async () => {
    // Varios scripts del repo son idempotentes y reescriben el scope tal cual. Si cada
    // pasada dejara una fila, el historial se volvería inservible justo cuando hay que
    // buscar en él el cambio que rompió algo.
    await enTxRevertida(async (t) => {
      const row = await filaDePrueba(t)
      await t`UPDATE topic_scope SET article_numbers = ${row.article_numbers} WHERE id = ${row.id}`
      const [c] = await t`SELECT count(*)::int c FROM topic_scope_history WHERE topic_id = ${row.topic_id}`
      expect(c.c).toBe(0)

      // …pero pasar a "ley entera" (NULL) SÍ es un cambio de temario, y solo una vez.
      await t`UPDATE topic_scope SET article_numbers = NULL WHERE id = ${row.id}`
      await t`UPDATE topic_scope SET article_numbers = NULL WHERE id = ${row.id}`
      const [c2] = await t`SELECT count(*)::int c FROM topic_scope_history WHERE topic_id = ${row.topic_id}`
      expect(c2.c).toBe(1)
    })
  })

  it('deja el hueco VISIBLE cuando el escritor no se identifica', async () => {
    // Que salga NULL no es un fallo: es la señal de que ese camino aún no se identifica,
    // y permite medir cuánto queda por drenar. Preferimos eso a fingir trazabilidad.
    await enTxRevertida(async (t) => {
      const row = await filaDePrueba(t)
      await t`UPDATE topic_scope SET article_numbers = ARRAY['7'] WHERE id = ${row.id}`
      const [h] = await t`SELECT changed_by, change_reason FROM topic_scope_history WHERE topic_id = ${row.topic_id}`
      expect(h.changed_by).toBeNull()
      expect(h.change_reason).toBeNull()
    })
  })

  it('ordena los eventos aunque ocurran en la MISMA transacción', async () => {
    // Regresión: con `now()` los tres cambios salían con el mismo timestamp.
    await enTxRevertida(async (t) => {
      const row = await filaDePrueba(t)
      await t`UPDATE topic_scope SET article_numbers = ARRAY['1'] WHERE id = ${row.id}`
      await t`UPDATE topic_scope SET article_numbers = ARRAY['2'] WHERE id = ${row.id}`
      await t`UPDATE topic_scope SET article_numbers = ARRAY['3'] WHERE id = ${row.id}`

      const [d] = await t`SELECT count(DISTINCT changed_at)::int c FROM topic_scope_history WHERE topic_id = ${row.topic_id}`
      expect(d.c).toBe(3)
      const [ultimo] = await t`
        SELECT articles_after FROM topic_scope_history
        WHERE topic_id = ${row.topic_id} ORDER BY changed_at DESC LIMIT 1`
      expect(ultimo.articles_after).toEqual(['3'])
    })
  })

  it('registra el borrado de una fila de scope y el alta de una nueva', async () => {
    await enTxRevertida(async (t) => {
      const row = await filaDePrueba(t)
      await t`DELETE FROM topic_scope WHERE id = ${row.id}`
      const [del] = await t`
        SELECT operation, articles_before, articles_after FROM topic_scope_history
        WHERE topic_id = ${row.topic_id} ORDER BY changed_at DESC LIMIT 1`
      expect(del.operation).toBe('DELETE')
      expect(del.articles_before).toEqual(row.article_numbers)
      expect(del.articles_after).toBeNull()

      await t`INSERT INTO topic_scope (topic_id, law_id, article_numbers)
              SELECT ${row.topic_id}, l.id, ARRAY['1','2'] FROM laws l LIMIT 1`
      const [ins] = await t`
        SELECT operation, articles_before, delta_count FROM topic_scope_history
        WHERE topic_id = ${row.topic_id} ORDER BY changed_at DESC LIMIT 1`
      expect(ins.operation).toBe('INSERT')
      expect(ins.articles_before).toBeNull()
      expect(ins.delta_count).toBe(2)
    })
  })

  it('convive con los triggers que ya vigilaban la tabla', async () => {
    // `trg_topic_scope_invalidate_verif` (invalida la verificación del tema) y
    // `tg_topic_scope_enqueue_pdf` (regenera el PDF) son de otras funcionalidades:
    // si esta migración pisara uno, el temario se serviría desactualizado en silencio.
    await enTxRevertida(async (t) => {
      const tg = await t`
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'public.topic_scope'::regclass AND NOT tgisinternal`
      const nombres = tg.map((x: any) => x.tgname).sort()
      expect(nombres).toContain('tg_topic_scope_audit')
      expect(nombres).toContain('tg_topic_scope_enqueue_pdf')
      expect(nombres).toContain('trg_topic_scope_invalidate_verif')
    })
  })
})
