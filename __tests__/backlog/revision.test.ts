/**
 * @jest-environment node
 */
// La QUINTA espera: «hecho, esperando que una persona lo revise». (T-539)
//
// El backlog modelaba cuatro esperas con su campo cada una (persona, tarea, reloj, deploy) y
// `claim` las impide todas. La quinta se DEDUCÍA del texto de `resume_check` con cinco expresiones
// regulares, y el propio comentario defendía la heurística: *«no hay campo para esto y añadir uno
// costaría una migración para algo que se resuelve leyendo lo que la gente YA escribe»*.
//
// La primera vuelta del piloto de flota (04/08) lo desmintió: el trabajador terminó una auditoría,
// dejó una propuesta lista para revisar y NO TENÍA COMANDO con el que decirlo. Acabó en
// `pause --hasta "2026-08-06 09:00"` con una fecha inventada, porque su bloqueo no era el reloj.
// Mismo patrón ya corregido dos veces aquí (`snooze_until`, `due_at`): una condición en prosa no
// es una condición.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const REV = require('@/lib/backlog/revision.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { claimGate, isAwaitingVerification, clasificarEspera } = require('@/lib/backlog/claimGate.cjs')

const AHORA = new Date('2026-08-04T15:00:00Z')
const haceH = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()

const entregada = (over: Record<string, any> = {}) => ({
  id: 'T-533', title: 'Auditoría de scope de Cantabria T6', status: 'open',
  review_requested_at: haceH(2), review_note: 'propuesta de recorte 25-37 verificada contra el BOC, sin aplicar',
  review_requested_by: 'piloto-t533-fedora-b3c66a', ...over,
})

describe('la entrega es obligatoria y tiene que decir QUÉ revisar', () => {
  it('un entregable descrito vale', () => {
    expect(REV.validarEntrega('propuesta de recorte 25-37 verificada contra el BOC, sin aplicar').ok).toBe(true)
  })

  it.each([['revisar'], ['listo'], ['hecho'], ['ok'], ['mirar']])(
    '«%s» no dice qué revisar', (v) => {
      const r = REV.validarEntrega(v)
      expect(r.ok).toBe(false)
      expect(r.problema).toBeTruthy()
    })

  it('vacío o demasiado corto no cuela: sería un «mírame» sin objeto', () => {
    expect(REV.validarEntrega('').ok).toBe(false)
    expect(REV.validarEntrega('x'.repeat(REV.ENTREGA_MIN - 1)).ok).toBe(false)
    expect(REV.validarEntrega('x'.repeat(REV.ENTREGA_MIN)).ok).toBe(true)
  })
})

describe('el CAMPO manda sobre la redacción', () => {
  it('una tarea entregada cae en «revision» aunque su texto no diga nada', () => {
    expect(REV.clasificarEsperaTarea(entregada({ resume_check: 'falta comprobar en producción' }), clasificarEspera))
      .toBe('revision')
  })

  // Sin este respaldo, el día que entre la columna las tareas que hoy están en el cajón 🙋 por su
  // redacción se caerían al de «verificar», que es justo el fallo que se está corrigiendo.
  it('sin campo, se sigue respetando la heurística legacy de las filas antiguas', () => {
    const vieja = { id: 'T-1', resume_check: 'esperando una decisión de Manuel sobre el precio' }
    expect(REV.clasificarEsperaTarea(vieja, clasificarEspera)).toBe('decision')
  })

  it('sin campo y sin marcador, sigue siendo verificación', () => {
    expect(REV.clasificarEsperaTarea({ id: 'T-1', resume_check: 'mirar el panel' }, clasificarEspera))
      .toBe('verificacion')
  })
})

