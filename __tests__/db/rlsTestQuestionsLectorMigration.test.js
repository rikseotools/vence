/**
 * @jest-environment node
 */
// T-573. `test_questions` y `tests` tienen RLS activo y CERO políticas: el GRANT SELECT de tabla
// que ya tiene `vence_lector` (20260805_rol_lector_flota.sql) no basta — el motor filtra en
// silencio y devuelve 0 filas siempre (mismo mecanismo que `question_disputes` en T-574, ver
// __tests__/db/rlsSelectBlocked.test.js). Este test solo comprueba la FORMA del fichero de
// migración: que exista, sea idempotente y no se cuele un alcance mayor del decidido.
const fs = require('fs')
const path = require('path')

const MIGRATION_PATH = path.join(
  __dirname,
  '../../supabase/migrations/20260805_rls_test_questions_lector.sql'
)

describe('migración RLS test_questions/tests para vence_lector', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')

  it('crea la política de SELECT en las dos tablas que el trabajo real necesita', () => {
    expect(sql).toMatch(/ARRAY\['test_questions', 'tests'\]/)
    expect(sql).toMatch(/CREATE POLICY flota_lector_lee ON public\.%I FOR SELECT TO vence_lector USING \(true\)/)
  })

  it('es idempotente: DROP POLICY IF EXISTS antes de crearla', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS flota_lector_lee ON public\.%I/)
  })

  it('NO concede el acceso a vence_coordinacion — ese rol se queda en sus 4 tablas de coordinación', () => {
    expect(sql).not.toMatch(/TO\s+vence_lector\s*,\s*vence_coordinacion/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\s*,\s*vence_lector/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\b/)
  })

  it('no se cuela ninguna otra tabla fuera de las dos decididas (no ampliar sin medir)', () => {
    const arrayMatch = sql.match(/ARRAY\[([^\]]+)\]/)
    expect(arrayMatch).not.toBeNull()
    const tablas = arrayMatch[1].split(',').map((t) => t.trim().replace(/'/g, ''))
    expect(tablas.sort()).toEqual(['test_questions', 'tests'])
  })

  it('solo concede SELECT — nunca INSERT/UPDATE/DELETE (un rol "lector" no escribe)', () => {
    expect(sql).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/)
  })
})
