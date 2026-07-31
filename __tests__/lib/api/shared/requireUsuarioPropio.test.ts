/**
 * @jest-environment node
 */
// Entorno node: `NextResponse.json` se apoya en el `Response.json` estático de la
// plataforma, que jsdom no trae. Sin esto el helper revienta al construir el 403.
// __tests__/lib/api/shared/requireUsuarioPropio.test.ts
//
// La decisión que toma este helper es de dinero: si corta, alguien no puede pagar; si deja
// pasar donde no debe, se cancela la suscripción equivocada. El guardarraíl
// `endpointsPagoIdentidad` comprueba que la política esté ESCRITA en cada endpoint; esto
// comprueba que HAGA lo que dice.
//
// Los cuatro casos que importan (31/07/2026, T-340 + el incidente del checkout):
//   · id que coincide            → pasa, se corte o no
//   · id distinto + 'cortar'     → 403, y queda registrado
//   · id distinto + 'seguir'     → pasa CON EL ID DEL TOKEN, y queda registrado igual
//   · sin id                     → no hay nada que contrastar, no se inventa una señal
import { NextRequest } from 'next/server'

const mockVerifyAuth = jest.fn()
const mockEmit = jest.fn()

jest.mock('@/lib/api/auth/verifyAuth', () => ({ verifyAuth: (...a: unknown[]) => mockVerifyAuth(...a) }))
jest.mock('@/lib/observability/emit', () => ({ emitFireAndForget: (...a: unknown[]) => mockEmit(...a) }))
// El helper importa Drizzle y Supabase al cargar; nada de eso interviene en esta función.
jest.mock('@/db/client', () => ({ getAdminDb: () => ({}) }))
jest.mock('@supabase/supabase-js', () => ({ createClient: () => ({}) }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { requireUsuarioPropio } = require('@/lib/api/shared/auth') as typeof import('@/lib/api/shared/auth')

const DUENO = '11111111-1111-4111-8111-111111111111'
const AJENO = '22222222-2222-4222-8222-222222222222'
const req = () => new NextRequest('https://www.vence.es/api/stripe/x', { method: 'POST' })

beforeEach(() => {
  jest.clearAllMocks()
  mockVerifyAuth.mockResolvedValue({ success: true, userId: DUENO, email: 'a@b.c', impersonadoPor: null })
})

describe('requireUsuarioPropio — qué pasa cuando el cliente afirma otro id', () => {
  it('sin sesión propaga el status real de verifyAuth (401), no un 403 genérico', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 401, reason: 'no_bearer_token' })
    const r = await requireUsuarioPropio(req(), '/api/stripe/cancel', DUENO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(401)
  })

  it('suplantando escribiendo propaga 403 (no es lo mismo que no estar autenticado)', async () => {
    mockVerifyAuth.mockResolvedValue({ success: false, status: 403, reason: 'impersonacion_solo_lectura' })
    const r = await requireUsuarioPropio(req(), '/api/stripe/cancel', DUENO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it('el id que coincide pasa y devuelve la identidad del token', async () => {
    const r = await requireUsuarioPropio(req(), '/api/stripe/cancel', DUENO)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.userId).toBe(DUENO)
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('sin id que contrastar no se inventa una discrepancia', async () => {
    const r = await requireUsuarioPropio(req(), '/api/stripe/cancel', undefined)
    expect(r.ok).toBe(true)
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('POR DEFECTO corta: olvidarse de declarar la política falla del lado seguro', async () => {
    const r = await requireUsuarioPropio(req(), '/api/stripe/cancel', AJENO)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(403)
  })

  it("'cortar' corta y lo deja registrado como bloqueado", async () => {
    const r = await requireUsuarioPropio(req(), '/api/stripe/cancel', AJENO, { alDiscrepar: 'cortar' })
    expect(r.ok).toBe(false)
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth_identidad_ajena_rechazada',
        metadata: expect.objectContaining({ afirmado: AJENO, politica: 'cortar', bloqueado: true }),
      }),
    )
  })

  it("'seguir-con-el-token' deja pasar — y con el id del TOKEN, no con el afirmado", async () => {
    const r = await requireUsuarioPropio(req(), '/api/stripe/create-checkout', AJENO, {
      alDiscrepar: 'seguir-con-el-token',
    })
    expect(r.ok).toBe(true)
    // Lo esencial: seguir NO es confiar en el cliente. Si esto devolviera AJENO, «seguir»
    // sería exactamente el agujero que T-340 cerró.
    if (r.ok) expect(r.userId).toBe(DUENO)
  })

  it('dejar pasar NO es pasar desapercibido: la señal se emite igual', async () => {
    await requireUsuarioPropio(req(), '/api/stripe/create-checkout', AJENO, {
      alDiscrepar: 'seguir-con-el-token',
    })
    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'auth_identidad_ajena_rechazada',
        metadata: expect.objectContaining({ politica: 'seguir-con-el-token', bloqueado: false }),
      }),
    )
  })

  it('la señal viaja con el id de QUIEN llama, para poder buscarlo después', async () => {
    await requireUsuarioPropio(req(), '/api/stripe/create-checkout', AJENO, {
      alDiscrepar: 'seguir-con-el-token',
    })
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ userId: DUENO }))
  })
})
