// lib/security/parejaFarmeo.js — el farmeo MÍNIMO VIABLE: dos cuentas clavadas en su tope. (T-372)
//
// ── EL PUNTO CIEGO, QUE ES PURA ARITMÉTICA ───────────────────────────────────────────────────
// Los dos detectores de equipo se pasan de largo justo el patrón más barato de ejecutar:
//
//   · `multi_account_device`  exige **≥3 cuentas** por equipo  → una pareja tiene 2.
//   · `device_daily_farming`  exige **>60 preguntas/día**      → 2 cuentas × el tope free de 25 = 50.
//
// O sea: **el patrón que produce el propio límite free cae por debajo de los dos cortes a la
// vez**. No hace falta que nadie sea listo para colarse; basta con abrir una segunda cuenta.
// Medido el 31/07 triando a mano los equipos que más consumían: de 5 revisados, **4 no habían
// generado JAMÁS una señal**.
//
// ── POR QUÉ NO SE ARREGLA BAJANDO EL UMBRAL ──────────────────────────────────────────────────
// Poner `FRAUD_DEVICE_ACCOUNTS=2` inundaría el inbox de familias y ordenadores compartidos —dos
// hermanos preparando la misma oposición en el mismo PC son exactamente eso— y un inbox inundado
// se deja de mirar, que es como muere un detector. La señal no es CUÁNTAS cuentas hay: es la
// FORMA del consumo.
//
// ── LA FORMA: «clavadas», no «reparten» ──────────────────────────────────────────────────────
// Una familia reparte de forma desigual y variable (hoy 40 y 5, mañana 12 y 0). Dos cuentas
// farmeando **agotan las dos su cupo, el mismo día, una y otra vez**. Medido sobre los equipos
// de exactamente 2 cuentas de 30 días, el reparto sale **bimodal**:
//
//     18 de 24 días clavados   ← rutina
//     18 de 20                 ← rutina
//     11 de 13 · 9 de 12 · 9 de 10
//     3 de 5 · 3 de 8 · 3 de 8
//     1 de 16 · 1 de 7 · 1 de 4 …  ← ruido: un día intenso de dos personas normales
//
// Por eso el criterio tiene DOS partes y ninguna basta sola: **repetición** (nº de días) y
// **proporción** (qué parte de sus días activos). `1 de 16` y `9 de 10` tienen ambos «días
// clavados», y no se parecen en nada.
//
// ── VALIDACIÓN CONTRA VERDAD CONOCIDA ────────────────────────────────────────────────────────
// Los **tres** equipos que se confirmaron a mano el 31/07 (`fraud_alerts.details.detectado_por=
// 'revision_manual_31_07'`) caen los tres en la banda alta: 75 %, 90 % y 60 %. La calibración
// reproduce el veredicto humano sin haberlo mirado.

/** El tope diario del free. Se ve como un muro en los datos: 3.624 usuario-días en 25 y 172 en 24. */
const TOPE_FREE = 25

/** «Clavada» = llegó al tope o se quedó a un pelo. El 24 entra: agotar no siempre cae exacto. */
const MARGEN_CLAVADA = 1

/** Días clavados por debajo de esto es un día malo, no una rutina. */
const MIN_DIAS = 3

/** …y por debajo de esta proporción de sus días activos, tampoco: mira `1 de 16`. */
const MIN_PROPORCION = 0.5

/** ¿Esta cuenta agotó su cupo ese día? */
function estaClavada(preguntas, tope = TOPE_FREE, margen = MARGEN_CLAVADA) {
  return Number(preguntas) >= tope - margen
}

/**
 * ¿Cómo fue ESTE día para el equipo?
 *
 * @param cuentas  [{ userId, preguntas }] del mismo device y día
 * @returns { clavadas, activas, todasClavadas }
 *
 * `todasClavadas` exige **≥2 cuentas y todas al tope**: una sola cuenta a 25 es un usuario
 * normal apurando el free, no un equipo.
 */
function clasificarDia(cuentas, opts = {}) {
  const { tope = TOPE_FREE, margen = MARGEN_CLAVADA } = opts
  const activas = (cuentas || []).filter((c) => Number(c && c.preguntas) > 0)
  const clavadas = activas.filter((c) => estaClavada(c.preguntas, tope, margen))
  return {
    clavadas: clavadas.length,
    activas: activas.length,
    todasClavadas: activas.length >= 2 && clavadas.length === activas.length,
  }
}

/**
 * Veredicto del equipo a partir de sus días.
 *
 * @param dias  [{ fecha, cuentas: [{userId, preguntas}] }]
 * @returns { veredicto, diasClavados, diasActivos, proporcion, motivo }
 *
 * Veredictos:
 *  · `farmeo`   — repetido Y proporción alta. Es el que abre señal.
 *  · `revisar`  — repetido pero disperso: pasa el mínimo de días y no la proporción. No abre
 *                 señal por sí solo; sale en el informe para que un humano decida.
 *  · `normal`   — todo lo demás, incluido el equipo con un solo día clavado de dieciséis.
 *
 * **La proporción se mide sobre días ACTIVOS, no sobre la ventana entera.** Contra los 30 días,
 * quien solo usa la app tres días al mes saldría siempre bajo y el criterio no distinguiría nada.
 */
function clasificarEquipo(dias, opts = {}) {
  const { minDias = MIN_DIAS, minProporcion = MIN_PROPORCION } = opts
  const evaluados = (dias || []).map((d) => clasificarDia(d && d.cuentas, opts))
  const diasActivos = evaluados.filter((e) => e.activas > 0).length
  const diasClavados = evaluados.filter((e) => e.todasClavadas).length
  const proporcion = diasActivos ? diasClavados / diasActivos : 0

  const base = { diasClavados, diasActivos, proporcion: Number(proporcion.toFixed(2)) }
  if (diasClavados < minDias) {
    return { ...base, veredicto: 'normal', motivo: `solo ${diasClavados} día(s) con todas las cuentas al tope` }
  }
  if (proporcion < minProporcion) {
    return {
      ...base,
      veredicto: 'revisar',
      motivo: `${diasClavados} días al tope pero solo el ${Math.round(proporcion * 100)}% de sus ${diasActivos} días activos`,
    }
  }
  return {
    ...base,
    veredicto: 'farmeo',
    motivo: `${diasClavados} de ${diasActivos} días activos con TODAS las cuentas al tope (${Math.round(proporcion * 100)}%)`,
  }
}

/** Gravedad para `fraud_alerts`, con el mismo criterio que el resto del sweep: por magnitud. */
function gravedad(v) {
  if (!v || v.veredicto !== 'farmeo') return 'medium'
  return v.diasClavados >= 8 ? 'high' : 'medium'
}

module.exports = {
  estaClavada, clasificarDia, clasificarEquipo, gravedad,
  TOPE_FREE, MARGEN_CLAVADA, MIN_DIAS, MIN_PROPORCION,
}
