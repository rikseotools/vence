// __tests__/guardrails/simSesionUnica.test.ts
//
// GUARDARRAÍL: ninguna simulación acuña la cookie de sesión por su cuenta.
//
// POR QUÉ (31/07/2026). Tres sims la reimplementaban con el nombre de local
// (`authjs.session-token`), y sobre https Auth.js le pone el prefijo `__Secure-` — que es
// además el **SALT** del cifrado. Consecuencia: contra producción no descifra nada y
// devuelve **401 en todo**. Eso no se lee como «la sim está mal», se lee como
// «la funcionalidad está rota»:
//
//   · `sim-precio-heredado` dio 6/7 en rojo tras desplegar T-341, con la funcionalidad
//     perfectamente viva. Media hora buscando un fallo que no existía.
//   · `sim-identidad-pago` y `sim-impersonacion` eran PEORES: casi todos sus casos esperan
//     un rechazo, así que un 401 universal los pinta de verde. Solo los casos de contraste
//     lo delatan — y son la minoría.
//
// La fuente única es `lib/sim/session.ts` (`sessionCookieNameFor`, `mintOwnAuthCookie`,
// `cookieForPlaywright`), que ya resolvía local vs producción cuando se escribieron las tres.
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

const DIR = join(process.cwd(), 'scripts/sim')

function simsTs(dir: string, salida: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) simsTs(p, salida)
    else if (/\.(ts|mts)$/.test(e.name)) salida.push(p)
  }
  return salida
}

describe('las simulaciones no reinventan la sesión', () => {
  const ficheros = simsTs(DIR)

  it('hay simulaciones que revisar (si no, este guardarraíl no vigila nada)', () => {
    expect(ficheros.length).toBeGreaterThan(3)
  })

  it('ninguna fija el nombre de la cookie de sesión a mano', () => {
    const culpables = ficheros.filter((f) => /'(__Secure-)?authjs\.session-token'/.test(readFileSync(f, 'utf8')))
    // Mensaje útil en el fallo: la ruta sola no dice qué hacer.
    expect(culpables.map((f) => f.slice(process.cwd().length + 1))).toEqual([])
  })

  it('la que acuña sesión importa el módulo compartido', () => {
    const acunan = ficheros.filter((f) => /from 'next-auth\/jwt'/.test(readFileSync(f, 'utf8')))
    // Vale tanto el import estático como el diferido (`await import(...)`): hay sims que
    // cargan `.env.local` antes de tocar nada que lea el entorno.
    const sinModulo = acunan.filter((f) => !/(from|import\()\s*'[^']*lib\/sim\/session'/.test(readFileSync(f, 'utf8')))
    expect(sinModulo.map((f) => f.slice(process.cwd().length + 1))).toEqual([])
  })
})
