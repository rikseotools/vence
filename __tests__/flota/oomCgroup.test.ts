/**
 * [T-647] El detector de OOM basado en journalctl es ciego: el supervisor corre como usuario
 * `flota`, sin pertenecer a `adm`/`systemd-journal`, así que no puede ver mensajes del kernel.
 * Medido en `flota-1`: `journalctl -k --since '-24h'` da «-- No entries --» pese a tener >15h de
 * historial real (`journalctl --list-boots`), y `flota_sin_memoria` (la señal que T-647 construyó
 * para esto) lleva CERO eventos en toda su historia. Este fichero prueba la alternativa: leer
 * `oom_kill` de `memory.events` (cgroup v2), que el kernel escribe directo y que SÍ es legible sin
 * privilegios especiales (confirmado con `cat` como usuario `flota` en la máquina real).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const OOM = require('../../lib/flota/oomCgroup.cjs')

describe('[T-647] rutaMemoryEvents — el patrón real de cgroup de flota-1', () => {
  it('construye la ruta con el guion de la slice escapado como systemd lo escapa', () => {
    const r = OOM.rutaMemoryEvents('w1')
    expect(r).toBe(
      '/sys/fs/cgroup/system.slice/system-vence\\x2dflota.slice/vence-flota@w1.service/memory.events',
    )
  })

  it('cambia solo el nombre del trabajador entre rutas', () => {
    expect(OOM.rutaMemoryEvents('w3')).toContain('vence-flota@w3.service')
  })
})

describe('[T-647] leerOomKillDeTexto — el contenido REAL medido en flota-1', () => {
  it('lee el contador de un memory.events real (w1, 08/08)', () => {
    const texto = 'low 0\nhigh 5499011\nmax 0\noom 0\noom_kill 0\noom_group_kill 0\n'
    expect(OOM.leerOomKillDeTexto(texto)).toBe(0)
  })

  it('lee un contador con muertes reales', () => {
    const texto = 'low 12\nhigh 340221\nmax 3\noom 5\noom_kill 5\noom_group_kill 0\n'
    expect(OOM.leerOomKillDeTexto(texto)).toBe(5)
  })

  it('sin la clave (formato inesperado, no cgroup v2) da null, no 0', () => {
    expect(OOM.leerOomKillDeTexto('memory.limit_in_bytes: 3221225472')).toBeNull()
  })

  it('tolera entrada vacía o nula', () => {
    expect(OOM.leerOomKillDeTexto('')).toBeNull()
    expect(OOM.leerOomKillDeTexto(null)).toBeNull()
    expect(OOM.leerOomKillDeTexto(undefined)).toBeNull()
  })
})

describe('[T-647] leerOomKill — nunca lanza, aunque el fichero no exista o el permiso falle', () => {
  it('lee vía el lector inyectado', () => {
    const leer = () => 'oom_kill 2\n'
    expect(OOM.leerOomKill('w1', leer)).toBe(2)
  })

  it('un lector que lanza (ENOENT, EACCES…) da null, no rompe el bucle', () => {
    const leer = () => { throw new Error('EACCES: permission denied') }
    expect(OOM.leerOomKill('w1', leer)).toBeNull()
  })
})

describe('[T-647] deltaOomKill — el delta frente a la última lectura, con sus tres "no se sabe"', () => {
  it('EL CASO REAL: sin muertes nuevas entre dos pasadas', () => {
    const anterior = { w1: 0, w2: 0, w3: 0, w4: 0 }
    const actual = { w1: 0, w2: 0, w3: 0, w4: 0 }
    const r = OOM.deltaOomKill(anterior, actual)
    expect(r.total).toBe(0)
    expect(r.nuevos).toEqual({})
    expect(r.reiniciados).toEqual([])
  })

  it('cuenta el delta y dice a QUIÉN, no solo cuántos', () => {
    const anterior = { w1: 2, w2: 0, w3: 5, w4: 1 }
    const actual = { w1: 3, w2: 0, w3: 5, w4: 4 }
    const r = OOM.deltaOomKill(anterior, actual)
    expect(r.total).toBe(4) // w1: +1, w4: +3
    expect(r.nuevos).toEqual({ w1: 1, w4: 3 })
  })

  it('un contador que BAJA (la unidad se reinició) no es un delta negativo: se marca reiniciado', () => {
    const anterior = { w1: 8 }
    const actual = { w1: 0 } // cgroup nuevo tras un restart
    const r = OOM.deltaOomKill(anterior, actual)
    expect(r.total).toBe(0)
    expect(r.nuevos).toEqual({})
    expect(r.reiniciados).toEqual(['w1'])
  })

  it('primera lectura de un trabajador (sin anterior): no se afirma un delta de 0', () => {
    const r = OOM.deltaOomKill({}, { w1: 5 })
    expect(r.total).toBe(0)
    expect(r.nuevos).toEqual({})
    expect(r.reiniciados).toEqual([])
  })

  it('lectura actual nula (no se pudo leer esta pasada): se ignora, no cuenta como sano', () => {
    const r = OOM.deltaOomKill({ w1: 3 }, { w1: null })
    expect(r.total).toBe(0)
    expect(r.reiniciados).toEqual([])
  })

  it('anterior ausente del todo (primera pasada tras arrancar): no revienta', () => {
    const r = OOM.deltaOomKill(null, { w1: 0, w2: 2 })
    expect(r.total).toBe(0)
    expect(r.reiniciados).toEqual([])
  })

  it('actual vacío: no hay nada que comparar', () => {
    expect(OOM.deltaOomKill({ w1: 3 }, {})).toEqual({ total: 0, nuevos: {}, reiniciados: [] })
  })
})
