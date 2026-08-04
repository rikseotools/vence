/**
 * @jest-environment node
 */
// `lib/deploy/shaVivo.cjs` — de quién se fía el sistema para saber qué está vivo en producción.
//
// Importa el módulo REAL, nunca una copia. El invariante que se fija aquí es de SEGURIDAD, no de
// comodidad: cuando no se puede saber el sha vivo, la respuesta tiene que ser `null` ("no lo sé")
// y NUNCA una cadena cualquiera. Quien lo consume despierta tareas comparando ese valor: un `null`
// no despierta nada (correcto, se reintenta luego), pero un valor inventado despertaría tareas
// mandando a alguien a verificar algo que no está desplegado — y eso se descubre tarde y mal.
//
// Nace del fallo del 29/07: el aviso de deploy dependía del script de quien desplegaba, cuyo
// worktree puede ser de hace días. La reconciliación contra `/health` quita esa dependencia, así
// que este módulo pasa a ser la pieza de la que cuelga todo el mecanismo.

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { shaVivo, shasVivos, shaVivoEstable, ENDPOINTS } = require('@/lib/deploy/shaVivo.cjs') as {
  shaVivo: (s: string, o?: { timeoutMs?: number }) => Promise<string | null>
  shasVivos: (o?: { timeoutMs?: number }) => Promise<{ frontend: string | null; backend: string | null }>
  shaVivoEstable: (s: string, o?: { intentos?: number; pausaMs?: number }) => Promise<{ sha: string | null; estable: boolean; vistos: string[] }>
  ENDPOINTS: Record<string, string>
}

const realFetch = global.fetch

afterEach(() => {
  global.fetch = realFetch
})

const conRespuesta = (impl: () => unknown) => {
  global.fetch = jest.fn(async () => impl()) as never
}

describe('shaVivo — la fuente de verdad de qué está desplegado', () => {
  it('devuelve el sha que publica /health', async () => {
    conRespuesta(() => ({ ok: true, json: async () => ({ deploy: 'abc12345' }) }))
    await expect(shaVivo('frontend')).resolves.toBe('abc12345')
  })

  it('consulta el endpoint de CADA superficie (no siempre el mismo)', async () => {
    const vistos: string[] = []
    global.fetch = jest.fn(async (url: string) => {
      vistos.push(String(url))
      return { ok: true, json: async () => ({ deploy: 'x' }) }
    }) as never
    await shasVivos()
    expect(vistos).toEqual(expect.arrayContaining([ENDPOINTS.frontend, ENDPOINTS.backend]))
    expect(ENDPOINTS.frontend).not.toBe(ENDPOINTS.backend)
  })

  // ── Fail-safe: "no lo sé" nunca puede parecerse a "está desplegado" ──────
  it('la red caída da null, no una excepción (quien llama está listando el backlog)', async () => {
    conRespuesta(() => { throw new Error('ECONNREFUSED') })
    await expect(shaVivo('backend')).resolves.toBeNull()
  })

  it('un 500 da null (un error del servidor no dice nada de qué hay vivo)', async () => {
    conRespuesta(() => ({ ok: false, status: 500, json: async () => ({ deploy: 'nope' }) }))
    await expect(shaVivo('frontend')).resolves.toBeNull()
  })

  it('una respuesta sin campo `deploy` da null, no undefined ni ""', async () => {
    conRespuesta(() => ({ ok: true, json: async () => ({ status: 'ok' }) }))
    await expect(shaVivo('frontend')).resolves.toBeNull()
  })

  it('un `deploy` vacío o no-string da null (no se despierta con basura)', async () => {
    conRespuesta(() => ({ ok: true, json: async () => ({ deploy: '' }) }))
    await expect(shaVivo('frontend')).resolves.toBeNull()
    conRespuesta(() => ({ ok: true, json: async () => ({ deploy: 12345 }) }))
    await expect(shaVivo('frontend')).resolves.toBeNull()
  })

  it('un JSON ilegible da null', async () => {
    conRespuesta(() => ({ ok: true, json: async () => { throw new Error('unexpected token') } }))
    await expect(shaVivo('backend')).resolves.toBeNull()
  })

  it('una superficie que no existe da null sin llamar a la red', async () => {
    const spy = jest.fn()
    global.fetch = spy as never
    await expect(shaVivo('inventada')).resolves.toBeNull()
    expect(spy).not.toHaveBeenCalled()
  })

  it('si una superficie falla, la otra sigue dando su valor', async () => {
    global.fetch = jest.fn(async (url: string) =>
      String(url).includes('api.vence.es')
        ? { ok: true, json: async () => ({ deploy: 'back99' }) }
        : { throw: true, ok: false, json: async () => ({}) },
    ) as never
    await expect(shasVivos()).resolves.toEqual({ frontend: null, backend: 'back99' })
  })
})

// ── T-459: durante un rollout el sha vivo es una MONEDA AL AIRE ─────────────────────────────
// Mientras ECS sustituye tareas, el balanceador reparte entre la revisión vieja y la nueva, así
// que /health contesta un sha u otro según a cuál caiga. Quien lo use para decidir si algo está
// desplegado obtiene veredictos OPUESTOS a la misma pregunta en el mismo minuto — y eso es lo que
// enseña a no creerse la puerta. Aquí no se adivina cuál es «el bueno»: se detecta el desacuerdo.
describe('shaVivoEstable — ¿me puedo fiar de este sha?', () => {
  const secuencia = (shas: (string | null)[]) => {
    let i = 0
    global.fetch = jest.fn(async () => {
      const s = shas[Math.min(i++, shas.length - 1)]
      return s === null
        ? { ok: false, json: async () => ({}) }
        : { ok: true, json: async () => ({ deploy: s }) }
    }) as never
  }

  it('con el despliegue quieto dice ESTABLE', async () => {
    secuencia(['abc123', 'abc123', 'abc123'])
    await expect(shaVivoEstable('frontend', { pausaMs: 0 })).resolves.toEqual({
      sha: 'abc123', estable: true, vistos: ['abc123'],
    })
  })

  it('con un ROLLOUT en curso (dos shas distintos) dice que NO es estable', async () => {
    secuencia(['viejo11', 'nuevo22', 'viejo11'])
    const r = await shaVivoEstable('frontend', { pausaMs: 0 })
    expect(r.estable).toBe(false)
    expect(r.vistos.sort()).toEqual(['nuevo22', 'viejo11'])
  })

  it('una lectura FALLIDA no es un desacuerdo: no inventa un rollout', async () => {
    // Un /health que da timeout una vez no prueba que haya dos revisiones sirviendo. Confundirlo
    // convertiría cualquier hipo de red en «se está desplegando».
    secuencia(['abc123', null, 'abc123'])
    const r = await shaVivoEstable('backend', { pausaMs: 0 })
    expect(r).toEqual({ sha: 'abc123', estable: true, vistos: ['abc123'] })
  })

  it('sin poder leer NADA devuelve null y estable: «no lo sé» no es «hay rollout»', async () => {
    secuencia([null, null, null])
    await expect(shaVivoEstable('frontend', { pausaMs: 0 })).resolves.toEqual({
      sha: null, estable: true, vistos: [],
    })
  })

  it('pregunta tantas veces como se le pida', async () => {
    secuencia(['x1'])
    await shaVivoEstable('frontend', { intentos: 4, pausaMs: 0 })
    expect(global.fetch).toHaveBeenCalledTimes(4)
  })
})
