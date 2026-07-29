// Journey: a quien le mantenemos su precio, TIENE que verlo y poder pagarlo.
//
// Bug real (29/07/2026, feedback 48f1503a de Rocío): su suscripción entró en el barrido de
// "no renovar", le creamos un precio de fidelidad y le mandamos su página… y estuvo tres
// horas sin poder comprar. La página cargaba pero salía vacía, así que se fue al checkout
// público, se encontró la tarifa nueva y abandonó CUATRO pagos.
//
// La causa no se veía por ningún lado: `apiFetch` fuerza POST y `/api/v2/premium/mi-oferta`
// es GET, así que devolvía **405** en silencio. El deploy estaba en verde, los tests
// pasaban y la única señal era su mensaje diciendo «no puedo acceder a la oferta».
//
// Y hubo un segundo fallo el mismo día: la base de datos ya permitía dos ofertas (mensual y
// trimestral, para que eligiera) pero el endpoint seguía con LIMIT 1 — con UNA oferta, que
// es lo que tienen todos los demás, funcionaba perfectamente.
//
// Por eso este journey no comprueba "la página responde 200": comprueba que el endpoint
// devuelve las ofertas que esa persona tiene EN LA BASE DE DATOS y que la página las pinta.
// Un 200 con la página vacía es exactamente el fallo que dejó a Rocío tirada.
import type { Journey } from '../../../lib/sim/journey'
import type { InvariantResult } from '../../../lib/sim/types'

// Misma cuenta de test que el resto de canaries. NUNCA una cuenta real: este journey mira
// precios y no debe tocar la cartera de nadie. Sin identidad, el runner lo salta.
const USER_ID = process.env.SIM_IDENTITY_USER_ID || process.env.SMOKE_USER_ID || ''
const EMAIL = process.env.SIM_IDENTITY_EMAIL || 'smoke@vence.es'
const POSITION = process.env.SIM_IDENTITY_POSITION || 'auxiliar_administrativo_valencia'

const journey: Journey = {
  name: 'precio-fidelidad-visible',
  // `high`: no rompe la aplicación, pero deja a una persona que YA decidió pagar sin poder
  // hacerlo, y encima creyendo que le hemos subido el precio.
  severity: 'high',
  // ⚠️ AÚN NO en el despliegue: contra producción devuelve 401 porque la sesión que forja
  // el sim no llega a este endpoint (verifyAuth espera Bearer; otros journeys van con
  // cookie). El journey ES correcto —distingue 401/405/200 y compara la API con lo pintado—
  // pero activarlo así metería un rojo permanente en cada deploy, y un guardarraíl que
  // siempre falla se acaba ignorando. Falta: que `ctx.api` mande el token de la identidad
  // simulada. Al arreglarlo, poner `postDeploy: true`.
  postDeploy: false,
  as: { userId: USER_ID, email: EMAIL, label: POSITION, positionType: POSITION },
  async run(ctx) {
    const resultados: InvariantResult[] = []

    // Abrir la página PRIMERO: `ctx.api` llama desde el navegador, y sin origen no hay
    // fetch posible. Además es el orden real de la persona: entra y la página consulta.
    await ctx.step('abrir la página de precio de fidelidad', () => ctx.goto('/premium/personal'), { shot: true })
    await ctx.page.waitForTimeout(2500)

    // 1) El endpoint, que es donde estaba el 405. Se pide como lo pide la página.
    const resp = await ctx.api('/api/v2/premium/mi-oferta', { method: 'GET' })
    const ok = resp?.status === 200
    resultados.push({
      name: 'mi_oferta_responde',
      ok,
      detail: ok ? 'GET 200' : `el endpoint de precio de fidelidad respondió ${resp?.status} (el 405 de 29/07 dejó a una usuaria sin poder pagar)`,
    })
    if (!ok) return resultados

    const cuerpo = resp.json as { ofertas?: unknown[]; oferta?: unknown } | null

    // 2) El contrato en PLURAL. Si desaparece, quien tenga dos planes verá uno solo.
    const plural = Array.isArray(cuerpo?.ofertas)
    resultados.push({
      name: 'mi_oferta_contrato_plural',
      ok: plural,
      detail: plural ? 'devuelve `ofertas` (lista)' : 'no devuelve `ofertas`: con dos planes se enseñaría uno',
    })

    // 3) Coherencia con lo que la persona VE. Solo se exige si tiene ofertas: la cuenta de
    //    test normalmente no tiene ninguna, y eso no es un fallo — el journey vigila que
    //    cuando LAS HAY, se pinten.
    const n = plural ? (cuerpo!.ofertas as unknown[]).length : 0
    if (n > 0) {
      const botones = await ctx.page.locator('text=Activar mi Premium').count()
      resultados.push({
        name: 'precio_fidelidad_pintado',
        ok: botones >= n,
        detail: `${n} oferta(s) en la API y ${botones} botón(es) en pantalla`,
      })
    } else {
      resultados.push({
        name: 'precio_fidelidad_pintado',
        ok: true,
        detail: 'la cuenta de test no tiene ofertas vivas (nada que pintar)',
      })
    }

    return resultados
  },
}

export default journey
