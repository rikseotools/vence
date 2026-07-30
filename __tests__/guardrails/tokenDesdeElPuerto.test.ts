// GUARDARRAÍL: el token de sesión se pide al PUERTO, nunca a un proveedor concreto.
//
// ## Qué pasó (30/07/2026)
//
// `app/premium/success/page.tsx` —la pantalla que ve quien acaba de pagar— sacaba el token
// creando un cliente de **Supabase** a mano:
//
//     const sb = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
//     const token = (await sb.auth.getSession()).data.session?.access_token
//     if (!token) return { errorMessage: 'no_token' }
//
// Pero desde el 03/07/2026 las sesiones las emite **Auth.js** (RS256). Para cualquiera con
// sesión nueva ese `getSession()` devuelve vacío, así que la función salía por `no_token` y
// **nunca llegaba a llamar al endpoint de sincronización**: medido, CERO llamadas a
// `/api/stripe/checkout-sync` en 30 días.
//
// Resultado: todo el que pagaba veía «Hemos tenido un problema técnico» en el último paso de
// la compra. El premium se activaba igual por el webhook (no se perdió dinero), y por eso
// nadie lo notó: el fallo no rompía nada medible y **no emitía ninguna señal**.
//
// La lección es de arquitectura: hay un puerto único (`lib/auth` / `getAuthHeaders`) que
// sirve el token del proveedor ACTIVO. Cada vez que alguien se salta el puerto y habla con
// un proveedor concreto, ata esa pantalla a una migración que ya ocurrió.
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const RAIZ = process.cwd()

/** Todos los .tsx/.ts marcados `'use client'` bajo estas carpetas. */
function ficherosCliente(dirs: string[]): string[] {
  const out: string[] = []
  const visitar = (dir: string) => {
    let entradas: string[] = []
    try {
      entradas = readdirSync(dir)
    } catch {
      return
    }
    for (const e of entradas) {
      const p = join(dir, e)
      let st
      try {
        st = statSync(p)
      } catch {
        continue
      }
      if (st.isDirectory()) {
        if (e === 'node_modules' || e === '.next') continue
        visitar(p)
      } else if (/\.(tsx|ts)$/.test(e)) {
        const src = readFileSync(p, 'utf8')
        if (/^['"]use client['"]/m.test(src.slice(0, 200))) out.push(p)
      }
    }
  }
  dirs.forEach((d) => visitar(join(RAIZ, d)))
  return out
}

describe('el token de sesión sale del puerto, no de un proveedor', () => {
  const clientes = ficherosCliente(['app', 'components', 'hooks'])

  it('hay ficheros cliente que revisar (si no, el test no está probando nada)', () => {
    expect(clientes.length).toBeGreaterThan(20)
  })

  it('ningún componente de cliente crea un cliente de Supabase para sacar el token', () => {
    // `contexts/AuthContext.tsx` y el adapter de proveedor SÍ pueden: son la implementación
    // del puerto. Cualquier otro sitio, no.
    const permitidos = ['contexts/AuthContext.tsx', 'lib/auth/']
    const culpables = clientes
      .filter((p) => !permitidos.some((ok) => p.includes(ok)))
      .filter((p) => {
        const src = readFileSync(p, 'utf8')
        const creaCliente = /createClient\(/.test(src)
        const sacaToken = /getSession\(\)/.test(src) && /access_token|accessToken/.test(src)
        return creaCliente && sacaToken
      })
      .map((p) => p.replace(RAIZ + '/', ''))
    expect(culpables.join('\n') || 'ninguno').toBe('ninguno')
  })

  it('la pantalla de después de pagar usa getAuthHeaders y deja rastro si falla', () => {
    const src = readFileSync(join(RAIZ, 'app/premium/success/page.tsx'), 'utf8')
    expect(src).toContain('getAuthHeaders')
    // Sin señal, este fallo vuelve a durar un mes sin que nadie se entere.
    expect(src).toContain('emitClientEvent')
    expect(src).toMatch(/errorMessage: 'no_token'/)
  })
})
