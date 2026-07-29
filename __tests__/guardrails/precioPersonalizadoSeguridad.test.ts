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

  it('la migración garantiza UNA sola oferta viva por persona', () => {
    const sqlMig = leer('supabase/migrations/20260729_user_price_offers.sql')
    expect(sqlMig).toMatch(/CREATE UNIQUE INDEX[\s\S]*user_price_offers \(user_id\)[\s\S]*WHERE redeemed_at IS NULL AND revoked_at IS NULL/)
    // Y que un importe absurdo no entre por la puerta de atrás.
    expect(sqlMig).toContain('CHECK (importe_centimos > 0)')
  })
})
