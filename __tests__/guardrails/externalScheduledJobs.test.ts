/**
 * @jest-environment node
 *
 * Guardarraíl de paridad para los jobs programados que corren FUERA del proceso
 * del backend.
 *
 * La liveness de estos jobs (`cron_overdue`) une DOS ficheros por un string:
 *   - el catálogo    `backend/src/cron-schedule/external-jobs.registry.ts`  (`name`)
 *   - el propio job  `scripts/pdf-worker.ts`                                (`JOB_NAME`)
 * y emite/consulta `observable_events.endpoint` con ese valor.
 *
 * No pueden importarse el uno al otro: el backend tiene `rootDir = backend/` y
 * nunca importa de `../lib`, y el script del worker vive en la raíz del repo.
 * Sin este test, un rename en cualquiera de los dos lados deja el job SIN
 * vigilancia y en silencio — que es exactamente el fallo del 27→29/07/2026 que
 * la vigilancia viene a cerrar. Un guardarraíl de paridad es el mismo patrón que
 * ya usa `runbookRegistry` ↔ `CLAUDE.md`.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const REGISTRY = join(ROOT, 'backend/src/cron-schedule/external-jobs.registry.ts')
const PDF_WORKER = join(ROOT, 'scripts/pdf-worker.ts')

/** Nombres declarados en el catálogo (`name: '...'`). */
function nombresDelCatalogo(): string[] {
  const src = readFileSync(REGISTRY, 'utf8')
  return [...src.matchAll(/^\s*name:\s*'([^']+)'/gm)].map((m) => m[1])
}

describe('guardarraíl — jobs programados externos', () => {
  it('el catálogo declara al menos un job', () => {
    expect(nombresDelCatalogo().length).toBeGreaterThan(0)
  })

  it('el JOB_NAME del worker de PDFs coincide EXACTO con su entrada del catálogo', () => {
    const src = readFileSync(PDF_WORKER, 'utf8')
    const m = src.match(/const JOB_NAME\s*=\s*'([^']+)'/)
    expect(m).not.toBeNull()
    expect(nombresDelCatalogo()).toContain(m![1])
  })

  it('el worker emite las DOS señales del contrato de liveness', () => {
    const src = readFileSync(PDF_WORKER, 'utf8')
    // `cron_tick` al arrancar: es la única señal que un job puede dar antes de
    // hacer trabajo, y la que distingue "ciclo sano con la cola vacía" de
    // "el job no arrancó".
    expect(src).toContain("'cron_tick'")
    // `cron_run` al terminar: sin él, `cron_started_not_finished` lo leería
    // como colgado.
    expect(src).toContain("'cron_run'")
  })

  it('el worker emite con endpoint = JOB_NAME (la regla une por ese campo)', () => {
    const src = readFileSync(PDF_WORKER, 'utf8')
    // El INSERT debe usar la constante, no un literal suelto que pueda divergir.
    const insert = src.slice(src.indexOf('async function emitCronSignal'))
    expect(insert).toMatch(/\$\{JOB_NAME\}/)
  })

  it('el catálogo no declara cadencias en dialecto de proveedor', () => {
    const src = readFileSync(REGISTRY, 'utf8')
    const exprs = [...src.matchAll(/^\s*expression:\s*'([^']+)'/gm)].map((m) => m[1])
    expect(exprs.length).toBeGreaterThan(0)
    for (const e of exprs) {
      // `rate(30 minutes)` y `cron(0 5 * * ? *)` son de un proveedor concreto;
      // el catálogo es agnóstico y debe sobrevivir a un cambio de proveedor.
      expect(e).not.toMatch(/rate\(|cron\(/i)
      expect(e.trim().split(/\s+/)).toHaveLength(5)
    }
  })
})

/**
 * Techo de render vs rescate de 'running' colgados.
 *
 * Son dos números en ficheros distintos con una relación de orden OBLIGATORIA, y
 * así es como se descalibraron: el techo se fijó con el récord de entonces (15,2
 * min) y sin holgura, y el primer tema que lo superó —Segovia T29, **20 min 1 s**
 * medidos renderizando a mano sin techo— quemaba sus 3 intentos y caía al DLQ
 * PARA SIEMPRE, con el canary emitiendo CRITICAL a diario por un tema que sí se
 * puede renderizar. El tema no estaba mal; el techo sí.
 */
describe('guardarraíl — techo de render vs rescate de colgados', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DEFAULT_RENDER_TIMEOUT_MS, DEFAULT_STALE_SECONDS } = require('@/lib/temario/pdf/pdfJobQueue')

  /** Peor caso MEDIDO en producción (Segovia T29, 2,9 MB). */
  const PEOR_CASO_MEDIDO_MS = 20 * 60_000 + 1_000

  it('el techo de render cubre el peor caso medido, con margen', () => {
    expect(DEFAULT_RENDER_TIMEOUT_MS).toBeGreaterThan(PEOR_CASO_MEDIDO_MS)
    // Margen mínimo del 20%: sin holgura, el siguiente tema un poco mayor repite el bug.
    expect(DEFAULT_RENDER_TIMEOUT_MS).toBeGreaterThanOrEqual(PEOR_CASO_MEDIDO_MS * 1.2)
  })

  it('el rescate de colgados llega DESPUÉS del techo (si no, re-encola un render en curso)', () => {
    expect(DEFAULT_STALE_SECONDS * 1000).toBeGreaterThan(DEFAULT_RENDER_TIMEOUT_MS)
    // Margen real, no un empate técnico: hay que poder distinguir "render largo"
    // de "worker muerto a media faena".
    expect(DEFAULT_STALE_SECONDS * 1000 - DEFAULT_RENDER_TIMEOUT_MS).toBeGreaterThanOrEqual(10 * 60_000)
  })

  it('el worker usa la constante compartida, no un literal propio', () => {
    const src = readFileSync(PDF_WORKER, 'utf8')
    expect(src).toMatch(/RENDER_TIMEOUT_MS\s*=\s*DEFAULT_RENDER_TIMEOUT_MS/)
    // Un `18 * 60_000` suelto aquí es exactamente cómo se descalibró.
    expect(src).not.toMatch(/RENDER_TIMEOUT_MS\s*=\s*\d+\s*\*/)
  })

  it('el canary del backend espeja el MISMO rescate (no puede importar de lib/)', () => {
    const canary = readFileSync(
      join(ROOT, 'backend/src/canary-pdf-queue/canary-pdf-queue.service.ts'), 'utf8',
    )
    const m = canary.match(/STALE_RUNNING_SECONDS\s*=\s*(\d+)\s*\*\s*60/)
    expect(m).not.toBeNull()
    expect(Number(m![1]) * 60).toBe(DEFAULT_STALE_SECONDS)
  })
})
