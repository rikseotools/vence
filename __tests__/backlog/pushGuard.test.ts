/**
 * @jest-environment node
 */
// Unitarios de la lógica PURA del guardrail de push (lib/backlog/pushGuard.cjs). Importa la
// función REAL que corre el hook `.husky/pre-push` (vía scripts/backlog-push-guard.cjs), no una
// copia: así el test no da falso verde el día que el guard cambie.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractTaskIds, parseGitLog, clasificarMenciones, evaluatePush, fichaAusenteEnPush } = require('@/lib/backlog/pushGuard.cjs')

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

// ────────────────────────────────────────────────────────────────────────────────────────────
// CITA ≠ TRABAJO (T-403) — el cuarto bloqueo que empujaba al `BACKLOG_GUARD_SKIP=1`
//
// Las fichas de este repo se cruzan sin parar y los mensajes de commit copian esa costumbre, así
// que cuanto mejor escrito el commit, más probable que el guard lo parase. La regla se restringe
// a lo que la medida respalda: solo se relaja el cuerpo de un commit cuyo ASUNTO ya declara un
// id. Con el asunto mudo, el id del cuerpo puede ser el trabajo (medido: 17,2% lo era).
// ────────────────────────────────────────────────────────────────────────────────────────────
describe('parseGitLog — el pegamento del que depende toda la regla', () => {
  const { GIT_LOG_FORMAT } = require('@/lib/backlog/pushGuard.cjs')
  const RS = '\x1e'
  const FS = '\x1f'

  it('el formato que pide el bridge y el que lee el parser son EL MISMO', () => {
    // Vivían separados (el formato en el script, el parseo debajo) y ahí es donde se pierde la
    // distinción asunto/cuerpo sin que nadie lo note.
    expect(GIT_LOG_FORMAT).toBe(`--format=${RS}%s${FS}%b`)
  })

  it('separa asunto y cuerpo de varios commits', () => {
    const raw = `${RS}feat(T-400): el mapa de solape${FS}Nace de T-361.\n\nY de T-385.\n${RS}fix(T-361): una consulta${FS}`
    expect(parseGitLog(raw)).toEqual([
      { subject: 'feat(T-400): el mapa de solape', body: 'Nace de T-361.\n\nY de T-385.\n' },
      { subject: 'fix(T-361): una consulta', body: '' },
    ])
  })

  it('un cuerpo con saltos y líneas vacías NO se parte en commits falsos', () => {
    const raw = `${RS}fix(T-403): algo${FS}línea 1\n\nlínea 2\n\n  Co-Authored-By: alguien\n`
    const r = parseGitLog(raw)
    expect(r).toHaveLength(1)
    expect(r[0].body).toContain('Co-Authored-By')
  })

  it('commit sin cuerpo (git omite el campo) → cuerpo vacío, no asunto partido', () => {
    expect(parseGitLog(`${RS}chore: sin cuerpo`)).toEqual([{ subject: 'chore: sin cuerpo', body: '' }])
  })

  it('salida vacía de git → sin commits (y el guard no paga peaje)', () => {
    expect(parseGitLog('')).toEqual([])
    expect(parseGitLog(null)).toEqual([])
  })

  it('de punta a punta: lo que git escupe llega clasificado como cita', () => {
    const raw = `${RS}feat(T-400): las sesiones ven el solape${FS}Contexto: [T-361] y [T-385].\n`
    expect(clasificarMenciones({ commits: parseGitLog(raw), branch: 'sesion/x' }).mencionSolo.sort())
      .toEqual(['T-361', 'T-385'])
  })
})

