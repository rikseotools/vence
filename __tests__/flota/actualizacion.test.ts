/**
 * @jest-environment node
 */
// El clon del trabajador, al día antes de cada encargo. (T-486)
//
// ── LO QUE ESTO PROTEGE, Y NO ES «TENER LA ÚLTIMA VERSIÓN» ──────────────────────────────────
// Lo que hace segura a la flota son los guardarraíles, y un clon viejo trae los de su fecha. Medido
// el 05/08: `w1` llevaba 30 commits de retraso, así que no tenía ni el canario con el que habría
// comprobado su propio permiso en diez segundos, ni el comando `revision` que su situación pedía —
// y se quedó parado preguntando algo que su propio repo ya sabía responder.
//
// La otra mitad es lo que NO se hace: nada de `reset --hard`. Un clon con cambios sin commitear
// puede ser el único rastro de un trabajo ([T-431], los worktrees huérfanos). Se rehúsa y se dice
// qué hay.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ACT = require('@/lib/flota/actualizacion.cjs')

const sonda = (o: Record<string, unknown> = {}) =>
  ACT.leerSonda(
    Object.entries({ FETCH: 'ok', HEAD: 'abc1234', ATRAS: 0, ADELANTE: 0, SUCIO: 0, ...o })
      .map(([k, v]) => `${k}=${v}`)
      .join('\n'),
  )

describe('leer la sonda: lo que no se pudo mirar NO se lee como cero', () => {
  it('lee los campos que vienen', () => {
    expect(sonda({ ATRAS: 30 })).toMatchObject({ fetch: 'ok', head: 'abc1234', atras: 30, sucio: 0 })
  })

  // Un campo ausente leído como 0 diría «está al día» justo cuando no se pudo comprobar. Ese es el
  // falso verde que este repo persigue en el contenido; aquí valdría lo mismo.
  it.each(['ATRAS', 'ADELANTE', 'SUCIO'])('%s ausente queda en null, no en 0', (campo) => {
    const s = ACT.leerSonda(`FETCH=ok\nHEAD=abc1234`)
    expect(s[campo.toLowerCase()]).toBeNull()
  })

  it('un contador negativo (la rama del `|| echo -1`) también es "no se sabe"', () => {
    expect(sonda({ ATRAS: -1 }).atras).toBeNull()
  })

  it('salida vacía no revienta', () => {
    expect(ACT.leerSonda('')).toMatchObject({ fetch: null, head: null, atras: null })
    expect(ACT.leerSonda(null)).toMatchObject({ fetch: null })
  })
})

describe('cuándo SÍ se le manda trabajo', () => {
  it('al día: adelante y sin tocar nada', () => {
    const v = ACT.evaluarClon(sonda())
    expect(v).toMatchObject({ estado: 'al_dia', puedeEncargar: true, hayQueActualizar: false })
    expect(ACT.diagnostico('w1', v)).toBeNull()   // lo normal no se pinta
  })

  it('atrasado y limpio: se actualiza y adelante', () => {
    const v = ACT.evaluarClon(sonda({ ATRAS: 30 }))
    expect(v).toMatchObject({ estado: 'atrasado', puedeEncargar: true, hayQueActualizar: true })
    expect(v.motivo).toMatch(/30 commit/)
  })
})

