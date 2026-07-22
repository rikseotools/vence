/**
 * @jest-environment node
 */
// __tests__/lib/admin/runbookRegistry.test.ts
// Guardarraíles del mapa finding→runbook→frase. Cierran la "confluencia": ningún
// hallazgo del sweep debe quedar sin guía, ningún runbook enlazado debe faltar, y
// cada frase-gatillo debe estar en CLAUDE.md (donde Claude la lee).
import { readFileSync, existsSync } from 'fs'
import { RUNBOOK_BY_KIND, runbookForKind, runbookGuideRows } from '@/lib/admin/runbookRegistry'

// SPEC: todos los `kind` que puede emitir el sweep (scripts/health-sweep.cjs +
// migración 20260710_content_health_findings.sql). Si el sweep añade un kind,
// añadirlo aquí Y al registro (este test lo recuerda).
const SWEEP_KINDS = [
  'http_down', 'empty_topic', 'render_error', 'http_5xx', 'webhook_unhealthy',
  'server_render_error', 'plaza_card', 'temas_card', 'dual_write', 'low_coverage',
  'no_hitos', 'flattened_table', 'stale_dated_law', 'audit_note_explanation',
  'law_unverified_source', 'scope_titulo_huerfano', 'convocatoria_docs_incompletos',
  'answer_in_annulled_fragment', 'scope_over_inclusion_suspect', 'shuffle_safe_regressed',
]

describe('runbookRegistry — guardarraíles', () => {
  it('NO hay kind huérfano: todo hallazgo del sweep tiene entrada (guía)', () => {
    for (const kind of SWEEP_KINDS) {
      expect(runbookForKind(kind)).toBeDefined()
    }
  })

  it('cada entrada tiene título, frase y descripción no vacíos', () => {
    const incompletos = Object.entries(RUNBOOK_BY_KIND)
      .filter(([, e]) => !e.title || !e.triggerPhrase || !e.claudeHace)
      .map(([kind]) => kind)
    expect(incompletos).toEqual([])
  })

  it('cada runbook enlazado EXISTE como fichero (no enlaces rotos)', () => {
    const rotos = Object.entries(RUNBOOK_BY_KIND)
      .filter(([, e]) => e.runbook && !existsSync(e.runbook))
      .map(([kind, e]) => `${kind} → ${e.runbook}`)
    expect(rotos).toEqual([])
  })

  it('cada frase-gatillo está registrada en CLAUDE.md (donde Claude la lee)', () => {
    const claudeMd = readFileSync('CLAUDE.md', 'utf-8')
    const faltan = runbookGuideRows()
      .filter((r) => !claudeMd.includes(r.triggerPhrase))
      .map((r) => r.triggerPhrase)
    expect(faltan).toEqual([])
  })

  it('kind desconocido → undefined (sin crash)', () => {
    expect(runbookForKind('kind_que_no_existe')).toBeUndefined()
    expect(runbookForKind(null)).toBeUndefined()
    expect(runbookForKind(undefined)).toBeUndefined()
  })

  it('la guía agrupa por frase (health-check cubre varios kinds de app)', () => {
    const rows = runbookGuideRows()
    const health = rows.find((r) => r.triggerPhrase === 'busca errores')
    expect(health).toBeDefined()
    expect(health!.kinds.length).toBeGreaterThan(1)
  })
})