describe('clasificarMenciones — qué declara el push y qué solo cita', () => {
  it('el caso T-400: el asunto declara, el cuerpo cita → las citas no exigen claim', () => {
    const r = clasificarMenciones({
      branch: 'sesion/central-derecho',
      commits: [{
        subject: 'feat(T-400): las sesiones ya pueden ver EN VIVO si van a los mismos ficheros',
        body: 'Nace de [T-361] y [T-385], donde el claim funcionó y aun así se duplicó trabajo.',
      }],
    })
    expect(r.referencedIds.sort()).toEqual(['T-361', 'T-385', 'T-400'])
    expect(r.mencionSolo.sort()).toEqual(['T-361', 'T-385'])
  })

  it('el caso T-408: varios ids en el asunto, uno citado en el cuerpo', () => {
    const r = clasificarMenciones({
      commits: [{ subject: 'fix(T-408, T-410): duplicados', body: 'El barrido ya existía en T-321.' }],
    })
    expect(r.mencionSolo).toEqual(['T-321'])
  })

  it('ASUNTO MUDO → el id del cuerpo SIGUE exigiendo claim (el 17,2% medido, caso T-089)', () => {
    // `docs(koigrid): …` con el id solo en el cuerpo es trabajo REAL de esa tarea: 22 commits
    // así en el historial. La regla literal de la ficha («el cuerpo nunca bloquea») los soltaba.
    const r = clasificarMenciones({
      commits: [{ subject: 'docs(koigrid): D5 — el restore gestionado tiene un tope de 30 min', body: 'Parte de T-089.' }],
    })
    expect(r.mencionSolo).toEqual([])
    expect(r.referencedIds).toEqual(['T-089'])
  })

  it('basta que UN commit del push lo declare para que sea trabajo en todo el push', () => {
    const r = clasificarMenciones({
      commits: [
        { subject: 'feat(T-400): el mapa de solape', body: 'contexto de T-361' },
        { subject: 'fix(T-361): el detector pasa a una consulta', body: '' },
      ],
    })
    expect(r.mencionSolo).toEqual([])
  })

  it('los ids de la RAMA declaran trabajo, no cita', () => {
    const r = clasificarMenciones({
      branch: 'feat/T-042-lo-que-sea',
      commits: [{ subject: 'chore(T-100): algo', body: 'ver T-042' }],
    })
    expect(r.mencionSolo).toEqual([])
  })

  it('sin ids → nada que verificar (el push normal no paga peaje)', () => {
    expect(clasificarMenciones({ commits: [{ subject: 'fix: typo', body: '' }] }).referencedIds).toEqual([])
    expect(clasificarMenciones({}).referencedIds).toEqual([])
  })
})

describe('evaluatePush — una tarea CITADA no exige claim', () => {
  const citando = (tasks: Record<string, any>, id: string) =>
    evaluatePush({ referencedIds: [id], tasksById: tasks, sid: SID, mencionSolo: [id], now: AHORA })

  it('PERMITE citar una tarea viva SIN reclamar (reclamarla le roba el reparto a quien sí la hará)', () => {
    const r = citando({ 'T-361': { status: 'open', claimed_by: null, lease_until: null } }, 'T-361')
    expect(r.allowed).toBe(true)
    expect(r.notices[0].reason).toMatch(/citada como contexto/)
  })

  it('PERMITE citar una que otra sesión tiene con lease VIVO — nombrarla no toca nada suyo', () => {
    // Aquí NO cede, a diferencia de «solo documento la ficha»: escribir la ficha ajena toca su
    // producto de trabajo; citarla en un párrafo no. Si cediera, no arreglaría el caso del 31/07.
    const r = citando({ 'T-385': { status: 'in_progress', claimed_by: OTRA, lease_until: mins(45) } }, 'T-385')
    expect(r.allowed).toBe(true)
  })

  it('NO abre el hueco del OLVIDO: la misma tarea DECLARADA sigue bloqueando', () => {
    const tasks = { 'T-361': { status: 'open', claimed_by: null, lease_until: null } }
    const r = evaluatePush({ referencedIds: ['T-361'], tasksById: tasks, sid: SID, mencionSolo: [], now: AHORA })
    expect(r.allowed).toBe(false)
    expect(r.violations[0].reason).toMatch(/sin reclamar/)
  })

  it('sin `mencionSolo` se comporta como antes (compatibilidad con quien no lo pase)', () => {
    const tasks = { 'T-361': { status: 'open', claimed_by: null, lease_until: null } }
    expect(evaluatePush({ referencedIds: ['T-361'], tasksById: tasks, sid: SID, now: AHORA }).allowed).toBe(false)
  })

  it('con citas y trabajo mezclados, solo bloquea lo DECLARADO', () => {
    const r = evaluatePush({
      referencedIds: ['T-400', 'T-361'],
      tasksById: {
        'T-400': { status: 'open', claimed_by: null, lease_until: null },   // declarada y sin claim → viola
        'T-361': { status: 'open', claimed_by: null, lease_until: null },   // citada → aviso
      },
      sid: SID, mencionSolo: ['T-361'], now: AHORA,
    })
    expect(r.violations.map((v: any) => v.id)).toEqual(['T-400'])
    expect(r.notices.map((n: any) => n.id)).toEqual(['T-361'])
  })
})

