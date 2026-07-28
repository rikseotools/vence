// Tests de `lib/api/authHeaders.ts` — ENSAMBLADO de cabeceras.
//
// Hasta T-210 (28/07/2026) este fichero caracterizaba además el singleflight + cooldown de
// 30 s, porque esa mecánica vivía aquí. Se movió al adapter del proveedor (que es quien la
// conoce) y su caracterización se movió con ella a
// `__tests__/lib/auth/client.test.ts` → «supabaseAdapter — getAccessToken (Bearer)»,
// ampliada con los dos casos que arreglan el defecto (reusar token fresco sin red; no
// servir un token caducado por estar dentro de la ventana de reloj de pared).
//
// Lo que se fija AQUÍ es lo que este módulo sigue prometiendo:
//   · pide el token al PUERTO (una sola vez, sin lógica de renovación propia),
//   · lo envuelve en `Authorization: Bearer`,
//   · adjunta las cabeceras de dispositivo (anti-fraude),
//   · y nunca lanza: sin token se devuelven cabeceras sin `Authorization`.

const mockAuthPort = {
  getAccessToken: jest.fn(),
  getSession: jest.fn(),
  refreshSession: jest.fn(),
}
jest.mock('@/lib/auth', () => ({
  auth: mockAuthPort,
}))

function loadGetAuthHeaders(): () => Promise<Record<string, string>> {
  return require('@/lib/api/authHeaders').getAuthHeaders
}

describe('getAuthHeaders — ensamblado de cabeceras', () => {
  beforeEach(() => {
    jest.resetModules()
    mockAuthPort.getAccessToken.mockReset()
    mockAuthPort.getSession.mockReset()
    mockAuthPort.refreshSession.mockReset()
    localStorage.clear()
  })

  test('pide el token al puerto y lo envuelve en Bearer', async () => {
    mockAuthPort.getAccessToken.mockResolvedValue('tok-1')
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(mockAuthPort.getAccessToken).toHaveBeenCalledTimes(1)
    expect(headers.Authorization).toBe('Bearer tok-1')
  })

  // El fondo de T-210: la renovación NO se decide aquí. Si este módulo volviera a llamar
  // refreshSession() por su cuenta, reaparecerían las dos implementaciones que convivían
  // (y con ellas los ~58.400 mints/día y los 401 silenciosos).
  test('NO decide renovaciones: no llama refreshSession ni getSession', async () => {
    mockAuthPort.getAccessToken.mockResolvedValue('tok-1')
    const getAuthHeaders = loadGetAuthHeaders()

    await getAuthHeaders()

    expect(mockAuthPort.refreshSession).not.toHaveBeenCalled()
    expect(mockAuthPort.getSession).not.toHaveBeenCalled()
  })

  test('N llamadas → N consultas al puerto (la caché es del puerto, no de aquí)', async () => {
    mockAuthPort.getAccessToken.mockResolvedValue('tok-1')
    const getAuthHeaders = loadGetAuthHeaders()

    await Promise.all([getAuthHeaders(), getAuthHeaders(), getAuthHeaders()])

    // Sin estado local: cada llamada pregunta. El puerto ya comparte el vuelo y cachea
    // (ver la simulación de 1 h en client.test.ts), así que esto NO es tráfico de red.
    expect(mockAuthPort.getAccessToken).toHaveBeenCalledTimes(3)
  })

  test('sin sesión → sin header Authorization (pero no lanza)', async () => {
    mockAuthPort.getAccessToken.mockResolvedValue(undefined)
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers.Authorization).toBeUndefined()
  })

  test('el puerto lanza → se degrada sin Authorization, sin propagar', async () => {
    mockAuthPort.getAccessToken.mockRejectedValue(new Error('boom'))
    localStorage.setItem('vence_device_id', 'dev-123')
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers.Authorization).toBeUndefined()
    // Las cabeceras de dispositivo se mandan igual: el anti-fraude no depende del token.
    expect(headers['X-Device-Id']).toBe('dev-123')
  })

  test('incluye X-Device-Id y X-Hw-Fingerprint desde localStorage', async () => {
    mockAuthPort.getAccessToken.mockResolvedValue('t')
    localStorage.setItem('vence_device_id', 'dev-123')
    localStorage.setItem('vence_hw_fingerprint', 'hw-456')
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers['X-Device-Id']).toBe('dev-123')
    expect(headers['X-Hw-Fingerprint']).toBe('hw-456')
  })

  test('sin device id en localStorage → no inventa la cabecera', async () => {
    mockAuthPort.getAccessToken.mockResolvedValue('t')
    const getAuthHeaders = loadGetAuthHeaders()

    const headers = await getAuthHeaders()

    expect(headers['X-Device-Id']).toBeUndefined()
    expect(headers['X-Hw-Fingerprint']).toBeUndefined()
  })
})
