/**
 * @jest-environment node
 */
// Guardarraíl del backlog: el fichero docs/roadmap/tareas-pendientes.md y la tabla
// `backlog_tasks` se unen por el id `T-xxx` de cada cabecera. Si una cabecera pierde el
// id, o hay ids repetidos, el join se rompe EN SILENCIO y dos sesiones vuelven a pisarse.
//
// No toca BD a propósito: así corre en CI. La comparación contra la tabla la hace
// `node scripts/backlog.cjs sync` (avisa de huérfanas en ambos sentidos).
//
// Mismo patrón que __tests__/lib/admin/runbookRegistry.test.ts (registro ↔ CLAUDE.md).
import { readFileSync } from 'fs'
import { join } from 'path'
import { parseBacklogMarkdown, findHeadingsWithoutId } from '@/lib/backlog/claim'

const MD_PATH = join(process.cwd(), 'docs', 'roadmap', 'tareas-pendientes.md')
const md = readFileSync(MD_PATH, 'utf8')
const tasks = parseBacklogMarkdown(md)

describe('backlog — guardarraíles de tareas-pendientes.md', () => {
  it('hay tareas que auditar (el fichero no se ha vaciado por accidente)', () => {
    expect(tasks.length).toBeGreaterThan(10)
  })

  it('TODA cabecera de tarea lleva su id [T-xxx]', () => {
    // Sin id no se puede coger la tarea: `backlog.cjs claim` no la encuentra.
    const sinId = findHeadingsWithoutId(md)
    expect(sinId).toEqual([])
  })

  it('los ids son ÚNICOS (un id duplicado haría que dos tareas compartan claim)', () => {
    const vistos = new Map<string, string[]>()
    for (const t of tasks) vistos.set(t.id, [...(vistos.get(t.id) || []), t.title])
    const dup = [...vistos.entries()].filter(([, v]) => v.length > 1)
    expect(dup).toEqual([])
  })

  it('toda tarea VIVA declara prioridad con su emoji (🔴/🟠/🟡/🟢)', () => {
    // La prioridad ordena el reparto; sin ella `next` no sabe qué sugerir.
    // Las cerradas (✅) no la necesitan: es la convención del fichero.
    const sinPrioridad = tasks
      .filter(t => !t.doneMarked && t.priority == null)
      .map(t => `${t.id} ${t.title}`)
    expect(sinPrioridad).toEqual([])
  })

  it('el fichero conserva la sección "## Abiertas" (de ella depende el estado)', () => {
    expect(/^##\s+Abiertas\s*$/m.test(md)).toBe(true)
  })

  it('los ids siguen el formato T-NNN', () => {
    for (const t of tasks) expect(t.id).toMatch(/^T-\d{3}$/)
  })
})

// Un runbook que Claude no sabe cuándo leer no sirve de nada: la frase-gatillo tiene que
// estar en CLAUDE.md, que es lo que Claude lee en cada sesión. Este bloque nace de un fallo
// real: el runbook se ancló SIN la frase "revisa las tareas pendientes" —justo la forma
// natural, y la convención del resto del proyecto ("revisa OEPs", "revisa rollover"…)—
// así que el disparador no saltaba con la frase que de verdad usa el usuario.
describe('backlog — el disparador está donde Claude lo lee', () => {
  const claudeMd = readFileSync(join(process.cwd(), 'CLAUDE.md'), 'utf8')
  const runbook = readFileSync(join(process.cwd(), 'docs', 'runbooks', 'tareas-pendientes.md'), 'utf8')

  // SPEC: frases con las que un humano pide el backlog. Si añades una al runbook,
  // añádela aquí Y a CLAUDE.md (este test te lo recuerda).
  const FRASES_GATILLO = [
    'revisa las tareas pendientes',
    'revisa el backlog',
    '¿qué tareas pendientes tenemos?',
    'coge una tarea',
    'añádelo a pendientes',
  ]

  it('CLAUDE.md enlaza el runbook del backlog', () => {
    expect(claudeMd).toContain('docs/runbooks/tareas-pendientes.md')
  })

  it('cada frase-gatillo está en CLAUDE.md (si no, el disparador no salta)', () => {
    const ausentes = FRASES_GATILLO.filter(f => !claudeMd.toLowerCase().includes(f.toLowerCase()))
    expect(ausentes).toEqual([])
  })

  it('cada frase-gatillo está también en el propio runbook', () => {
    const ausentes = FRASES_GATILLO.filter(f => !runbook.toLowerCase().includes(f.toLowerCase()))
    expect(ausentes).toEqual([])
  })

  it('CLAUDE.md recuerda la regla dura: coger ANTES de trabajar', () => {
    expect(claudeMd).toMatch(/coger ANTES de trabajar/i)
  })

  it('el runbook enlaza el manual de push/deploy (cerrar el ciclo)', () => {
    expect(runbook).toContain('pusheo-revision-despliegue.md')
  })
})
