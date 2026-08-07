import { readFileSync } from 'fs'
import { join } from 'path'

// ── Guardarraíl anti-drift del criterio `is_ok:false` (T-395, 07/08/2026) ─────────────────
//
// El criterio de completitud de leyes vive REPETIDO en CUATRO sitios (fuente única declarada:
// `lib/laws/completeness.ts`), y el propio módulo avisa: "mantener EN SYNC". El bug que motivó
// esta tarea fue exactamente eso — un `is_ok:false` (nota de incidencia del detector
// `audit_boe_url`, sin contadores de comparación) que ninguna de las cuatro copias miraba, así
// que 9 leyes con evidencia de que algo estaba mal se servían como `verified`.
//
// Este guardarraíl NO ejecuta los tres ficheros (health-sweep.cjs y
// audit-law-completeness.cjs corren su main()/IIFE sin guarda al hacer `require`, así que
// importarlos dispararía una conexión real a BD) — comprueba, por TEXTO, que las tres copias
// JS/TS declaran el mismo chequeo y en el mismo orden relativo. Mismo patrón que
// `content-sweep-parity.test.ts` usa para los `kind` del barrido.
//
// La vista SQL (`law_verification_effective`) la vigila
// `lawCompletenessConsistency.integration.test.ts` EJECUTÁNDOLA contra RDS de verdad — no hace
// falta un segundo guardarraíl de texto para esa, con uno que ejecuta ya alcanza.

const REPO = join(__dirname, '..', '..')
const TS_MODULE = readFileSync(join(REPO, 'lib/laws/completeness.ts'), 'utf8')
const HEALTH_SWEEP = readFileSync(join(REPO, 'scripts/health-sweep.cjs'), 'utf8')
const AUDIT_SCRIPT = readFileSync(join(REPO, 'scripts/audit-law-completeness.cjs'), 'utf8')

/** ¿el fichero comprueba `is_ok === false` (o el equivalente `!== true` inverso no vale: tiene
 *  que ser el chequeo explícito contra `false`, no "cualquier cosa que no sea true")? */
const CHECA_IS_OK_FALSE = /su\.is_ok\s*===\s*false/

describe('completitud de leyes — is_ok:false no puede volver a colarse como verified (T-395)', () => {
  it('el módulo TS (fuente única) comprueba is_ok === false', () => {
    expect(TS_MODULE).toMatch(CHECA_IS_OK_FALSE)
  })

  it('el mirror de health-sweep.cjs comprueba is_ok === false', () => {
    expect(HEALTH_SWEEP).toMatch(CHECA_IS_OK_FALSE)
  })

  it('el mirror de audit-law-completeness.cjs comprueba is_ok === false', () => {
    expect(AUDIT_SCRIPT).toMatch(CHECA_IS_OK_FALSE)
  })

  it('la migración SQL de la vista comprueba is_ok IS FALSE', () => {
    const migracion = readFileSync(
      join(REPO, 'supabase/migrations/20260807_law_verification_effective_is_ok.sql'),
      'utf8',
    )
    expect(migracion).toMatch(/'is_ok'\)::boolean\)\s*IS FALSE/)
  })

  // El orden importa: is_ok:false tiene que mirarse DESPUÉS de missing_in_db/content_mismatch/
  // title_mismatch (para que RGGIT, que trae is_ok:false PERO también missing_in_db>0, siga
  // saliendo 'incomplete' — más específico — y no 'never_verified'), y DESPUÉS de las
  // exenciones legítimas (no_consolidated_text/historical/deliberate_subset), para que esas
  // sigan mandando. Comprobado también con datos reales en completeness.test.ts.
  for (const [nombre, texto] of [
    ['módulo TS', TS_MODULE],
    ['health-sweep.cjs', HEALTH_SWEEP],
    ['audit-law-completeness.cjs', AUDIT_SCRIPT],
  ] as const) {
    it(`${nombre}: is_ok:false se mira DESPUÉS de missing_in_db (RGGIT no debe cambiar)`, () => {
      const iMissing = texto.indexOf('missing_in_db')
      const iIsOk = texto.search(CHECA_IS_OK_FALSE)
      expect(iMissing).toBeGreaterThan(-1)
      expect(iIsOk).toBeGreaterThan(-1)
      expect(iIsOk).toBeGreaterThan(iMissing)
    })

    it(`${nombre}: is_ok:false se mira DESPUÉS de las exenciones legítimas (deliberate_subset no debe cambiar)`, () => {
      const iExencion = texto.indexOf('deliberate_subset')
      const iIsOk = texto.search(CHECA_IS_OK_FALSE)
      expect(iExencion).toBeGreaterThan(-1)
      expect(iIsOk).toBeGreaterThan(-1)
      expect(iIsOk).toBeGreaterThan(iExencion)
    })
  }
})
