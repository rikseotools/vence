/**
 * @jest-environment node
 */
// Unitarios de la lógica PURA del guardrail de push (lib/backlog/pushGuard.cjs). Importa la
// función REAL que corre el hook `.husky/pre-push` (vía scripts/backlog-push-guard.cjs), no una
// copia: así el test no da falso verde el día que el guard cambie.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractTaskIds, evaluatePush } = require('@/lib/backlog/pushGuard.cjs')

const AHORA = new Date('2026-07-20T12:00:00Z')
const mins = (n: number) => new Date(AHORA.getTime() + n * 60_000).toISOString()
const SID = 'sesion-A'
const OTRA = 'sesion-B'

describe('extractTaskIds', () => {
  it('saca los T-NNN únicos de un texto', () => {
    expect(extractTaskIds('feat(x): cierra T-044 y toca T-050\n\nref T-044')).toEqual(['T-044', 'T-050'])
  })
  it('texto sin ids → vacío (push normal no paga peaje)', () => {
    expect(extractTaskIds('fix: typo en el README')).toEqual([])
    expect(extractTaskIds('')).toEqual([])
    expect(extractTaskIds(null)).toEqual([])
  })
  it('exige el formato T-NNN de 3 dígitos (no confunde T-1 ni versiones)', () => {
    expect(extractTaskIds('T-1 T-12 T-9999 v1.2-T-3')).toEqual([])
    expect(extractTaskIds('T-007')).toEqual(['T-007'])
  })
})

