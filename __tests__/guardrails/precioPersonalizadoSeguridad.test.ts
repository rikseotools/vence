// GUARDARRAÍL: un precio personalizado no puede convertirse en un descuento para todos.
//
// `/api/stripe/create-checkout` cobra el `priceId` que le manden en el body. Con el
// catálogo público da igual (todos ven los mismos precios), pero desde que existen
// precios a medida —a alguien se le mantiene su tarifa anterior— un `price_...` que se
// filtre por captura de pantalla o por el inspector permitiría a cualquiera pagar 18 € en
// vez de 29. Estos tests fijan las tres piezas que lo impiden.
import { readFileSync } from 'fs'
import { join } from 'path'

const leer = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8')
const CHECKOUT = leer('app/api/stripe/create-checkout/route.js')
const OFERTAS = leer('lib/api/premium/ofertas.ts')
const WEBHOOK = leer('app/api/stripe/webhook/route.ts')

describe('seguridad del precio personalizado', () => {
  it('el checkout comprueba que la oferta es DEL USUARIO antes de aceptar un precio fuera de catálogo', () => {
    expect(CHECKOUT).toContain('priceEsDelUsuario')
    // El userId con el que se comprueba tiene que ser el de la petición, no uno del body
    // aparte: se usa la misma variable que resuelve al usuario en el resto del endpoint.
    expect(CHECKOUT).toMatch(/priceEsDelUsuario\(userId, priceId\)/)
  })

  it('un precio fuera de catálogo que NO sea suyo sigue el camino de rechazo de siempre', () => {
    // La bandera solo salta la traducción/rechazo cuando la oferta es válida.
    expect(CHECKOUT).toMatch(/if \(!precioPersonalizado && !priceBelongsToAccount\(priceId, targetAccount\)\)/)
  })

  it('ante un fallo comprobando la oferta, se RECHAZA (fail-closed)', () => {
    // El resto de guardias de ese fichero son fail-open a propósito (no bloquear ingresos
    // por un blip). Este no: un fallo aquí significaría cobrar al precio de otro.
    const bloque = CHECKOUT.slice(CHECKOUT.indexOf('PRECIO PERSONALIZADO'), CHECKOUT.indexOf('BUSCAR USUARIO'))
    expect(bloque).toContain('offer_check_failed')
    expect(bloque).toContain('status: 503')
  })

  it('la vigencia la decide UNA sola función pura (página y checkout no discrepan)', () => {
    expect(OFERTAS).toContain('export function ofertaVigente')
    // Las dos consultas la usan; ninguna reimplementa el criterio con SQL propio.
    const usos = OFERTAS.match(/ofertaVigente\(/g) || []
    expect(usos.length).toBeGreaterThanOrEqual(3) // definición + getOfertaActiva + priceEsDelUsuario
  })

  it('el webhook marca la oferta como usada (no se contrata dos veces al precio especial)', () => {
    expect(WEBHOOK).toContain('marcarOfertaCanjeada')
  })

  it('marcar la oferta NUNCA puede impedir activar el premium ya pagado', () => {
    const bloque = WEBHOOK.slice(WEBHOOK.indexOf('marcarOfertaCanjeada') - 800, WEBHOOK.indexOf('marcarOfertaCanjeada') + 400)
    expect(bloque).toContain('try')
    expect(bloque).toMatch(/catch/)
  })

  it('un precio heredado NO recibe encima el cupón de fidelidad (sería doble descuento)', () => {
    // El precio heredado YA reconoce la antigüedad en el importe. Con el 10 % encima,
    // los 18 € pactados se quedarían en 16,20 €, que no es lo dicho ni a esa persona ni
    // al resto.
    expect(WEBHOOK).toContain("metadata?.tipo === 'precio_heredado'")
    const bloque = WEBHOOK.slice(WEBHOOK.indexOf('esPrecioHeredado'), WEBHOOK.indexOf('applyInitialLoyaltyCoupon') + 200)
    expect(bloque).toMatch(/if \(esPrecioHeredado\)[\s\S]*\} else \{/)
  })

  it('la tabla nace con las guardas correctas (el índice de una-sola se relajó después)', () => {
    const sqlMig = leer('supabase/migrations/20260729_user_price_offers.sql')
    // La migración original creaba «una oferta viva por persona»; el mismo día se cambió a
    // «una por precio» para poder ofrecer dos planes (ver …_multiples.sql). Se comprueba
    // que la tabla nace con SU índice, no que ese índice siga vigente — si no, este test
    // afirmaría algo que ya es falso.
    expect(sqlMig).toMatch(/CREATE UNIQUE INDEX[\s\S]*user_price_offers \(user_id\)/)
    // Y que un importe absurdo no entre por la puerta de atrás.
    expect(sqlMig).toContain('CHECK (importe_centimos > 0)')
  })
})

describe('varias ofertas vivas por persona (29/07)', () => {
  // La migración permitió dos ofertas (mensual y trimestral, para que elija), pero el
  // endpoint y la página se quedaron con LIMIT 1: se le iban a prometer dos precios por
  // mensaje y habría visto uno. No lo cazó nada porque con UNA oferta —lo que tienen
  // todos los demás— funciona perfectamente. Estos tests fijan las tres piezas.
  const ENDPOINT = leer('app/api/v2/premium/mi-oferta/route.ts')
  const PAGINA = leer('app/premium/personal/page.tsx')

  it('la consulta devuelve TODAS las vivas, sin LIMIT 1', () => {
    expect(OFERTAS).toContain('export async function getOfertasActivas')
    const bloque = OFERTAS.slice(OFERTAS.indexOf('getOfertasActivas'), OFERTAS.indexOf('/** La primera oferta viva'))
    expect(bloque).not.toMatch(/LIMIT\s+1/i)
  })

  it('el endpoint las expone en plural (y conserva el singular para clientes viejos)', () => {
    expect(ENDPOINT).toContain('getOfertasActivas')
    expect(ENDPOINT).toMatch(/ofertas:\s*ofertas\.map/)
    expect(ENDPOINT).toMatch(/oferta:\s*vista\(ofertas\[0\]\)/)
  })

  it('la página pinta una tarjeta por oferta, no la primera', () => {
    expect(PAGINA).toMatch(/ofertas\.map\(\(oferta\)/)
    // Y el botón contrata LA de su tarjeta, no una variable suelta del componente.
    expect(PAGINA).toMatch(/onClick=\{\(\) => contratar\(oferta\)\}/)
  })

  it('la migración impide la MISMA oferta dos veces, pero no dos planes distintos', () => {
    const mig = leer('supabase/migrations/20260729_user_price_offers_multiples.sql')
    expect(mig).toContain('DROP INDEX IF EXISTS user_price_offers_una_viva_por_usuario')
    expect(mig).toMatch(/UNIQUE INDEX[\s\S]*\(user_id, stripe_price_id\)/)
  })
})
