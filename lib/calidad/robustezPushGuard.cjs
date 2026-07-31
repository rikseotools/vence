// lib/calidad/robustezPushGuard.cjs — lógica PURA del guardarraíl de robustez en el push.
//
// ## Por qué existe (31/07/2026, encargo de Manuel)
//
// «Antes de pushear hay que añadir capas: tests, simulaciones, canary y observabilidad sin
// huecos… y siempre se te olvida». Es cierto, y una nota no lo arregla: se olvida igual. Lo
// que funciona en este repo es lo que ya hace el claim del backlog — **un gate en el punto
// donde el olvido hace daño**, que es el push (cuando el trabajo se comparte).
//
// Evidencia de que el olvido cuesta dinero, del mismo día:
//   · El primer clic del precio heredado devolvía 500 y NINGÚN test lo cazó: lo encontró una
//     prueba manual contra datos reales.
//   · 17 intentos de compra bloqueados estuvieron INVISIBLES porque la alerta de cobro solo
//     contaba 5xx y aquello era un 403.
//
// ## Qué comprueba, y qué NO
//
// No juzga si los tests son buenos —eso no lo puede saber un hook— sino si **hay o no hay**.
// Dos preguntas, las dos contestables con el diff:
//
//   1. ¿Este push toca código de producción sin tocar NINGUNA capa? (test, spec, sim, canary,
//      guardarraíl). Un cambio de producción que no viene acompañado de nada es la firma del
//      olvido.
//   2. ¿Introduce un `eventType` NUEVO que nadie vigila? Emitir una señal que ninguna regla
//      mira es observabilidad con hueco — el fallo exacto del 403 de la caja. Aquí se caza al
//      escribirla, no un mes después.
//
// Fail-open y con escape (`ROBUSTEZ_GUARD_SKIP=1`): un guardarraíl que no se puede saltar
// cuando toca —un hotfix a las 3 de la mañana— se acaba desactivando entero, y entonces no
// protege nada. El escape queda registrado en la salida.
//
// JS plano (no .ts) a propósito: el hook corre `node` pelado y el test hace `require` de ESTE
// fichero. Una sola fuente, sin copia que se desincronice.

/** Rutas cuyo cambio es «código de producción»: lo que puede romperle algo a alguien. */
const RUTAS_PRODUCCION = [
  /^app\/api\//,
  /^app\/(?!api\/).*\.(tsx|ts|js|jsx)$/,
  /^lib\//,
  /^backend\/src\//,
  /^components\//,
  /^contexts\//,
  /^db\//,
]

/** Rutas que YA SON una capa de robustez. Tocar una cuenta como acompañar el cambio. */
const RUTAS_CAPA = [
  /^__tests__\//,
  /\.test\.(ts|tsx|js|cjs|mjs)$/,
  /\.spec\.(ts|tsx|js|cjs|mjs)$/,
  /^scripts\/sim\//,
  /^backend\/scripts\/sim-/,
  /canary/i,
  /guardrail/i,
  /guardarrail/i,
]

/** Un fichero de test/sim NO es código de producción aunque viva bajo `lib/` o `backend/src/`. */
function esCapa(ruta) {
  return RUTAS_CAPA.some((re) => re.test(ruta))
}

function esProduccion(ruta) {
  if (esCapa(ruta)) return false
  return RUTAS_PRODUCCION.some((re) => re.test(ruta))
}

/**
 * Clasifica los ficheros del push.
 * @param rutas lista de rutas relativas a la raíz del repo.
 */
function clasificar(rutas) {
  const produccion = []
  const capas = []
  for (const r of rutas || []) {
    if (esCapa(r)) capas.push(r)
    else if (esProduccion(r)) produccion.push(r)
  }
  return { produccion, capas }
}

/**
 * `eventType`s que el diff INTRODUCE (líneas añadidas). Se buscan las dos formas reales del
 * repo: `eventType: 'x'` (emisor TS/JS) y `event_type = 'x'` / `event_type IN (...)` (reglas SQL).
 *
 * Solo líneas añadidas (`+`): mover una línea de sitio no es estrenar una señal.
 */
function eventTypesIntroducidos(diff) {
  const tipos = new Set()
  for (const linea of String(diff || '').split('\n')) {
    if (!linea.startsWith('+') || linea.startsWith('+++')) continue
    for (const m of linea.matchAll(/eventType:\s*'([a-z0-9_]+)'/g)) tipos.add(m[1])
  }
  return [...tipos]
}

/**
 * ¿Está vigilada esta señal? Lo está si aparece en el catálogo de reglas del backend, en el de
 * benignas/con-regla-propia, o si el propio push la añade a alguno de los dos.
 */
function senalesSinVigilancia(tiposIntroducidos, textoVigilancia) {
  const texto = String(textoVigilancia || '')
  return (tiposIntroducidos || []).filter((t) => !texto.includes(`'${t}'`))
}

/**
 * Decisión pura. La toma con el diff ya leído: ni git ni ficheros aquí.
 *
 * @param rutas             ficheros tocados por el push
 * @param diff              diff completo de lo que se empuja (solo se leen las líneas '+')
 * @param textoVigilancia   concatenación de alert-rules + benignSignals (frontend y backend)
 * @returns { allowed, motivos: [{ tipo, detalle }] }
 */
function evaluarPush(rutas, diff, textoVigilancia) {
  const { produccion, capas } = clasificar(rutas)
  const motivos = []

  // (1) Código de producción sin ninguna capa que lo acompañe.
  if (produccion.length > 0 && capas.length === 0) {
    motivos.push({
      tipo: 'sin_capas',
      detalle:
        `${produccion.length} fichero(s) de producción sin una sola capa que los acompañe. ` +
        `Ejemplos: ${produccion.slice(0, 3).join(', ')}`,
    })
  }

  // (2) Señal nueva que nadie mira.
  const huerfanas = senalesSinVigilancia(eventTypesIntroducidos(diff), textoVigilancia)
  if (huerfanas.length > 0) {
    motivos.push({
      tipo: 'senal_sin_vigilancia',
      detalle:
        `señal(es) nueva(s) que ninguna regla vigila: ${huerfanas.join(', ')}. ` +
        `Emitir sin vigilar es el hueco que dejó 17 pagos bloqueados invisibles.`,
    })
  }

  return { allowed: motivos.length === 0, motivos }
}

module.exports = {
  RUTAS_PRODUCCION,
  RUTAS_CAPA,
  esCapa,
  esProduccion,
  clasificar,
  eventTypesIntroducidos,
  senalesSinVigilancia,
  evaluarPush,
}
