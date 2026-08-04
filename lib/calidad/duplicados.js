// lib/calidad/duplicados.js
//
// Criterio ÚNICO de «esta pregunta ya está en el banco». [T-408 · T-410]
//
// Existe porque el 31/07/2026 tres sesiones distintas atacaron el mismo hueco sin verse:
// el barrido de legislativas (T-321, `scripts/calidad/duplicados-exactos.cjs`), la ficha
// T-408 (que lo dio por inexistente: `tools:buscar -- duplicadas` no casa con «duplicados»)
// y el hallazgo de psicotécnicas de T-410. Tres puertas al mismo recurso con criterios
// distintos no protegen: se contradicen. Aquí vive el criterio, y los dos bancos lo importan.
//
// ## Lo que este módulo NO hace
//
// No mide parecido. Un umbral de solape de palabras ya se probó en T-321 y dio 3.230 pares
// cuyos peores casos eran supuestos prácticos —preguntas distintas que comparten enunciado
// POR DISEÑO—. El corte es exacto sobre texto normalizado; lo borroso va aparte y a mano.

/**
 * Normaliza texto para comparar: sin HTML, sin acentos, sin puntuación, en minúsculas.
 *
 * La **ñ se conserva**: quitarle la tilde la convertiría en «n» y «año» pasaría a ser «ano».
 * Por eso se aparta antes de descomponer los acentos y se repone después — si se dejara a
 * NFD, este camino y el de SQL (que no toca la ñ) dejarían de dar lo mismo.
 */
function normalizar(texto) {
  const MARCA = '\u0001'
  return String(texto ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ñÑ]/g, MARCA)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(MARCA)
    .join('ñ')
    .replace(/[^a-z0-9ñ]+/g, '')
}

/**
 * El MISMO normalizar(), en SQL, para poder agrupar 138.000 preguntas sin traérselas.
 * Los dos caminos tienen que dar lo mismo: lo fija `__tests__/calidad/duplicados.test.ts`
 * (unidad) y la paridad contra la BD se comprueba con `--paridad` en el script.
 */
function sqlNormalizar(col) {
  return `regexp_replace(lower(translate(regexp_replace(coalesce(${col},''), '<[^>]*>', ' ', 'g'),
            'áéíóúàèìòùäëïöüâêîôûÁÉÍÓÚÀÈÌÒÙÄËÏÖÜÂÊÎÔÛçÇ',
            'aeiouaeiouaeiouaeiouAEIOUAEIOUAEIOUAEIOUcC')), '[^a-z0-9ñ]+', '', 'g')`
}

/**
 * Clave de un juego de opciones: normalizadas, ORDENADAS y sin las vacías.
 *
 * - Ordenadas porque las copias vienen barajadas entre sí (medido: los tres pares exactos
 *   de psicotécnicas del 31/07 tenían `correct_option` distinto y la misma respuesta).
 * - Sin las vacías porque hay oposiciones de 3 opciones POR DISEÑO (Policía Nacional:
 *   989 de 991 oficiales con la D nula). Contar la D vacía las emparejaría entre sí.
 */
function claveOpciones(opciones) {
  return (opciones || [])
    .map(normalizar)
    .filter((o) => o.length > 0)
    .sort()
    .join('|')
}

/**
 * Huella del contenido que NO está en el texto (psicotécnicas): imagen y `content_data`.
 *
 * Sin esto el barrido miente: 95 de 98 grupos de psicotécnicas que comparten enunciado y
 * opciones son preguntas DISTINTAS que solo comparten un enunciado genérico («Observa la
 * secuencia…») y se diferencian en la figura o en la rejilla. Medido el 31/07.
 */
function huellaContenido({ imageUrl, contentData } = {}) {
  const cd = contentData == null ? '' : canonicalizar(contentData)
  return `${imageUrl || ''}#${cd}`
}

/** JSON con las claves ordenadas: dos objetos iguales dan la misma cadena. */
function canonicalizar(valor) {
  if (valor === null || typeof valor !== 'object') return JSON.stringify(valor ?? null)
  if (Array.isArray(valor)) return `[${valor.map(canonicalizar).join(',')}]`
  const claves = Object.keys(valor).sort()
  return `{${claves.map((k) => JSON.stringify(k) + ':' + canonicalizar(valor[k])).join(',')}}`
}

