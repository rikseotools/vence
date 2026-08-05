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
  'article_no_coverage', 'cobertura_banda_ciega',
  'no_hitos', 'flattened_table', 'stale_dated_law', 'audit_note_explanation',
  'law_unverified_source', 'scope_titulo_huerfano', 'convocatoria_docs_incompletos',
  'answer_in_annulled_fragment', 'scope_over_inclusion_suspect',
  'scope_over_inclusion_confirmed',
  'scope_cross_tema_dup', 'shuffle_safe_regressed', 'shuffle_narrativa_letra_clavada',
  'visual_deixis_no_image', 'enunciado_norma_sin_nombrar', 'cita_no_literal',
  'epigrafe_provenance_no_doc', 'temario_revision_pendiente', 'scope_sin_verificar',
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

  // ── Anti-SILO (26/07/2026) ────────────────────────────────────────────────
  // El 26/07 dos sesiones construyeron A LA VEZ dos planificadores distintos para
  // `article_no_coverage`: ninguna encontró el de la otra porque uno vivía en el
  // runbook y el otro solo en CLAUDE.md y una ficha del backlog. Declarar el
  // comando en el registro no basta si nadie comprueba que existe y que el
  // runbook lo nombra: sin estas dos comprobaciones, el puntero se pudre y la
  // siguiente sesión vuelve a construirse el suyo.
  it('el `comando` declarado existe de verdad como script de package.json', () => {
    const pkg = JSON.parse(readFileSync('package.json', 'utf-8'))
    const rotos = Object.entries(RUNBOOK_BY_KIND)
      .filter(([, e]) => e.comando)
      .filter(([, e]) => !pkg.scripts?.[e.comando!.replace(/^npm run /, '')])
      .map(([kind, e]) => `${kind} → ${e.comando}`)
    expect(rotos).toEqual([])
  })

  it('el runbook del kind NOMBRA su comando (el punto de entrada es descubrible)', () => {
    const faltan = Object.entries(RUNBOOK_BY_KIND)
      .filter(([, e]) => e.comando && e.runbook && existsSync(e.runbook))
      .filter(([, e]) => !readFileSync(e.runbook!, 'utf-8').includes(e.comando!.replace(/^npm run /, '')))
      .map(([kind, e]) => `${kind}: ${e.runbook} no menciona ${e.comando}`)
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

// ── T-553: `programa_url` sirve a DOS contratos y sus detectores no se pueden fundir ──
//
// Es una confusión fácil y cara: `convocatoria_enlace_no_boletin` juzga `programa_url` como
// ENLACE DEL BOTÓN («¿lleva al boletín que promete?») y `programa_url_no_es_temario` como FUENTE
// DEL TEMARIO («¿tiene temas dentro?»). Un portal institucional puede ser un botón razonable y
// una fuente inútil A LA VEZ — medido el 04/08: 44 de 126 activas están exactamente así.
//
// Sin esto, la próxima sesión que vea dos kinds «sobre programa_url» los unifica de buena fe y
// se pierde uno de los dos contratos sin que nada lo diga.
describe('programa_url: botón y fuente del temario son detectores DISTINTOS', () => {
  const BOTON = 'convocatoria_enlace_no_boletin'
  const FUENTE = 'programa_url_no_es_temario'

  it('los dos existen y no comparten frase-gatillo', () => {
    const b = runbookForKind(BOTON)
    const f = runbookForKind(FUENTE)
    expect(b).toBeDefined()
    expect(f).toBeDefined()
    expect(b!.triggerPhrase).not.toBe(f!.triggerPhrase)
  })

  it('cada uno manda a SU runbook y a SU comando', () => {
    const f = runbookForKind(FUENTE)!
    expect(f.runbook).toBe('docs/runbooks/verificar-epigrafes-scope.md')
    expect(f.comando).toBe('audit:epigrafe-fuente')
    // El del botón vive en salud-contenido y no tiene comando propio: lo emite el sweep.
    expect(runbookForKind(BOTON)!.runbook).toBe('docs/runbooks/salud-contenido.md')
  })

  it('el kind de la fuente EXPLICA la diferencia, para que no se fundan por error', () => {
    const f = runbookForKind(FUENTE)!
    expect(f.claudeHace).toMatch(/convocatoria_enlace_no_boletin/)
    expect(f.claudeHace).toMatch(/dos contratos|BOT[ÓO]N/i)
  })

  it('el triaje epígrafe↔fuente comparte una sola frase para sus dos salidas', () => {
    // Son dos cubos del MISMO comando: separar la frase obligaría a recordar cuál es cuál.
    expect(runbookForKind('temario_fuera_de_su_fuente')!.triggerPhrase)
      .toBe(runbookForKind(FUENTE)!.triggerPhrase)
  })
})
