// lib/metrics/churn.js
//
// Churn mensual de suscripciones — NÚCLEO PURO (sin red, sin BD, sin env).
//
// ## Por qué existe (T-266, 29/07/2026)
//
// La fórmula anterior era `canceladas_de_toda_la_vida / activas_de_hoy`, y eso
// mezcla un FLUJO acumulado desde el primer día del negocio con un STOCK medido
// hoy. Mientras la cartera crece el número sale bajo por dilución; cuando una
// cuenta se apaga, sale alto por un motivo que no es comercial. En ninguno de
// los dos casos responde a la pregunta que se le hace: *de los clientes que
// pagan, ¿qué proporción se va cada mes?*
//
// Medido el 29/07/2026 sobre datos reales: 214 canceladas / 6,6 meses / 252
// activas = 12,83%. Con ventana de 30 días, en cambio, 61 canceladas → 24%
// mensual. Dos números incompatibles para la misma realidad, y el panel
// enseñaba el primero.
//
// ## Las dos correcciones, y por qué son distintas
//
// 1. **VENTANA MÓVIL** (flujo contra flujo): se cuentan las cancelaciones de los
//    últimos N días y se normalizan a mes. Deja de importar lo que pasó hace
//    seis meses, que es justo lo que el churn *mensual* no debe arrastrar.
//
// 2. **CUENTA EN VACIADO FUERA DE LA BASE**: una cuenta que ya no capta ni
//    renueva no produce churn, produce VENCIMIENTOS. Sus bajas están decididas
//    de antemano y no dicen nada sobre si el producto retiene. Contarlas es
//    medir una decisión nuestra como si fuera comportamiento del cliente.
//    Se reportan aparte (`vencimientosProgramados`), que es lo que son.
//
//    ⚠️ Esto NO se puede deducir de Stripe. Se comprobó el 29/07: los 214
//    `canceled` traen `cancellation_details.reason` = 201 `cancellation_requested`
//    + 13 `payment_failed`, y el vaciado se ejecutó PIDIENDO la cancelación, así
//    que cae en el mismo cubo que un cliente que se marcha. La única fuente
//    fiable de "esta cuenta está viva" es nuestra propia configuración: la cuenta
//    que recibe las altas nuevas.
//
// 3. **MIGRACIONES**: quien canceló en una cuenta y tiene suscripción activa en
//    otra no se ha ido — se ha movido. Se excluye. Es correcto aunque sea de bajo
//    impacto (13 de 214 el 29/07): mide poco hoy y mediría mucho si algún día se
//    migrase la cartera en bloque.

/** Días de la ventana móvil por defecto. Un trimestre: absorbe la estacionalidad
 *  de los exámenes sin arrastrar eras del negocio que ya no existen. */
const VENTANA_DIAS = 90

/** Suelo y techo del churn aplicado a las proyecciones. El suelo evita proyectar
 *  una cartera que no pierde a nadie; el techo evita que un mes raro se propague
 *  doce meses hacia delante. Se informa cuando cualquiera de los dos MUERDE, para
 *  que nadie lea un número recortado creyendo que es el medido. */
const SUELO = 0.03
const TECHO = 0.15

/** Mínimo de suscripciones activas para que la tasa signifique algo. Por debajo,
 *  una sola baja mueve el número decenas de puntos. */
const MUESTRA_MINIMA = 20

const idUsuario = (sub) => sub?.metadata?.supabase_user_id || sub?.metadata?.user_id || null

/**
 * Calcula el churn mensual sobre las cuentas VIVAS, con ventana móvil.
 *
 * @param {object} opts
 * @param {Array} opts.subs            todas las suscripciones, con `stripe_account`, `status`,
 *                                     `canceled_at` (epoch s), `cancel_at_period_end` y `metadata`.
 * @param {string[]} opts.cuentasVivas cuentas que siguen captando/renovando. El resto se
 *                                     considera en vaciado y NO entra en la base del churn.
 * @param {number} opts.ahoraMs        instante de referencia (inyectado: un cálculo puro no
 *                                     puede leer el reloj, o su test no sería reproducible).
 * @param {number} [opts.ventanaDias]
 * @returns {{
 *   tasaMensual:number, tasaMedida:number, aplicada:'medida'|'suelo'|'techo'|'muestra_insuficiente',
 *   canceladasVentana:number, migracionesExcluidas:number, activasBase:number,
 *   ventanaDias:number, cuentasVivas:string[],
 *   vencimientosProgramados:number, cuentasEnVaciado:string[], canceladasEnVaciado:number
 * }}
 */
function calcularChurn({ subs, cuentasVivas, ahoraMs, ventanaDias = VENTANA_DIAS }) {
  const lista = Array.isArray(subs) ? subs : []
  const vivas = new Set(cuentasVivas || [])
  const desde = (ahoraMs - ventanaDias * 24 * 3600 * 1000) / 1000

  const enVivas = lista.filter((s) => vivas.has(s.stripe_account))
  const enVaciado = lista.filter((s) => !vivas.has(s.stripe_account))

  const activasBase = enVivas.filter((s) => s.status === 'active').length

  // Un usuario con suscripción activa en CUALQUIER cuenta no se ha ido del negocio.
  const usuariosActivos = new Set(
    lista.filter((s) => s.status === 'active').map(idUsuario).filter(Boolean),
  )

  const canceladasVentana = enVivas.filter(
    (s) => s.status === 'canceled' && (s.canceled_at ?? 0) >= desde,
  )
  const migraciones = canceladasVentana.filter((s) => {
    const u = idUsuario(s)
    return u && usuariosActivos.has(u)
  })
  const bajasReales = canceladasVentana.length - migraciones.length

  const cuentasEnVaciado = [...new Set(enVaciado.map((s) => s.stripe_account))].sort()

  const salida = {
    canceladasVentana: canceladasVentana.length,
    migracionesExcluidas: migraciones.length,
    activasBase,
    ventanaDias,
    cuentasVivas: [...vivas].sort(),
    // Lo que la cuenta apagada aporta NO es churn: son vencimientos ya decididos.
    vencimientosProgramados: enVaciado.filter(
      (s) => s.status === 'active' && s.cancel_at_period_end,
    ).length,
    cuentasEnVaciado,
    canceladasEnVaciado: enVaciado.filter((s) => s.status === 'canceled').length,
  }

  if (activasBase < MUESTRA_MINIMA) {
    return { ...salida, tasaMedida: 0, tasaMensual: SUELO, aplicada: 'muestra_insuficiente' }
  }

  const meses = ventanaDias / 30
  const tasaMedida = bajasReales / meses / activasBase

  let tasaMensual = tasaMedida
  let aplicada = 'medida'
  if (tasaMedida < SUELO) { tasaMensual = SUELO; aplicada = 'suelo' }
  else if (tasaMedida > TECHO) { tasaMensual = TECHO; aplicada = 'techo' }

  return { ...salida, tasaMedida, tasaMensual, aplicada }
}

module.exports = { calcularChurn, VENTANA_DIAS, SUELO, TECHO, MUESTRA_MINIMA }
