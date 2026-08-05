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
    Object.entries({ FETCH: 'ok', HEAD: 'abc1234', ATRAS: 0, ADELANTE: 0, FUERA_DE_MAIN: 0, SUCIO: 0, ...o })
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
    ['commits que solo existen ahí', { ADELANTE: 2 }, 'adelantado', /NING[ÚU]N remoto|solo existen/],
    ['las dos cosas', { SUCIO: 3, ADELANTE: 2 }, 'divergido', /sin commitear.*solo existen/],
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

// ── RETOMAR LO SUYO ≠ EMPEZAR ALGO NUEVO ────────────────────────────────────────────────────
// Encima de un trabajo sin terminar no se empieza otra cosa. Pero seguir el PROPIO con el árbol a
// medias es exactamente el estado en que se dejó, y bloquearlo dejaría al trabajador encallado
// para siempre — un bloqueo que no se puede satisfacer se acaba rodeando ([T-375]). Medido el
// 05/08 con `l1`: turno terminado a media tarea, 11 ficheros sin commitear y ni un commit.
// Un trabajador trabaja en SU rama. Intentar `pull --ff-only` de main sobre ella no puede ser
// avance directo en cuanto tenga un commit propio, así que fallaba SIEMPRE y se reportaba como
// «no se sabe» — dejando al trabajador sin poder recibir nada (05/08, l3 y l6).
describe('un trabajador en su propia rama', () => {
  it('no se le intenta mover la rama: le basta con que el fetch deje origin/main al día', () => {
    const v = ACT.evaluarClon(sonda({ ATRAS: 4, FUERA_DE_MAIN: 1 }))
    expect(v).toMatchObject({ estado: 'en_su_rama', puedeEncargar: true, hayQueActualizar: false })
  })

  it('pero si está EN main y solo va por detrás, sí se actualiza', () => {
    expect(ACT.evaluarClon(sonda({ ATRAS: 4, FUERA_DE_MAIN: 0 })))
      .toMatchObject({ estado: 'atrasado', hayQueActualizar: true })
  })

  it('y sin saber si puede avanzar, no se inventa', () => {
    expect(ACT.evaluarClon(sonda({ ATRAS: 4, FUERA_DE_MAIN: -1 })).puedeEncargar).toBe(false)
  })
})

describe('cuando RETOMA su propia tarea', () => {
  it.each([
    ['ficheros sin commitear', { SUCIO: 11 }, /11 fichero/],
    ['commits sin empujar', { ADELANTE: 3 }, /3 commit/],
    ['las dos cosas', { SUCIO: 11, ADELANTE: 3 }, /11 fichero.*3 commit/],
  ])('%s deja de bloquear', (_c, campos, detalle) => {
    const v = ACT.evaluarClon(sonda(campos), { reanuda: true })
    expect(v).toMatchObject({ estado: 'a_medias', puedeEncargar: true })
    expect(v.motivo).toMatch(detalle as RegExp)
  })

  // Lo que NO cambia: si no se puede mirar, sigue sin encargarse. Reanudar no es una excusa para
  // dejar pasar lo que no se sabe.
  it.each([{ FETCH: 'fallo' }, { ATRAS: -1 }])('pero «no se sabe» sigue bloqueando', (campos) => {
    expect(ACT.evaluarClon(sonda(campos), { reanuda: true }).puedeEncargar).toBe(false)
  })

  it('y sin reanudar, el mismo árbol SÍ bloquea', () => {
    expect(ACT.evaluarClon(sonda({ SUCIO: 11 })).puedeEncargar).toBe(false)
  })

  // El turno nuevo no recuerda nada del anterior: si nadie se lo dice, empieza de cero encima de
  // la única copia que existe.
  it('el aviso le manda ponerlo a salvo ANTES de seguir, y no descartarlo', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ENC = require('@/lib/flota/encargo.cjs')
    const aviso = ENC.avisoTrabajoAMedias('11 ficheros sin commitear')
    expect(aviso).toMatch(/ANTES DE NADA/)
    expect(aviso).toMatch(/commit/)
    expect(aviso).toMatch(/No empieces de cero|sin haberlo leído/)
    expect(aviso).not.toMatch(/reset --hard|clean -fd/)
  })
})

