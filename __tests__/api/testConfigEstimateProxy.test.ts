/**
 * @jest-environment node
 *
 * (entorno `node` a propósito: `NextResponse.json` se apoya en el `Response.json` estático de la
 * plataforma, que jsdom no trae — el fallo sería del entorno de prueba, no del código.)
 */
/**
 * El proxy de `/api/v2/test-config/estimate` durante el despliegue de DOS superficies. (T-623)
 *
 * ── EL FALLO, MEDIDO EN VIVO ──────────────────────────────────────────────────────────────
 * Frontend y backend se despliegan por separado, así que SIEMPRE hay una ventana en la que uno
 * tiene el POST nuevo y el otro no. El 06/08, con el frontend ya desplegado (`vence-frontend:623`)
 * y el backend todavía encolado, un POST real a producción devolvía:
 *
 *     x-served-by: vence-backend-proxy   →   HTTP 404
 *
 * O sea: el proxy reenviaba al backend, el backend no conocía el verbo, y el 404 salía TAL CUAL
 * al cliente. Y entonces el configurador dejaba de contar para **todas** las selecciones, no solo
 * para las grandes — el arreglo, a medio desplegar, era PEOR que el defecto que venía a arreglar.
 *
 * El `catch` del proxy no lo cubría, y ése es el punto que este test fija: **un 404 no lanza**.
 * Es una respuesta perfectamente válida, así que el camino de error no se activaba.
 *
 * Se comprueba también el reverso, que es lo que impide pasarse de listo: un 500 del backend SÍ
 * tiene que verse. Un 500 significa «sé hacerlo y me ha salido mal»; taparlo con el cálculo local
 * escondería una avería real del backend y nadie se enteraría.
 */
describe('[T-623] proxy de estimate — la ventana entre los dos deploys', () => {
  const MODULO = '@/app/api/v2/test-config/estimate/route'

  const conBackend = (respuesta: { status: number; body?: string }) => {
    jest.resetModules()
    jest.doMock('@/lib/api/backend-router', () => ({
      shouldRouteToBackend: () => true,
      backendUrlFor: (p: string) => `https://api.vence.es/${p}`,
    }))
    jest.doMock('@/lib/api/test-config', () => ({
      safeParseEstimateQuestions: (d: unknown) => ({ success: true, data: d }),
      estimateAvailableQuestionsCached: async () => ({ success: true, count: 1234, local: true }),
    }))
    jest.doMock('@/lib/api/withErrorLogging', () => ({
      withErrorLogging: (_r: string, h: unknown) => h,
    }))
    global.fetch = jest.fn().mockResolvedValue({
      status: respuesta.status,
      headers: { get: () => null },
      text: async () => respuesta.body ?? '',
    }) as unknown as typeof fetch
  }

  const peticion = () =>
    ({ json: async () => ({ positionType: 'auxiliar_administrativo_estado' }) }) as never

  afterEach(() => { jest.resetModules(); jest.restoreAllMocks() })

  it('un 404 del backend NO se propaga: se cuenta en local', async () => {
    conBackend({ status: 404, body: '{"message":"Cannot POST /api/v2/test-config/estimate"}' })
    const { POST } = require(MODULO)
    const res = await POST(peticion())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.count).toBe(1234)   // vino del cálculo local, no del backend
  })

  it('un 405 tampoco: es la otra forma de decir «no conozco ese verbo»', async () => {
    conBackend({ status: 405 })
    const { POST } = require(MODULO)
    const res = await POST(peticion())
    expect(res.status).toBe(200)
    expect((await res.json()).count).toBe(1234)
  })

  // El reverso, y es igual de importante: no taparlo todo.
  it('un 500 del backend SÍ se ve — sabe hacerlo y le ha salido mal', async () => {
    conBackend({ status: 500, body: '{"success":false,"error":"boom"}' })
    const { POST } = require(MODULO)
    const res = await POST(peticion())
    expect(res.status).toBe(500)
  })

  it('una respuesta buena del backend se sirve tal cual (no se recalcula en local)', async () => {
    conBackend({ status: 200, body: '{"success":true,"count":777}' })
    const { POST } = require(MODULO)
    const res = await POST(peticion())
    expect(res.status).toBe(200)
    expect((await res.json()).count).toBe(777)
  })

  it('un cuerpo que no es JSON se rechaza con 400, sin tumbar el endpoint', async () => {
    conBackend({ status: 200 })
    const { POST } = require(MODULO)
    const res = await POST({ json: async () => { throw new Error('no es JSON') } } as never)
    expect(res.status).toBe(400)
  })
})
