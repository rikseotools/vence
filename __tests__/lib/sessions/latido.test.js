/**
 * Núcleo de «¿qué sesión está viva?» (T-296).
 *
 * Se prueba aquí, sin BD, porque la pregunta que responde es «¿puedo borrar este worktree?» y las
 * dos direcciones tienen coste MUY distinto: un worktree de más ocupa disco; uno de menos se lleva
 * por delante el trabajo sin pushear de una sesión viva. Las bandas se fijan por escrito.
 */
const {
  clasificarSenal, formatearAntiguedad, etiquetaEstado, nombresCasiIdenticos,
} = require('@/lib/sessions/latido')

const AHORA = new Date('2026-07-30T12:00:00Z')
const haceMin = (m) => new Date(AHORA.getTime() - m * 60_000)

describe('clasificarSenal — las bandas', () => {
  it.each([
    ['recién latido', 0, 'viva', false],
    ['dentro del cuarto de hora', 14, 'viva', false],
    ['justo en el borde de viva', 15, 'reciente', false],
    ['una hora', 60, 'reciente', false],
    ['dos horas', 120, 'dormida', false],
    ['medio día', 12 * 60, 'dormida', false],
    ['un día justo', 24 * 60, 'sin_senales', true],
    ['tres días', 3 * 24 * 60, 'sin_senales', true],
  ])('%s → %s', (_, minutos, estado, borrable) => {
    const r = clasificarSenal(haceMin(minutos), AHORA)
    expect(r.estado).toBe(estado)
    expect(r.borrable).toBe(borrable)
  })

  it('sin señal ninguna es «sin señales», no «viva» (una sesión vieja no tiene fila)', () => {
    expect(clasificarSenal(null, AHORA)).toEqual({ estado: 'sin_senales', minutos: null, borrable: true })
  })

  it('una fecha ilegible NO se toma por viva ni revienta', () => {
    expect(clasificarSenal('ayer por la tarde', AHORA).estado).toBe('sin_senales')
  })

  // El error que NO se puede cometer: dar por muerta una sesión viva por un reloj torcido. Con
  // sesiones en varias máquinas y la hora del servidor, una señal en el futuro es posible.
  it('una señal en el FUTURO se trata como recién vista', () => {
    const r = clasificarSenal(new Date(AHORA.getTime() + 5 * 60_000), AHORA)
    expect(r.estado).toBe('viva')
    expect(r.minutos).toBe(0)
    expect(r.borrable).toBe(false)
  })

  it('acepta la fecha como string ISO (es lo que devuelve la BD)', () => {
    expect(clasificarSenal(haceMin(3).toISOString(), AHORA).estado).toBe('viva')
  })
})

describe('formatearAntiguedad — que se lea de un vistazo', () => {
  it.each([
    [null, 'nunca'],
    [0, 'ahora mismo'],
    [3, 'hace 3 min'],
    [59, 'hace 59 min'],
    [90, 'hace 2 h'],
    [47 * 60, 'hace 47 h'],
    [72 * 60, 'hace 3 días'],
  ])('%s → %s', (minutos, esperado) => {
    expect(formatearAntiguedad(minutos)).toBe(esperado)
  })

  it('cada estado tiene su semáforo', () => {
    expect(etiquetaEstado('viva')).toContain('viva')
    expect(etiquetaEstado('sin_senales')).toContain('sin señales')
  })
})

describe('nombresCasiIdenticos — la trampa del guion', () => {
  // Caso REAL del 30/07: `sesion-0729-b` estaba viva y `sesion-0729b` sin señales, en el mismo
  // directorio. Equivocarse al cerrar borra el trabajo de la otra.
  it('caza el par que solo se diferencia por un guion', () => {
    expect(nombresCasiIdenticos(['sesion-0729-b', 'sesion-0729b', 'koigrid-mig2']))
      .toEqual([['sesion-0729-b', 'sesion-0729b']])
  })

  it('caza el par que se diferencia por UN carácter', () => {
    expect(nombresCasiIdenticos(['sesion-27jul', 'sesion-27jul-b'])).toEqual([['sesion-27jul', 'sesion-27jul-b']])
  })

  it('no marca nombres claramente distintos (un aviso que grita se deja de leer)', () => {
    expect(nombresCasiIdenticos([
      'esquina-inferior-derecha', 'esquina-inferior-izquierda', 'centro-abajo', 'revision-preguntas',
    ])).toEqual([])
  })

  it('con un solo worktree no hay par posible', () => {
    expect(nombresCasiIdenticos(['solo-una'])).toEqual([])
  })
})
