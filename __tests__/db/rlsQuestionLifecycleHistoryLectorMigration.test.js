/**
 * @jest-environment node
 */
// T-638. `question_lifecycle_history` tiene RLS activo y CERO políticas: el GRANT SELECT de
// tabla que ya tiene `vence_lector` (20260805_rol_lector_flota.sql) no basta — el motor filtra
// en silencio y devuelve 0 filas siempre (mismo mecanismo que `question_disputes` en T-574 y
// `test_questions`/`tests` en T-573, ver __tests__/db/rlsSelectBlocked.test.js). Este test solo
// comprueba la FORMA del fichero de migración: que exista, sea idempotente y no se cuele un
// alcance mayor del decidido — mismo patrón que rlsTestQuestionsLectorMigration.test.js.
const fs = require('fs')
const path = require('path')

const MIGRATION_PATH = path.join(
  __dirname,
  '../../supabase/migrations/20260807_rls_question_lifecycle_history_lector.sql'
)

describe('migración RLS question_lifecycle_history para vence_lector', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')

  it('crea la política de SELECT en la tabla que el trabajo real necesita', () => {
    expect(sql).toMatch(/CREATE POLICY flota_lector_lee ON public\.question_lifecycle_history\s*\n?\s*FOR SELECT TO vence_lector USING \(true\)/)
  })

  it('es idempotente: DROP POLICY IF EXISTS antes de crearla', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS flota_lector_lee ON public\.question_lifecycle_history/)
  })

  it('NO concede el acceso a vence_coordinacion — ese rol se queda en sus 4 tablas de coordinación', () => {
    expect(sql).not.toMatch(/TO\s+vence_lector\s*,\s*vence_coordinacion/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\s*,\s*vence_lector/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\b/)
  })

  it('solo concede SELECT — nunca INSERT/UPDATE/DELETE (un rol "lector" no escribe)', () => {
    expect(sql).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/)
  })

  it('comprueba que el GRANT de tabla exista antes de dar la política por útil', () => {
    expect(sql).toMatch(/information_schema\.role_table_grants/)
    expect(sql).toMatch(/table_name = 'question_lifecycle_history'/)
    expect(sql).toMatch(/RAISE EXCEPTION/)
  })
})

describe('canary-rol-lector.cjs declara question_lifecycle_history en DEBE_LEER', () => {
  const canary = fs.readFileSync(
    path.join(__dirname, '../../scripts/canary-rol-lector.cjs'),
    'utf8'
  )

  it('está en la lista de lo que el trabajo real necesita leer', () => {
    expect(canary).toMatch(/\['question_lifecycle_history',/)
  })
})
