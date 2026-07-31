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

describe('la página manda la sesión (30/07)', () => {
  // Rocío se quedó bloqueada DOS veces por lo mismo con distinta cara: primero porque
  // `apiFetch` mandaba POST a un endpoint GET (405), y después porque la llamada no
  // llevaba cabeceras de autenticación (401). En los dos casos la página decía «no tienes
  // precio activo» a alguien que SÍ lo tenía, y en los dos el endpoint estaba perfecto.
  //
  // La lección de verificación: probar el endpoint con un token a mano NO prueba la
  // página. Salió verde mientras la usuaria seguía sin poder pagar.
  const PAGINA = leer('app/premium/personal/page.tsx')

  it('la página pide las cabeceras de sesión antes de llamar', () => {
    expect(PAGINA).toContain('getAuthHeaders')
    expect(PAGINA).toMatch(/const headers = await getAuthHeaders\(\)/)
  })

  it('y se las pasa a la llamada (tenerlas y no usarlas es el mismo 401)', () => {
    const bloque = PAGINA.slice(PAGINA.indexOf('mi-oferta') - 400, PAGINA.indexOf('mi-oferta') + 200)
    expect(bloque).toMatch(/headers\s*[,}]/)
  })

  // ⚠️ Aquí VIVÍA `expect(PAGINA).toMatch(/method: 'GET'/)`, y es el ejemplo perfecto de
  // guardarraíl que engaña: estuvo verde tres días mientras la petición salía como POST.
  // El texto estaba escrito, sí… en el segundo argumento de `apiFetch`, que es el CUERPO.
  // Comprobar que una cadena aparece en un fichero no dice nada sobre dónde aparece.
  // Lo que de verdad cierra ese agujero está en `__tests__/lib/api/clientMetodo.test.ts`
  // (ejecuta la llamada e inspecciona la petición) y en el tipo `CuerpoValido`.
  it('la página usa apiGet, que no admite escribir el método en el sitio equivocado', () => {
    expect(PAGINA).toContain('apiGet')
    expect(PAGINA).not.toMatch(/apiFetch<[^>]*>\(\s*'\/api\/v2\/premium\/mi-oferta'/)
  })
})

describe('el endpoint atiende también a los clientes que sigan mandando POST (30/07)', () => {
  // Tercer día del mismo bloqueo. El arreglo del 405 se había dado por hecho y Rocío seguía
  // sin poder pagar: sus eventos del 30/07 (04:50, 04:51, 06:56, 06:57) son POST 405 con
  // `deploy_version` = el despliegue que supuestamente lo arreglaba.
  //
  // La causa no era su navegador: era que la llamada nunca fue GET. `apiFetch(url, body,
  // options)` recibía las opciones en la posición del cuerpo, así que `options` quedaba
  // `undefined` y se aplicaba el método por defecto, POST. Arreglado con `apiGet` y con un
  // tipo que impide repetirlo.
  //
  // El endpoint conserva el POST porque TODOS los navegadores que no recarguen siguen
  // ejecutando la versión anterior: para ellos, esto es la diferencia entre poder pagar hoy
  // o no. Es una lectura autenticada e idempotente, no cuesta nada mantenerla.
  const ENDPOINT = leer('app/api/v2/premium/mi-oferta/route.ts')

  it('el endpoint responde a POST además de a GET', () => {
    expect(ENDPOINT).toMatch(/export const GET =/)
    expect(ENDPOINT).toMatch(/export const POST =/)
  })

  it('y los dos métodos ejecutan EL MISMO handler (si divergen, vuelve el fallo)', () => {
    const get = ENDPOINT.match(/export const GET = withErrorLogging\([^,]+,\s*(\w+)\)/)
    const post = ENDPOINT.match(/export const POST = withErrorLogging\([^,]+,\s*(\w+)\)/)
    expect(get?.[1]).toBeTruthy()
    expect(post?.[1]).toBe(get?.[1])
  })

  it('sigue exigiendo sesión por POST: el método viejo no es una puerta de atrás', () => {
    // El handler es uno solo, así que `verifyAuth` cubre ambos; se fija por si alguien
    // separa los caminos más adelante.
    expect(ENDPOINT).toContain('verifyAuth')
    expect(ENDPOINT).not.toMatch(/request\.(json|body)/)
  })
})

/**
 * El precio heredado no puede cobrarse dos veces (T-363, 31/07/2026).
 *
 * Quien vuelve puede tener todavía servicio PAGADO en la cuenta antigua. Como son dos cuentas de
 * Stripe distintas no hay prorrateo posible, así que la suscripción nueva arranca con `trial_end` el
 * día en que se le acaba lo pagado. Medido el 31/07: **180 personas** a las que eso les evita pagar
 * dos veces el mismo periodo.
 *
 * Se vigila aquí porque es dinero y porque el fallo sería INVISIBLE: la pantalla se vería igual de
 * bien, y el doble cargo aparecería en el banco del usuario.
 */
describe('T-363 — el checkout aplaza el primer cobro si queda servicio pagado', () => {
  const CHECKOUT_JS = CHECKOUT   // ya cargado arriba con el helper del fichero

  it('manda `trial_end` a Stripe', () => {
    expect(CHECKOUT_JS).toMatch(/trial_end:\s*cobertura\.trialEnd/)
  })

  it('SOLO para el precio heredado (a quien paga tarifa normal no se le regala nada)', () => {
    expect(CHECKOUT_JS).toMatch(/if\s*\(\s*precioPersonalizado\s*\)/)
    expect(CHECKOUT_JS).toContain('coberturaPendiente')
  })

  it('la fecha se calcula en el CLIC, no se guarda con la oferta', () => {
    // Si se precalculara al crear la oferta, quien tardara dos meses en pulsar tendría dos meses
    // de regalo: el enlace se guarda y se reutiliza.
    const ofertas = leer('lib/api/premium/ofertaHeredada.ts')
    expect(ofertas).not.toContain('trial_end')
    expect(ofertas).not.toContain('trial_period_days')
  })
})
