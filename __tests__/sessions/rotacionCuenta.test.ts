const {
  estadoDeCuota,
  destinoDeRotacion,
  ordenDeRotacion,
  MARGEN_AVISO,
  MARGEN_URGENTE,
} = require('@/lib/sessions/rotacionCuenta.cjs')
const { cuentaDeSesion, estaAtribuido, DESCONOCIDA } = require('@/lib/observability/cuentaDeSesion.cjs')

/**
 * [T-709] — «igual me quedo yo ahora sin poder terminar, y eso es un fallo» (Manuel, 08/08/2026).
 * El límite semanal no avisa: corta. Estos tests fijan que el aviso llegue con margen para
 * terminar lo que estés haciendo, y que nunca se afirme holgura sin haberla medido.
 */
describe('estadoDeCuota — avisar CON MARGEN, no cuando ya da igual', () => {
  it('sin referencia no se afirma nada: es la primera vez y no se puede saber', () => {
    // Decir «holgado» aquí es exactamente la mentira que deja a alguien tirado a media tarea.
    const v = estadoDeCuota({ consumido: 5_000_000, referencia: null })
    expect(v.estado).toBe('desconocido')
    expect(v.sinReferencia).toBe(true)
    expect(v.fraccion).toBeNull()
  })

  it('holgado mientras queda margen de verdad', () => {
    expect(estadoDeCuota({ consumido: 100, referencia: 1000 }).estado).toBe('holgado')
    expect(estadoDeCuota({ consumido: 799, referencia: 1000 }).estado).toBe('holgado')
  })

  it('avisa al 80%: el margen tiene que dar tiempo a cerrar y rotar en una pausa', () => {
    expect(MARGEN_AVISO).toBe(0.8)
    expect(estadoDeCuota({ consumido: 800, referencia: 1000 }).estado).toBe('avisar')
  })

  it('y a partir del 93% ya no es aviso, es rotar ya', () => {
    expect(MARGEN_URGENTE).toBe(0.93)
    expect(estadoDeCuota({ consumido: 930, referencia: 1000 }).estado).toBe('rotar_ya')
    expect(estadoDeCuota({ consumido: 2000, referencia: 1000 }).estado).toBe('rotar_ya')
  })

  it('una referencia de 0 o negativa se trata como ausente, no como «lo has pasado»', () => {
    expect(estadoDeCuota({ consumido: 10, referencia: 0 }).estado).toBe('desconocido')
    expect(estadoDeCuota({ consumido: 10, referencia: -5 }).estado).toBe('desconocido')
  })
})

describe('destinoDeRotacion — no se rota a una cuenta que también está apurada', () => {
  it('elige la otra cuenta sana', () => {
    const d = destinoDeRotacion({
      actual: 'principal',
      candidatas: [
        { cuenta: 'principal', estado: 'rotar_ya' },
        { cuenta: 'secundaria', estado: 'holgado' },
      ],
    })
    expect(d).toBe('secundaria')
  })

  it('NO rota si la otra también está para rotar: sería cambiar de silla y gastar el resume', () => {
    const d = destinoDeRotacion({
      actual: 'principal',
      candidatas: [
        { cuenta: 'principal', estado: 'rotar_ya' },
        { cuenta: 'secundaria', estado: 'avisar' },
      ],
    })
    expect(d).toBeNull()
  })

  it('prefiere una con margen MEDIDO sobre una desconocida', () => {
    const d = destinoDeRotacion({
      actual: 'a',
      candidatas: [
        { cuenta: 'b', estado: 'desconocido' },
        { cuenta: 'c', estado: 'holgado' },
      ],
    })
    expect(d).toBe('c')
  })

  it('pero usa la desconocida si es lo único que hay: mejor que quedarse parado', () => {
    const d = destinoDeRotacion({ actual: 'a', candidatas: [{ cuenta: 'b', estado: 'desconocido' }] })
    expect(d).toBe('b')
  })

  it('nunca devuelve la cuenta actual', () => {
    const d = destinoDeRotacion({ actual: 'a', candidatas: [{ cuenta: 'a', estado: 'holgado' }] })
    expect(d).toBeNull()
  })
})

