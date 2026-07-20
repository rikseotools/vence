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
