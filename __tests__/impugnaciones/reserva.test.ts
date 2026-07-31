/**
 * @jest-environment node
 */
// Cuándo una reserva de la cola vuelve a estar libre (T-412).
//
// Lo que se fija aquí es la salida al dilema que NINGÚN número resuelve: con un plazo fijo, o
// traicionas a la sesión viva que lleva horas con un caso difícil (y dos sesiones acaban en el
// mismo feedback — pasó el 31/07), o dejas un caso bloqueado horas cuando se apaga el ordenador.
// La reserva deja de caducar por reloj y pasa a caducar cuando MUERE SU SESIÓN.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { estadoReserva, sqlReservaLibre, MIN_HORAS, LATIDO_VIVO_MIN } = require('@/lib/impugnaciones/reserva.cjs')

const AHORA = new Date('2026-07-31T20:00:00Z')
const haceH = (h: number) => new Date(AHORA.getTime() - h * 3_600_000).toISOString()
const haceMin = (m: number) => new Date(AHORA.getTime() - m * 60_000).toISOString()
const YO = 'sid-yo'
const OTRA = 'sid-otra'

const run = (over: Record<string, any> = {}) => estadoReserva({
  claimedBy: OTRA, claimedAt: haceH(5), sesiones: [], sid: YO, ahora: AHORA, ...over,
})

describe('lo básico', () => {
  it('sin reservar → libre', () => {
    expect(run({ claimedBy: null }).libre).toBe(true)
  })
  it('la tuya siempre es tuya (re-abrir un caso no te lo quita)', () => {
    expect(run({ claimedBy: YO }).libre).toBe(true)
  })
})

describe('el SUELO: por debajo de él no se toca, pase lo que pase', () => {
  // Es lo que hace este cambio seguro: el peor caso posible sigue siendo el comportamiento de
  // hoy. Si la señal de vida fallara entera, seguiríamos con el reloj de siempre.
  it('una reserva reciente NO se libera aunque su sesión esté muerta', () => {
    const r = run({ claimedAt: haceH(MIN_HORAS - 0.5), sesiones: [{ sid: OTRA, last_signal_at: haceH(48) }] })
    expect(r.libre).toBe(false)
    expect(r.motivo).toMatch(/suelo/)
  })
})

describe('LAS CUATRO SITUACIONES QUE MOTIVARON EL CAMBIO', () => {
  // 1) La pregunta de Manuel: «¿y si se apaga el ordenador o la sesión se cuelga?»
  it('ordenador apagado / sesión colgada → la reserva se libera sola', () => {
    const r = run({ claimedAt: haceH(5), sesiones: [{ sid: OTRA, last_signal_at: haceH(3) }] })
    expect(r.libre).toBe(true)
    expect(r.motivo).toMatch(/no late/)
  })

  // 2) El caso que rompió el 31/07: con el reloj fijo, a las 2 h la perdía aunque siguiera ahí.
  it('revisión LARGA pero la sesión sigue viva → CONSERVA su reserva, sin tope de horas', () => {
    const r = run({ claimedAt: haceH(9), sesiones: [{ sid: OTRA, last_signal_at: haceMin(3) }] })
    expect(r.libre).toBe(false)
    expect(r.motivo).toMatch(/sigue viva/)
  })

  // 3) El dueño no está en el registro de latidos: no se puede afirmar nada.
  it('dueño sin latido publicado → manda el reloj, no se inventa un veredicto', () => {
    const r = run({ claimedAt: haceH(5), sesiones: [] })
    expect(r.libre).toBe(true)
    expect(r.motivo).toMatch(/no se puede confirmar/)
  })

  // 4) La frontera del silencio.
  it('justo dentro de la ventana de latido sigue reservada; justo fuera, libre', () => {
    const casi = run({ claimedAt: haceH(5), sesiones: [{ sid: OTRA, last_signal_at: haceMin(LATIDO_VIVO_MIN - 1) }] })
    const pasado = run({ claimedAt: haceH(5), sesiones: [{ sid: OTRA, last_signal_at: haceMin(LATIDO_VIVO_MIN + 1) }] })
    expect(casi.libre).toBe(false)
    expect(pasado.libre).toBe(true)
  })
})

describe('el motivo se puede LEER (si no, nadie entiende por qué no puede coger un caso)', () => {
  it('dice cuánto lleva y por qué', () => {
    expect(run({ claimedAt: haceH(9), sesiones: [{ sid: OTRA, last_signal_at: haceMin(2) }] }).motivo)
      .toMatch(/9\.0 h[\s\S]*latido hace 2 min/)
  })
})

// La reserva TIENE que decidirse dentro del UPDATE atómico, o dos sesiones que lean «libre» a la
// vez se la llevarían las dos — justo lo que esta cola existe para impedir. Por eso hay una
// versión SQL además de la versión JS, y por eso hay que vigilar que no diverjan.
describe('paridad JS ↔ SQL (el criterio que se EJECUTA es el SQL)', () => {
  const sql = sqlReservaLibre('f.', '$1')

  it('el SQL comprueba las mismas tres puertas que el JS', () => {
    expect(sql).toContain('f.claimed_by IS NULL')     // sin reservar
    expect(sql).toContain('f.claimed_by = $1')        // es tuya
    expect(sql).toContain('f.claimed_at <')           // el suelo por reloj
    expect(sql).toContain('worktree_sessions')        // …y la señal de vida
  })

  it('usa los MISMOS umbrales que el núcleo (si uno cambia, el otro también)', () => {
    expect(sql).toContain(`interval '${MIN_HORAS} hours'`)
    expect(sql).toContain(`interval '${LATIDO_VIVO_MIN} minutes'`)
  })

  it('el prefijo de tabla se aplica a TODAS las columnas (o el SQL no compila con join)', () => {
    const conPrefijo = sqlReservaLibre('f.', '$2')
    expect(conPrefijo).not.toMatch(/[^.]claimed_by IS NULL/)
    expect(conPrefijo).toContain('$2')
  })

  it('sin prefijo también es válido (las consultas de una sola tabla lo usan así)', () => {
    expect(sqlReservaLibre('', '$1')).toContain('claimed_by IS NULL')
  })
})