/**
 * Quién se queda, en este orden: oficial → explicación estructurada → más servida → más antigua.
 * Devuelve [superviviente, aJubilar[]]. El orden viene de T-321 y no se toca sin motivo:
 * la oficial es la que tiene respaldo de examen y la más servida es la que tiene historial.
 */
function decidirSuperviviente(miembros) {
  const orden = [...miembros].sort((a, b) => {
    if (!!a.oficial !== !!b.oficial) return a.oficial ? -1 : 1
    if ((a.expl > 0) !== (b.expl > 0)) return a.expl > 0 ? -1 : 1
    if ((a.servida || 0) !== (b.servida || 0)) return (b.servida || 0) - (a.servida || 0)
    return new Date(a.alta) - new Date(b.alta)
  })
  return [orden[0], orden.slice(1)]
}

/**
 * Banda del grupo, comparando el TEXTO de la respuesta correcta y NUNCA su índice.
 *
 * `correct_option` difiere entre copias legítimamente (las opciones vienen barajadas), así
 * que compararlo daría alarmas falsas en cascada: en las psicotécnicas del 31/07 los tres
 * pares «discrepantes» resultaron ser el mismo texto con el punto final puesto o quitado.
 *
 *   error → las gemelas dan respuestas DISTINTAS: el opositor no puede saber cuál vale.
 *   warn  → misma respuesta repetida: molesta, no engaña.
 */
function bandaGrupo(miembros) {
  const respuestas = new Set(miembros.map((m) => normalizar(m.textoCorrecta)))
  return respuestas.size > 1 ? 'error' : 'warn'
}

/**
 * Igual que `normalizar()` pero CONSERVANDO las tildes. Sirve para preguntarle al grupo si lo
 * unió el criterio o lo unió el normalizador.
 */
function normalizarConTildes(texto) {
  return String(texto ?? '')
    .replace(/<[^>]*>/g, ' ')
    .toLowerCase()
    .replace(/[^a-z0-9ñáéíóúüç]+/g, '')
}

/**
 * ¿Este grupo solo existe porque se le quitaron las TILDES a las opciones?
 *
 * En un banco que examina ORTOGRAFÍA, la tilde puede ser justo lo que la pregunta pregunta
 * («¿cuál está bien escrita?»), y entonces ignorarla no es normalizar: es borrar la diferencia
 * que decide la respuesta. Un grupo así **no se aplica en automático** — se mira el enunciado.
 *
 * No se hace lo mismo con la puntuación a propósito: medido el 31/07, el punto final y el orden
 * de las opciones explican 13 de los 40 grupos de la cola y son diferencias de transcripción,
 * no de contenido. Apartarlos también dejaría la herramienta sin nada que hacer.
 *
 * @param opcionesPorCopia array con el juego de opciones de cada copia del grupo
 */
function unidoSoloPorTildes(opcionesPorCopia) {
  const claves = (opcionesPorCopia || []).map((opts) =>
    (opts || []).map(normalizarConTildes).filter((o) => o.length > 0).sort().join('|'))
  return new Set(claves).size > 1
}

/**
 * Juegos de opciones que NO sirven para emparejar por sí solos: números sueltos («1|2|3|4»),
 * «figura a/b/c/d» y cualquier juego demasiado corto. Solo aplica al corte PARAFRASEADO
 * (mismas opciones, enunciado distinto), donde la única evidencia son las opciones.
 */
function esJuegoGenerico(claveDeOpciones) {
  const c = String(claveDeOpciones || '')
  if (c.length <= 24) return true
  if (/^[0-9|]+$/.test(c)) return true
  if (/figura/.test(c)) return true
  return false
}

