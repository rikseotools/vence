/**
 * @jest-environment node
 */
// T-640. `convocatoria_seguimiento_checks` tiene RLS activo y CERO políticas para NINGÚN rol: el
// GRANT SELECT de tabla que `vence_lector` ya tiene (20260805_rol_lector_flota.sql) no basta — el
// motor filtra en silencio y devuelve 0 filas siempre, mismo mecanismo que `test_questions`/
// `tests` en T-573 (ver __tests__/db/rlsSelectBlocked.test.js). Este test solo comprueba la FORMA
// del fichero de migración: que exista, sea idempotente y no se cuele un alcance mayor del decidido.
const fs = require('fs')
const path = require('path')

const MIGRATION_PATH = path.join(
  __dirname,
  '../../supabase/migrations/20260807_rls_convocatoria_seguimiento_checks_lector.sql'
)

describe('migración RLS convocatoria_seguimiento_checks para vence_lector', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')

  it('crea la política de SELECT en convocatoria_seguimiento_checks', () => {
    expect(sql).toMatch(/CREATE POLICY flota_lector_lee ON public\.convocatoria_seguimiento_checks/)
    expect(sql).toMatch(/FOR SELECT TO vence_lector USING \(true\)/)
  })

  it('es idempotente: DROP POLICY IF EXISTS antes de crearla', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS flota_lector_lee ON public\.convocatoria_seguimiento_checks/)
  })

  it('NO concede el acceso a vence_coordinacion — ese rol se queda en sus tablas de coordinación', () => {
    expect(sql).not.toMatch(/TO\s+vence_lector\s*,\s*vence_coordinacion/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\s*,\s*vence_lector/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\b/)
  })

  it('no toca ninguna otra tabla fuera de convocatoria_seguimiento_checks (no ampliar sin medir)', () => {
    const matches = [...sql.matchAll(/CREATE POLICY flota_lector_lee ON public\.(\w+)/g)]
    expect(matches.map((m) => m[1])).toEqual(['convocatoria_seguimiento_checks'])
  })

  it('solo concede SELECT — nunca INSERT/UPDATE/DELETE (un rol "lector" no escribe)', () => {
    expect(sql).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/)
  })

  it('aborta si el GRANT de tabla no está — la política nunca es el único candado', () => {
    expect(sql).toMatch(/RAISE EXCEPTION/)
    expect(sql).toMatch(/role_table_grants/)
  })
})

describe('canary-rol-lector.cjs declara convocatoria_seguimiento_checks en DEBE_LEER', () => {
  const canary = fs.readFileSync(
    path.join(__dirname, '../../scripts/canary-rol-lector.cjs'),
    'utf8'
  )

  it('está en la lista de lo que el trabajo real necesita leer', () => {
    expect(canary).toMatch(/\['convocatoria_seguimiento_checks',/)
  })
})
