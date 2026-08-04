// lib/flota/cuentas.cjs — de qué CUENTA de Claude Code tira cada trabajador de la flota. (T-486)
//
// ── POR QUÉ UN REGISTRO Y NO UNA VARIABLE ────────────────────────────────────────────────────
// Con una sola cuenta bastaba `CLAUDE_CODE_OAUTH_TOKEN` y ya. Con dos —y con la intención de que
// puedan ser más— eso se convierte en el problema de siempre: cada script decidiendo por su cuenta
// de dónde saca la credencial, y nadie capaz de responder «¿qué cuenta está gastando este
// trabajador?».
//
// Es EXACTAMENTE la forma del registro multi-cuenta de Stripe (`lib/stripe.ts` → `ACCOUNT_ENV`),
// y se copia a propósito: allí ya está probado que **añadir una cuenta es una fila más y su bloque
// de env, sin tocar la lógica de ningún consumidor**. Dos registros con formas distintas para el
// mismo problema serían el silo que este proyecto lleva evitando desde [T-130].
//
// ── LO QUE HACE ESCALABLE ESTO, Y NO ES EL NÚMERO DE CUENTAS ────────────────────────────────
// El reparto es **determinista por nombre**, no rotatorio. Un trabajador llamado `w1` cae siempre
// en la misma cuenta, reinicie las veces que reinicie. Con rotación (round-robin o azar) un
// reinicio movería a `w1` de cuenta, y entonces:
//   · el consumo por cuenta deja de ser comparable consigo mismo entre días;
//   · si una cuenta topa su límite, no se puede saber a quién le pasó ni reproducirlo;
//   · y dos trabajadores pueden acabar en la misma cuenta por casualidad mientras otra está ociosa.
// Determinista significa que el reparto se puede predecir, explicar y auditar sin guardar estado.

/**
 * El registro. **Añadir una cuenta = UNA fila aquí + su variable de entorno.**
 *
 * La cuenta por defecto lee la variable SIN sufijo —la histórica— para que todo lo que ya
 * funcionaba siga funcionando sin tocarlo, igual que la cuenta 'manuel' de Stripe.
 */
const CUENTA_ENV = {
  principal:  'CLAUDE_CODE_OAUTH_TOKEN',
  secundaria: 'CLAUDE_CODE_OAUTH_TOKEN_SECUNDARIA',
}

const NOMBRES = Object.keys(CUENTA_ENV)
const POR_DEFECTO = 'principal'

/** Un token de `claude setup-token`; lo bastante largo para no confundirse con un marcador. */
const TOKEN_MIN = 20

/** ¿Qué cuentas tienen credencial de verdad en este entorno? Sin token, la cuenta no existe. */
function cuentasDisponibles(env = process.env) {
  return NOMBRES.filter((n) => {
    const v = env[CUENTA_ENV[n]]
    return typeof v === 'string' && v.trim().length >= TOKEN_MIN
  })
}

/**
 * A qué cuenta le toca este trabajador.
 *
 * @param nombre       nombre del trabajador (p.ej. 'w1')
 * @param disponibles  cuentas con credencial, en orden estable
 * @returns el nombre de la cuenta, o null si no hay ninguna
 *
 * Determinista y **estable ante el orden de llegada**: no depende de cuántos trabajadores haya
 * arrancado antes ni de en qué orden. Se reparte por una suma de caracteres, que para nombres
 * cortos y parecidos (`w1`, `w2`, `w3`…) distribuye bien y es trivial de verificar a mano — que es
 * lo que se quiere de un reparto que alguien va a tener que explicar cuando una cuenta se sature.
 */
function cuentaDe(nombre, disponibles) {
  const ds = (disponibles || []).filter(Boolean)
  if (!ds.length) return null
  const s = String(nombre || '')
  let suma = 0
  for (let i = 0; i < s.length; i++) suma += s.charCodeAt(i)
  return ds[suma % ds.length]
}

/**
 * Resuelve la cuenta que debe usar un trabajador y devuelve con qué credencial.
 *
 * @param nombre    del trabajador
 * @param pedida    cuenta pedida explícitamente (manda sobre el reparto), o null
 * @returns {ok, cuenta, variable, token, problema}
 *
 * Lo explícito manda, igual que `--sid` manda sobre el fichero: si alguien dice en qué cuenta
 * quiere un trabajador, no se le lleva la contraria. Pero se comprueba que exista y tenga token,
 * porque un nombre mal escrito que caiga en silencio al reparto sería peor que un error.
 */
function resolver(nombre, pedida = null, env = process.env) {
  const disponibles = cuentasDisponibles(env)
  if (!disponibles.length) {
    return {
      ok: false, cuenta: null, variable: null, token: null,
      problema: `ninguna cuenta tiene credencial. Declara al menos ${CUENTA_ENV[POR_DEFECTO]} `
              + `(se acuña con "claude setup-token" en una máquina con navegador).`,
    }
  }
  if (pedida) {
    if (!NOMBRES.includes(pedida)) {
      return { ok: false, cuenta: null, variable: null, token: null,
        problema: `la cuenta "${pedida}" no existe. Declaradas: ${NOMBRES.join(', ')}.` }
    }
    if (!disponibles.includes(pedida)) {
      return { ok: false, cuenta: pedida, variable: CUENTA_ENV[pedida], token: null,
        problema: `la cuenta "${pedida}" no tiene token: falta ${CUENTA_ENV[pedida]}.` }
    }
  }
  const cuenta = pedida || cuentaDe(nombre, disponibles)
  return { ok: true, cuenta, variable: CUENTA_ENV[cuenta], token: env[CUENTA_ENV[cuenta]].trim(), problema: null }
}

/**
 * Cómo quedaría repartido un conjunto de trabajadores. Para poder VERLO antes de arrancar nada y
 * para que el parte pueda decir si una cuenta lleva el doble de carga que la otra.
 */
function reparto(nombres, disponibles) {
  const out = {}
  for (const n of nombres || []) {
    const c = cuentaDe(n, disponibles)
    if (!c) continue
    ;(out[c] = out[c] || []).push(n)
  }
  return out
}

module.exports = { CUENTA_ENV, NOMBRES, POR_DEFECTO, TOKEN_MIN, cuentasDisponibles, cuentaDe, resolver, reparto }