// ─── Corte PARAFRASEADO del banco legislativo [T-425] ───────────────────────────────────
//
// El corte parafraseado que ya existía («mismas opciones, enunciado distinto») está pensado
// para las psicotécnicas y NO se puede trasladar tal cual a `questions`. Medido el 31/07 sobre
// las activas:
//
//   · agrupando solo por opciones ............ 3.376 grupos, casi todo falso positivo POR DISEÑO
//     (gramática inglesa `another/other/others`, etapas del PAE, `estadio I-IV`, `grado I-IV`)
//   · y `esJuegoGenerico` DESCARTA el caso que originó la ficha, porque sus opciones son cuatro
//     números de artículo (`115|137|147|148`) — en este banco eso sí discrimina.
//
// Tampoco vale el solape de palabras a secas: es lo que probó T-321 (3.230 pares) y lo que
// hunde son los SUPUESTOS PRÁCTICOS, que comparten un preámbulo largo y difieren solo en la
// pregunta final, así que puntúan 0,90 sin ser gemelas.
//
// Lo que sí separa las dos cosas es cruzar el ratio con el número ABSOLUTO de palabras no
// compartidas: una gemela difiere en 1-2 palabras (una errata, un «365», una tilde); una
// familia de supuesto difiere en decenas aunque el ratio sea alto. Medido:
//
//   ratio \ palabras distintas    <=2   3-5   6-10  11-20   >20
//   >=0,95                        347    37     8      1      0
//   0,90-0,95                     213   132    12      4      4
//   0,80-0,90                      82   223   164     14     12
//   0,70-0,80                       2    55   204     86     10

/**
 * Tokeniza para MEDIR PARECIDO. Es lo contrario de `normalizar()`, que pega el texto entero
 * para construir una CLAVE DE IGUALDAD: aquí hacen falta las palabras sueltas.
 *
 * La ñ se colapsa a n sin salvaguarda a propósito — la misma transformación cae sobre los dos
 * textos que se comparan, así que no puede inventar ni borrar un parecido.
 */
function palabrasComparables(texto) {
  return String(texto ?? '')
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
}

/**
 * Compara dos enunciados y devuelve las DOS medidas que hacen falta juntas:
 *   solape    — Dice sobre el conjunto de palabras (1 = mismas palabras, 0 = ninguna)
 *   distintas — cuántas palabras no comparten, en ABSOLUTO (no en porcentaje)
 *
 * El ratio solo dice «se parecen»; el absoluto dice «se parecen POR POCO texto», que es lo que
 * distingue la errata del supuesto práctico.
 */
function compararEnunciados(a, b) {
  const A = new Set(palabrasComparables(a))
  const B = new Set(palabrasComparables(b))
  if (!A.size || !B.size) return { solape: 0, distintas: Infinity }
  let comunes = 0
  for (const w of A) if (B.has(w)) comunes++
  return {
    solape: (2 * comunes) / (A.size + B.size),
    distintas: (A.size - comunes) + (B.size - comunes),
  }
}

const UMBRAL_GEMELA = { solape: 0.95, distintas: 2 }
const UMBRAL_COLA = { solape: 0.70 }

/**
 * Banda de una pareja candidata del corte parafraseado legislativo.
 *
 *   'gemela' → casi el mismo texto, casi las mismas palabras y la MISMA respuesta.
 *              318 parejas medidas; precisión ~90 % sobre 20 revisadas a mano.
 *   'cola'   → parecidas pero no concluyentes: se miran a mano, NUNCA en bloque.
 *   null     → no es candidata.
 *
 * ⚠️ **Ni siquiera `gemela` autoriza a jubilar en automático**, y por eso este corte solo
 * LISTA (igual que el parafraseado de psicotécnicas, T-410). Los dos falsos positivos que
 * sobreviven al umbral son irreducibles para un criterio determinista:
 *
 *   · intercambio de UNA palabra de contenido — «prevención secundaria» / «terciaria»,
 *     «¿cuántos dictámenes?» / «¿cuántos informes?». Son preguntas DISTINTAS.
 *   · conjunto de palabras idéntico con otro orden: si las dos palabras que se intercambian
 *     ya aparecen antes en el enunciado, el solape da 1,000 y las `distintas` dan 0.
 *
 * @param {{solape:number, distintas:number, mismaRespuesta:boolean}} m
 */
