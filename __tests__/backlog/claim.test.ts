/**
 * @jest-environment node
 */
// Unitarios de la lógica PURA del claim del backlog. Importan la función REAL de
// producción (lib/backlog/claim.ts), nunca una copia: una copia da falso verde el día
// que el original cambie.
import {
  isClaimable, claimBlockedReason, pickNext, sortByAttackOrder,
  parseBacklogMarkdown, findHeadingsWithoutId, findBacklogDrift, findZombieClaims,
  isSnoozed, snoozeInfo,
  type BacklogTask,
} from '@/lib/backlog/claim'

const AHORA = new Date('2026-07-20T12:00:00Z')
const mins = (n: number) => new Date(AHORA.getTime() + n * 60_000).toISOString()

const task = (over: Partial<BacklogTask> = {}): BacklogTask => ({
  id: 'T-001', title: 'X', priority: 'media', status: 'open',
  claimed_by: null, lease_until: null, blocked_by: [], ...over,
})

describe('isClaimable — lease, no lock', () => {
  it('libre si no la tiene nadie', () => {
    expect(isClaimable(task(), 'sesion-A', AHORA)).toBe(true)
  })

  it('re-claim idempotente: la tuya sigue siendo tuya', () => {
    const t = task({ claimed_by: 'sesion-A', lease_until: mins(30) })
    expect(isClaimable(t, 'sesion-A', AHORA)).toBe(true)
  })

  it('NO reclamable si otra sesión la tiene con lease vivo', () => {
    const t = task({ claimed_by: 'sesion-B', lease_until: mins(30) })
    expect(isClaimable(t, 'sesion-A', AHORA)).toBe(false)
  })

  // El caso que justifica el diseño: una sesión muere y no debe bloquear el backlog.
  it('reclamable si el lease de la otra sesión CADUCÓ (sesión muerta)', () => {
    const t = task({ claimed_by: 'sesion-B', lease_until: mins(-1) })
    expect(isClaimable(t, 'sesion-A', AHORA)).toBe(true)
  })

  it('nunca reclamable si está cerrada', () => {
    for (const status of ['done', 'dropped'] as const) {
      expect(isClaimable(task({ status }), 'sesion-A', AHORA)).toBe(false)
    }
  })

  it('el motivo del bloqueo es legible (no un "no" seco)', () => {
    const t = task({ claimed_by: 'sesion-BBBBBBBBBBBB', lease_until: mins(45) })
    expect(claimBlockedReason(t, 'sesion-A', AHORA)).toMatch(/lease vivo, 45 min/)
    expect(claimBlockedReason(task({ status: 'done' }), 'sesion-A', AHORA)).toMatch(/cerrada/)
    expect(claimBlockedReason(task(), 'sesion-A', AHORA)).toBeNull()
  })
})

describe('orden de ataque y reparto', () => {
  it('ordena por prioridad y, a igualdad, por id (determinista)', () => {
    const out = sortByAttackOrder([
      task({ id: 'T-009', priority: 'baja' }), task({ id: 'T-002', priority: 'critica' }),
      task({ id: 'T-005', priority: 'media' }), task({ id: 'T-001', priority: 'critica' }),
    ])
    expect(out.map(t => t.id)).toEqual(['T-001', 'T-002', 'T-005', 'T-009'])
  })

  it('pickNext salta las cogidas por otros y respeta la prioridad', () => {
    const next = pickNext([
      task({ id: 'T-001', priority: 'critica', claimed_by: 'otra', lease_until: mins(30) }),
      task({ id: 'T-002', priority: 'alta' }),
    ], 'yo', AHORA)
    expect(next?.id).toBe('T-002')
  })

  it('pickNext NO devuelve una tarea bloqueada por otra que sigue viva', () => {
    const next = pickNext([
      task({ id: 'T-001', priority: 'critica', blocked_by: ['T-002'] }),
      task({ id: 'T-002', priority: 'baja', status: 'in_progress', claimed_by: 'otra', lease_until: mins(30) }),
    ], 'yo', AHORA)
    expect(next).toBeNull()
  })

  it('pero SÍ la devuelve si su bloqueante ya está cerrado', () => {
    const next = pickNext([
      task({ id: 'T-001', priority: 'critica', blocked_by: ['T-002'] }),
      task({ id: 'T-002', status: 'done' }),
    ], 'yo', AHORA)
    expect(next?.id).toBe('T-001')
  })
})

// Aplazamiento (T-252): el tercer estado, junto al claim ("la tengo yo") y a `blocked_by`
// ("depende de otra tarea nuestra"). Aquí no la tiene nadie: es que hasta cierta hora no hay
// NADA que hacer. Antes esto se escribía a gritos en el título de la ficha y `next` la ofrecía.
describe('aplazamiento por reloj (snooze)', () => {
  it('está dormida mientras no llega su hora, y despierta SOLA al pasar', () => {
    const t = task({ snooze_until: mins(60) })
    expect(isSnoozed(t, AHORA)).toBe(true)
    expect(isSnoozed(t, new Date(AHORA.getTime() + 61 * 60_000))).toBe(false)
  })

  it('sin snooze_until está despierta (el campo es opcional)', () => {
    expect(isSnoozed(task(), AHORA)).toBe(false)
  })

  it('pickNext NO sugiere una dormida, aunque sea la más prioritaria', () => {
    const next = pickNext([
      task({ id: 'T-001', priority: 'critica', snooze_until: mins(600) }),
      task({ id: 'T-002', priority: 'baja' }),
    ], 'yo', AHORA)
    expect(next?.id).toBe('T-002')
  })

  it('…y vuelve a sugerirla en cuanto vence el plazo (nadie tiene que despertarla)', () => {
    const tareas = [task({ id: 'T-001', priority: 'critica', snooze_until: mins(60) })]
    expect(pickNext(tareas, 'yo', AHORA)).toBeNull()
    expect(pickNext(tareas, 'yo', new Date(AHORA.getTime() + 61 * 60_000))?.id).toBe('T-001')
  })

  it('dormir NO es bloquear: sigue siendo reclamable a propósito (avisando)', () => {
    const t = task({ snooze_until: mins(600) })
    expect(isClaimable(t, 'yo', AHORA)).toBe(true)
    expect(claimBlockedReason(t, 'yo', AHORA)).toBeNull()
  })

  it('snoozeInfo da la hora, el motivo y cuánto queda; null si está despierta', () => {
    const info = snoozeInfo(task({ snooze_until: mins(90), snooze_reason: 'el cron corre a las 03:15' }), AHORA)
    expect(info?.minutos).toBe(90)
    expect(info?.reason).toBe('el cron corre a las 03:15')
    expect(snoozeInfo(task(), AHORA)).toBeNull()
  })
})

