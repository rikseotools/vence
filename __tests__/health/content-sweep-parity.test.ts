import fs from 'fs'
import path from 'path'
import { RUNBOOK_BY_KIND } from '../../lib/admin/runbookRegistry'

// ── Guardarraíl anti-DRIFT del sweep de salud ──────────────────────────────────
// El sweep de contenido vive DUPLICADO a mano en dos ficheros que DEBEN emitir los
// mismos `kind`s (misma detección):
//   - backend/src/content-health-sweep/content-health-sweep.service.ts  → @Cron 03:00
//     UTC, el writer PROGRAMADO real de content_health_findings.
//   - scripts/health-sweep.cjs  → gemelo CLI (DRY/manual), "MANTENER EN SYNC".
//
// El 22/07 se descubrió que el backend @Cron iba 8 detectores por detrás del script
// (article_no_coverage, convocatoria_timeline_*, scope_over_inclusion_suspect,
// scope_phantom_article, texto_examen_pasado, hito_vencido_abierto, seguimiento_url_stale)
// → el @Cron escribía un snapshot INCOMPLETO cada noche y el panel perdía detectores
// EN SILENCIO. Este test falla si los dos ficheros vuelven a divergir en su set de kinds.
//
// Universo de kinds = claves de RUNBOOK_BY_KIND (fuente fiable; el guardarraíl de
// runbookRegistry ya garantiza que todo finding tiene entrada). Los kinds que NO son del
// sweep (p.ej. `render_error`, client-side) no aparecen en ninguno de los dos ficheros y
// quedan fuera automáticamente.

const REPO = path.resolve(__dirname, '../..')
const SCRIPT = fs.readFileSync(path.join(REPO, 'scripts/health-sweep.cjs'), 'utf8')
const BACKEND = fs.readFileSync(
  path.join(REPO, 'backend/src/content-health-sweep/content-health-sweep.service.ts'),
  'utf8',
)

// ¿aparece el literal del kind (entre comillas) en el texto del fichero?
const hasKind = (txt: string, kind: string) =>
  new RegExp(`['"\`]${kind.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"\`]`).test(txt)

// Detectores CLI-only: corren SOLO en el gemelo `scripts/health-sweep.cjs`, no en el
// backend @Cron. `shuffle_safe_regressed` invoca un subproceso `npx tsx
// scripts/sweep-shuffle-safety-drift.ts` que importa `explanationReferencesLetters` de
// `@/lib/shuffle/...` (lib del FRONTEND). El backend NestJS (proyecto ./backend separado,
// build sin acceso al root `scripts/` ni a `@/lib`) no puede ejecutarlo tal cual, así que
// se excluye de la paridad A PROPÓSITO. Consecuencia asumida: el @Cron nocturno NO refresca
// estos hallazgos (solo aparecen al correr el CLI a mano). Si algún día se reimplementa la
// lógica nativa en el service (o en un paquete compartido), quitarlo de este set.
const CLI_ONLY_KINDS = new Set(['shuffle_safe_regressed'])
const ALL_KINDS = Object.keys(RUNBOOK_BY_KIND).filter((k) => !CLI_ONLY_KINDS.has(k))
const scriptKinds = ALL_KINDS.filter((k) => hasKind(SCRIPT, k)).sort()
const backendKinds = ALL_KINDS.filter((k) => hasKind(BACKEND, k)).sort()

describe('content-health-sweep — paridad script ↔ backend @Cron', () => {
  it('el script emite al menos un puñado de detectores (sanity: la extracción funciona)', () => {
    expect(scriptKinds.length).toBeGreaterThanOrEqual(15)
  })

  it('TODO kind del script (CLI) está también en el backend @Cron (el writer real)', () => {
    const faltanEnBackend = scriptKinds.filter((k) => !backendKinds.includes(k))
    expect(faltanEnBackend).toEqual([])
  })

  it('TODO kind del backend está también en el script (sin extras huérfanos)', () => {
    const faltanEnScript = backendKinds.filter((k) => !scriptKinds.includes(k))
    expect(faltanEnScript).toEqual([])
  })

  it('los sets de kinds son IDÉNTICOS (no hay drift en ninguna dirección)', () => {
    expect(backendKinds).toEqual(scriptKinds)
  })
})
