// Qué método SALE POR EL CABLE cuando se llama a `apiFetch`/`apiGet`.
//
// ## Por qué este test existe (30/07/2026)
//
// La página de precio de fidelidad llamaba así:
//
//     apiFetch('/api/v2/premium/mi-oferta', { method: 'GET', retries: 2, headers })
//
// La firma es `(url, body, options)`, así que las opciones iban de CUERPO: `options`
// quedaba `undefined` y el método por defecto —POST— se aplicaba tal cual. El endpoint es
// GET, devolvía 405, y la página le decía «no tienes precio activo» a una usuaria que sí
// lo tenía. Tres días bloqueada y cuatro pagos abandonados.
//
// Lo que falló no fue la falta de comprobaciones, sino su NATURALEZA. Había un guardarraíl
// que buscaba el texto `method: 'GET'` dentro del fichero, y lo encontraba: estaba escrito,
// solo que en el argumento equivocado. Un test de texto ve las letras, no la posición.
//
// Estos tests ejecutan la función con `fetch` interceptado y comprueban la petición real.
// Es la única capa que distingue «lo pone» de «lo hace».
import { apiFetch, apiGet } from '@/lib/api/client'

describe('el método que sale por el cable', () => {
  let llamadas: Array<{ url: string; init: RequestInit }>

  beforeEach(() => {
    llamadas = []
    global.fetch = jest.fn(async (url: string, init: RequestInit) => {
      llamadas.push({ url, init })
      return {
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as unknown as Response
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any
  })

  it('apiGet manda GET (el fallo del 30/07 era que mandaba POST)', async () => {
    await apiGet('/api/v2/premium/mi-oferta', { headers: { Authorization: 'Bearer x' } })
    expect(llamadas).toHaveLength(1)
    expect(llamadas[0].init.method).toBe('GET')
  })

  it('apiGet no manda cuerpo (fetch lanza TypeError si un GET lo lleva)', async () => {
    await apiGet('/api/v2/premium/mi-oferta')
    expect(llamadas[0].init.body).toBeUndefined()
  })

  it('apiGet propaga las cabeceras de sesión (sin ellas es un 401, el otro fallo)', async () => {
    await apiGet('/x', { headers: { Authorization: 'Bearer tok', 'X-Device-Id': 'd1' } })
    const h = llamadas[0].init.headers as Record<string, string>
    expect(h.Authorization).toBe('Bearer tok')
    expect(h['X-Device-Id']).toBe('d1')
  })

  it('apiFetch sigue mandando POST con cuerpo cuando se usa bien', async () => {
    await apiFetch('/api/algo', { questionId: 'q1' })
    expect(llamadas[0].init.method).toBe('POST')
    expect(JSON.parse(llamadas[0].init.body as string)).toEqual({ questionId: 'q1' })
  })

  it('apiFetch respeta un GET pedido por opciones, en su posición correcta', async () => {
    await apiFetch('/api/algo', null, { method: 'GET' })
    expect(llamadas[0].init.method).toBe('GET')
    expect(llamadas[0].init.body).toBeUndefined()
  })

  it('las opciones puestas donde el cuerpo REPRODUCEN el fallo (por eso no compilan)', async () => {
    // Este es el error exacto, ejecutado a propósito con el tipo desactivado para dejar
    // constancia de su efecto: sale POST. En código normal ya no compila (`CuerpoValido`).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await apiFetch('/api/v2/premium/mi-oferta', { method: 'GET', retries: 2 } as any)
    expect(llamadas[0].init.method).toBe('POST') // ← lo que recibía el servidor
  })
})
