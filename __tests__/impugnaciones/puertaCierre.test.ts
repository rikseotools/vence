/**
 * @jest-environment node
 */
// La puerta que exige tener el caso RESERVADO para poder cerrarlo (T-474).
//
// El defecto que arregla, medido el 01/08/2026 contra RDS: de 165 impugnaciones cerradas en 14
// días, **28 no habían pasado nunca por reserva**; de 111 feedbacks, **58**. Y en simulación con
// seis sesiones concurrentes, la que PERDÍA el claim cerraba la fila igualmente — la reserva
// protegía el reparto y no protegía el acto de responderle a la persona.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { puedeCerrar, comandoParaSatisfacer } = require('@/lib/impugnaciones/puertaCierre.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { MIN_HORAS, LATIDO_VIVO_MIN } = require('@/lib/impugnaciones/reserva.cjs')

const AHORA = new Date('2026-08-01T20:00:00Z')
const haceH = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString()
const YO = 'sid-yo'
const OTRA = 'sid-otra'
const viva = [{ sid: OTRA, last_signal_at: haceMin(3) }]
const muerta = [{ sid: OTRA, last_signal_at: haceH(12) }]

const run = (over: Record<string, any> = {}) =>
  puedeCerrar({ claimedBy: null, claimedAt: null, sesiones: [], sid: YO, ahora: AHORA, ...over })

describe('deja cerrar lo que es tuyo', () => {
  it('la tienes reservada → adelante', () => {
    const r = run({ claimedBy: YO, claimedAt: haceH(1) })
    expect(r.permitido).toBe(true)
    expect(r.clase).toBe('tuya')
  })

  it('sigue siendo tuya aunque lleves nueve horas con ella (no hay tope si es tuya)', () => {
    expect(run({ claimedBy: YO, claimedAt: haceH(9) }).permitido).toBe(true)
  })
})

describe('EL CASO GRAVE: otra sesión está en ello ahora mismo', () => {
  // Aquí el daño no es hipotético: si cierras, al usuario le llega un segundo correo y el
  // análisis de la otra sesión se tira a la basura.
  it('otra sesión VIVA la tiene → bloquea', () => {
    const r = run({ claimedBy: OTRA, claimedAt: haceH(4), sesiones: viva })
    expect(r.permitido).toBe(false)
    expect(r.clase).toBe('ajena')
    expect(r.motivo).toMatch(/sigue viva/)
  })

  it('reserva reciente de otra sesión → bloquea aunque no haya latido (el suelo manda)', () => {
    const r = run({ claimedBy: OTRA, claimedAt: haceH(MIN_HORAS - 0.5), sesiones: [] })
    expect(r.permitido).toBe(false)
    expect(r.clase).toBe('ajena')
  })
})

describe('cerrar SIN reservar también se bloquea, que es el fallo que se mide', () => {
  // Bloquear solo «es de otra» llega tarde: para cuando cierras, la otra sesión ya gastó el
  // trabajo. Lo que crea la colisión es trabajar sin reservar, porque entonces la cola le sigue
  // ofreciendo ese mismo caso a las demás.
  it('fila libre y no la has cogido → bloquea, y dice el comando exacto', () => {
    const r = run({ claimedBy: null })
    expect(r.permitido).toBe(false)
    expect(r.clase).toBe('sin_reservar')
    expect(comandoParaSatisfacer('abc-123')).toContain('cola.cjs claim abc-123')
  })

  it('la tenía otra sesión que YA murió, pero tampoco es tuya → bloquea (cógela y ciérrala)', () => {
    const r = run({ claimedBy: OTRA, claimedAt: haceH(6), sesiones: muerta })
    expect(r.permitido).toBe(false)
    expect(r.clase).toBe('sin_reservar')
    expect(r.motivo).toMatch(/ya no está/)
  })
})