function bandaParafraseada({ solape, distintas, mismaRespuesta }) {
  if (solape >= UMBRAL_GEMELA.solape && distintas <= UMBRAL_GEMELA.distintas && mismaRespuesta) return 'gemela'
  if (solape >= UMBRAL_COLA.solape) return 'cola'
  return null
}

/** ¿Las dos copias dan la misma respuesta? Compara el TEXTO normalizado, nunca el índice. */
function mismaRespuesta(a, b) {
  return normalizar(a) === normalizar(b) && normalizar(a) !== ''
}

// ─── La guarda del ORDEN [T-439] ────────────────────────────────────────────────────────
//
// T-425 dio por IRREDUCIBLE este falso positivo: dos preguntas del art. 81 de la Ley 39/2015,
// una preguntando «¿cuántos DICTÁMENES?» y otra «¿cuántos INFORMES?», con solape 1,000 y cero
// palabras distintas — porque las dos palabras ya salen en el preámbulo común, así que el
// CONJUNTO de palabras es idéntico.
//
// No era irreducible: era que se estaba mirando el conjunto en vez de la SECUENCIA. Al comparar
// las palabras en orden, las dos frases divergen. Medido sobre los 87 grupos más expuestos, esta
// guarda sola rescató 4 grupos que el corte por conjunto daba por gemelos, entre ellos el par
// canónico de arriba y «¿convertir una CITA en EVENTO?» / «¿convertir un EVENTO en una CITA?».
//
// Da algún aviso de más («igualdad efectiva de hombres y mujeres» / «de mujeres y hombres» es la
// misma pregunta), y está bien que lo dé: esto no borra nada, decide qué se lee con cuidado.

/**
 * Palabras que solo son forma de citar y no cambian lo que se pregunta.
 *
 * **Lo que NO está aquí es tan importante como lo que está.** Fuera quedan a propósito:
 *   · `no` y `correcta` — «señale la INCORRECTA» es la pregunta contraria, no una variante;
 *   · cualquier cifra — puede ser el número del artículo, que es justo lo que se pregunta.
 * Meterlos costó tres grupos mal clasificados en la primera pasada de T-439.
 */
const RUIDO_DE_CITA = new Set([
  'art', 'articulo', 'arts', 'articulos', 'ce', 'constitucion', 'constitucional', 'espanola',
  'de', 'del', 'la', 'el', 'los', 'las', 'un', 'una', 'y', 'o', 'a', 'en', 'que', 'segun',
  'conforme', 'acuerdo', 'senale', 'indique', 'cual', 'cuales', 'siguiente', 'siguientes',
  'ley', 'lo', 'se', 'su', 'sus', 'al', 'con', 'por', 'para', 'es', 'son', 'sera', 'seran',
  'marzo', 'octubre', 'abril', 'texto', 'refundido',
])

// ─── Corte MISMA CLAVE: mismo artículo, misma respuesta, opciones DISTINTAS [T-519] ─────
//
// El hueco que ni el corte exacto ni el parafraseado pueden ver, porque LOS DOS exigen que
// las OPCIONES coincidan. Aquí solo coincide la respuesta correcta, y los distractores son
// otros — que es como se acumulan las paráfrasis generadas en tandas distintas.
//
// Lo destapó la impugnación 9e0d7418 (Marta Benito Padilla, 03/08/2026): pidió un test del
// art. 2 de la LGSS, le salieron 10 preguntas y OCHO examinaban la misma frase (los cuatro
// principios). El artículo servía 13 preguntas activas y 11 preguntaban lo mismo. Ninguna
// herramienta podía verlo: los enunciados son distintos y los distractores también.
//
// El discriminador NO puede ser «misma respuesta» a secas. Medido sobre las activas: 41.063
// parejas, y las de abajo son mayoría de falsos positivos POR DISEÑO — un artículo con una
// enumeración (LOFCS art. 5, principios básicos de actuación) tiene N preguntas que piden
// subhechos DISTINTOS y comparten la etiqueta como respuesta. Lo que separa las dos cosas es
// si el ENUNCIADO pide lo mismo, medido sobre las palabras de CONTENIDO (sin la cita legal,
// que en este banco es un bloque idéntico de 100+ caracteres y se infla solo — la misma razón
// por la que el dedup de generación da los dos números en vez de subir el umbral).
//
// Calibración sobre datos vivos (03/08/2026), con las anclas juzgadas a mano:
//   · falsos positivos conocidos (LOFCS art. 5) ....... 0,120 · 0,143 · 0,273
//   · ciertos del caso de Marta (RDL 8/2015 art. 2) ... 0,476 · 0,667 · 0,667 · 0,867
//   contenido >= 0,85 → 3.050 parejas, 6 de 6 ciertas en muestra leída a mano
//   contenido 0,55–0,85 → 4.441 parejas, ~10 de 14 ciertas: se leen, no se aplican
//   contenido < 0,55 → 33.572 parejas: ahí viven los falsos positivos, NO se emite