// ── EL ESCAPE CUESTA UN MOTIVO (T-497) ──────────────────────────────────────────────────────
// Mismo fallo que su hermano del índice compartido y con más volumen: 13 de 23 escapes medidos
// NUNCA respondieron a un bloqueo de esa sesión — el `=1` se arrastraba en el comando. Y este
// apaga el guard ENTERO para todos los ficheros del push.
describe('el escape del push-guard usa el criterio COMPARTIDO', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { evaluarEscape } = require('@/lib/observability/friccionSesiones.cjs')

  it('un «1» ya no abre la puerta', () => {
    expect(evaluarEscape('1')).toMatchObject({ usa: true, permitido: false })
  })

  it('un motivo de verdad sí, y se conserva para registrarlo', () => {
    const e = evaluarEscape('rehago historia; la ficha ya está cerrada')
    expect(e.permitido).toBe(true)
    expect(e.motivo).toContain('rehago historia')
  })

  // Dos criterios sobre lo que vale como escape acabarían divergiendo: es como nacieron los cinco
  // escritores de seguimiento_url (T-130). Hay UNA definición y los guardarraíles la comparten.
  it('es LA MISMA función que usa el guard del índice compartido', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const idx = require('@/lib/sessions/indiceCompartido.cjs')
    expect(idx.evaluarEscape).toBe(evaluarEscape)
  })

  it('el script del push-guard NO reimplementa el criterio', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const src = require('fs').readFileSync(require('path').join(process.cwd(), 'scripts/backlog-push-guard.cjs'), 'utf8')
    expect(src).toContain('evaluarEscape')
    // La comparación literal contra '1' es exactamente el agujero que esta tarea cierra.
    expect(src).not.toMatch(/BACKLOG_GUARD_SKIP\s*===\s*'1'/)
  })
})

// T-443: la ficha de T-435 se escribió, `sync` la reconcilió con la tabla, y `git log -S` no la
// encontró en NINGUNA revisión — se perdió antes de llegar a un commit. `mia_sin_escribir` ya
// distinguía el caso dentro de `sync`, pero solo se veía corriendo ese comando A MANO. Esto lo
// asoma en el momento en que de verdad importa: cuando el push va a publicar el estado.
describe('fichaAusenteEnPush — mi tarea se publica sin ficha en el markdown', () => {
  const MD_CON_T042 = '## Abiertas\n\n### [T-042] 🔴 [ABIERTO 01/08] Un título cualquiera\n\nCuerpo.\n'
  const MD_SIN_T042 = '## Abiertas\n\n### [T-099] 🔴 [ABIERTO 01/08] Otra tarea distinta\n\nCuerpo.\n'

  it('no dice nada si la ficha SÍ está en el markdown que se va a publicar', () => {
    const r = fichaAusenteEnPush({
      referencedIds: ['T-042'],
      tasksById: new Map([['T-042', { status: 'in_progress', claimed_by: SID }]]),
      sid: SID,
      mdHeadContent: MD_CON_T042,
    })
    expect(r).toEqual([])
  })

  it('avisa si la tarea es MÍA, está viva, y su ficha no aparece por ningún lado', () => {
    const r = fichaAusenteEnPush({
      referencedIds: ['T-042'],
      tasksById: new Map([['T-042', { status: 'in_progress', claimed_by: SID }]]),
      sid: SID,
      mdHeadContent: MD_SIN_T042,
    })
    expect(r).toEqual(['T-042'])
  })

  it('NO avisa de una tarea AJENA sin ficha: no es mi trabajo el que se pierde', () => {
    const r = fichaAusenteEnPush({
      referencedIds: ['T-042'],
      tasksById: new Map([['T-042', { status: 'in_progress', claimed_by: OTRA }]]),
      sid: SID,
      mdHeadContent: MD_SIN_T042,
    })
    expect(r).toEqual([])
  })

  it('NO avisa de una tarea CERRADA: su ficha puede vivir en otra sección (## Hechas)', () => {
    const r = fichaAusenteEnPush({
      referencedIds: ['T-042'],
      tasksById: new Map([['T-042', { status: 'done', claimed_by: SID }]]),
      sid: SID,
      mdHeadContent: MD_SIN_T042,
    })
    expect(r).toEqual([])
  })

  it('no confunde T-042 con T-4202 (límite de palabra en el id)', () => {
    const md = '### [T-4202] 🔴 [ABIERTO] Título\n'
    const r = fichaAusenteEnPush({
      referencedIds: ['T-042'],
      tasksById: new Map([['T-042', { status: 'in_progress', claimed_by: SID }]]),
      sid: SID,
      mdHeadContent: md,
    })
    expect(r).toEqual(['T-042'])
  })
})
