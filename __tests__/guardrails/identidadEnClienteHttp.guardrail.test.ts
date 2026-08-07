// __tests__/guardrails/identidadEnClienteHttp.guardrail.test.ts
//
// El cliente HTTP común (`apiFetch`) adjunta la identidad del usuario porque el puerto de auth
// se la REGISTRA al construirse. Este guardarraíl vigila que ese cableado siga existiendo.
//
// ── LO QUE PASA SI SE PIERDE (T-670, 07/08/2026) ─────────────────────────────────────────────
// Sin proveedor registrado, `apiFetch` manda TODO anónimo. Mientras los endpoints toleren
// tráfico sin identidad no se nota nada; el día que uno comprueba la PROPIEDAD del recurso, la
// petición pasa a ser «alguien sin identidad pidiendo el examen de otro» y devuelve 403 al
// propio dueño. Emma, premium, lo intentó SEIS veces en 45 minutos —bajando de 100 preguntas a
// 25, a 10, a 5 y a 2— y se fue sin corregir ninguno. 190 rechazos y 20 personas el mismo día.
//
// Es un fallo SILENCIOSO por naturaleza: nada peta al perder el registro, simplemente las
// peticiones dejan de llevar quién eres. Por eso hace falta una prueba que lo afirme.

import { readFileSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()

describe('guardarraíl: el cliente HTTP lleva la identidad del usuario', () => {
  it('el puerto de auth registra su proveedor al construirse', () => {
    const src = readFileSync(join(RAIZ, 'lib/auth/client.ts'), 'utf8')
    expect(src).toContain('registrarProveedorDeIdentidad')
    // Dentro de getAuthClient, no en un módulo aparte que alguien tenga que importar: un paso
    // de cableado que se puede olvidar es el que se olvida.
    const dentroDeLaFabrica = src.slice(src.indexOf('export function getAuthClient'))
    expect(dentroDeLaFabrica).toContain('registrarProveedorDeIdentidad')
  })

  it('`apiFetch` sigue teniendo dónde enchufarla', () => {
    const src = readFileSync(join(RAIZ, 'lib/api/client.ts'), 'utf8')
    expect(src).toContain('export function registrarProveedorDeIdentidad')
    expect(src).toContain('cabeceraDeIdentidad')
  })

  it('EJECUTA el cableado: pedir el puerto deja el proveedor puesto', async () => {
    // Prueba de EJECUCIÓN, no de texto: que los dos ficheros mencionen la función no demuestra
    // que se llamen. Se ejerce la fábrica real y se comprueba el efecto en el cliente HTTP.
    jest.resetModules()
    const cliente = await import('@/lib/api/client')
    cliente._resetProveedorDeIdentidadParaTests()

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ ok: true }),
    })
    const original = global.fetch
    global.fetch = fetchMock as unknown as typeof fetch

    try {
      const { getAuthClient } = await import('@/lib/auth/client')
      getAuthClient() // <- construir el puerto es lo que debe registrar el proveedor

      await cliente.apiFetch('/api/lo-que-sea', { a: 1 }, { retries: 1 })

      // LA PRUEBA: antes de mandar mi petición, el cliente le pidió el token al puerto — y eso
      // se ve porque el puerto sale a por él (`/api/auth/token`). Sin el registro, esa llamada
      // no existiría: `apiFetch` iría directo y anónimo.
      const urls = fetchMock.mock.calls.map((c) => String(c[0]))
      expect(urls.some((u) => u.includes('/api/auth/token'))).toBe(true)
      expect(urls).toContain('/api/lo-que-sea')

      // Y la mía sigue saliendo pase lo que pase con el token (aquí no hay sesión).
      const mia = fetchMock.mock.calls.find((c) => String(c[0]) === '/api/lo-que-sea')!
      expect((mia[1].headers as Record<string, string>)['Content-Type']).toBe('application/json')
    } finally {
      global.fetch = original
    }
  })
})