describe('parseo del markdown', () => {
  const MD = [
    '# Backlog', '## Abiertas',
    '### [T-001] 🔴 Tarea crítica de ejemplo',
    'texto de la tarea',
    '### [T-002] 🟡 [ABIERTO 19/07] Tarea media',
    '## Hechas',
    '### [T-003] ✅ 🟢 Tarea ya cerrada',
  ].join('\n')

  it('extrae id, prioridad y en qué sección está', () => {
    const t = parseBacklogMarkdown(MD)
    expect(t).toHaveLength(3)
    expect(t[0]).toMatchObject({ id: 'T-001', priority: 'critica', inOpenSection: true })
    expect(t[1]).toMatchObject({ id: 'T-002', priority: 'media', inOpenSection: true })
    expect(t[2]).toMatchObject({ id: 'T-003', inOpenSection: false })
  })

  it('limpia el título de emojis y etiquetas de estado', () => {
    expect(parseBacklogMarkdown(MD)[1].title).toBe('Tarea media')
  })

  it('⬜ marca la tarea como APARCADA (viva, pero fuera del orden de ataque)', () => {
    const md = '## Abiertas\n### [T-040] ⬜ [SIN PRIORIDAD — aparcada por tamaño] Artículos-cajón'
    const [t] = parseBacklogMarkdown(md)
    expect(t).toMatchObject({ id: 'T-040', parked: true, priority: null, doneMarked: false })
    expect(t.title).toBe('Artículos-cajón')  // el ⬜ no ensucia el título
  })

  it('una tarea normal NO queda marcada como aparcada (el flag no se activa por accidente)', () => {
    expect(parseBacklogMarkdown(MD).every(x => x.parked === false)).toBe(true)
  })

  it('caza cabeceras SIN id (romperían el join markdown↔BD en silencio)', () => {
    expect(findHeadingsWithoutId('### 🟠 Sin identificador')).toEqual(['🟠 Sin identificador'])
    expect(findHeadingsWithoutId(MD)).toEqual([])
  })
})

describe('findBacklogDrift — el guardarraíl que nace del incidente del 20/07', () => {
  const md = parseBacklogMarkdown([
    '## Abiertas', '### [T-001] 🔴 Viva', '### [T-002] 🟠 Cerrada en BD pero aquí abierta',
    '## Hechas', '### [T-003] 🟢 Cerrada',
  ].join('\n'))

  it('detecta la tarea cerrada que sigue anunciada como abierta', () => {
    // Es EXACTAMENTE el fallo real: la ficha del RD 176/2022 decía "9 mislinks EN VIVO"
    // cuando ya estaban arreglados, y una sesión perdió el tiempo montando un worktree.
    const drift = findBacklogDrift(md, [
      task({ id: 'T-001', status: 'in_progress' }),
      task({ id: 'T-002', status: 'done' }),
      task({ id: 'T-003', status: 'done' }),
    ])
    expect(drift.cerradaPeroAbiertaEnMarkdown).toEqual(['T-002'])
    expect(drift.vivaPeroCerradaEnMarkdown).toEqual([])
  })

  it('detecta tareas que solo existen en un lado', () => {
    const drift = findBacklogDrift(md, [task({ id: 'T-001' }), task({ id: 'T-099' })])
    expect(drift.soloEnBd).toEqual(['T-099'])           // fantasma: sin contexto en el markdown
    expect(drift.soloEnMarkdown).toContain('T-002')     // nadie puede cogerla
  })

  it('sin divergencia, todo vacío', () => {
    const drift = findBacklogDrift(md, [
      task({ id: 'T-001', status: 'open' }), task({ id: 'T-002', status: 'open' }),
      task({ id: 'T-003', status: 'done' }),
    ])
    expect(drift).toEqual({
      soloEnMarkdown: [], soloEnBd: [], cerradaPeroAbiertaEnMarkdown: [], vivaPeroCerradaEnMarkdown: [],
    })
  })
})

describe('findZombieClaims', () => {
  it('caza in_progress con lease caducado hace mucho (sesión muerta o cierre olvidado)', () => {
    const z = findZombieClaims([
      task({ id: 'T-001', status: 'in_progress', claimed_by: 'x', lease_until: mins(-60 * 48) }),
      task({ id: 'T-002', status: 'in_progress', claimed_by: 'x', lease_until: mins(30) }),
      task({ id: 'T-003', status: 'open' }),
    ], AHORA, 24)
    expect(z.map(t => t.id)).toEqual(['T-001'])
  })
})
