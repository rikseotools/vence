// lib/sessions/friccion.cjs — el ÚNICO emisor de fricción entre sesiones. (T-542)
//
// ── POR QUÉ EXISTE ───────────────────────────────────────────────────────────────────────────
// El núcleo de T-423 (`lib/observability/friccionSesiones.cjs`) define QUÉ se mide, y
// `scripts/friccion-emitir.cjs` lo escribe en `observable_events`. Entre los dos faltaba la
// pieza que de verdad usan los guardarraíles: **lanzar ese script sin bloquear y sin poder
// romper nada**. Al no existir, cada guardarraíl se escribió la suya: cinco copias privadas de
// la misma función `friccion()` (backlog-push, contexto-backlog, indice-compartido, backlog.cjs,
// cierre-cola), todas con el mismo `spawn` detached.
//
// Y el coste de esa duplicación no fue el código repetido, sino lo que pasó el **04/08/2026**:
// la SEXTA puerta —la de temario (T-518)— nació **sin escribir su copia**. Imprimía
// «queda contado» y no contaba nada. Nadie lo vio, porque el propio mensaje afirmaba lo
// contrario: peor que el silencio, porque le dice a la siguiente sesión que no se preocupe.
// Lo destapó una sesión que saltó la puerta y fue a buscar su escape al bus.
//
// Es exactamente el fallo que T-423 se construyó para evitar. De su cabecera:
//   «la señal que más importa es el ESCAPE, no el bloqueo — un guardarraíl que se salta de
//    forma sistemática está muerto y nadie se ha enterado».
// Una puerta que no emite es invisible para ese indicador: puede estar muerta desde el día uno.
//
// ── LA REGLA ─────────────────────────────────────────────────────────────────────────────────
// Un guardarraíl NO escribe su propio emisor. Llama a `emitirFriccion(...)`. El trinquete de
// `__tests__/guardrails/friccionEmisorUnico.guardrail.test.ts` impide que aparezca la copia nº 6.
//
// ── INVARIANTES ──────────────────────────────────────────────────────────────────────────────
// · **No lanza NUNCA.** Esto corre dentro de hooks de git y del camino de deploy. Una avería del
//   bus de observabilidad no puede impedirle a nadie commitear, pushear ni cerrar una
//   impugnación. Es la misma regla que el latido (principio 9: fail-open en telemetría).
// · **No bloquea.** `detached` + `unref()`: el proceso padre termina sin esperar al INSERT.
// · **No imprime.** Quien decide qué se le cuenta al usuario es el guardarraíl, no el emisor.
// · **Valida la clase contra el catálogo cerrado** antes de gastar un proceso. Una clase
//   inventada no llega a la serie: `friccion-emitir.cjs` la descartaría en silencio y el
//   guardarraíl se quedaría creyendo que cuenta (que es, literalmente, el bug que esto arregla).

const path = require('path')
const { spawn } = require('child_process')

const REPO = path.resolve(__dirname, '..', '..')
const EMISOR = path.join(REPO, 'scripts', 'friccion-emitir.cjs')

/** Tope del detalle. `friccion-emitir.cjs` recorta igual; se hace aquí para no pasar un argv gigante. */
const MAX_DETALLE = 180

/**
 * Cuenta un roce en el bus de fricción (`npm run sesiones:friccion`).
 *
 * @param {object}  o
 * @param {string}  o.clase     una de `CLASES` de lib/observability/friccionSesiones.cjs
 * @param {string} [o.guard]    qué guardarraíl lo emite ('temario', 'cierre-cola', 'backlog-push'…)
 * @param {string} [o.detalle]  motivo declarado o clase del bloqueo
 * @param {number} [o.segundos] para las clases que miden espera (deploy_espera)
 * @param {object} [deps]       inyección para los tests (`spawn`, `esClase`)
 * @returns {boolean} si se ha llegado a lanzar el emisor. **Nunca lanza excepción.**
 */
function emitirFriccion(o, deps = {}) {
  try {
    const lanzar = deps.spawn || spawn
    const { esClase } = deps.esClase
      ? { esClase: deps.esClase }
      : require(path.join(REPO, 'lib', 'observability', 'friccionSesiones.cjs'))

    // Sin clase válida no se gasta un proceso: la serie solo sirve si el catálogo está cerrado.
    if (!o || !esClase(o.clase)) return false

    const args = [EMISOR, '--clase', o.clase]
    if (o.guard) args.push('--guard', String(o.guard))
    if (o.detalle) args.push('--detalle', String(o.detalle).slice(0, MAX_DETALLE))
    if (o.segundos != null) args.push('--segundos', String(o.segundos))
    // Tri-estado a propósito: `undefined` = este guardarraíl no sabe contestarlo (y entonces el
    // panel infiere restando, diciendo que infiere). Ver T-702.
    if (o.evitoBloqueo === true) args.push('--evito-bloqueo')
    else if (o.evitoBloqueo === false) args.push('--sin-nada-que-rodear')

    lanzar(process.execPath, args, { detached: true, stdio: 'ignore' }).unref()
    return true
  } catch {
    // La telemetría no decide si alguien puede cerrar, commitear o desplegar.
    return false
  }
}

module.exports = { emitirFriccion, MAX_DETALLE, EMISOR }
