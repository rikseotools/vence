/**
 * @jest-environment node
 */
// Las dos ramas de `resolverPerfilPorEmail` que la simulación NO puede ejercer de forma fiable
// porque dependen de un instante concreto contra Postgres. (T-434)
//
// Por qué hacen falta AQUÍ y no allí: la simulación contra la BD real lanza 6 peticiones a la
// vez y comprueba que acaban con UN solo perfil — pero el reparto de tiempos decide si alguna
// llega a chocar. Medido el 01/08: las 6 salieron `creado` + 5×`existia`, o sea que la rama del
// **23505** no se ejecutó ni una vez. Una rama que solo corre «a veces» no está probada, y es
// justo la que convierte una reparación en un error intermitente si está mal.
//
// Aquí el instante se fija a mano, con un doble de la base de datos.

const mockEjecutar = jest.fn()
jest.mock('@/db/client', () => ({ getAdminDb: () => ({ execute: (...a: unknown[]) => mockEjecutar(...a) }) }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resolverPerfilPorEmail } = require('@/lib/auth/resolveAppUser')

const ID_GANADOR = '99999999-8888-7777-6666-555555555555'
const violacionUnica = () => Object.assign(new Error('duplicate key'), { code: '23505' })

beforeEach(() => mockEjecutar.mockReset())

describe('la CARRERA: otra petición creó el perfil entre nuestra lectura y nuestra escritura', () => {
  it('el 23505 NO es un fallo: se relee y se devuelve el id del ganador', async () => {
    mockEjecutar
      .mockResolvedValueOnce([])                    // 1) SELECT: no existe
      .mockRejectedValueOnce(violacionUnica())      // 2) create: choca (otro fue más rápido)
      .mockResolvedValueOnce([{ id: ID_GANADOR }])  // 3) SELECT de nuevo: ahí está el suyo

    const r = await resolverPerfilPorEmail('ana@example.com', 'Ana')
    expect(r).toMatchObject({ id: ID_GANADOR, motivo: 'creado_por_otro' })
    expect(mockEjecutar).toHaveBeenCalledTimes(3)
  })

  it('el código de error también se reconoce si viene envuelto en `cause`', async () => {
    mockEjecutar
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(Object.assign(new Error('x'), { cause: { code: '23505' } }))
      .mockResolvedValueOnce([{ id: ID_GANADOR }])

    expect(await resolverPerfilPorEmail('ana@example.com')).toMatchObject({ motivo: 'creado_por_otro' })
  })

  it('si tras el choque la relectura tampoco encuentra nada, se admite el fallo (no se inventa un id)', async () => {
    mockEjecutar
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(violacionUnica())
      .mockResolvedValueOnce([])

    const r = await resolverPerfilPorEmail('ana@example.com')
    expect(r.id).toBeNull()
    expect(r.motivo).toBe('error_creacion')
  })
})

// El peor fallo posible en este fichero, dicho en su propia cabecera: «un usuario hereda los
// datos de otro». Si la CONSULTA falla no sabemos si el perfil existe, así que crear uno nuevo
// podría duplicar a alguien. Antes de T-434 esa consulta ni siquiera estaba dentro del try.
describe('si falla la LECTURA no se crea nada', () => {
  it('devuelve error_lectura y NO intenta crear', async () => {
    mockEjecutar.mockRejectedValueOnce(new Error('connection terminated'))

    const r = await resolverPerfilPorEmail('ana@example.com')
    expect(r).toMatchObject({ id: null, motivo: 'error_lectura' })
    expect(r.detalle).toContain('connection terminated')
    expect(mockEjecutar).toHaveBeenCalledTimes(1) // una sola: la consulta. Ninguna escritura.
  })

  it('la excepción NO se propaga (rompería el callback jwt y con él la sesión)', async () => {
    mockEjecutar.mockRejectedValueOnce(new Error('boom'))
    await expect(resolverPerfilPorEmail('ana@example.com')).resolves.toBeDefined()
  })
})

describe('los caminos normales', () => {
  it('perfil existente → su id, sin escribir', async () => {
    mockEjecutar.mockResolvedValueOnce([{ id: ID_GANADOR }])
    expect(await resolverPerfilPorEmail('ANA@Example.com ')).toMatchObject({
      id: ID_GANADOR,
      motivo: 'existia',
    })
    expect(mockEjecutar).toHaveBeenCalledTimes(1)
  })

  it('perfil nuevo → se crea', async () => {
    mockEjecutar.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    const r = await resolverPerfilPorEmail('nueva@example.com')
    expect(r.motivo).toBe('creado')
    expect(r.id).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('sin email no se consulta nada', async () => {
    for (const v of [null, undefined, '', '   ']) {
      expect(await resolverPerfilPorEmail(v)).toMatchObject({ id: null, motivo: 'sin_email' })
    }
    expect(mockEjecutar).not.toHaveBeenCalled()
  })

  it('un fallo de creación que NO es la carrera se reporta como tal', async () => {
    mockEjecutar.mockResolvedValueOnce([]).mockRejectedValueOnce(new Error('permission denied'))
    const r = await resolverPerfilPorEmail('ana@example.com')
    expect(r).toMatchObject({ id: null, motivo: 'error_creacion' })
    expect(r.detalle).toContain('permission denied')
  })
})
