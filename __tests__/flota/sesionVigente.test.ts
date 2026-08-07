/**
 * [T-667] Un trabajador acumula una fila de `worktree_sessions` por cada identidad que ha tenido
 * (reinstalación, worktree recreado, `.session-id` nuevo). Quien resolvía «el sid de w1» hacía
 * `new Map(sesiones.map((s) => [s.slug, s.sid]))` — se queda con la ÚLTIMA fila que llegue, y la
 * consulta NO lleva `ORDER BY`, así que cuál gana es arbitrario.
 *
 * Medido en el VPS el 07/08: `w1` y `w2` tenían DOS filas cada uno y ganaba la del **05/08**. Con
 * el sid equivocado, `conTarea.has(sid)` da `false` para un trabajador que SÍ tiene tarea cogida:
 * se le cuenta libre, no se le reconoce el turno muerto y no se le devuelve SU tarea — el fallo
 * que más caro sale (w1, seis horas con T-168 cogida sin que nadie la retomara).
 */
const MAQ = require('@/lib/flota/maquinas.cjs')

const vieja = { slug: 'w1', sid: 'w1-VIEJA', last_signal_at: '2026-08-05T10:28:00Z' }
const viva = { slug: 'w1', sid: 'w1-VIVA', last_signal_at: '2026-08-07T13:31:00Z' }

describe('[T-667] sesionVigente — manda la señal de vida, no el orden de llegada', () => {
  it('con dos filas del mismo trabajador se queda con la que latió más tarde', () => {
    expect(MAQ.sesionVigente([vieja, viva]).get('w1').sid).toBe('w1-VIVA')
  })

  it('y da igual en qué orden vengan: es lo que fallaba, porque la consulta no ordena', () => {
    // El caso real llegaba con la vieja DETRÁS, y por eso ganaba. Un test que solo probara un
    // orden habría pasado con el código roto.
    expect(MAQ.sesionVigente([viva, vieja]).get('w1').sid).toBe('w1-VIVA')
  })

  it('una fila SIN señal nunca le gana a una que la tiene, venga donde venga', () => {
    const muda = { slug: 'w1', sid: 'w1-MUDA', last_signal_at: null }
    expect(MAQ.sesionVigente([muda, viva]).get('w1').sid).toBe('w1-VIVA')
    expect(MAQ.sesionVigente([viva, muda]).get('w1').sid).toBe('w1-VIVA')
  })

  it('si NINGUNA tiene señal se queda con una, sin reventar', () => {
    const a = { slug: 'w1', sid: 'a', last_signal_at: null }
    const b = { slug: 'w1', sid: 'b', last_signal_at: null }
    expect(['a', 'b']).toContain(MAQ.sesionVigente([a, b]).get('w1').sid)
  })

  it('no mezcla trabajadores ni se traga filas sin slug', () => {
    const w2 = { slug: 'w2', sid: 'w2-VIVA', last_signal_at: '2026-08-07T19:05:00Z' }
    const m = MAQ.sesionVigente([vieja, viva, w2, null, { sid: 'sin-slug' }])
    expect(m.get('w1').sid).toBe('w1-VIVA')
    expect(m.get('w2').sid).toBe('w2-VIVA')
    expect(m.size).toBe(2)
  })

  it('entrada vacía o ausente devuelve un Map vacío', () => {
    expect(MAQ.sesionVigente([]).size).toBe(0)
    expect(MAQ.sesionVigente(undefined).size).toBe(0)
  })
})

describe('[T-667] comparar() usa el MISMO criterio (o el panel y el reparto discrepan)', () => {
  it('con historial, el estado se juzga por la fila viva y no por la rancia', () => {
    // Antes, según el orden que devolviera Postgres, `w1` podía salir «callado» por una fila de
    // hace dos días mientras estaba latiendo. Panel y reparto tienen que ver lo mismo.
    const ahora = new Date('2026-08-07T13:35:00Z')
    const f = MAQ.comparar([vieja, viva], { ahora }).find((x) => x.trabajador === 'w1')
    expect(f.estado).toBe('vivo')
    expect(f.antiguedadMin).toBe(4)
  })

  it('y al revés: si la única fila es antigua, sigue diciendo la verdad', () => {
    const ahora = new Date('2026-08-07T13:35:00Z')
    const f = MAQ.comparar([vieja], { ahora }).find((x) => x.trabajador === 'w1')
    expect(f.estado).toBe('callado')
  })
})

describe('[T-667] anti-silo: nadie vuelve a resolver el sid por su cuenta', () => {
  const fs = require('fs')
  const path = require('path')
  it('flota.cjs no reconstruye el Map slug→sid a mano', () => {
    // Es exactamente la línea que tenía el defecto. Si reaparece, vuelven a existir dos
    // resoluciones del mismo sid y el panel puede decir una cosa y el reparto hacer otra.
    const src = fs.readFileSync(path.join(process.cwd(), 'scripts/flota/flota.cjs'), 'utf8')
    expect(src).not.toMatch(/new Map\(\s*sesiones\.map\(\s*\(s\)\s*=>\s*\[s\.slug,\s*s\.sid\]/)
    expect(src).toMatch(/MAQ\.sesionVigente\(sesiones\)/)
  })
})