describe('las órdenes que se ejecutan en la máquina', () => {
  // `--ff-only` es la diferencia entre actualizar y poder perder algo: si no es avance directo,
  // git se niega en vez de fabricar un merge en una máquina que nadie mira.
  it('el pull no puede perder nada', () => {
    expect(ACT.ORDEN_ACTUALIZAR('~flota/vence')).toContain('--ff-only')
    expect(ACT.ORDEN_ACTUALIZAR('~flota/vence')).not.toMatch(/reset|clean|--force/)
  })

  // Un trabajador trabaja en SU rama: medir contra `origin/main` haría que sus commits salieran
  // «adelantados» para siempre aunque estuvieran empujados y a salvo, y ese bloqueo no se puede
  // satisfacer ([T-375]). Lo que hay que proteger es el commit que solo vive en esa máquina.
  it('lo que cuenta como trabajo en peligro es lo que no está en NINGÚN remoto', () => {
    expect(ACT.SONDA_GIT('~/x')).toContain('HEAD --not --remotes')
    expect(ACT.SONDA_GIT('~/x')).not.toMatch(/ADELANTE=\$\(git rev-list --count origin\/main\.\.HEAD/)
  })

  it('la sonda pregunta si el avance sería directo', () => {
    expect(ACT.SONDA_GIT('~/x')).toContain('FUERA_DE_MAIN=')
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

// ── EL PANEL NO PUEDE CONTRADECIRSE A SÍ MISMO ──────────────────────────────────────────────
// Medido el 05/08: `npm run flota` decía «✅ toda la flota viva y trabajando» y, cuatro líneas
// más arriba, marcaba las CUATRO tareas de esos mismos trabajadores como «esa sesión nunca ha
// dado señal». Cuatro falsos de cuatro. La causa no estaba en el cruce —que es correcto— sino en
// lo que se le pasaba: TODAS las tareas pero SOLO las sesiones de Manuel, así que la sesión de un
// trabajador nunca aparecía y su tarea salía huérfana por construcción.
//
// Una alarma que acierta cero veces se deja de leer, y entonces tampoco se ve la que sí importa.
describe('el cruce tarea↔sesión necesita TODAS las sesiones', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const PARTE = require('@/lib/sessions/parte.cjs')

  const ahora = new Date('2026-08-05T14:00:00Z')
  const hace = (min: number) => new Date(ahora.getTime() - min * 60000).toISOString()
  const tareas = [{ id: 'T-418', title: 'x', claimed_by: 'w1-sid', claimed_at: hace(30), lease_until: null }]
  const trabajador = { sid: 'w1-sid', slug: 'w1', host: 'vps', last_signal_at: hace(3) }
  const persona = { sid: 'yo-sid', slug: 'mi-worktree', host: 'fedora', last_signal_at: hace(1) }

  it('con TODAS, un trabajador vivo no sale como parado', () => {
    const { paradas } = PARTE.cruzarTrabajo(tareas, [persona, trabajador], { ahora })
    expect(paradas).toHaveLength(0)
  })

  // El bug, reproducido: mismo trabajador, misma señal de hace 3 minutos, y sale «desaparecida»
  // solo porque su sesión no venía en la lista.
  it('pasándole solo las personas, ese mismo trabajador sale «desaparecida» (el fallo)', () => {
    const { paradas } = PARTE.cruzarTrabajo(tareas, [persona], { ahora })
    expect(paradas).toHaveLength(1)
    expect(paradas[0].motivo).toBe('desaparecida')
  })

  it('y el supervisor le pasa TODAS, no solo las personas', () => {
    const src = require('fs').readFileSync(
      require('path').join(process.cwd(), 'scripts', 'flota', 'flota.cjs'), 'utf8')
    expect(src).toMatch(/cruzarTrabajo\(tareas,\s*todas/)
    // Y el bloque «TUYAS» filtra por rol DESPUÉS, que es donde toca: lo de un trabajador ya lo
    // cuenta el bloque de la flota con su estado real.
    expect(src).toMatch(/paradasTuyas/)
  })
})