const UMBRAL_MISMA_CLAVE = { gemela: 0.85, cola: 0.55 }

/**
 * Cuánto piden lo mismo dos enunciados, mirando solo sus palabras de CONTENIDO.
 *
 * Es Dice sobre `secuenciaDeContenido()` (la de T-439, que ya quita el ruido de cita). Se
 * reutiliza a propósito en vez de escribir una tercera medida de parecido: `compararEnunciados`
 * mide el texto ENTERO y aquí eso no vale, porque el nombre desarrollado de la ley —que
 * §2.2-quater obliga a poner en cada enunciado— pesa más que la materia y empareja preguntas
 * de la misma ley que no tienen nada que ver.
 */
function solapeDeContenido(a, b) {
  const A = new Set(secuenciaDeContenido(a))
  const B = new Set(secuenciaDeContenido(b))
  if (!A.size || !B.size) return 0
  let comunes = 0
  for (const w of A) if (B.has(w)) comunes++
  return (2 * comunes) / (A.size + B.size)
}

/**
 * Banda de una pareja del corte MISMA CLAVE.
 *
 *   'gemela' → el enunciado pide lo mismo: es la misma pregunta otra vez.
 *   'cola'   → se parecen; se leen de una en una, NUNCA en bloque.
 *   null     → no es candidata (o ya la ve otro corte).
 *
 * ⚠️ **Ni `gemela` autoriza a jubilar en automático**, igual que en los otros dos cortes: la
 * decisión de qué se conserva depende de qué pide el epígrafe y de cuál está mejor escrita.
 * Este corte LISTA.
 *
 * `mismasOpciones` descarta la pareja a propósito: ese caso ya lo cubren el corte exacto y el
 * parafraseado, y emitirlo aquí también sería contar dos veces el mismo defecto.
 *
 * @param {{solape:number, mismasOpciones:boolean}} m
 */
function bandaMismaClave({ solape, mismasOpciones }) {
  if (mismasOpciones) return null
  if (solape >= UMBRAL_MISMA_CLAVE.gemela) return 'gemela'
  if (solape >= UMBRAL_MISMA_CLAVE.cola) return 'cola'
  return null
}

/**
 * ¿Estas dos preguntas del MISMO artículo responden lo mismo con otros distractores?
 *
 * Devuelve la banda o `null`. Compara el TEXTO de la respuesta correcta y nunca su índice,
 * por la misma razón que `bandaGrupo`: las copias vienen barajadas entre sí.
 *
 * @param {{question_text:string, opciones:string[], correctOption:number}} a
 * @param {{question_text:string, opciones:string[], correctOption:number}} b
 */
function parejaMismaClave(a, b) {
  const claveA = normalizar((a.opciones || [])[a.correctOption])
  const claveB = normalizar((b.opciones || [])[b.correctOption])
  if (!claveA || claveA !== claveB) return null
  return bandaMismaClave({
    solape: solapeDeContenido(a.question_text, b.question_text),
    mismasOpciones: claveOpciones(a.opciones) === claveOpciones(b.opciones),
  })
}

