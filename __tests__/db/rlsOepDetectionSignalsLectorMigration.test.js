/**
 * @jest-environment node
 */
// T-237. `oep_detection_signals` tiene RLS activo y CERO políticas: el GRANT SELECT de tabla que
// ya tiene `vence_lector` (20260805_rol_lector_flota.sql) no basta — el motor filtra en silencio
// y devuelve 0 filas siempre, aunque el sensor `llm_semantic` escriba en ella (mismo mecanismo
// que `test_questions`/`tests` en T-573, `ai_verification_results` en T-038,
// `convocatoria_seguimiento_checks` en T-220, ver __tests__/db/rlsSelectBlocked.test.js). Este
// test solo comprueba la FORMA del fichero de migración: que exista, sea idempotente y no se
// cuele un alcance mayor del decidido.
const fs = require('fs')
const path = require('path')

const MIGRATION_PATH = path.join(
  __dirname,
  '../../supabase/migrations/20260806_rls_oep_detection_signals_lector.sql',
)

describe('migración RLS oep_detection_signals para vence_lector', () => {
  const sql = fs.readFileSync(MIGRATION_PATH, 'utf8')

  it('crea la política de SELECT en oep_detection_signals', () => {
    expect(sql).toMatch(
      /CREATE POLICY flota_lector_lee\s+ON public\.oep_detection_signals\s+FOR SELECT TO vence_lector USING \(true\)/,
    )
  })

  it('es idempotente: DROP POLICY IF EXISTS antes de crearla', () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS flota_lector_lee ON public\.oep_detection_signals/)
  })

  it('NO concede el acceso a vence_coordinacion — ese rol se queda en sus tablas de coordinación', () => {
    expect(sql).not.toMatch(/TO\s+vence_lector\s*,\s*vence_coordinacion/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\s*,\s*vence_lector/)
    expect(sql).not.toMatch(/TO\s+vence_coordinacion\b/)
  })

  it('no toca ninguna otra tabla fuera de oep_detection_signals (no ampliar sin medir)', () => {
    const tablas = [...sql.matchAll(/ON public\.(\w+)/g)].map((m) => m[1])
    expect(new Set(tablas)).toEqual(new Set(['oep_detection_signals']))
  })

  it('solo concede SELECT — nunca INSERT/UPDATE/DELETE (un rol "lector" no escribe)', () => {
    expect(sql).not.toMatch(/FOR\s+(INSERT|UPDATE|DELETE)/)
  })
})
