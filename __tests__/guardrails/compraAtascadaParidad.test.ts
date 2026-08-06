/**
 * T-601 — el rescate de la cancelación bloqueada por un checkout abierto vive en TRES sitios que
 * tienen que seguir de acuerdo:
 *
 *   · el núcleo puro (`lib/stripe/cancelCheckoutAbierto.ts`), que decide CUÁNDO actuar
 *   · el punto de uso (`lib/api/subscription/queries.ts`), que lo llama y EMITE
 *   · la regla de alerta (`backend/src/alerts/alert-rules.ts`), que VIGILA esa emisión
 *
 * El modo de fallo que esto cierra no es teórico y es el peor de todos: si alguien quita el
 * try/catch del cancel, o renombra el evento en un sitio y no en el otro, **la regla se queda
 * verde para siempre** y nadie se entera de que hay gente atrapada — que es exactamente el
 * silencio de 18 días que originó la tarea. Un cero por ceguera es indistinguible de un cero sano.
 *
 * Se comparan los AMARRES (nombre del evento, uso del núcleo, reintento), no el código entero.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const raiz = join(__dirname, '..', '..')
const nucleo = readFileSync(join(raiz, 'lib/stripe/cancelCheckoutAbierto.ts'), 'utf8')
const usos = readFileSync(join(raiz, 'lib/api/subscription/queries.ts'), 'utf8')
const reglas = readFileSync(join(raiz, 'backend/src/alerts/alert-rules.ts'), 'utf8')
const rescate = readFileSync(join(raiz, 'scripts/stripe/compras-atascadas.cjs'), 'utf8')

/** El evento es el único hilo entre lo que PASA y lo que se VE. */
const EVENTO = 'subscription_checkout_expirado_para_cancelar'

describe('paridad del rescate de compra atascada (T-601)', () => {
  it('el emisor y la regla nombran EXACTAMENTE el mismo evento', () => {
    expect(usos).toContain(EVENTO)
    expect(reglas).toContain(EVENTO)
  })

  it('la cancelación usa el núcleo puro, no una condición escrita a mano ahí mismo', () => {
    // Si el criterio se reescribe en línea (un `includes('checkout')` suelto), deja de estar
    // testeado y se vuelve a poder disparar una escritura en Stripe por parecido de texto.
    expect(usos).toContain('esBloqueoPorCheckoutAbierto')
    expect(usos).toContain('sesionesAExpirar')
    expect(usos).toMatch(/from '@\/lib\/stripe\/cancelCheckoutAbierto'/)
  })

  it('tras expirar se REINTENTA la cancelación (si no, el usuario sigue atrapado)', () => {
    // Expirar sin reintentar arreglaría la mitad: la sesión se cierra pero la suscripción
    // `incomplete` se queda ahí y la persona sigue sin poder salir.
    // `lastIndexOf`: la primera aparición es el `import` de arriba, no el punto de uso.
    const i = usos.lastIndexOf('esBloqueoPorCheckoutAbierto')
    expect(i).toBeGreaterThan(-1)
    const bloque = usos.slice(i, i + 1200)
    expect(bloque).toContain('expireOpenCheckoutSessions')
    expect(bloque).toMatch(/subscriptions\.cancel/)
  })

  it('el reintento usa una idempotency key DISTINTA', () => {
    // Stripe cachea la respuesta por key: reusar la del primer intento devolvería el error
    // guardado y el reintento sería una ilusión — verde en el código, usuario igual de atascado.
    // `lastIndexOf`: la primera aparición es el `import` de arriba, no el punto de uso.
    const i = usos.lastIndexOf('esBloqueoPorCheckoutAbierto')
    const bloque = usos.slice(i, i + 1200)
    expect(bloque).toContain('-immediate-tras-expirar')
  })

  it('el núcleo exige las DOS señales del mensaje, no solo «checkout»', () => {
    // Es lo que impide expirarle la sesión a alguien que está pagando bien.
    expect(nucleo).toContain('cannot cancel')
    expect(nucleo).toContain('checkout session')
    expect(nucleo).toMatch(/niegaCancelar\s*&&\s*señalaCheckout/)
  })

  it('solo se expiran las sesiones `open`', () => {
    expect(nucleo).toMatch(/EXPIRABLES\s*=\s*new Set\(\['open'\]\)/)
  })

  it('el script de rescate expira EXACTAMENTE lo mismo que el endpoint', () => {
    // `compras-atascadas.cjs` es CommonJS y no puede importar el núcleo (TypeScript), así que
    // lleva un espejo — mismo arreglo y mismo riesgo que `benignSignals`. Los dos escriben sobre
    // el MISMO recurso de Stripe: si divergen, el rescate a mano podría expirarle la sesión a
    // quien acaba de pagar mientras el endpoint no lo hace.
    expect(rescate).toContain("s.status === 'open'")
    expect(rescate).toMatch(/function sesionesAExpirar/)
    // Y que quede dicho que es un espejo, para que el siguiente no lo tome por código suelto.
    expect(rescate).toContain('cancelCheckoutAbierto')
  })

  it('el script NO escribe salvo que se lo pidan', () => {
    // Un rescate que se dispare solo al listar tocaría la compra de gente que no lo ha pedido.
    expect(rescate).toMatch(/if \(RESCATAR\) return rescatar\(\)/)
    expect(rescate).toMatch(/sessions\.expire/)
  })

  it('la alerta que ENGAÑABA sigue mandando contar usuarios distintos', () => {
    // `subscription_cancel_error_burst` nombra el endpoint y por eso se leyó como incidente de
    // Stripe. Si alguien limpia ese aviso, se pierde la única pista de que puede ser UNA persona.
    const i = reglas.indexOf('RULE_SUBSCRIPTION_CANCEL_ERROR_BURST')
    expect(i).toBeGreaterThan(-1)
    const bloque = reglas.slice(i, i + 3000)
    expect(bloque).toContain('T-601')
    expect(bloque).toContain('usuarios distintos')
  })
})