describe('evaluatePush — regla de bloqueo', () => {
  const run = (tasks: Record<string, any>, ids: string[], sid = SID) =>
    evaluatePush({ referencedIds: ids, tasksById: tasks, sid, now: AHORA })

  it('PERMITE si la tienes tú con lease vivo', () => {
    const r = run({ 'T-044': { status: 'in_progress', claimed_by: SID, lease_until: mins(60) } }, ['T-044'])
    expect(r.allowed).toBe(true)
    expect(r.violations).toEqual([])
  })

  it('PERMITE si la fila es tuya aunque el lease esté caducado (nadie te la robó)', () => {
    const r = run({ 'T-044': { status: 'in_progress', claimed_by: SID, lease_until: mins(-30) } }, ['T-044'])
    expect(r.allowed).toBe(true)
  })

  it('BLOQUEA si el commit menciona una tarea viva SIN reclamar', () => {
    const r = run({ 'T-044': { status: 'open', claimed_by: null, lease_until: null } }, ['T-044'])
    expect(r.allowed).toBe(false)
    expect(r.violations[0].id).toBe('T-044')
    expect(r.violations[0].reason).toMatch(/sin reclamar/)
  })

  it('BLOQUEA si la tiene OTRA sesión (el caso de la colisión T-047/T-050)', () => {
    const r = run({ 'T-050': { status: 'in_progress', claimed_by: OTRA, lease_until: mins(45) } }, ['T-050'])
    expect(r.allowed).toBe(false)
    expect(r.violations[0].reason).toMatch(/la tiene la sesión/)
  })

  it('PERMITE mencionar una tarea CERRADA (done/dropped no pide lease)', () => {
    const r = run({ 'T-047': { status: 'done', claimed_by: OTRA, lease_until: null } }, ['T-047'])
    expect(r.allowed).toBe(true)
  })

  it('PERMITE una mención suelta a un id que NO está en el registro', () => {
    const r = run({}, ['T-999'])
    expect(r.allowed).toBe(true)
  })

  it('con varias tareas, reporta SOLO las violaciones', () => {
    const r = run({
      'T-044': { status: 'in_progress', claimed_by: SID, lease_until: mins(60) },   // mía → ok
      'T-050': { status: 'open', claimed_by: null, lease_until: null },              // sin reclamar → viola
      'T-047': { status: 'done', claimed_by: OTRA, lease_until: null },              // cerrada → ok
    }, ['T-044', 'T-050', 'T-047'])
    expect(r.allowed).toBe(false)
    expect(r.violations.map((v: any) => v.id)).toEqual(['T-050'])
  })

  it('acepta tasksById como Map además de objeto', () => {
    const m = new Map([['T-044', { status: 'open', claimed_by: null, lease_until: null }]])
    const r = evaluatePush({ referencedIds: ['T-044'], tasksById: m, sid: SID, now: AHORA })
    expect(r.allowed).toBe(false)
  })

  it('sin ids referenciados → permitido y sin tocar nada', () => {
    expect(run({}, []).allowed).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────
// Lease MUERTO de otra sesión — el bloqueo que no se podía satisfacer (31/07)
//
// `claim` entrega una fila con `lease_until < now()`. Este guard no lo miraba y mandaba a
// "esperar a que libere" a sesiones muertas hacía días (T-214, T-221 y T-238 llevaban 72-79 h
// así). La única salida era BACKLOG_GUARD_SKIP=1, que apaga el guard ENTERO: un bloqueo
// imposible no protege, enseña a saltarse la protección.
// ────────────────────────────────────────────────────────────────────────────────────────────
describe('evaluatePush — lease muerto de otra sesión', () => {
  const run = (tasks: Record<string, any>, ids: string[], sid = SID) =>
    evaluatePush({ referencedIds: ids, tasksById: tasks, sid, now: AHORA })

  it('PERMITE si la reclamó otra sesión pero su lease ya venció (misma regla que `claim`)', () => {
    const r = run({ 'T-214': { status: 'in_progress', claimed_by: OTRA, lease_until: mins(-4320) } }, ['T-214'])
    expect(r.allowed).toBe(true)
    expect(r.notices[0].reason).toMatch(/lease caducó/)
  })

  it('SIGUE BLOQUEANDO con el lease vivo: el trabajo en curso ajeno no se pisa', () => {
    const r = run({ 'T-050': { status: 'in_progress', claimed_by: OTRA, lease_until: mins(1) } }, ['T-050'])
    expect(r.allowed).toBe(false)
  })

  it('NO abre el hueco del OLVIDO: sin dueño sigue bloqueando aunque no haya lease', () => {
    // Es la razón de ser del guard (colisión T-047/T-050). Relajar el lease muerto no puede
    // relajar esto: aquí no hay ninguna sesión muerta a la que esperar, hay una tarea libre.
    const r = run({ 'T-044': { status: 'open', claimed_by: null, lease_until: null } }, ['T-044'])
    expect(r.allowed).toBe(false)
    expect(r.violations[0].reason).toMatch(/sin reclamar/)
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────
// Pausa propia (T-375) — los dos guardarraíles se bloqueaban entre sí
// ────────────────────────────────────────────────────────────────────────────────────────────
describe('evaluatePush — tarea que pausaste TÚ', () => {
  const run = (tasks: Record<string, any>, ids: string[], sid = SID) =>
    evaluatePush({ referencedIds: ids, tasksById: tasks, sid, now: AHORA })

  it('PERMITE la que TÚ pausaste esperando deploy (pause suelta el claim a propósito)', () => {
    const r = run({ 'T-369': {
      status: 'open', claimed_by: null, lease_until: null,
      snoozed_by: SID, snooze_until: null, wake_on_deploy_sha: 'abc1234',
    } }, ['T-369'])
    expect(r.allowed).toBe(true)
    expect(r.notices[0].reason).toMatch(/pausaste tú/)
  })

  it('PERMITE la que TÚ pausaste hasta una FECHA futura', () => {
    const r = run({ 'T-234': {
      status: 'open', claimed_by: null, lease_until: null,
      snoozed_by: SID, snooze_until: mins(60 * 24 * 11), wake_on_deploy_sha: null,
    } }, ['T-234'])
    expect(r.allowed).toBe(true)
  })

  it('BLOQUEA la que pausó OTRA sesión: es trabajo ajeno con su contexto', () => {
    const r = run({ 'T-234': {
      status: 'open', claimed_by: null, lease_until: null,
      snoozed_by: OTRA, snooze_until: mins(60 * 24), wake_on_deploy_sha: null,
    } }, ['T-234'])
    expect(r.allowed).toBe(false)
  })

  it('BLOQUEA si tu pausa ya VENCIÓ y no la has vuelto a coger (vuelve al pool)', () => {
    const r = run({ 'T-234': {
      status: 'open', claimed_by: null, lease_until: null,
      snoozed_by: SID, snooze_until: mins(-10), wake_on_deploy_sha: null,
    } }, ['T-234'])
    expect(r.allowed).toBe(false)
  })
})

// ────────────────────────────────────────────────────────────────────────────────────────────
// «Solo documento la ficha» (T-375, segundo roce) — documentar ≠ trabajar
// ────────────────────────────────────────────────────────────────────────────────────────────
describe('evaluatePush — push que solo toca el markdown de fichas', () => {
  const MD = 'docs/roadmap/tareas-pendientes.md'
  const libre = { 'T-377': { status: 'open', claimed_by: null, lease_until: null } }
  const run = (changedFiles: string[] | null) =>
    evaluatePush({ referencedIds: ['T-377'], tasksById: libre, sid: SID, changedFiles, now: AHORA })

  it('PERMITE si el push SOLO toca el markdown de fichas', () => {
    expect(run([MD]).allowed).toBe(true)
  })

  it('BLOQUEA en cuanto toca CUALQUIER otra cosa junto a la ficha', () => {
    expect(run([MD, 'lib/api/pagos.ts']).allowed).toBe(false)
  })

  it('BLOQUEA otros documentos: escribir un runbook SÍ es trabajo', () => {
    expect(run(['docs/runbooks/tareas-pendientes.md']).allowed).toBe(false)
  })

  it('BLOQUEA si no se pudo determinar qué ficheros toca (null ≠ "no toca nada")', () => {
    expect(run(null).allowed).toBe(false)
    expect(run([]).allowed).toBe(false)
  })

  it('la exención CEDE si otra sesión la tiene con lease VIVO (ahí sí la está trabajando)', () => {
    const enCurso = { 'T-291': { status: 'in_progress', claimed_by: OTRA, lease_until: mins(45) } }
    const r = evaluatePush({ referencedIds: ['T-291'], tasksById: enCurso, sid: SID, changedFiles: [MD], now: AHORA })
    expect(r.allowed).toBe(false)
  })

  it('…pero no cede ante un lease MUERTO: no hay nadie a quien pisar', () => {
    const zombi = { 'T-214': { status: 'in_progress', claimed_by: OTRA, lease_until: mins(-4320) } }
    const r = evaluatePush({ referencedIds: ['T-214'], tasksById: zombi, sid: SID, changedFiles: [MD], now: AHORA })
    expect(r.allowed).toBe(true)
  })
})
