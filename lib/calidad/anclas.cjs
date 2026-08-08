// lib/calidad/anclas.cjs — un detector no publica una cifra sin declarar sus ANCLAS. [T-718]
//
// ## El fallo que arregla, medido el 08/08/2026
//
// Tres veces en una sola sesión, un número plausible estuvo a punto de decidir algo:
//
//   1. Se dio por **suelo sano** un 36 % de rechazos en `/api/v2/user-stats` porque era su cifra
//      habitual. Era la propia avería: 0 de 935 eran anónimos y había 156 personas distintas en
//      8 días. Con ese suelo, [T-692] se habría cerrado diciendo que funcionaba.
//   2. Un detector de «artículos que son un resumen y no la norma» dijo **2 de 21**. Eran **21
//      de 21**: solo miraba la primera palabra.
//   3. El segundo intento señaló la **Constitución** (4.606 preguntas activas) como texto no
//      literal, porque su contenido no repite la cabecera «Artículo N.» — que es formato, no
//      paráfrasis.
//
// Ninguno lo cazó un test. Los cazó que chirriaban al leerlos. Y no es nuevo: el manual de
// impugnaciones ya documenta un `lower()` que fabricó 8 preguntas rotas inexistentes y una regex
// mal escapada que convirtió 33 en 48.
//
// ## Qué impone
//
// Un detector declara, junto a su criterio, casos REALES verificados a mano:
//   · **positivos**: los que TIENE que cazar (con el porqué),
//   · **negativos**: los que NO puede cazar nunca.
// Su test evalúa el detector contra las dos listas. Si el criterio se afloja, salta un negativo;
// si se endurece de más, cae un positivo.
//
// ## Por qué los NEGATIVOS son obligatorios
//
// Es la mitad que salva. Un detector que solo declara positivos se satisface marcándolo TODO —
// que es exactamente la forma del error nº 3: aquel criterio cazaba sus positivos (el decreto
// resumido) y de paso la Constitución. Con una sola ancla negativa habría salido rojo antes de
// que la cifra llegara a ninguna parte.
//
// Puro a propósito: recibe qué marcó el detector y las anclas. Sin BD, sin red y sin ficheros,
// para poder probar el propio mecanismo sin montar nada.

/** Normaliza a Set de strings, aceptando Set, array o iterable. */
function aConjunto(marcados) {
  if (marcados instanceof Set) return new Set([...marcados].map(String))
  return new Set(Array.from(marcados || []).map(String))
}

/**
 * @param {Iterable<string>} marcados  ids que el detector ha señalado
 * @param {{positivos: Array<{id:string, porque:string}>, negativos: Array<{id:string, porque:string}>}} anclas
 * @returns {{ok:boolean, positivosPerdidos:Array, negativosCazados:Array, motivoInvalido:string|null}}
 */
function evaluarAnclas(marcados, anclas) {
  const invalido = validarAnclas(anclas)
  if (invalido) {
    return { ok: false, positivosPerdidos: [], negativosCazados: [], motivoInvalido: invalido }
  }
  const set = aConjunto(marcados)
  const positivosPerdidos = anclas.positivos.filter((a) => !set.has(String(a.id)))
  const negativosCazados = anclas.negativos.filter((a) => set.has(String(a.id)))
  return {
    ok: positivosPerdidos.length === 0 && negativosCazados.length === 0,
    positivosPerdidos,
    negativosCazados,
    motivoInvalido: null,
  }
}

/**
 * ¿Están bien declaradas las anclas? Devuelve el motivo si NO, o null si sí.
 *
 * Esto no es papeleo: cada regla de aquí corresponde a una forma real de engañarse.
 */
function validarAnclas(anclas) {
  if (!anclas || typeof anclas !== 'object') return 'no se han declarado anclas'
  const { positivos, negativos } = anclas
  if (!Array.isArray(positivos) || !positivos.length) {
    return 'sin anclas POSITIVAS: no se puede afirmar que el detector siga cazando lo suyo'
  }
  // La regla que salva: sin negativos, «márcalo todo» pasa el examen.
  if (!Array.isArray(negativos) || !negativos.length) {
    return 'sin anclas NEGATIVAS: un detector que solo declara positivos se satisface marcándolo TODO ' +
      '(es la forma exacta del falso positivo que señaló la Constitución entera)'
  }
  const conPorque = (a) => a && typeof a.id === 'string' && a.id.trim()
    && typeof a.porque === 'string' && a.porque.trim().length >= 15
  const flojos = [...positivos, ...negativos].filter((a) => !conPorque(a))
  if (flojos.length) {
    // Un ancla sin porqué es un id pegado: el siguiente no sabrá si sigue siendo válida ni por
    // qué se eligió, y acabará borrándola cuando estorbe.
    return `${flojos.length} ancla(s) sin id o sin un porqué de al menos 15 caracteres`
  }
  const ids = new Set()
  for (const a of [...positivos, ...negativos]) {
    if (ids.has(a.id)) return `el ancla ${a.id} está declarada dos veces (¿positiva y negativa a la vez?)`
    ids.add(a.id)
  }
  return null
}

/** Mensaje accionable. Un guardarraíl que solo dice «mal» se aprende a ignorar. */
function explicarAnclas(nombre, r) {
  if (r.motivoInvalido) return `[${nombre}] anclas mal declaradas — ${r.motivoInvalido}`
  if (r.ok) return ''
  const partes = [`[${nombre}] el detector ya no coincide con sus casos verificados a mano:`]
  for (const a of r.positivosPerdidos) {
    partes.push(`  ❌ DEJÓ DE CAZAR ${a.id} — tenía que marcarlo: ${a.porque}`)
  }
  for (const a of r.negativosCazados) {
    partes.push(`  ❌ CAZA DE MÁS ${a.id} — no puede marcarlo nunca: ${a.porque}`)
  }
  partes.push('')
  partes.push('  O el criterio ha cambiado y hay que re-calibrarlo, o el ancla ya no vale y hay')
  partes.push('  que decir POR QUÉ al quitarla. Lo que no vale es publicar la cifra igual.')
  return partes.join('\n')
}

module.exports = { evaluarAnclas, validarAnclas, explicarAnclas }
