/**
 * @jest-environment node
 *
 * Guardarraíl de paridad para los jobs programados que corren FUERA del proceso
 * del backend.
 *
 * La liveness de estos jobs (`cron_overdue`) une DOS ficheros por un string:
 *   - el catálogo    `backend/src/cron-schedule/external-jobs.registry.ts`  (`name`)
 *   - el propio job  (p.ej. `scripts/pdf-worker.ts`)                        (`JOB_NAME`)
 * y emite/consulta `observable_events.endpoint` con ese valor.
 *
 * No pueden importarse el uno al otro: el backend tiene `rootDir = backend/` y
 * nunca importa de `../lib`, y los scripts de los jobs viven en la raíz del repo
 * (algunos ni siquiera en el mismo lenguaje — `instagram_daily.py`). Sin este
 * test, un rename en cualquiera de los dos lados deja el job SIN vigilancia y en
 * silencio — que es exactamente el fallo del 27→29/07/2026 que la vigilancia
 * viene a cerrar. Un guardarraíl de paridad es el mismo patrón que ya usa
 * `runbookRegistry` ↔ `CLAUDE.md`.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const REGISTRY = join(ROOT, 'backend/src/cron-schedule/external-jobs.registry.ts')
const PDF_WORKER = join(ROOT, 'scripts/pdf-worker.ts')
const CONTENT_RADAR = join(ROOT, 'marketing/social-content/content-radar/content_radar.mjs')
const INSTAGRAM_DAILY = join(ROOT, 'marketing/social-content/instagram_daily.py')

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

  // ── Los otros dos jobs externos, destapados en [T-325]: el catálogo solo
  // declaraba temario-pdf-worker mientras vence-content-radar y
  // vence-instagram-daily podían morir exactamente igual y nadie se enteraría. ──

  it('el JOB_NAME de content-radar (.mjs) coincide EXACTO con su entrada del catálogo', () => {
    const src = readFileSync(CONTENT_RADAR, 'utf8')
    const m = src.match(/const JOB_NAME\s*=\s*'([^']+)'/)
    expect(m).not.toBeNull()
    expect(nombresDelCatalogo()).toContain(m![1])
  })

  it('content-radar emite las DOS señales del contrato de liveness, con endpoint = JOB_NAME', () => {
    const src = readFileSync(CONTENT_RADAR, 'utf8')
    expect(src).toContain("'cron_tick'")
    expect(src).toContain("'cron_run'")
    const fn = src.slice(src.indexOf('async function emitCronSignal'))
    expect(fn).toMatch(/\$\{JOB_NAME\}/)
  })

  it('el JOB_NAME de instagram-daily (.py) coincide EXACTO con su entrada del catálogo', () => {
    const src = readFileSync(INSTAGRAM_DAILY, 'utf8')
    // Sintaxis Python: sin `const`, comillas dobles.
    const m = src.match(/^JOB_NAME\s*=\s*"([^"]+)"/m)
    expect(m).not.toBeNull()
    expect(nombresDelCatalogo()).toContain(m![1])
  })

  it('instagram-daily emite las DOS señales del contrato de liveness, con endpoint = JOB_NAME', () => {
    const src = readFileSync(INSTAGRAM_DAILY, 'utf8')
    expect(src).toContain('"cron_tick"')
    expect(src).toContain('"cron_run"')
    // Python no interpola con `${}`: aquí el contrato es que el INSERT use la
    // variable JOB_NAME (parámetro %s ligado a JOB_NAME), no un literal suelto.
    const fn = src.slice(src.indexOf('def emit_cron_signal'))
    expect(fn).toMatch(/JOB_NAME/)
    // Y que el propio JOB_NAME esté entre los parámetros ligados al INSERT.
    const execute = fn.slice(fn.indexOf('cur.execute'))
    expect(execute).toMatch(/JOB_NAME/)
  })

  // La revisión de [T-325] encontró que el DRY_RUN documentado en el README de la carpeta
  // emitía con el endpoint de siempre. `cron_overdue` solo comprueba que exista ALGUNA señal
  // desde el tick anterior, así que una prueba manual TAPA la muerte del cron real de ese día:
  // el falso verde que este job existe para eliminar, autoinfligido. Afecta a las DOS señales
  // (el tick sale antes de saber si se va a publicar), no solo al `cron_run`.
  it('una pasada DRY_RUN NO emite bajo el endpoint que vigila cron_overdue', () => {
    const src = readFileSync(INSTAGRAM_DAILY, 'utf8')
    const main = src.slice(src.indexOf('def main('))

    // El endpoint se decide a partir de `dry`, y en dry NO es el JOB_NAME pelado.
    expect(main).toMatch(/endpoint\s*=\s*JOB_NAME\s*\+\s*"[-\w]+"\s+if\s+dry\s+else\s+JOB_NAME/)

    // Y TODAS las señales del job van por esa variable: si una se queda con el
    // valor por defecto, vuelve a tapar.
    // Por LÍNEA, no por paréntesis equilibrados: los argumentos llevan `int((time.time() - t0)…)`
    // y un `\([^)]*\)` corta en el primer cierre, dando por buena una llamada que no lo es.
    const señales = main.split('\n').filter((l) => l.includes('emit_cron_signal('))
    expect(señales.length).toBeGreaterThanOrEqual(4) // tick + dry_run + success + error
    for (const s of señales) expect(s).toMatch(/endpoint=endpoint/)
  })

  it('los tres jobs externos que emiten señal están TODOS en el catálogo (ni uno se queda fuera)', () => {
    const nombres = [PDF_WORKER, CONTENT_RADAR, INSTAGRAM_DAILY].map((f) => {
      const src = readFileSync(f, 'utf8')
      const m = src.match(/JOB_NAME\s*=\s*['"]([^'"]+)['"]/)
      return m![1]
    })
    expect(nombres.sort()).toEqual([...nombresDelCatalogo()].sort())
  })

  it('el catálogo no declara cadencias en dialecto de proveedor', () => {
    const src = readFileSync(REGISTRY, 'utf8')
    // Solo las entradas del ARRAY de producción: las expresiones que aparecen
    // en los comentarios explicativos (`*/30 * * * *`, `rate(30 minutes)`) son
    // la documentación del bug, no declaraciones.
    const array = src.slice(src.indexOf('EXTERNAL_SCHEDULED_JOBS: readonly'))
    const exprs = [...array.matchAll(/^\s*expression:\s*'([^']+)'/gm)].map((m) => m[1])
    for (const e of exprs) {
      // `rate(30 minutes)` y `cron(0 5 * * ? *)` son de un proveedor concreto;
      // el catálogo es agnóstico y debe sobrevivir a un cambio de proveedor.
      expect(e).not.toMatch(/rate\(|cron\(/i)
      expect(e.trim().split(/\s+/)).toHaveLength(5)
    }
    // Cada entrada declara una cadencia y solo una: o fase (`expression`) o
    // intervalo (`everyMinutes`). Un job sin ninguna no entra en el calendario
    // y se vuelve invisible EN SILENCIO, que es el fallo original.
    const entradas = (array.match(/^\s*name:\s*'/gm) ?? []).length
    const cadencias = (array.match(/^\s*cadence:\s*'(phase|interval)'/gm) ?? []).length
    expect(entradas).toBeGreaterThan(0)
    expect(cadencias).toBe(entradas)
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

  /**
   * Peor caso MEDIDO (Segovia T29, 2,9 MB). Dos mediciones reales del MISMO tema:
   * 20 min 1 s a mano y 17 min 8,6 s en Fargate 2 vCPU (render forzado, 29/07).
   * Se toma la más alta: su duración oscila, y el techo viejo (18 min) caía DENTRO
   * de esa banda — por eso unas veces pasaba y otras iba al DLQ.
   */
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

/**
 * Acotado de concurrencia del worker.
 *
 * El scheduler dispara una ejecución cada 30 min y cada una drenaba HASTA VACIAR
 * la cola. Con la cola vacía eso termina en segundos y nunca dio problema; con un
 * backlog de temas pesados dura horas y los workers se ACUMULAN, 2 vCPU cada uno,
 * contra una cuota Fargate de 30 que el frontend ya consume en dos tercios.
 * Quedarse sin vCPU es lo que revierte los deploys de frontend.
 */
describe('guardarraíl — el worker no puede acumularse sin límite', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const {
    DEFAULT_RENDER_TIMEOUT_MS, DEFAULT_MAX_RUNTIME_MS, WORKER_CADENCE_MS,
  } = require('@/lib/temario/pdf/pdfJobQueue')
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { runPdfWorker } = require('@/lib/temario/pdf/pdfWorker')

  it('el peor caso de una ejecución deja como mucho 2 workers a la vez', () => {
    // La fecha límite se mira ANTES de reclamar, nunca a mitad de render, así que
    // el peor caso real es tope + un render entero.
    const peorCaso = DEFAULT_MAX_RUNTIME_MS + DEFAULT_RENDER_TIMEOUT_MS
    expect(peorCaso).toBeLessThan(2 * WORKER_CADENCE_MS)
  })

  it('la cadencia declarada coincide con la del catálogo de jobs externos', () => {
    const registry = readFileSync(
      join(ROOT, 'backend/src/cron-schedule/external-jobs.registry.ts'), 'utf8',
    )
    // El worker se programa con `rate(30 minutes)`, que NO tiene fase, así que
    // el catálogo lo declara por intervalo. Declararlo como cron con fase es lo
    // que provocó los CRITICAL diarios del 29/07 contra un job sano.
    const m = registry.match(/name:\s*'temario-pdf-worker'[\s\S]*?everyMinutes:\s*(\d+)/)
    expect(m).not.toBeNull()
    expect(Number(m![1]) * 60_000).toBe(WORKER_CADENCE_MS)
  })

  /**
   * Cola INAGOTABLE a propósito: el `db` falso siempre devuelve un job que reclamar,
   * así que lo ÚNICO que puede parar el bucle es la fecha límite. Si se rompe, este
   * test no falla por una aserción: se cuelga. Esa es la idea — el contrato es
   * "termina", y con la cola infinita no hay forma de aprobarlo por accidente.
   */
  it('con cola inagotable, la fecha límite es lo único que para el bucle', async () => {
    let t = 0
    const now = () => t
    const db = {
      execute: async () => [
        { id: 'j', oposicion: 'x', tema: 1, contentHash: 'h', attempts: 1 },
      ],
    }
    const deps: any = {
      db,
      // El render es lo que tarda: cada tema "consume" 8 min de reloj.
      render: async () => { t += 8 * 60_000; return { ok: true, outcome: 'uploaded', ms: 1 } },
      emit: () => {},
    }

    const s = await runPdfWorker(deps, { maxRuntimeMs: 20 * 60_000, now })

    // Reclama en t=0, 8 y 16 min; en t=24 ya ha vencido → para. Ni uno más.
    expect(s.processed).toBe(3)
    expect(s.done).toBe(3)
  })

  it('el tope por defecto respeta el invariante de concurrencia', async () => {
    let t = 0
    const db = { execute: async () => [{ id: 'j', oposicion: 'x', tema: 1, contentHash: 'h', attempts: 1 }] }
    const deps: any = {
      db,
      render: async () => { t += DEFAULT_RENDER_TIMEOUT_MS; return { ok: true, outcome: 'uploaded', ms: 1 } },
      emit: () => {},
    }
    // Sin pasar maxRuntimeMs: usa DEFAULT_MAX_RUNTIME_MS.
    const s = await runPdfWorker(deps, { now: () => t })
    // Con renders del tamaño del techo, una ejecución no puede encadenar muchos.
    expect(t).toBeLessThanOrEqual(DEFAULT_MAX_RUNTIME_MS + DEFAULT_RENDER_TIMEOUT_MS)
    expect(s.processed).toBeGreaterThan(0)
  })
})