/**
 * Comprueba una adjudicación hecha A MANO antes de escribir nada [T-439].
 *
 * Devuelve la lista de problemas; vacía = se puede aplicar. Con uno solo, **no se aplica NADA**:
 * una adjudicación es una unidad de juicio, y aplicar la mitad deja el banco en un estado que
 * nadie decidió.
 *
 * Las tres cosas que mira, y por qué cada una:
 *   · la pregunta EXISTE — un id copiado a mano se equivoca;
 *   · no es de examen OFICIAL — `retired_duplicate` es TERMINAL y borrar el registro de que algo
 *     cayó en un examen real necesita más que un parecido de texto;
 *   · su `lifecycle_state` sigue siendo el que se vio al adjudicar — entre leer y aplicar puede
 *     pasar una hora y otra sesión (o un cron) haber movido la pregunta.
 *
 * @param {Array<{quedaId:string, jubilar:Array<{id:string, estado:string}>}>} plan
 * @param {Map<string,{is_official_exam:boolean, lifecycle_state:string}>} vivos
 */
function validarAdjudicacion(plan, vivos) {
  const problemas = []
  for (const p of plan) {
    for (const j of p.jubilar) {
      const r = vivos.get(j.id)
      if (!r) problemas.push({ id: j.id, causa: 'no_existe' })
      else if (r.is_official_exam) problemas.push({ id: j.id, causa: 'examen_oficial' })
      else if (r.lifecycle_state !== j.estado) {
        problemas.push({ id: j.id, causa: 'estado_cambiado', esperado: j.estado, actual: r.lifecycle_state })
      }
      if (j.id === p.quedaId) problemas.push({ id: j.id, causa: 'se_jubila_al_superviviente' })
    }
  }
  return problemas
}

/** Las palabras de contenido, EN ORDEN. Es la huella que distingue el orden del conjunto. */
function secuenciaDeContenido(texto) {
  return palabrasComparables(texto).filter((w) => !RUIDO_DE_CITA.has(w))
}

/**
 * ¿Las dos frases dicen sus palabras de contenido en el MISMO orden?
 *
 * `false` no significa «son distintas»: significa **«esto no lo decide el conjunto, léelo»**.
 */
function mismoOrdenDeContenido(a, b) {
  return secuenciaDeContenido(a).join(' ') === secuenciaDeContenido(b).join(' ')
}

/**
 * Cuántos elementos de una lista YA ORDENADA de mayor a menor hacen falta para juntar
 * `fraccion` del total. Es lo que convierte «319 grupos» en «empieza por estos 87».
 *
 * Existe porque el recuento y el daño no se reparten igual: medido el 31/07, 122 de los 319
 * grupos gemelos no se han servido NUNCA, así que adjudicarlos gasta criterio humano donde no
 * cambia nada. Con la lista ordenada por exposición, el 80% cabe en 87.
 *
 * Devuelve 0 si no hay nada que repartir — un total de cero no tiene «el 80%», y devolver
 * `length` ahí haría que una tanda sin servir a nadie pareciera trabajo prioritario entero.
 */
function corteAcumulado(valoresDesc, fraccion = 0.8) {
  const total = valoresDesc.reduce((a, v) => a + v, 0)
  if (total <= 0) return 0
  let acc = 0
  for (let i = 0; i < valoresDesc.length; i++) {
    acc += valoresDesc[i]
    if (acc >= total * fraccion) return i + 1
  }
  return valoresDesc.length
}

module.exports = {
  normalizar,
  normalizarConTildes,
  unidoSoloPorTildes,
  sqlNormalizar,
  claveOpciones,
  huellaContenido,
  canonicalizar,
  decidirSuperviviente,
  bandaGrupo,
  esJuegoGenerico,
  palabrasComparables,
  compararEnunciados,
  bandaParafraseada,
  mismaRespuesta,
  corteAcumulado,
  RUIDO_DE_CITA,
  secuenciaDeContenido,
  mismoOrdenDeContenido,
  validarAdjudicacion,
  solapeDeContenido,
  bandaMismaClave,
  parejaMismaClave,
  UMBRAL_GEMELA,
  UMBRAL_COLA,
  UMBRAL_MISMA_CLAVE,
}
