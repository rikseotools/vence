// __tests__/flota/maquinaLocal.test.ts — [T-617]
//
// «¿Estoy EN esa máquina?» tiene que ser una pregunta, no una constante.
//
// `local: true` estaba clavado en el portátil, lo que daba por hecho que el supervisor corre
// siempre ahí. Y esa suposición es justo lo que dejaba la flota parada: el programador era un
// proceso en primer plano en el portátil de Manuel. Medido el 06/08: cuatro trabajadores del VPS
// ociosos siete horas, últimos encargos a las 11:17, con el bucle ya escrito desde las 11:35.
//
// Para que el supervisor pueda vivir en el VPS (que no se apaga), `local` se resuelve en un solo
// sitio a partir de lo que DECLARA quien arranca el proceso — igual que VENCE_SESSION_ROLE/HOME.

const MAQ = require('../../lib/flota/maquinas.cjs')

describe('[T-617] esLocal — lo declara quien arranca', () => {
  const original = process.env.VENCE_FLOTA_AQUI

  afterEach(() => {
    if (original === undefined) delete process.env.VENCE_FLOTA_AQUI
    else process.env.VENCE_FLOTA_AQUI = original
  })

  // Lo más importante del cambio: quien NO lo use no nota nada.
  it('sin declarar, el comportamiento es el de siempre: el portátil es local', () => {
    delete process.env.VENCE_FLOTA_AQUI
    expect(MAQ.esLocal('portatil')).toBe(true)
    expect(MAQ.esLocal('flota-1')).toBe(false)
  })

  it('declarando flota-1, el VPS pasa a ser local (es donde correrá el supervisor)', () => {
    process.env.VENCE_FLOTA_AQUI = 'flota-1'
    expect(MAQ.esLocal('flota-1')).toBe(true)
  })

  it('...y entonces el portátil es remoto, que es la verdad vista desde el VPS', () => {
    process.env.VENCE_FLOTA_AQUI = 'flota-1'
    expect(MAQ.esLocal('portatil')).toBe(false)
  })

  it('una declaración con espacios o vacía no cuenta como declaración', () => {
    process.env.VENCE_FLOTA_AQUI = '   '
    expect(MAQ.esLocal('portatil')).toBe(true)
  })

  it('declarar una máquina que no existe no vuelve local a ninguna (no se adivina)', () => {
    process.env.VENCE_FLOTA_AQUI = 'maquina-que-no-existe'
    expect(MAQ.esLocal('portatil')).toBe(false)
    expect(MAQ.esLocal('flota-1')).toBe(false)
  })
})

describe('[T-617] maquinaDe resuelve `local` en UN solo sitio', () => {
  const original = process.env.VENCE_FLOTA_AQUI
  afterEach(() => {
    if (original === undefined) delete process.env.VENCE_FLOTA_AQUI
    else process.env.VENCE_FLOTA_AQUI = original
  })

  // Once puntos del supervisor leen `m.local`. Si cada uno tuviera que preguntar por su cuenta,
  // aparecería un segundo criterio de «¿estoy en casa?» — los cinco escritores de nuevo [T-130].
  it('un trabajador del VPS sale local cuando se corre desde el VPS', () => {
    process.env.VENCE_FLOTA_AQUI = 'flota-1'
    expect(MAQ.maquinaDe('w1').local).toBe(true)
  })

  it('y sale remoto cuando se corre desde el portátil', () => {
    delete process.env.VENCE_FLOTA_AQUI
    expect(MAQ.maquinaDe('w1').local).toBe(false)
    expect(MAQ.maquinaDe('l1').local).toBe(true)
  })

  it('sigue devolviendo el resto de la máquina intacto (anota, no sustituye)', () => {
    delete process.env.VENCE_FLOTA_AQUI
    const m = MAQ.maquinaDe('w1')
    expect(m.nombre).toBe('flota-1')
    expect(m.host).toBe('167.233.249.187')
  })

  it('un trabajador no declarado sigue siendo null', () => {
    expect(MAQ.maquinaDe('no-existe')).toBeNull()
  })
})

