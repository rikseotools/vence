import { causaDelFallo, avisoDeCorreccion } from '@/lib/tests/avisoDeCorreccion'

/**
 * [T-671] — la frase que hay que impedir es una sola, y es literal. `rbsc87` escribió:
 *
 *   «lanza el mensaje de que no tengo conexión y hubo un problema con el envío de la
 *    información cuando la conexión es perfecta»
 *
 * El aviso viejo era único para cualquier fallo. Estos tests fijan que la conexión solo se
 * nombra cuando el fallo ES de conexión.
 */
describe('causaDelFallo — de qué se murió la corrección', () => {
  it('401 = sesión', () => {
    expect(causaDelFallo({ status: 401, tipoDeError: 'HTTP' })).toBe('sesion')
  })

  it('403 con reason del servidor: cada uno al suyo', () => {
    expect(causaDelFallo({ status: 403, reason: 'sin_identidad', tipoDeError: 'HTTP' })).toBe('sesion')
    expect(causaDelFallo({ status: 403, reason: 'recurso_ajeno', tipoDeError: 'HTTP' })).toBe('ajeno')
  })

  it('403 SIN reason (cliente viejo ↔ servidor nuevo) cae en sesión, que es lo que resulta ser', () => {
    // Medido: 195 de 195 en el incidente. Y equivocarse hacia «vuelve a entrar» no le quita
    // nada a quien de verdad pidió algo ajeno; al revés, deja al dueño sin salida.
    expect(causaDelFallo({ status: 403, tipoDeError: 'HTTP' })).toBe('sesion')
  })

  it('timeout y red son red — aquí SÍ toca hablar de conexión', () => {
    expect(causaDelFallo({ tipoDeError: 'TIMEOUT' })).toBe('red')
    expect(causaDelFallo({ tipoDeError: 'NETWORK' })).toBe('red')
    // Y el estado HTTP no manda sobre eso: un timeout con status residual sigue siendo red.
    expect(causaDelFallo({ status: 500, tipoDeError: 'TIMEOUT' })).toBe('red')
  })

  it('5xx es del servidor, no del usuario', () => {
    expect(causaDelFallo({ status: 500, tipoDeError: 'HTTP' })).toBe('servidor')
    expect(causaDelFallo({ status: 503, tipoDeError: 'HTTP' })).toBe('servidor')
  })

  it('sin nada que lo explique, «desconocida» — no se inventa una causa', () => {
    expect(causaDelFallo({})).toBe('desconocida')
    expect(causaDelFallo({ status: 418, tipoDeError: 'HTTP' })).toBe('desconocida')
  })
})

describe('avisoDeCorreccion — qué lee el opositor', () => {
  it('SOLO el fallo de red menciona la conexión', () => {
    // El bug entero cabe en esta aserción.
    const causas = ['sesion', 'servidor', 'ajeno', 'desconocida'] as const
    for (const c of causas) {
      expect(avisoDeCorreccion(c).cuerpo.toLowerCase()).not.toContain('conexión')
    }
    expect(avisoDeCorreccion('red').cuerpo.toLowerCase()).toContain('conexión')
  })

  it('si el examen es SUYO, se le dice que sus respuestas están guardadas — es el miedo real', () => {
    // El opositor no teme el mensaje de error: teme haber perdido la hora que acaba de echar.
    const suyas = ['sesion', 'red', 'servidor', 'desconocida'] as const
    for (const c of suyas) {
      expect(avisoDeCorreccion(c).respuestasASalvo).toBe(true)
      expect(avisoDeCorreccion(c).cuerpo.toLowerCase()).toMatch(/guardad/)
    }
  })

  it('pero en «ajeno» NO se afirma: ese examen no es suyo y no sabemos nada de sus respuestas', () => {
    // Este caso salió de un test en rojo: la promesa estaba escrita como constante `true` y
    // en una de las cinco causas era mentira.
    expect(avisoDeCorreccion('ajeno').respuestasASalvo).toBe(false)
    expect(avisoDeCorreccion('ajeno').cuerpo.toLowerCase()).not.toMatch(/tus respuestas están guardad/)
  })

  it('el fallo de sesión ofrece VOLVER A ENTRAR, que es lo único que lo resuelve', () => {
    expect(avisoDeCorreccion('sesion').accion).toBe('entrar')
    expect(avisoDeCorreccion('ajeno').accion).toBe('entrar')
    expect(avisoDeCorreccion('red').accion).toBe('reintentar')
    expect(avisoDeCorreccion('servidor').accion).toBe('reintentar')
  })

  it('ningún aviso deja al usuario sin salida', () => {
    const causas = ['sesion', 'red', 'servidor', 'ajeno', 'desconocida'] as const
    for (const c of causas) expect(avisoDeCorreccion(c).accion).not.toBe('ninguna')
  })

  it('y ninguno le echa la culpa a su equipo salvo cuando es su red', () => {
    expect(avisoDeCorreccion('servidor').titulo.toLowerCase()).toContain('nuestro')
  })
})
