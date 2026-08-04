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

  it('sobre una tarea que no espera revisión no inventa nada', () => {
    expect(REV.lineaRevision({ id: 'T-1' })).toBeNull()
    expect(REV.esperandoDesde({ id: 'T-1' })).toBeNull()
    expect(REV.esperaRevision(null)).toBe(false)
  })
})
