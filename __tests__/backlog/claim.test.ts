/**
 * @jest-environment node
 */
// Unitarios de la lógica PURA del claim del backlog. Importan la función REAL de
// producción (lib/backlog/claim.ts), nunca una copia: una copia da falso verde el día
// que el original cambie.
import {
  isClaimable, claimBlockedReason, pickNext, sortByAttackOrder,
  parseBacklogMarkdown, findHeadingsWithoutId, findBacklogDrift, findZombieClaims, findMarcaIncoherente,
  isSnoozed, snoozeInfo,
  findDateLockedTitles,
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

  it('extrae id, prioridad y si la ficha se declara abierta', () => {
    const t = parseBacklogMarkdown(MD)
    expect(t).toHaveLength(3)
    expect(t[0]).toMatchObject({ id: 'T-001', priority: 'critica', declaredOpen: true })
    expect(t[1]).toMatchObject({ id: 'T-002', priority: 'media', declaredOpen: true })
    expect(t[2]).toMatchObject({ id: 'T-003', declaredOpen: false })
  })

  // ── T-382: lo abierto lo dice la CABECERA, no dónde cayó la ficha ────────────────────────
  // El fichero real tiene tres `## Hechas` y varias `##` sueltas, así que la posición dejaba
  // fuera a 145 de las 177 tareas vivas — incluida la protección anti-colisión del `sync`.
  it('una ficha VIVA bajo "## Hechas" sigue contando como abierta (el orden no manda)', () => {
    const md = [
      '## Hechas',
      '### [T-100] ✅ Cerrada de verdad',
      '### [T-101] 🟠 [ABIERTO 31/07] Viva, pero escrita donde cabía',
    ].join('\n')
    const t = parseBacklogMarkdown(md)
    expect(t.find((x: any) => x.id === 'T-101')!.declaredOpen).toBe(true)
    expect(t.find((x: any) => x.id === 'T-100')!.declaredOpen).toBe(false)
  })

  it('una ficha CERRADA bajo "## Abiertas" no se cuenta abierta por estar ahí', () => {
    const md = '## Abiertas\n### [T-102] ✅ [HECHA 31/07] Ya cerrada'
    expect(parseBacklogMarkdown(md)[0].declaredOpen).toBe(false)
  })

  it('NO da por cerrada una ficha viva que menciona trabajo HECHO en su etiqueta', () => {
    // El caso que descartó ampliar la marca a la primera palabra de la etiqueta: es el error
    // en la dirección peligrosa (viva contada como cerrada = invisible y en silencio).
    const md = '### [T-103] 🟠 [HECHO 24/07 — quedan 3 follow-ups pequeños] Cosa a medias'
    expect(parseBacklogMarkdown(md)[0].declaredOpen).toBe(true)
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

// El parser lee UNA marca (✅), así que la marca tiene que ser fiable: una cabecera que anuncia
// cierre en su etiqueta y no la lleva deja la tarea contada como abierta para siempre.
describe('findMarcaIncoherente — sostiene el criterio del ✅', () => {
  const marcas = (md: string) => findMarcaIncoherente(parseBacklogMarkdown(md))

  it('caza [HECHA …] sin ✅', () => {
    const r = marcas('### [T-336] 🟢 [HECHA 31/07 · abierta 30/07] Tres suites en rojo')
    expect(r.map((x: any) => x.id)).toEqual(['T-336'])
    expect(r[0].motivo).toMatch(/falta el ✅/)
  })

  it('acepta la misma cabecera CON ✅', () => {
    expect(marcas('### [T-336] ✅ [HECHA 31/07] Tres suites en rojo')).toEqual([])
  })

  it('no molesta a una ficha abierta que solo NOMBRA trabajo hecho', () => {
    expect(marcas('### [T-342] 🟡 [ABIERTO 30/07 — DETECTOR HECHO, queda triar 411] Cosa')).toEqual([])
  })
})

describe('findBacklogDrift — el guardarraíl que nace del incidente del 20/07', () => {
  // El ✅ es lo que declara cerrada una ficha (T-382); la sección en que caiga es indiferente.
  const md = parseBacklogMarkdown([
    '## Abiertas', '### [T-001] 🔴 Viva', '### [T-002] 🟠 Cerrada en BD pero aquí abierta',
    '## Hechas', '### [T-003] ✅ 🟢 Cerrada',
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

// ════════════════════════════════════════════════════════════════════════════
// LA PUERTA DEL CLAIM (29/07) — el reloj deja de avisar y pasa a impedir.
// Revierte a propósito la decisión del 28/07 ("avisa, no impide"): 24 h después
// T-221 seguía con "⛔ NO COGER HASTA EL 29/07" en el TÍTULO, con el campo ya
// disponible. Un aviso impreso entre otras diez líneas no es una condición.
// ════════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  claimGate, isChronicSnooze, deployWakeReady, isAwaitingVerification, deployDebtLevel,
  puedeMarcarseVerificada,
} = require('@/lib/backlog/claimGate.cjs') as {
  claimGate: (t: unknown, sid: string, now?: Date, openIds?: Set<string>) => {
    ok: boolean; code: string; reason: string | null; forzable: boolean
  }
  isChronicSnooze: (t: unknown, umbral?: number) => boolean
  deployWakeReady: (t: unknown, contiene: { frontend?: boolean; backend?: boolean }) => boolean
  isAwaitingVerification: (t: unknown, now?: Date) => boolean
  puedeMarcarseVerificada: (t: unknown, sid: string, now?: Date) => { ok: boolean; motivo?: string }
  deployDebtLevel: (i: { commits?: number; tareasEsperando?: number }) => {
    nivel: string; motivo: string
  }
}

const HOY = new Date('2026-07-29T12:00:00Z')
const tarea = {
  id: 'T-1', title: 'x', priority: 'alta' as const, status: 'open' as const,
  claimed_by: null, lease_until: null,
}

describe('claimGate', () => {
  it('deja coger una tarea libre y despierta', () => {
    expect(claimGate(tarea, 'sid-a', HOY)).toEqual({ ok: true, code: 'ok', reason: null, forzable: false })
  })

  it('IMPIDE coger una aplazada, y dice hasta cuándo y por qué', () => {
    const t = { ...tarea, snooze_until: '2026-08-11T07:00:00Z', snooze_reason: 'medir a los 14 días' }
    const g = claimGate(t, 'sid-a', HOY)
    expect(g.ok).toBe(false)
    expect(g.code).toBe('snoozed')
    expect(g.reason).toContain('2026-08-11')
    expect(g.reason).toContain('medir a los 14 días')
  })

  it('el aplazamiento vence SOLO: pasada la hora vuelve a ser reclamable', () => {
    const t = { ...tarea, snooze_until: '2026-07-29T11:59:00Z' }
    expect(claimGate(t, 'sid-a', HOY).ok).toBe(true)
  })

  it('IMPIDE coger una bloqueada por otra tarea VIVA, y la nombra', () => {
    const t = { ...tarea, blocked_by: ['T-99'] }
    const g = claimGate(t, 'sid-a', HOY, new Set(['T-99']))
    expect(g.code).toBe('blocked')
    expect(g.reason).toContain('T-99')
  })

  it('una dependencia YA CERRADA no bloquea (no está en el conjunto de abiertas)', () => {
    const t = { ...tarea, blocked_by: ['T-99'] }
    expect(claimGate(t, 'sid-a', HOY, new Set()).ok).toBe(true)
  })

  it('el lease ajeno NO es forzable, el reloj y la dependencia SÍ', () => {
    // Forzar un lease vivo sería pisar trabajo de otra sesión; forzar el reloj es
    // adelantar preparación, que es legítimo si se declara.
    const leased = { ...tarea, claimed_by: 'otra', lease_until: '2026-07-29T13:00:00Z' }
    expect(claimGate(leased, 'sid-a', HOY)).toMatchObject({ code: 'leased', forzable: false })
    const dormida = { ...tarea, snooze_until: '2026-08-11T07:00:00Z' }
    expect(claimGate(dormida, 'sid-a', HOY).forzable).toBe(true)
    const bloqueada = { ...tarea, blocked_by: ['T-99'] }
    expect(claimGate(bloqueada, 'sid-a', HOY, new Set(['T-99'])).forzable).toBe(true)
  })

  it('una cerrada no se coge ni forzando', () => {
    const t = { ...tarea, status: 'done' as const }
    expect(claimGate(t, 'sid-a', HOY)).toMatchObject({ code: 'closed', forzable: false })
  })

  it('el lease ajeno se comprueba ANTES que el reloj (el motivo más útil primero)', () => {
    const t = { ...tarea, claimed_by: 'otra', lease_until: '2026-07-29T13:00:00Z', snooze_until: '2026-08-11T07:00:00Z' }
    expect(claimGate(t, 'sid-a', HOY).code).toBe('leased')
  })

  it('re-claim de la MISMA sesión sigue siendo idempotente aunque esté aplazada… no: el reloj manda', () => {
    // Matiz deliberado: que la tarea sea tuya no adelanta la fecha externa. Si la
    // pausaste hasta el 11/08, tampoco tú tienes nada que hacer hoy.
    const t = { ...tarea, claimed_by: 'sid-a', snooze_until: '2026-08-11T07:00:00Z' }
    expect(claimGate(t, 'sid-a', HOY).code).toBe('snoozed')
  })
})

describe('isChronicSnooze', () => {
  it('marca la tarea aplazada 3+ veces (aplazar en bucle es no decidir)', () => {
    expect(isChronicSnooze({ ...tarea, snooze_count: 3 })).toBe(true)
    expect(isChronicSnooze({ ...tarea, snooze_count: 2 })).toBe(false)
    expect(isChronicSnooze({ ...tarea, snooze_count: null })).toBe(false)
  })
})

describe('findDateLockedTitles', () => {
  it('caza los candados imperativos reales (T-221 y T-234)', () => {
    const hits = findDateLockedTitles([
      { id: 'T-221', title: '⛔ NO COGER HASTA EL 29/07 07:00 UTC (esperando la cosecha del cron)' },
      { id: 'T-234', title: '⏱ MEDIR EL 11/08 — 873 usuarios estudian con una oposición que no existe' },
    ])
    expect(hits.map(h => h.id)).toEqual(['T-221', 'T-234'])
  })

  it('NO marca la fecha descriptiva, que es información legítima del título', () => {
    // Precisión sobre recall: estos dos son títulos correctos y deben pasar.
    const hits = findDateLockedTitles([
      { id: 'T-162', title: '`detect-notas-convocatoria` no COMPLETA una ejecución desde el 24/07' },
      { id: 'T-276', title: 'Las preguntas generadas desde el 23/07 nacen no barajables' },
      { id: 'T-999', title: 'Newsletters de las 4 convocatorias con plazo abierto' },
    ])
    expect(hits).toEqual([])
  })

  it('caza "esperar a" y "hasta el <fecha>" sin emoji', () => {
    const hits = findDateLockedTitles([
      { id: 'T-1', title: 'Esperar a que el cron coseche y entonces medir' },
      { id: 'T-2', title: 'Rehacer el scope hasta el 30/07' },
    ])
    expect(hits.map(h => h.id)).toEqual(['T-1', 'T-2'])
  })
})

describe('espera de DEPLOY (no es un reloj: no hay fecha que poner)', () => {
  it('IMPIDE coger una tarea cuyo commit aún no está desplegado, y dice cuál', () => {
    const t = { ...tarea, wake_on_deploy_sha: 'abc1234567', wake_on_deploy_surface: 'frontend' }
    const g = claimGate(t, 'sid-a', HOY)
    expect(g.code).toBe('awaiting_deploy')
    expect(g.reason).toContain('abc12345')
    expect(g.reason).toContain('frontend')
    expect(g.forzable).toBe(true)   // se puede adelantar preparación declarándolo
  })

  it('el reloj se comprueba antes que el deploy (si tiene los dos, manda la fecha)', () => {
    const t = { ...tarea, snooze_until: '2026-08-11T07:00:00Z', wake_on_deploy_sha: 'abc' }
    expect(claimGate(t, 'sid-a', HOY).code).toBe('snoozed')
  })

  it('sin commit pendiente no bloquea nada', () => {
    expect(claimGate({ ...tarea, wake_on_deploy_sha: null }, 'sid-a', HOY).ok).toBe(true)
  })
})

describe('deployWakeReady', () => {
  const t = (surface: string) => ({ wake_on_deploy_sha: 'abc', wake_on_deploy_surface: surface })

  it('frontend: despierta cuando el frontend ya lo lleva', () => {
    expect(deployWakeReady(t('frontend'), { frontend: true, backend: false })).toBe(true)
    expect(deployWakeReady(t('frontend'), { frontend: false, backend: true })).toBe(false)
  })

  it('backend: idem al revés', () => {
    expect(deployWakeReady(t('backend'), { frontend: true, backend: false })).toBe(false)
    expect(deployWakeReady(t('backend'), { frontend: false, backend: true })).toBe(true)
  })

  it('both exige las DOS: despertar a medias manda a verificar algo incompleto', () => {
    expect(deployWakeReady(t('both'), { frontend: true, backend: false })).toBe(false)
    expect(deployWakeReady(t('both'), { frontend: true, backend: true })).toBe(true)
  })

  it('sin superficie declarada se comporta como both (lo conservador)', () => {
    expect(deployWakeReady({ wake_on_deploy_sha: 'abc' }, { frontend: true })).toBe(false)
  })

  it('una tarea que no espera deploy siempre está lista', () => {
    expect(deployWakeReady({ wake_on_deploy_sha: null }, {})).toBe(true)
  })
})

// ── Aviso de vuelta: quién está LISTA PARA VERIFICAR (T-285) ──────────────
//
// El deploy despierta tareas de otras sesiones, pero el aviso se imprimía solo en
// el log del deploy: quien pausó la tarea no se enteraba nunca. Estos predicados
// son los que la sacan a `list`, que es donde las sesiones sí miran.
describe('isAwaitingVerification — el aviso de vuelta', () => {
  const pausada = {
    id: 'T-9', status: 'open', resume_check: 'comprobar que el badge baja a 0',
    wake_on_deploy_sha: null, snooze_until: null, claimed_by: null, lease_until: null,
  }

  it('pausada, ya desplegada y sin dueño → lista para verificar', () => {
    expect(isAwaitingVerification(pausada, HOY)).toBe(true)
  })

  it('si TODAVÍA espera el deploy, no se anuncia (aún no hay nada que verificar)', () => {
    expect(isAwaitingVerification({ ...pausada, wake_on_deploy_sha: 'abc1234' }, HOY)).toBe(false)
  })

  it('si espera un reloj que no ha vencido, tampoco', () => {
    const futuro = new Date(HOY.getTime() + 3600_000).toISOString()
    expect(isAwaitingVerification({ ...pausada, snooze_until: futuro }, HOY)).toBe(false)
  })

  it('con el reloj YA vencido sí: la espera terminó', () => {
    const pasado = new Date(HOY.getTime() - 60_000).toISOString()
    expect(isAwaitingVerification({ ...pausada, snooze_until: pasado }, HOY)).toBe(true)
  })

  it('si alguien la está trabajando (lease vivo) no es un aviso para el resto', () => {
    const lease = new Date(HOY.getTime() + 30 * 60_000).toISOString()
    expect(isAwaitingVerification({ ...pausada, claimed_by: 'sesion-b', lease_until: lease }, HOY)).toBe(false)
  })

  it('con el lease CADUCADO vuelve al pool de avisos', () => {
    const lease = new Date(HOY.getTime() - 60_000).toISOString()
    expect(isAwaitingVerification({ ...pausada, claimed_by: 'sesion-b', lease_until: lease }, HOY)).toBe(true)
  })

  it('sin `resume_check` no hay nada que verificar (no toda tarea abierta es un aviso)', () => {
    expect(isAwaitingVerification({ ...pausada, resume_check: null }, HOY)).toBe(false)
  })

  it('una tarea ya cerrada no se anuncia', () => {
    expect(isAwaitingVerification({ ...pausada, status: 'done' }, HOY)).toBe(false)
  })

  it('no revienta con basura', () => {
    expect(isAwaitingVerification(null as never, HOY)).toBe(false)
    expect(isAwaitingVerification({} as never, HOY)).toBe(false)
  })
})

describe('deployDebtLevel — cuándo toca desplegar si la política es AGRUPAR', () => {
  it('sin commits pendientes, al día', () => {
    expect(deployDebtLevel({ commits: 0, tareasEsperando: 0 }).nivel).toBe('al-dia')
  })

  it('commits pendientes y NADIE esperando → se sigue agrupando (la política es agrupar)', () => {
    expect(deployDebtLevel({ commits: 12, tareasEsperando: 0 }).nivel).toBe('acumulando')
  })

  it('UNA tarea esperando ya inclina la balanza: es trabajo hecho que no se puede cerrar', () => {
    expect(deployDebtLevel({ commits: 1, tareasEsperando: 1 }).nivel).toBe('toca-desplegar')
  })

  it('el motivo dice el porqué, no solo el veredicto', () => {
    expect(deployDebtLevel({ commits: 5, tareasEsperando: 2 }).motivo).toContain('2 tarea')
    expect(deployDebtLevel({ commits: 5, tareasEsperando: 0 }).motivo).toContain('5 commit')
  })

  it('no revienta sin argumentos', () => {
    expect(deployDebtLevel().nivel).toBe('al-dia')
  })
})

// ── La puerta que impide cerrar en falso (30/07) ─────────────────────────
//
// Manuel: «pon un guardarraíl para que cuando trabajes sobre las tareas pongas cuándo retomarlas,
// porque si no se quedan en el olvido y tengo que fiarme de que tú te acuerdes».
// Exacto: programar la vuelta no puede depender de la memoria de nadie. Si el texto con el que se
// cierra una tarea confiesa que queda trabajo, el CLI se NIEGA y manda a `pause`, que sí agenda
// el regreso. Es una puerta, no un aviso: un aviso se ignora justo cuando hay prisa.
// ── UNA MEDIDA DEL PASADO NO ES UN PLAZO (T-499) ────────────────────────────────────────────
// El marcador temporal nació para cazar *«medir en 14 días»*, pero casaba igual con *«medido
// sobre 30 días de historial»*, que es lo contrario. Pasó cerrando [T-497] y costó caro: al
// aislar qué disparaba la puerta, la tarea se cerró con el outcome literal «test».
describe('detectarTrabajoPendiente — el pasado no es futuro', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { detectarTrabajoPendiente } = require('@/lib/backlog/claimGate.cjs')

  it.each([
    ['está medido: en 30 días ROBUSTEZ_GUARD_SKIP no aparece ni una vez'],
    ['contadas en 7 días: 24 escapes de 70 bloqueos'],
    ['medido en 30 días de historial, cero usos'],
  ])('una ventana YA medida no bloquea el cierre: %s', (txt) => {
    expect(detectarTrabajoPendiente(txt).pendiente).toBe(false)
  })

  it.each([
    ['hay que medir en 14 días el efecto'],
    ['la campaña sale en 3 días'],
    ['se repite mañana'],
  ])('una promesa futura SIGUE bloqueando: %s', (txt) => {
    expect(detectarTrabajoPendiente(txt).pendiente).toBe(true)
  })

  // Con una ventana ancha, un outcome que mezcla las dos cosas se eximiría entero por la palabra
  // del principio — y ahí sí queda trabajo. La pista tiene que estar PEGADA a la fecha.
  it('mezclar medida pasada y promesa futura NO exime: la pista tiene que estar pegada', () => {
    expect(detectarTrabajoPendiente('medido hace 30 días; hay que repetirlo en 14 días').pendiente).toBe(true)
  })

  // La exención es un matiz, no una amnistía: relajar el patrón entero abriría el caso que la
  // puerta existe para cazar (T-363 se cerró con el código sin desplegar).
  it('los demás marcadores no se relajan por hablar en pasado', () => {
    expect(detectarTrabajoPendiente('medido en 30 días; queda desplegarlo').pendiente).toBe(true)
    expect(detectarTrabajoPendiente('medido en 30 días; falta la migración').pendiente).toBe(true)
  })

  // Un guardarraíl que no dice QUÉ frase lo disparó empuja a probar outcomes hasta que uno pase.
  it('dice qué fragmento lo disparó, no solo la categoría', () => {
    const r = detectarTrabajoPendiente('esto queda a medias')
    expect(r.fragmento).toBe('queda')
  })
})

describe('detectarTrabajoPendiente — cerrar en falso deja de ser posible', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { detectarTrabajoPendiente, clasificarEspera } = require('@/lib/backlog/claimGate.cjs') as {
    detectarTrabajoPendiente: (o: unknown) => { pendiente: boolean; motivo: string | null }
    clasificarEspera: (r: unknown) => string
  }

  it.each([
    ['Arreglado y pusheado. PENDIENTE: desplegar backend.', 'pendiente'],
    ['Hecho, falta verificar el barrido de mañana', 'falta'],
    ['Calibrado; queda la contrapartida de answerCapped', 'queda'],
    ['Todo en main pero sin desplegar', 'desplegar'],
    ['Entregado, hay que comprobar el pico de las 12h', 'comprobación'],
    ['Listo; verificar tras el deploy', 'verificación'],
    ['Cerrado, medir en 14 días el efecto', 'futuro'],
  ])('BLOQUEA: %s', (outcome) => {
    expect(detectarTrabajoPendiente(outcome).pendiente).toBe(true)
  })

  it.each([
    'Verificado en producción: el barrido no abrió ninguna señal falsa.',
    'Entregado: 25 tests verdes y validado contra los datos reales.',
    'Descartada — la medición dice que no compensa.',
    'Consolidados los 6 grupos duplicados; censo posterior a cero.',
  ])('deja cerrar: %s', (outcome) => {
    expect(detectarTrabajoPendiente(outcome).pendiente).toBe(false)
  })

  it('dice POR QUÉ bloquea (si no, se lee como un capricho del CLI)', () => {
    const r = detectarTrabajoPendiente('hecho pero falta desplegar')
    expect(r.pendiente).toBe(true)
    expect(r.motivo).toBeTruthy()
  })

  it('sin outcome no opina (ese caso ya lo corta el CLI por otro lado)', () => {
    expect(detectarTrabajoPendiente(null).pendiente).toBe(false)
    expect(detectarTrabajoPendiente('').pendiente).toBe(false)
    expect(detectarTrabajoPendiente(42).pendiente).toBe(false)
  })
})

describe('clasificarEspera — verificación nuestra vs decisión de Manuel', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { clasificarEspera } = require('@/lib/backlog/claimGate.cjs') as {
    clasificarEspera: (r: unknown) => string
  }

  it.each([
    'DECISION DE MANUEL: encender FEATURE_TEMARIO_PDF_PARTES',
    'ESPERANDO a que Manuel avise de que koigrid borró la copia',
    'DECIDIR el diseño de carril/prioridad',
    'Necesita OK de Manuel antes de tocar producción',
  ])('espera a Manuel: %s', (t) => {
    expect(clasificarEspera(t)).toBe('decision')
  })

  it.each([
    'Comprobar el barrido automático de las 07:30 UTC',
    'Que crezca el corpus de huellas v2 y aparezcan bloqueos',
    'MEDIR EL PICO (11:00-13:00 CEST)',
  ])('la verificamos nosotros: %s', (t) => {
    expect(clasificarEspera(t)).toBe('verificacion')
  })

  it('ante la duda, verificación: esconder una comprobación es peor que colar una decisión', () => {
    expect(clasificarEspera(null)).toBe('verificacion')
    expect(clasificarEspera('')).toBe('verificacion')
    expect(clasificarEspera('texto cualquiera sin marcadores')).toBe('verificacion')
  })
})

// Exenciones del detector, sacadas de OUTCOMES REALES al revisar 70 cierres (30/07).
// Sin ellas la puerta bloquea cierres legítimos, y un guardarraíl que estorba acaba esquivándose
// con `--igualmente` — que es como mueren los guardarraíles.
describe('detectarTrabajoPendiente — narrar un pendiente YA resuelto no es dejar trabajo', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { detectarTrabajoPendiente } = require('@/lib/backlog/claimGate.cjs') as {
    detectarTrabajoPendiente: (o: unknown) => { pendiente: boolean; motivo: string | null }
  }

  it.each([
    'HECHO 20/07. El pendiente era Osakidetza Decreto 255/1997: la ficha decía 7 arts bilingües',
    'CERRADA por la auditoría del backlog: ya estaba resuelta. Prueba: el drenaje descrito',
    'Consolidados los 6 grupos de leyes duplicadas (censo posterior: 0 grupos partiendo trabajo)',
    'CANCELADA / WONTFIX (Manuel, 24/07): NO se trocean los artículos-cajón',
    'visual_deixis_no_image 5 findings -> 0; las 5 eran falsos positivos',
  ])('deja cerrar (es historia, no deuda): %s', (o) => {
    expect(detectarTrabajoPendiente(o).pendiente).toBe(false)
  })

  it.each([
    'Arreglado y pusheado. PENDIENTE: desplegar backend.',
    'Key de idempotencia del email en main, falta desplegar',
    'Hecho, falta verificar el barrido de mañana',
  ])('sigue bloqueando lo que de verdad queda: %s', (o) => {
    expect(detectarTrabajoPendiente(o).pendiente).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// T-449 — el gemelo que le faltaba a `pause`.
//
// `pause` sabe decir «esto está hecho a falta de que llegue un momento». Lo que NO había forma de
// decir era «esto YA lo comprobé y la tarea sigue viva»: `done` la cerraría en falso, `pause`
// obligaría a inventarse una espera y `release` no toca `resume_check`, así que la suelta con el
// pendiente obsoleto intacto.
//
// Costó tiempo real el 01/08: `list` ofrecía T-385 arriba del todo como «IMPLEMENTADA Y SIN
// COMPROBAR» con un pendiente que otra sesión acababa de resolver, y una tercera montó un
// worktree para repetir trabajo hecho. Lo paga siempre la sesión más diligente: la que hace caso
// al orden sugerido.
// ════════════════════════════════════════════════════════════════════════════
describe('puedeMarcarseVerificada — «ya lo comprobé» sin cerrar ni fingir una espera', () => {
  const lista = {
    id: 'T-9', status: 'open', resume_check: 'comprobar que el badge baja a 0',
    wake_on_deploy_sha: null, snooze_until: null, claimed_by: null, lease_until: null,
  }

  it('una tarea lista para verificar SÍ se puede marcar', () => {
    expect(puedeMarcarseVerificada(lista, 'sid-a', HOY)).toEqual({ ok: true })
  })

  it('la mía, con lease vivo, también (verificarla es parte de trabajarla)', () => {
    const lease = new Date(HOY.getTime() + 30 * 60_000).toISOString()
    expect(puedeMarcarseVerificada({ ...lista, claimed_by: 'sid-a', lease_until: lease }, 'sid-a', HOY).ok).toBe(true)
  })

  it('sin `resume_check` NO: no hay nada que marcar, y el verbo no es decorativo', () => {
    const v = puedeMarcarseVerificada({ ...lista, resume_check: null }, 'sid-a', HOY)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/nada pendiente de comprobar/)
  })

  it('CERRADA no: una tarea cerrada no se verifica, se reabre', () => {
    const v = puedeMarcarseVerificada({ ...lista, status: 'done' }, 'sid-a', HOY)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/se reabre/)
  })

  // Este es el caso que de verdad protege el invariante: si el código no está vivo, la
  // comprobación NO se ha podido hacer. Marcarla sería escribir la misma mentira que el verbo
  // viene a borrar, solo que en la otra dirección.
  it('si TODAVÍA espera un deploy NO: sin estar vivo no has podido comprobarlo', () => {
    const v = puedeMarcarseVerificada({ ...lista, wake_on_deploy_sha: 'abc1234' }, 'sid-a', HOY)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/DEPLOY/)
  })

  it('si espera un RELOJ que no ha vencido tampoco: hasta esa hora no hay nada que mirar', () => {
    const futuro = new Date(HOY.getTime() + 3600_000).toISOString()
    const v = puedeMarcarseVerificada({ ...lista, snooze_until: futuro }, 'sid-a', HOY)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/RELOJ/)
  })

  it('con el reloj ya vencido sí: la espera terminó', () => {
    const pasado = new Date(HOY.getTime() - 60_000).toISOString()
    expect(puedeMarcarseVerificada({ ...lista, snooze_until: pasado }, 'sid-a', HOY).ok).toBe(true)
  })

  it('la que OTRA sesión tiene con lease vivo NO se toca: su dueño sabe mejor si comprobó', () => {
    const lease = new Date(HOY.getTime() + 30 * 60_000).toISOString()
    const v = puedeMarcarseVerificada({ ...lista, claimed_by: 'sesion-b', lease_until: lease }, 'sid-a', HOY)
    expect(v.ok).toBe(false)
    expect(v.motivo).toMatch(/coordina/)
  })

  it('pero si su lease ya VENCIÓ sí, igual que hace `claim` (no se espera a los muertos)', () => {
    const vencido = new Date(HOY.getTime() - 60_000).toISOString()
    expect(puedeMarcarseVerificada({ ...lista, claimed_by: 'sesion-b', lease_until: vencido }, 'sid-a', HOY).ok).toBe(true)
  })

  it('una tarea que no existe no revienta: contesta que no', () => {
    expect(puedeMarcarseVerificada(null, 'sid-a', HOY).ok).toBe(false)
  })
})
