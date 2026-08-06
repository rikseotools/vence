/**
 * @jest-environment node
 */
// T-450. `daily_question_usage` tiene RLS activo y CERO políticas: el GRANT SELECT de tabla que
// ya tiene `vence_lector` (20260805_rol_lector_flota.sql) no basta — el motor filtra en silencio
// y devuelve 0 filas siempre. Es el mismo mecanismo que `test_questions`/`tests` en T-573 (ver
// __tests__/db/rlsTestQuestionsLectorMigration.test.js), pero T-573 se acotó a esas dos tablas a
// propósito y no cubrió ésta. Este test solo comprueba la FORMA del fichero de migración: que
// exista, sea idempotente y no se cuele un alcance mayor del decidido.
const fs = require('fs')
const path = require('path')

const MIGRATION_PATH = path.join(
  __dirname,
  '../../supabase/migrations/20260806_rls_daily_question_usage_lector.sql'
)

describe('migración RLS daily_question_usage para vence_lector', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')

  it('crea la política de SELECT en daily_question_usage', () => {
    expect(sql).toMatch(/CREATE POLICY flota_lector_lee ON public\.daily_question_usage FOR SELECT TO vence_lector USING \(true\)/)
  })

  it('es idempotente: DROP POLICY IF EXISTS antes de crearla', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS flota_lector_lee ON public\.daily_question_usage/)
  })

  it('NO concede el acceso a vence_coordinacion — ese rol se queda en sus 4 tablas de coordinación', () => {
    expect(sql).not.toMatch(/TO\s+vence_lector\s*,\s*vence_coordinacion/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\s*,\s*vence_lector/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\b/)
  })

  it('no toca ninguna otra tabla fuera de daily_question_usage (no ampliar sin medir)', () => {
    const tablas = [...sql.matchAll(/ON public\.(\w+)/g)].map((m) => m[1])
    expect(new Set(tablas)).toEqual(new Set(['daily_question_usage']))
  })

  it('solo concede SELECT — nunca INSERT/UPDATE/DELETE (un rol "lector" no escribe)', () => {
    expect(sql).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/)
  })

  it('exige el GRANT de tabla antes de fiarse de la política (guarda anti-orfandad)', () => {
    expect(sql).toMatch(/RAISE EXCEPTION/)
    expect(sql).toMatch(/privilege_type = 'SELECT'/)
  })
})