describe('[T-617] inalcanzable — decirlo en vez de construir un ssh sin destino', () => {
  const original = process.env.VENCE_FLOTA_AQUI
  afterEach(() => {
    if (original === undefined) delete process.env.VENCE_FLOTA_AQUI
    else process.env.VENCE_FLOTA_AQUI = original
  })

  it('lo local siempre es alcanzable', () => {
    delete process.env.VENCE_FLOTA_AQUI
    expect(MAQ.inalcanzable(MAQ.maquinaDe('l1'))).toBeNull()
  })

  it('el VPS es alcanzable desde el portátil: declara host', () => {
    delete process.env.VENCE_FLOTA_AQUI
    expect(MAQ.inalcanzable(MAQ.maquinaDe('w1'))).toBeNull()
  })

  // El caso nuevo que abre este cambio: el portátil NO declara host porque nunca hizo falta.
  // Visto desde el VPS sí hace falta, y sin esto se construiría `ssh  -i …` sin destino.
  it('el portátil visto desde el VPS es inalcanzable, y lo dice con su motivo', () => {
    process.env.VENCE_FLOTA_AQUI = 'flota-1'
    const motivo = MAQ.inalcanzable(MAQ.maquinaDe('l1'))
    expect(motivo).toMatch(/no declara host/)
    expect(motivo).toMatch(/portatil/)
  })

  it('sin máquina, el motivo lo dice claro en vez de reventar', () => {
    expect(MAQ.inalcanzable(null)).toMatch(/no está declarado/)
  })
})

describe('[T-617] un solo programador, y anunciado', () => {
  const fs = require('fs')
  const path = require('path')
  const fuente = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'flota', 'flota.cjs'), 'utf8')

  // Había DOS bucles con criterios propios (`vigilar` 05/08 y `bucle` 06/08), y el bueno no se
  // anunciaba. Dos repartidores distintos entregan cosas distintas según quién corra.
  it('`vigilar` ya no tiene implementación propia: es un alias de `bucle`', () => {
    expect(fuente).toContain("cmd = 'bucle'")
    // La marca inequívoca del bucle viejo: su propio contador de vueltas.
    expect(fuente).not.toContain("vigilando la flota cada")
  })

  it('la ayuda nombra `bucle` — que era invisible y por eso nadie lo arrancaba', () => {
    // La línea general, no la de un subcomando: hay varios «Uso: flota.cjs <verbo>».
    const uso = fuente.split('\n').find((l: string) => l.includes('Uso: flota.cjs [estado]'))
    expect(uso).toBeDefined()
    expect(uso).toContain('bucle')
  })

  it('el anti-duplicados del reparto vive DENTRO de `repartir`, no en el cuerpo suelto', () => {
    const i = fuente.indexOf("if (cmd === 'repartir')")
    const j = fuente.indexOf('repartidasHacePoco')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)   // la cicatriz de merge lo dejaba ANTES del comando
  })
})

describe('[T-617] la unidad de systemd del supervisor', () => {
  const fs = require('fs')
  const path = require('path')
  const unidad = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts', 'flota', 'vence-flota-supervisor.service'), 'utf8')

  it('arranca el bucle, no otra cosa', () => {
    expect(unidad).toMatch(/ExecStart=.*flota\.cjs bucle/)
  })

  it('declara DÓNDE está, o se intentaría conectar por SSH a sí mismo', () => {
    expect(unidad).toContain('VENCE_FLOTA_AQUI=flota-1')
  })

  it('se levanta sola tras un reinicio: es todo el sentido de que sea un servicio', () => {
    expect(unidad).toContain('WantedBy=multi-user.target')
    expect(unidad).toMatch(/Restart=always/)
  })

  it('no corre como root (Claude Code se niega, y con razón)', () => {
    expect(unidad).toContain('User=flota')
  })

  it('deja terminar la pasada en curso en vez de matarla a media', () => {
    expect(unidad).toContain('KillSignal=SIGTERM')
    expect(unidad).toMatch(/TimeoutStopSec=\d+/)
  })
})