describe('el escape existe, exige motivo y se distingue del resto', () => {
  // Principio 7: lo que hay que poder ver no es cuántas veces bloquea, sino cuántas se la rodea.
  it('--igualmente con motivo, fila LIBRE (nadie a quien pisar) → pasa, marcado como escape', () => {
    const r = run({ claimedBy: null, igualmente: 'la cola la daba por libre y ya la había analizado' })
    expect(r.permitido).toBe(true)
    expect(r.clase).toBe('escape')
    expect(r.motivo).toMatch(/ya la había analizado/)
  })

  it('--igualmente con motivo, dueña muerta → pasa, marcado como escape', () => {
    const r = run({ claimedBy: OTRA, claimedAt: haceH(6), sesiones: muerta, igualmente: 'sesión muerta, confirmado con Manuel' })
    expect(r.permitido).toBe(true)
    expect(r.clase).toBe('escape')
  })

  it('--igualmente vacío o en blanco NO cuenta como escape', () => {
    expect(run({ claimedBy: null, igualmente: '   ' }).permitido).toBe(false)
    expect(run({ claimedBy: null, igualmente: '' }).permitido).toBe(false)
  })
})

describe('T-609: el escape NO cubre el claim VIVO de otra sesión', () => {
  // 06/08/2026: cuatro cierres seguidos usaron `--igualmente` contra una reserva VIVA y mandaron
  // tres correos con un texto que Manuel había vetado ocho minutos antes. La reserva es la única
  // puerta que protege el reparto: un escape con motivo la anulaba ENTERA. Un claim vivo se
  // resuelve hablando con la otra sesión, no escapando — mismo criterio que [T-375] del backlog
  // (el push-guard deja de bloquear lo que no se puede satisfacer, pero sigue bloqueando un lease
  // vivo, porque eso sí tiene arreglo).
  it('otra sesión VIVA la tiene → --igualmente NO la salta, sigue "ajena"', () => {
    const r = run({ claimedBy: OTRA, claimedAt: haceH(4), sesiones: viva, igualmente: 'lo necesito ya' })
    expect(r.permitido).toBe(false)
    expect(r.clase).toBe('ajena')
  })

  it('reserva reciente de otra sesión (dentro del suelo) → --igualmente TAMPOCO la salta', () => {
    const r = run({ claimedBy: OTRA, claimedAt: haceH(MIN_HORAS - 0.5), sesiones: [], igualmente: 'lo necesito ya' })
    expect(r.permitido).toBe(false)
    expect(r.clase).toBe('ajena')
  })

  it('en cambio, sin reservar por NADIE, --igualmente sigue funcionando (nada que pisar)', () => {
    const r = run({ claimedBy: null, igualmente: 'motivo legítimo' })
    expect(r.permitido).toBe(true)
    expect(r.clase).toBe('escape')
  })
})

describe('FAIL-OPEN donde no se puede afirmar nada (principio 4 y 9)', () => {
  it('sin id de sesión no se exige reserva: no se puede pedir lo que no se sabe comprobar', () => {
    const r = run({ sid: null, claimedBy: OTRA, claimedAt: haceH(4), sesiones: viva })
    expect(r.permitido).toBe(true)
    expect(r.clase).toBe('sin_identidad')
  })
})

describe('la frontera del latido es la MISMA que la del reparto', () => {
  // Si la puerta de cierre y el reparto usaran umbrales distintos, habría casos que el reparto
  // entrega y el cierre no deja cerrar: un callejón sin salida.
  it('justo dentro de la ventana bloquea; justo fuera pasa a «sin_reservar»', () => {
    const dentro = run({ claimedBy: OTRA, claimedAt: haceH(5), sesiones: [{ sid: OTRA, last_signal_at: haceMin(LATIDO_VIVO_MIN - 1) }] })
    const fuera = run({ claimedBy: OTRA, claimedAt: haceH(5), sesiones: [{ sid: OTRA, last_signal_at: haceMin(LATIDO_VIVO_MIN + 1) }] })
    expect(dentro.clase).toBe('ajena')
    expect(fuera.clase).toBe('sin_reservar')
  })
})
