/**
 * @jest-environment node
 */
// ¿Un trabajador puede DE VERDAD trabajar? (T-486)
//
// El latido demuestra que la máquina vive y alcanza la BD; no demuestra nada sobre Claude Code —
// es node hablando con Postgres, y eso funciona igual con la sesión atascada en el login.
//
// Medido el 05/08, primer arranque real de la flota: los dos trabajadores salieron 🟢 en el panel,
// latiendo, con rol y preflight en verde… y NINGUNO estaba autenticado. Veinte minutos delante de
// un «Select login method» con el sistema entero diciendo que todo iba bien.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const A = require('@/lib/flota/autenticacion.cjs')

describe('las tres causas piden acciones distintas, así que se distinguen', () => {
  it('el proveedor rechaza la credencial → token_invalido', () => {
    // La salida real del caso que originó esto.
    expect(A.clasificar('Failed to authenticate. API Error: 401 Invalid bearer token', 1).estado)
      .toBe('token_invalido')
    expect(A.clasificar('Invalid API key · Fix external API key', 1).estado).toBe('token_invalido')
  })

  it('no hay credencial → sin_credencial (la pantalla de login)', () => {
    const pantalla = 'Welcome to Claude Code v2.1.221\n\n Select login method:\n\n ❯ 1. Claude account with subscription'
    expect(A.clasificar(pantalla, 0).estado).toBe('sin_credencial')
    expect(A.clasificar('Login expired · Please run /login', 1).estado).toBe('sin_credencial')
  })

  it('responde → autenticado', () => {
    expect(A.clasificar('ok', 0).estado).toBe('autenticado')
    expect(A.puedeTrabajar(A.clasificar('ok', 0))).toBe(true)
  })

  // «No lo sé» tiene que poder decirse: un fallo de red no es una credencial mala, y tratarlo
  // como tal mandaría a acuñar tokens que no hacían falta.
  it.each([
    ['timeout sin salida', '', null],
    ['error de red', 'getaddrinfo ENOTFOUND api.anthropic.com', 1],
    ['algo que no reconocemos', 'Segmentation fault', 139],
  ])('%s → desconocido, no se afirma nada', (_c, salida, codigo) => {
    const v = A.clasificar(salida as string, codigo as any)
    expect(v.estado).toBe('desconocido')
    expect(A.puedeTrabajar(v)).toBe(false)
  })

  // El éxito se afirma por lo que RESPONDE, no por el código de salida: `claude -p` puede salir 0
  // habiendo escrito un error, y dar por bueno un 0 es cómo nacen los verdes falsos.
  it('un código 0 con un error dentro NO es autenticado', () => {
    expect(A.clasificar('Failed to authenticate. API Error: 401 Invalid bearer token', 0).estado)
      .toBe('token_invalido')
  })

  it('la palabra ok sin código 0 tampoco basta', () => {
    expect(A.clasificar('ok', 1).estado).toBe('desconocido')
  })
})

describe('cómo entra en el bus y qué se le enseña a quien mira', () => {
  it('un trabajador que no puede autenticar es ERROR: ocupa sitio sin poder trabajar', () => {
    expect(A.severidad(A.clasificar('401 Invalid bearer token', 1))).toBe('error')
    expect(A.severidad(A.clasificar('Select login method', 0))).toBe('error')
  })

  it('no saber es warn, no error', () => {
    expect(A.severidad(A.clasificar('', null))).toBe('warn')
  })

  it('lo normal no se pinta', () => {
    expect(A.diagnostico('w1', A.clasificar('ok', 0))).toBeNull()
  })

  it('el diagnóstico dice CÓMO arreglarlo, incluida la forma del token bueno', () => {
    const d = A.diagnostico('w1', A.clasificar('401 Invalid bearer token', 1))
    expect(d).toMatch(/setup-token/)
    expect(d).toMatch(/sk-ant-oat01-/)
  })

  it('y distingue «no tiene» de «se lo rechazan», que se arreglan distinto', () => {
    expect(A.diagnostico('w1', A.clasificar('Select login method', 0))).toMatch(/SIN credencial/)
    expect(A.diagnostico('w1', A.clasificar('401', 1))).toMatch(/RECHAZADO/)
  })
})
