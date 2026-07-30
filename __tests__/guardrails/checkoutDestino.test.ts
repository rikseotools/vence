// GUARDARRAÍL: quien manda a pagar tiene que leer el campo que el endpoint DEVUELVE.
//
// ## Qué pasó (30/07/2026)
//
// `/api/stripe/create-checkout` responde `{ sessionId, checkoutUrl, debug }`. La página del
// precio de fidelidad hacía:
//
//     window.location.href = data.url        // ← ese campo no existe
//
// `location.href = undefined` navega a «/undefined», así que la usuaria pulsaba «Activar mi
// Premium», con sus dos precios delante y la página ya correcta, y aterrizaba en un 404 de
// la propia web. Cuarta vuelta del mismo flujo y el mismo patrón de siempre: **el dato
// existe y quien lo necesita lo lee con otro nombre**.
//
// La página de premium normal (`/premium`) lo hacía bien desde el principio, y con guarda
// (`if (data.checkoutUrl)`). La diferencia entre las dos es justo lo que fija este test.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')

const ENDPOINT = leer('app/api/stripe/create-checkout/route.js')
const PAGINAS = ['app/premium/page.tsx', 'app/premium/personal/page.tsx']

describe('el destino del checkout', () => {
  it('el endpoint sigue devolviendo `checkoutUrl` (si se renombra, hay que tocar las páginas)', () => {
    expect(ENDPOINT).toMatch(/checkoutUrl:\s*session\.url/)
  })

  for (const rel of PAGINAS) {
    it(`${rel} lee checkoutUrl, no un campo inventado`, () => {
      const src = leer(rel)
      expect(src).toContain('checkoutUrl')
    })

    it(`${rel} no navega a \`data.url\` a secas (el 404 del 30/07)`, () => {
      const src = leer(rel)
      // Vale usarlo como respaldo (`data.checkoutUrl || data.url`), pero nunca como única
      // fuente del destino.
      expect(src).not.toMatch(/location\.href\s*=\s*data\.url\b/)
    })

    it(`${rel} comprueba que hay destino antes de navegar`, () => {
      const src = leer(rel)
      // O bien `if (data.checkoutUrl)`, o bien una variable con guarda explícita.
      const tieneGuarda = /if\s*\(\s*data\.checkoutUrl\s*\)/.test(src) || /if\s*\(\s*!\s*destino\s*\)/.test(src)
      expect(tieneGuarda).toBe(true)
    })
  }

  it('si falta el destino, queda rastro en vez de un redirect a ninguna parte', () => {
    const src = leer('app/premium/personal/page.tsx')
    expect(src).toContain('checkout sin URL de destino')
  })
})
