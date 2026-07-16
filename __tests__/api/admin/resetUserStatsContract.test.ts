/**
 * Contrato de la función SQL reset_user_stats + del reseteo.
 *
 * Estos tests guardan las DOS invariantes que hacen que el reset sea correcto y
 * que no son evidentes leyendo el código:
 *
 *  1. ORDEN test_questions/tests → stats. Los triggers materializadores de
 *     test_questions tienen guard `EXISTS user_profiles`. En un reset el perfil
 *     SOBREVIVE (a diferencia del borrado RGPD), así que borrar las stats antes
 *     que test_questions las REPUEBLA y el reset se deshace solo. Invertir el
 *     orden del array es un bug silencioso: no falla, simplemente no resetea.
 *
 *  2. LISTA EXPLÍCITA, no barrido dinámico. delete_user_account() barre toda
 *     tabla con user_id porque su objetivo es "que no quede nada". Aquí el
 *     objetivo es "borrar SOLO las métricas": un barrido se llevaría el feedback,
 *     la atribución de marketing y las preferencias del usuario.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const sqlSrc = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260716_reset_user_stats_fn.sql'),
  'utf8'
)
const queriesSrc = readFileSync(
  join(process.cwd(), 'lib/api/admin-reset-user-stats/queries.ts'),
  'utf8'
)

// Los asserts de "NO uses X" deben mirar CÓDIGO, no comentarios: ambos ficheros
// documentan a propósito por qué NO usan information_schema / supabase.rpc, y un
// grep ingenuo sobre el fichero entero se dispara con esa misma explicación.
const stripSqlComments = (s: string) => s.replace(/--.*$/gm, '')
const stripTsComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')

const sqlCode = stripSqlComments(sqlSrc)
const queriesCode = stripTsComments(queriesSrc)

describe('reset_user_stats — orden de borrado (triggers repueblan)', () => {
  test('test_questions y tests van en las tablas FUENTE, antes que las stats', () => {
    const idxSource = sqlSrc.indexOf('c_source_tables')
    const idxStats = sqlSrc.indexOf('c_stats_tables')
    expect(idxSource).toBeGreaterThan(-1)
    expect(idxStats).toBeGreaterThan(-1)
    expect(idxSource).toBeLessThan(idxStats)
  })

  test('el array de borrado concatena fuentes ANTES que stats', () => {
    expect(sqlSrc).toMatch(/v_all_tables\s*:=\s*c_source_tables\s*\|\|\s*c_stats_tables/)
  })

  test('test_questions se borra antes que tests (FK)', () => {
    const m = sqlSrc.match(/c_source_tables\s+text\[\]\s*:=\s*ARRAY\[([^\]]+)\]/)
    expect(m).toBeTruthy()
    const arr = m![1]
    expect(arr.indexOf('test_questions')).toBeLessThan(arr.indexOf("'tests'"))
  })

  // Bug real cazado al ejecutar el primer reset (Ja Fe, 16/07): sin esto, el
  // trigger tg_test_questions_emit_outbox encola un evento por fila borrada y el
  // outbox-processor (asíncrono, otro proceso) los replica DESPUÉS del commit,
  // reescribiendo las stats recién borradas. La transacción NO protege de ello.
  test('purga test_questions_outbox, y DESPUÉS de borrar test_questions', () => {
    const m = sqlSrc.match(/c_source_tables\s+text\[\]\s*:=\s*ARRAY\[([^\]]+)\]/)
    const arr = m![1]
    expect(arr).toContain('test_questions_outbox')
    // el purgado debe ir después: los eventos los encola el propio DELETE
    expect(arr.indexOf("'test_questions'")).toBeLessThan(arr.indexOf('test_questions_outbox'))
  })
})

describe('reset_user_stats — alcance', () => {
  const statsBlock = sqlSrc.match(/c_stats_tables\s+text\[\]\s*:=\s*ARRAY\[([\s\S]*?)\]/)![1]

  test('incluye user_article_stats (la razón de existir: el mapa de debilidades)', () => {
    expect(statsBlock).toContain('user_article_stats')
  })

  test('NO toca tablas que deben sobrevivir al reset', () => {
    // La cuenta, su feedback, la atribución de marketing y los pagos NO son
    // métricas de estudio. Si alguna aparece aquí, el reset se ha convertido en
    // otra cosa.
    for (const forbidden of [
      'user_profiles',
      'user_feedback',
      'feedback_messages',
      'user_acquisition',
      'payment_settlements',
      'user_subscriptions',
    ]) {
      expect(sqlSrc).not.toMatch(new RegExp(`DELETE FROM public\\.${forbidden}\\b`))
      expect(statsBlock).not.toContain(forbidden)
    }
  })

  test('la analítica de journey queda FUERA por defecto', () => {
    expect(sqlSrc).toMatch(/p_include_analytics\s+boolean\s+DEFAULT\s+false/)
    expect(sqlSrc).toMatch(/c_analytics_tables[\s\S]*?user_interactions[\s\S]*?user_sessions/)
    // solo se añaden bajo el flag
    expect(sqlSrc).toMatch(/IF\s+p_include_analytics\s+THEN[\s\S]*?c_analytics_tables/)
  })

  test('NO hace barrido dinámico por information_schema (eso es del borrado RGPD)', () => {
    expect(sqlCode).not.toMatch(/information_schema/i)
  })
})

describe('reset_user_stats — seguridad y marcha atrás', () => {
  test('exige que el usuario exista (un userId inventado NO es un éxito de 0 filas)', () => {
    expect(sqlSrc).toMatch(/IF\s+NOT\s+FOUND\s+THEN[\s\S]*?RAISE\s+EXCEPTION/)
    expect(sqlSrc).toMatch(/no_data_found/)
  })

  test('exige requested_by y reason (audit trail)', () => {
    expect(sqlSrc).toMatch(/requested_by\s+text\s+NOT\s+NULL/)
    expect(sqlSrc).toMatch(/reason\s+text\s+NOT\s+NULL/)
    expect(sqlSrc).toMatch(/RAISE\s+EXCEPTION\s+'reset_user_stats: requested_by y reason/)
  })

  test('hace snapshot ANTES de borrar (deshacer un reset por error)', () => {
    const idxSnapshot = sqlSrc.indexOf('Snapshot ANTES de borrar')
    const idxDelete = sqlSrc.indexOf('DELETE FROM public.%I')
    expect(idxSnapshot).toBeGreaterThan(-1)
    expect(idxSnapshot).toBeLessThan(idxDelete)
    expect(sqlSrc).toMatch(/INSERT INTO public\.user_stats_resets/)
  })

  test('el snapshot guarda la fila entera (to_jsonb(t.*)), no columnas listadas', () => {
    // Sobrevive a futuros ALTER TABLE sin mantenimiento.
    expect(sqlSrc).toMatch(/to_jsonb\(t\.\*\)/)
  })
})

describe('reset_user_stats — capa de app', () => {
  test('se invoca por Drizzle, nunca por supabase.rpc (agnosticismo)', () => {
    expect(queriesCode).toMatch(/getAdminDb\(\)\.execute\(/)
    expect(queriesCode).not.toMatch(/supabase\.rpc/)
  })

  test('_reset_id no se cuela como si fuera una tabla en deletedCounts', () => {
    expect(queriesCode).toMatch(/if\s*\(key === '_reset_id'\)\s*continue/)
  })
})