describe('cuándo NO, y por qué en cada caso', () => {
  // Cada uno pide una acción distinta de una persona: mirar qué hay, empujarlo, o aprovisionar.
  // Meterlos en un solo «no se puede» mandaría a mirar donde no es.
  it.each([
    ['cambios sin commitear', { SUCIO: 3 }, 'sucio', /sin commitear/],
    ['commits que no están en origin', { ADELANTE: 2 }, 'adelantado', /no están en origin/],
    ['las dos cosas', { SUCIO: 3, ADELANTE: 2 }, 'divergido', /sin commitear.*no están en origin/],
    ['no pudo hablar con origin', { FETCH: 'fallo' }, 'sin_red', /no se sabe/],
  ])('%s → no se encarga', (_c, campos, estado, motivo) => {
    const v = ACT.evaluarClon(sonda(campos))
    expect(v.estado).toBe(estado)
    expect(v.puedeEncargar).toBe(false)
    expect(v.motivo).toMatch(motivo as RegExp)
    expect(ACT.diagnostico('w1', v)).toMatch(/w1/)
  })

  it('sin clon en la máquina lo dice y manda a aprovisionar', () => {
    const v = ACT.evaluarClon(ACT.leerSonda(''))
    expect(v).toMatchObject({ estado: 'sin_repo', puedeEncargar: false })
    expect(ACT.diagnostico('w2', v)).toMatch(/arrancar-trabajador/)
  })

  // Fail-closed: es la regla de [T-539]. El fail-open es para quien está delante y puede juzgar.
  it('no saber NUNCA deja pasar', () => {
    for (const campos of [{ FETCH: 'fallo' }, { ATRAS: -1 }, { SUCIO: -1 }]) {
      expect(ACT.evaluarClon(sonda(campos)).puedeEncargar).toBe(false)
    }
  })

  // Lo irreversible es tirar trabajo, no dejar a un trabajador parado una hora.
  it('nunca propone descartar lo que hay', () => {
    for (const campos of [{ SUCIO: 3 }, { ADELANTE: 2 }, { SUCIO: 1, ADELANTE: 1 }]) {
      const v = ACT.evaluarClon(sonda(campos))
      expect(v.hayQueActualizar).toBe(false)
      expect(ACT.diagnostico('w1', v)).not.toMatch(/reset --hard|clean -fd|descarta/i)
    }
  })
})

describe('las órdenes que se ejecutan en la máquina', () => {
  // `--ff-only` es la diferencia entre actualizar y poder perder algo: si no es avance directo,
  // git se niega en vez de fabricar un merge en una máquina que nadie mira.
  it('el pull no puede perder nada', () => {
    expect(ACT.ORDEN_ACTUALIZAR('~flota/vence')).toContain('--ff-only')
    expect(ACT.ORDEN_ACTUALIZAR('~flota/vence')).not.toMatch(/reset|clean|--force/)
  })

  it('la sonda no escribe: solo mira', () => {
    expect(ACT.SONDA_GIT('~flota/vence')).not.toMatch(/git (pull|merge|reset|checkout|clean|commit)/)
    expect(ACT.SONDA_GIT('~flota/vence')).toContain('git fetch')
  })

  // El árbol NO es el mismo en todas las máquinas —worktree por trabajador en el portátil, clon
  // compartido en el VPS—, así que sale del registro. Cablearlo aquí obligaría a tocar este
  // fichero al añadir una máquina, que es justo lo que el registro evita.
  it('el árbol se lo dice el registro de máquinas, no está cableado', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const MAQ = require('@/lib/flota/maquinas.cjs')
    expect(MAQ.arbolDe('w1')).toMatch(/vence/)
    expect(MAQ.arbolDe('l1')).toContain('l1')          // uno por trabajador
    expect(MAQ.arbolDe('no-existe')).toBeNull()
    for (const w of ['w1', 'l1']) {
      expect(ACT.SONDA_GIT(MAQ.arbolDe(w))).toContain(`cd ${MAQ.arbolDe(w)}`)
    }
  })

  // Bajo `sudo -u <otro>` sin `-H`, HOME sigue siendo el de root: el `cd` cae fuera del repo y la
  // sonda dice «no hay clon» de una máquina que lo tiene. Costó el primer intento (05/08).
  it('la máquina remota no depende de $HOME', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const MAQ = require('@/lib/flota/maquinas.cjs')
    expect(MAQ.arbolDe('w1')).not.toContain('$HOME')
  })
})

describe('severidad: lo que se arregla solo no grita', () => {
  it.each([
    ['al_dia', {}, 'info'],
    ['atrasado', { ATRAS: 30 }, 'info'],
    ['sucio', { SUCIO: 1 }, 'error'],
    ['sin_red', { FETCH: 'fallo' }, 'error'],
  ])('%s → %s', (_c, campos, sev) => {
    expect(ACT.severidad(ACT.evaluarClon(sonda(campos)))).toBe(sev)
  })
})
