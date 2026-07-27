/**
 * @jest-environment node
 */
// Guardarraíl anti-"timestamp sin zona": trinquete sobre db/schema.ts.
//
// ## Por qué existe (T-103, 26/07/2026)
//
// `user_feedback.created_at` es `timestamp WITHOUT time zone` mientras que
// `user_profiles.created_at` (y otras 464 columnas) son `timestamptz`. Comparar
// las dos produce un desfase FANTASMA de ~2h (el offset CEST), y ese desfase se
// diagnosticó como un bug de datos: la ficha T-103 sostenía que
// `user_profiles.created_at` "se reseteaba" y que había "bajas fantasma"
// anteriores al alta. **No era cierto.** Medido con `to_char` (sin conversiones
// del driver), el perfil se crea 2-3 min ANTES de la solicitud de baja — el
// orden normal. Solo interpretando el valor naive como hora de Madrid salían los
// "−117,9 min" que dispararon una investigación forense entera.
//
// Coste real del defecto: una sesión persiguiendo un write que no existe.
//
// ## Qué vigila
//
// Que NO aparezcan columnas `timestamp` nuevas sin `withTimezone: true`. Las 13
// que ya existen están congeladas abajo: son deuda conocida, no permiso. Si
// arreglas una (migrándola a `timestamptz`), quita su entrada y el test vuelve a
// verde — la lista solo puede MENGUAR.
//
// No toca BD: lee el schema de Drizzle, que es la fuente de verdad del proyecto
// (`db/schema.ts`, regenerable con `npx drizzle-kit introspect`).

import { readFileSync } from 'fs'
import { join } from 'path'

const SCHEMA = readFileSync(join(process.cwd(), 'db', 'schema.ts'), 'utf8')

/** Columnas `timestamp(...)` SIN `withTimezone`, como "tabla.columna". */
function naiveTimestampColumns(src: string): string[] {
  const out: string[] = []
  let tabla: string | null = null
  for (const linea of src.split('\n')) {
    const t = linea.match(/pgTable\("([^"]+)"/)
    if (t) tabla = t[1]
    // `campo: timestamp("col", { ... })` — el nombre SQL puede omitirse si coincide
    const c = linea.match(/^\s*(\w+):\s*timestamp\((?:"([^"]+)")?/)
    if (c && tabla) {
      const col = c[2] || c[1]
      if (!/withTimezone:\s*true/.test(linea)) out.push(`${tabla}.${col}`)
    }
  }
  return out.sort()
}

// Deuda CONGELADA (verificada contra RDS: 13 naive de 478 el 26/07/2026 → **10** el 27/07, tras
// pagar las 3 de `user_feedback` en T-167). Migrar a timestamptz interpretando el valor como UTC
// —el servidor corre en UTC y estas columnas tienen `DEFAULT now()`, así que el naive YA es hora
// UTC; comprobado midiendo contra una tabla timestamptz antes de convertir:
//   ALTER TABLE x ALTER COLUMN y TYPE timestamptz USING y AT TIME ZONE 'UTC';
// Receta completa (simulación con ROLLBACK incluida) en
// supabase/migrations/20260727_user_feedback_timestamptz.sql.
const DEUDA_CONOCIDA = [
  'laws.change_detected_at',
  'laws.last_checked',
  'laws.reviewed_at',
  'problematic_questions_tracking.created_at',
  'problematic_questions_tracking.detected_at',
  'problematic_questions_tracking.resolved_at',
  'pwa_events.created_at',
  'pwa_sessions.session_end',
  'pwa_sessions.session_start',
  'trigger_logs.trigger_time',
  // PAGADAS 27/07 (T-167): user_feedback.{created_at,updated_at,resolved_at}. Eran las 3 que
  // causaron el falso diagnóstico de T-103 y, un día después, el de un `account_deletion` que
  // parecía anterior al registro del propio usuario. Ya son timestamptz.
].sort()

describe('guardarraíl — timestamps sin zona horaria (trinquete)', () => {
  const naive = naiveTimestampColumns(SCHEMA)

  it('la extracción funciona (el schema tiene timestamps y se parsean)', () => {
    expect(SCHEMA).toContain('pgTable')
    expect(naive.length).toBeGreaterThan(0)
  })

  it('NO hay columnas timestamp sin zona nuevas', () => {
    const nuevas = naive.filter((c) => !DEUDA_CONOCIDA.includes(c))
    // Una columna nueva sin `withTimezone: true` volverá a producir el desfase
    // fantasma de ~2h en cuanto alguien la compare con una timestamptz.
    expect(nuevas).toEqual([])
  })

  it('la lista de deuda no miente (todas sus entradas siguen existiendo)', () => {
    // Si arreglaste una columna, quítala de DEUDA_CONOCIDA: la lista solo mengua.
    const fantasmas = DEUDA_CONOCIDA.filter((c) => !naive.includes(c))
    expect(fantasmas).toEqual([])
  })

  it('user_feedback NO puede volver a ser naive (el caso testigo, ya pagado)', () => {
    // Antes este test exigía lo contrario y decía "si falla es BUENA noticia: se
    // migró". Se migró el 27/07 (T-167), así que ahora el trinquete apunta al
    // otro lado: esta tabla es la que se cruza con `user_profiles` y
    // `user_interactions` en el triaje de bajas, y volver a naive reabriría los
    // dos falsos diagnósticos que ya costó (T-103 y el account_deletion del 27/07).
    expect(naive).not.toContain('user_feedback.created_at')
    expect(naive).not.toContain('user_feedback.updated_at')
    expect(naive).not.toContain('user_feedback.resolved_at')
  })
})
