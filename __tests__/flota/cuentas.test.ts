/**
 * @jest-environment node
 */
// De qué CUENTA de Claude Code tira cada trabajador de la flota. (T-486)
//
// Con una cuenta bastaba una variable de entorno. Con dos —y con intención de que sean más— eso se
// convierte en el problema de siempre: cada script decidiendo por su cuenta de dónde saca la
// credencial, y nadie capaz de contestar «¿qué cuenta está gastando este trabajador?».
//
// La forma es la del registro multi-cuenta de Stripe (`ACCOUNT_ENV`), copiada a propósito: allí ya
// está probado que añadir una cuenta es una fila y su bloque de env, sin tocar a los consumidores.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const C = require('@/lib/flota/cuentas.cjs')

const TOK = 'sk-ant-oat-' + 'x'.repeat(30)
const dos = { CLAUDE_CODE_OAUTH_TOKEN: TOK, CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA: TOK + '2' }
const una = { CLAUDE_CODE_OAUTH_TOKEN: TOK }

describe('qué cuentas existen de verdad', () => {
  it('sin token, la cuenta NO existe: declararla no la crea', () => {
    expect(C.cuentasDisponibles({})).toEqual([])
    expect(C.cuentasDisponibles(una)).toEqual(['principal'])
    expect(C.cuentasDisponibles(dos)).toEqual(['principal', 'secundaria'])
  })

  it('un valor corto no cuela como token (sería un marcador olvidado)', () => {
    expect(C.cuentasDisponibles({ CLAUDE_CODE_OAUTH_TOKEN: 'pon-el-token-aqui' })).toEqual([])
    expect(C.cuentasDisponibles({ CLAUDE_CODE_OAUTH_TOKEN: '   ' })).toEqual([])
  })

  // La cuenta por defecto lee la variable SIN sufijo, como la 'manuel' de Stripe: lo que ya
  // funcionaba sigue funcionando sin tocar nada.
  it('la cuenta por defecto usa la variable histórica', () => {
    expect(C.CUENTA_ENV[C.POR_DEFECTO]).toBe('CLAUDE_CODE_OAUTH_TOKEN')
  })
})

// ── LO QUE HACE ESTO ESCALABLE NO ES EL NÚMERO DE CUENTAS, ES QUE EL REPARTO SEA PREDECIBLE ──
describe('el reparto es DETERMINISTA, no rotatorio', () => {
  it('el mismo trabajador cae siempre en la misma cuenta, reinicie las veces que reinicie', () => {
    const a = C.cuentaDe('w1', ['principal', 'secundaria'])
    for (let i = 0; i < 20; i++) expect(C.cuentaDe('w1', ['principal', 'secundaria'])).toBe(a)
  })

  // Con rotación, un reinicio movería a w1 de cuenta y el consumo por cuenta dejaría de ser
  // comparable consigo mismo: si una topa su límite, no se podría saber a quién le pasó.
  it('no depende del ORDEN de arranque ni de cuántos hubo antes', () => {
    const solo = C.cuentaDe('w3', ['principal', 'secundaria'])
    C.cuentaDe('w1', ['principal', 'secundaria'])
    C.cuentaDe('w2', ['principal', 'secundaria'])
    expect(C.cuentaDe('w3', ['principal', 'secundaria'])).toBe(solo)
  })

  it('con varios trabajadores usa las DOS cuentas, no se amontona en una', () => {
    const r = C.reparto(['w1', 'w2', 'w3', 'w4'], ['principal', 'secundaria'])
    expect(Object.keys(r).sort()).toEqual(['principal', 'secundaria'])
  })

  it('con una sola cuenta, todos caen ahí (y no revienta)', () => {
    expect(C.cuentaDe('w1', ['principal'])).toBe('principal')
    expect(C.reparto(['w1', 'w2'], ['principal'])).toEqual({ principal: ['w1', 'w2'] })
  })

  it('sin cuentas no se inventa ninguna', () => {
    expect(C.cuentaDe('w1', [])).toBeNull()
    expect(C.cuentaDe('w1', null)).toBeNull()
  })
})

describe('resolver: lo explícito manda, pero se comprueba', () => {
  it('sin cuenta pedida, reparte y devuelve la credencial', () => {
    const r = C.resolver('w1', null, dos)
    expect(r.ok).toBe(true)
    expect(C.NOMBRES).toContain(r.cuenta)
    expect(r.token).toBeTruthy()
    expect(r.variable).toBe(C.CUENTA_ENV[r.cuenta])
  })

  it('una cuenta pedida gana al reparto', () => {
    expect(C.resolver('w1', 'secundaria', dos)).toMatchObject({ ok: true, cuenta: 'secundaria' })
    expect(C.resolver('w1', 'principal', dos)).toMatchObject({ ok: true, cuenta: 'principal' })
  })

  // Un nombre mal escrito que cayera en silencio al reparto sería peor que un error: el trabajador
  // arrancaría gastando de una cuenta que nadie eligió.
  it('una cuenta que no existe FALLA, no cae al reparto', () => {
    const r = C.resolver('w1', 'terciaria', dos)
    expect(r.ok).toBe(false)
    expect(r.problema).toMatch(/no existe/)
  })

  it('una cuenta declarada pero SIN token falla diciendo qué variable falta', () => {
    const r = C.resolver('w1', 'secundaria', una)
    expect(r.ok).toBe(false)
    expect(r.problema).toContain('CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA')
  })

  it('sin ninguna credencial, el error dice cómo acuñar una', () => {
    const r = C.resolver('w1', null, {})
    expect(r.ok).toBe(false)
    expect(r.problema).toMatch(/setup-token/)
  })
})

// El valor de un registro es que crecer no cueste código. Si esto deja de cumplirse, se ha vuelto
// un silo más — que es justo lo que la forma de Stripe evita.
describe('añadir una cuenta es UNA fila', () => {
  it('todas las cuentas declaradas tienen su variable, y ninguna se repite', () => {
    const vars = C.NOMBRES.map((n) => C.CUENTA_ENV[n])
    expect(vars.every(Boolean)).toBe(true)
    expect(new Set(vars).size).toBe(vars.length)
  })

  it('el registro y la lista de nombres no pueden divergir', () => {
    expect(C.NOMBRES.sort()).toEqual(Object.keys(C.CUENTA_ENV).sort())
    expect(C.NOMBRES).toContain(C.POR_DEFECTO)
  })
})
