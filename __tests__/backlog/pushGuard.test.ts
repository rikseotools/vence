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