describe('claim la impide, como a las otras cuatro esperas', () => {
  it('no se entrega a nadie sin --force', () => {
    const g = claimGate(entregada(), 'otra-sesion', AHORA)
    expect(g.ok).toBe(false)
    expect(g.code).toBe('awaiting_review')
    expect(g.reason).toMatch(/revisión humana/)
  })

  it('es forzable, porque a veces hay que seguir — pero deja registro', () => {
    expect(claimGate(entregada(), 'otra-sesion', AHORA).forzable).toBe(true)
  })

  it('tampoco se la queda quien la entregó: entregar es soltarla', () => {
    expect(claimGate(entregada(), 'piloto-t533-fedora-b3c66a', AHORA).ok).toBe(false)
  })

  // Un lease ajeno vivo NO es forzable; la revisión sí. Si el orden estuviera al revés, una tarea
  // entregada por una sesión viva se leería como «la tiene otra sesión, espera», que es distinto.
  it('la revisión se comprueba después del lease ajeno y antes del deploy', () => {
    const conDeploy = entregada({ wake_on_deploy_sha: 'abc1234' })
    expect(claimGate(conDeploy, 'x', AHORA).code).toBe('awaiting_review')
  })
})

describe('entregada NO es «lista para verificar»', () => {
  // La primera la desbloquea una persona mirando el entregable; la segunda la desbloqueamos
  // nosotros comprobando producción. Mezclarlas mandaría a cerrar «en minutos» algo sin aprobar.
  it('con entrega pendiente no aparece en la lista de verificar', () => {
    expect(isAwaitingVerification(entregada({ resume_check: 'comprobar en producción' }), AHORA)).toBe(false)
  })

  it('sin entrega pendiente, la lista de verificar funciona igual que antes', () => {
    expect(isAwaitingVerification(
      { status: 'open', resume_check: 'comprobar en producción', review_requested_at: null }, AHORA)).toBe(true)
  })
})