describe('ordenDeRotacion — el usuario no escribe nada, y el hilo se conserva', () => {
  it('relanza el panel con la otra credencial y --resume', () => {
    const o = ordenDeRotacion({
      panel: 'movil-colas:1.1',
      cwd: '/home/manuel/vence-sessions/movil-colas',
      envVar: 'CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA',
      sesionId: '63af1327-ed9b-4a84-ad4a-5c57a50d6230',
    })
    expect(o!.argv).toEqual([
      'tmux', 'respawn-pane', '-k', '-c', '/home/manuel/vence-sessions/movil-colas',
      '-t', 'movil-colas:1.1', 'bash', '-lc',
      expect.stringContaining('--resume 63af1327-ed9b-4a84-ad4a-5c57a50d6230'),
    ])
  })

  it('la credencial va por ENTORNO, nunca escrita en el comando', () => {
    // Un token en el comando acabaría en el historial de la shell y en cualquier log del panel.
    const o = ordenDeRotacion({ panel: 'p:1.1', cwd: '/x', envVar: 'CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA' })
    expect(o!.comando).toContain('"$CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA"')
    expect(o!.comando).not.toMatch(/sk-ant-oat/)
  })

  it('sin sesión que reanudar, arranca limpia en vez de inventarse un id', () => {
    const o = ordenDeRotacion({ panel: 'p:1.1', cwd: '/x', envVar: 'V' })
    expect(o!.comando).not.toContain('--resume')
  })

  it('con datos incompletos NO devuelve orden: `respawn-pane -k` mata lo que haya dentro', () => {
    expect(ordenDeRotacion({ panel: 'p:1.1', cwd: '/x' } as never)).toBeNull()
    expect(ordenDeRotacion({ cwd: '/x', envVar: 'V' } as never)).toBeNull()
    expect(ordenDeRotacion({ panel: 'p:1.1', envVar: 'V' } as never)).toBeNull()
  })
})

describe('cuentaDeSesion — de quién es este consumo', () => {
  const flota = (n: string) => (n === 'w1' ? 'principal' : 'secundaria')

  it('un trabajador de la flota se resuelve EXACTO y hacia atrás', () => {
    expect(cuentaDeSesion({ trabajador: 'w1', resolverFlota: flota })).toEqual({
      cuenta: 'principal', via: 'flota',
    })
  })

  it('un panel con token propio gana sobre la cuenta de la máquina', () => {
    // Es justo el caso de un panel ya rotado: sin mirar esto se le atribuiría el gasto a la
    // cuenta que NO está gastando.
    const v = cuentaDeSesion({
      env: {
        CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-' + 'x'.repeat(30),
        CLAUDE_CODE_CUENTA: 'secundaria',
      },
      global: { email: 'mcasadocano@gmail.com', accountUuid: null },
    })
    expect(v).toEqual({ cuenta: 'secundaria', via: 'env' })
  })

  it('REGRESIÓN: tener guardada la credencial secundaria NO es estar usándola', () => {
    // Cazado al ir a poner esa variable en el perfil de la máquina, que es lo que hay que
    // hacer para poder rotar: la versión anterior habría etiquetado como «secundaria» TODAS
    // las sesiones locales aunque corrieran en la principal, y la medida por cuenta habría
    // nacido mintiendo. Tener la llave de un coche no es conducirlo.
    const v = cuentaDeSesion({
      env: {
        CLAUDE_CODE_OAUTH_TOKEN: 'sk-ant-oat01-' + 'p'.repeat(30),
        CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA: 'sk-ant-oat01-' + 's'.repeat(30),
      },
      global: { email: 'mcasadocano@gmail.com', accountUuid: null },
    })
    expect(v).toEqual({ cuenta: 'principal', via: 'env' })
  })

  it('y el almacén SOLO, sin credencial en uso, no atribuye nada por sí mismo', () => {
    const v = cuentaDeSesion({
      env: { CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA: 'sk-ant-oat01-' + 's'.repeat(30) },
      global: { email: 'mcasadocano@gmail.com', accountUuid: null },
    })
    expect(v).toEqual({ cuenta: 'mcasadocano@gmail.com', via: 'global' })
  })

  it('sin token propio, la cuenta global de la máquina, identificada por email', () => {
    const v = cuentaDeSesion({ env: {}, global: { email: 'mcasadocano@gmail.com', accountUuid: 'u' } })
    expect(v).toEqual({ cuenta: 'mcasadocano@gmail.com', via: 'global' })
  })

  it('sin NADA se dice «desconocida» — no se supone la cuenta actual', () => {
    // Dar por hecho que lo de la semana pasada salió de la cuenta puesta hoy es lo que haría
    // inútil la medida el día que se rote. Medido: de 355 transcripts, NINGUNO guarda la cuenta.
    const v = cuentaDeSesion({ env: {}, global: null })
    expect(v).toEqual({ cuenta: DESCONOCIDA, via: 'ninguna' })
    expect(estaAtribuido(v.cuenta)).toBe(false)
  })

  it('un token de juguete no cuenta como credencial', () => {
    const v = cuentaDeSesion({ env: { CLAUDE_CODE_OAUTH_TOKEN: 'x' }, global: null })
    expect(v.cuenta).toBe(DESCONOCIDA)
  })
})