describe('lo que se le enseña a quien revisa', () => {
  it('dice desde cuándo espera: una revisión parada días es EL dato', () => {
    expect(REV.esperandoDesde(entregada({ review_requested_at: haceH(50) }), AHORA)).toMatch(/2 día/)
    expect(REV.esperandoDesde(entregada({ review_requested_at: haceH(3) }), AHORA)).toMatch(/3 h/)
    expect(REV.esperandoDesde(entregada({ review_requested_at: new Date(AHORA).toISOString() }), AHORA))
      .toMatch(/menos de 1 h/)
  })

  it('la línea lleva el entregable y quién lo dejó', () => {
    const l = REV.lineaRevision(entregada(), AHORA)
    expect(l).toContain('T-533')
    expect(l).toContain('propuesta de recorte')
    expect(l).toMatch(/la dejó piloto-t533/)
  })

  // ── EL SID SE ABREVIA POR SEGMENTO, NO POR LONGITUD (T-538) ────────────────────────────────
  // Cortar por caracteres corta justo por donde no es: la forma canónica es
  // `<nombre>-<máquina>-<azar>`, con lo distintivo al principio. Medido el 04/08 con cinco
  // sesiones del mismo día (imp-04ago-b/-c/-d/-e/-g): a 8 caracteres las cinco se escriben igual,
  // y quien lee reconoce como suya una fila ajena.
  it('el sid de quien entregó se abrevia por segmento, sin arrastrar máquina ni azar', () => {
    const l = REV.lineaRevision(entregada({ review_requested_by: 'piloto-t533-fedora-b3c66a' }), AHORA)
    expect(l).toContain('la dejó piloto-t533')
    expect(l).not.toContain('fedora')       // con un slice(0,18) esto entraría
    expect(l).not.toContain('b3c66a')
  })

  it('y el motivo del rechazo del claim usa la misma abreviatura', () => {
    const g = claimGate(entregada({ review_requested_by: 'piloto-t533-fedora-b3c66a' }), 'x', AHORA)
    expect(g.reason).toContain('piloto-t533')
    expect(g.reason).not.toContain('fedora')
  })

  // Un sid que NO tiene la forma de los nuestros (uno viejo, un UUID del entorno) no se toca:
  // más vale una línea larga que una abreviatura que colisiona.
  it('un sid ajeno a nuestra convención no se recorta', () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000'
    expect(REV.lineaRevision(entregada({ review_requested_by: uuid }), AHORA)).toContain(uuid)
  })

  it('sobre una tarea que no espera revisión no inventa nada', () => {
    expect(REV.lineaRevision({ id: 'T-1' })).toBeNull()
    expect(REV.esperandoDesde({ id: 'T-1' })).toBeNull()
    expect(REV.esperaRevision(null)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════════
// DOS ESTADOS, NO UNO (T-486, 06/08) — lo que el ciclo se dejó al estrenarse
//
// Al montar la revisión entre trabajadores se leyó solo `review_requested_at`, y eso metió en el
// mismo cajón a la entrega que nadie ha mirado y a la que YA tiene veredicto. Se midió el mismo
// día contra la BD real: de 19 entregas vivas, 4 estaban revisadas y las 19 se anunciaban como
// «esperando que las revises». Consecuencias medidas:
//   · el veredicto —el resultado del trabajo de otro trabajador— no aparecía en ninguna pantalla;
//   · `claim` contestaba «esperando revisión humana» a una devuelta con `problemas`, o sea que
//     retomar lo que el propio veredicto pedía retomar exigía `--force`;
//   · y `revisado` no soltaba el claim, así que T-244 y T-397 quedaron `in_progress` con el lease
//     vivo de un trabajador muerto: `reap` no las siega (respeta el lease) y `claim` no las da.
// ═══════════════════════════════════════════════════════════════════════════════════════════

const revisada = (over: Record<string, any> = {}) => entregada({
  reviewed_at: haceH(1), reviewed_by: 'w3-vence-flota-w1-9f2a1c',
  review_verdict: 'ok', review_findings: 'leí el diff entero y reproduje la causa contra el BOE',
  ...over,
})

describe('«espera revisión» deja de ser cierto en cuanto alguien la revisa', () => {
  it('sin mirar: espera revisor, no decisión', () => {
    expect(REV.esperaRevision(entregada())).toBe(true)
    expect(REV.esperaDecision(entregada())).toBe(false)
    expect(REV.yaRevisada(entregada())).toBe(false)
  })

  it('ya revisada: espera DECISIÓN, y ya no cuenta como pendiente de revisar', () => {
    expect(REV.esperaRevision(revisada())).toBe(false)
    expect(REV.esperaDecision(revisada())).toBe(true)
  })

  it('las dos siguen estando «en el circuito»: es lo que distingue de una tarea normal', () => {
    expect(REV.tieneEntrega(entregada())).toBe(true)
    expect(REV.tieneEntrega(revisada())).toBe(true)
    expect(REV.tieneEntrega({ id: 'T-1' })).toBe(false)
  })

  it('van a cajones distintos, que es todo el punto', () => {
    expect(REV.clasificarEsperaTarea(entregada(), clasificarEspera)).toBe('revision')
    expect(REV.clasificarEsperaTarea(revisada(), clasificarEspera)).toBe('decision')
  })
})

describe('el veredicto decide si la tarea vuelve al trabajo o espera a una persona', () => {
  it('«problemas» es trabajo pendiente otra vez, no una espera', () => {
    expect(REV.devueltaConProblemas(revisada({ review_verdict: 'problemas' }))).toBe(true)
    expect(REV.devueltaConProblemas(revisada({ review_verdict: 'ok' }))).toBe(false)
  })

  it('y por eso NO bloquea el claim: forzar lo que el sistema pide hacer no protege nada', () => {
    const g = claimGate(revisada({ review_verdict: 'problemas' }), 'otra-sesion', AHORA)
    expect(g.ok).toBe(true)
  })

  it('«ok» sí bloquea, pero diciendo su motivo REAL: falta mergear, no falta trabajo', () => {
    const g = claimGate(revisada({ review_verdict: 'ok' }), 'otra-sesion', AHORA)
    expect(g.ok).toBe(false)
    expect(g.code).toBe('awaiting_decision')
    expect(g.reason).toContain('mergee')
    expect(g.forzable).toBe(true)
  })

  it('la que nadie ha mirado sigue bloqueando como antes (no se ha aflojado nada)', () => {
    const g = claimGate(entregada(), 'otra-sesion', AHORA)
    expect(g.ok).toBe(false)
    expect(g.code).toBe('awaiting_review')
  })
})

describe('al retomar una devuelta, el veredicto no se pierde', () => {
  it('devuelve la nota que baja a progress_note, con quién la revisó y qué encontró', () => {
    const r = REV.retomarTrasProblemas(revisada({
      review_verdict: 'problemas',
      review_findings: 'la cifra «canarios 19/19» era un falso verde: RLS sin política da 0 filas',
    }))
    expect(r).not.toBeNull()
    expect(r.nota).toContain('DEVUELTA POR LA REVISIÓN')
    expect(r.nota).toContain('w3-vence-flota')        // abreviado por segmento, no por longitud
    expect(r.nota).toContain('falso verde')
  })

  it('y no dice nada de una que no es una devolución', () => {
    expect(REV.retomarTrasProblemas(revisada({ review_verdict: 'ok' }))).toBeNull()
    expect(REV.retomarTrasProblemas(entregada())).toBeNull()
    expect(REV.retomarTrasProblemas(null)).toBeNull()
  })

  // T-518 (06/08/2026): esta copia es la ÚNICA que sobrevive — al retomar, `review_findings`
  // se pone a NULL. Estaba cortada a 800 caracteres y los veredictos reales miden 2.400-4.600,
  // así que retomar destruía el 70-85% del trabajo de quien revisó. Y la cola es justo donde
  // están los problemas: un veredicto empieza por lo que está bien. Le pasó a T-443 y a T-518,
  // las dos cortadas a 843 caracteres exactos (43 del prefijo + 800), en mitad de la frase.
  it('conserva el veredicto ENTERO, por largo que sea (no lo recorta)', () => {
    const largo =
      'Empiezo por lo que está bien: ' + 'x'.repeat(3000) + ' PERO los problemas son: FALTA EL PUNTO 6.'
    const r = REV.retomarTrasProblemas(revisada({ review_verdict: 'problemas', review_findings: largo }))
    expect(r.nota).toContain(largo)
    expect(r.nota).toContain('FALTA EL PUNTO 6')      // la COLA, que es lo que se perdía
    expect(r.nota.length).toBeGreaterThan(3000)
  })

  it('el recorte vive en la IMPRESIÓN, no en el dato', () => {
    // Lo que no puede inundar la pantalla es la línea de `list`; el dato guardado va entero.
    const largo = 'y'.repeat(2000)
    const task = revisada({ review_verdict: 'problemas', review_findings: largo })
    expect(REV.lineaRevisada(task, AHORA)!.length).toBeLessThan(700)
    expect(REV.retomarTrasProblemas(task)!.nota.length).toBeGreaterThan(2000)
  })
})

describe('la línea de la ya revisada enseña el VEREDICTO (antes no se enseñaba en ningún sitio)', () => {
  it('un ok dice que la decisión es de quien lee', () => {
    const l = REV.lineaRevisada(revisada(), AHORA)
    expect(l).toContain('REVISADA sin problemas')
    expect(l).toContain('decides tú')
    expect(l).toContain('reproduje la causa contra el BOE')   // los hallazgos, no solo el sello
  })

  it('un problemas dice que vuelve, y lo canta distinto', () => {
    const l = REV.lineaRevisada(revisada({ review_verdict: 'problemas' }), AHORA)
    expect(l).toContain('CON PROBLEMAS')
    expect(l).toContain('vuelve a quien la retome')
  })

  it('no la pinta si aún no hay veredicto — ese es el otro cajón', () => {
    expect(REV.lineaRevisada(entregada(), AHORA)).toBeNull()
  })

  it('y la línea de «esperando revisión» deja de pintarse en cuanto hay veredicto', () => {
    expect(REV.lineaRevision(revisada(), AHORA)).toBeNull()
  })
})

describe('una entrega revisada tampoco es «lista para verificar»', () => {
  it('ni con veredicto ok ni con problemas: la desbloquea una persona, no producción', () => {
    const conPendiente = { resume_check: 'comprobar en producción', status: 'open' }
    expect(isAwaitingVerification({ ...revisada(), ...conPendiente })).toBe(false)
    expect(isAwaitingVerification({ ...revisada({ review_verdict: 'problemas' }), ...conPendiente })).toBe(false)
    // contraste: la misma fila SIN entrega sí es de verificar
    expect(isAwaitingVerification({ id: 'T-9', ...conPendiente })).toBe(true)
  })
})
