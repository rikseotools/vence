// lib/health/visualDeixis.cjs — núcleo puro del detector `visual_deixis_no_image`:
// preguntas ACTIVAS cuyo enunciado invoca un visual ("el siguiente icono", "observa la
// figura", "las restas de la imagen") pero no tienen imagen almacenada (`image_url` NULL
// y `content_data` vacío) → irresolubles en silencio: nadie ve el gráfico.
//
// ## Por qué existe este fichero (y no dos copias de los regex)
//
// El sweep de salud vive duplicado a mano en `scripts/health-sweep.cjs` (CLI) y
// `backend/src/content-health-sweep/content-health-sweep.service.ts` (@Cron 03:00 UTC, el
// writer REAL). El CLI **requiere este núcleo**; el backend NestJS no puede (proyecto y
// build separados, sin acceso al `lib/` del frontend) así que replica los patrones INLINE
// y el guardarraíl `content-sweep-parity` compara sus literales CONTRA los de aquí, por
// VALOR. Misma convención que `seguimientoUrlSalud.cjs`, `examenPasadoEnTexto.cjs` y
// `landingCompleteness.cjs`. Un mirror desincronizado es peor que no tenerlo: el @Cron
// nocturno vería otra cosa que el CLI, en silencio.
//
// ## Por qué está calibrado así (T-113, 26/07/2026)
//
// La versión anterior marcaba 5 preguntas y las 5 eran FALSOS POSITIVOS: preguntas
// AUTOCONTENIDAS, que aluden a un visual pero traen en texto todo lo necesario para
// responder. Dos mecanismos distintos, dos guardas:
//
//   1. **`esquema` NO es sustantivo visual.** En preguntas de administración/informática
//      "el siguiente esquema" introduce un esquema TEXTUAL que viene en el propio
//      enunciado ("ES_órgano>_ _>ID_específico", metadato ENI) o en las opciones
//      (clasificación URO de Correos). Medido sobre el banco: 2 activas dicen "el/la
//      siguiente esquema" y NINGUNA ha tenido nunca `image_url` → su precisión como señal
//      de imagen ausente era 0.
//   2. **SQL autocontenido.** Si la consulta entera (`SELECT … FROM`) está en el enunciado
//      O EN LAS OPCIONES, la pregunta se responde leyendo el SQL; el diagrama relacional
//      al que alude es contexto, no el dato que falta. Mirar las opciones es imprescindible:
//      en 2 de los 3 casos reales la query vive ahí, no en el enunciado.
//
// **Punto ciego asumido (medido, no ignorado):** una pregunta que diga "el siguiente
// esquema" Y necesite de verdad una imagen Y no use ninguna otra palabra visual no se
// marcará; ídem una de SQL que sí dependa del diagrama. Ambos casos son estrechos y este
// detector es `warn` de triaje, no una puerta. Remediar un hallazgo NUNCA es automático:
// si el texto ya describe el visual = autocontenida (dejar); si hace falta la imagen y hay
// fuente = reconstruir; si no = jubilar (`admin_image_unavailable`). NUNCA inventar la
// imagen ni fijar una clave a ciegas.

// Sustantivos que, precedidos de "el/la siguiente", SÍ denotan un visual.
// `esquema` está FUERA a propósito (ver punto 1 arriba).
const VISUAL_NOUNS = [
  'icono', 'imagen', 'imágen', 's[íi]mbolo', 'gr[áa]fico',
  'figura', 'captura', 'pictograma', 'diagrama', 'se[ñn]al',
]

// Patrón FUERTE de deixis visual. Sintaxis de expresiones regulares de Postgres (ARE):
// `\y` = frontera de palabra. Se compara con `~*` (case-insensitive).
// Deixis SINGULAR a propósito: "las siguientes …" = "de las siguientes opciones" (FP masivo).
const VD_STRONG =
  `(\\y(el|la)\\s+siguiente\\s+(${VISUAL_NOUNS.join('|')})\\y)` +
  '|(en\\s+la\\s+imagen\\s+(anterior|superior|inferior|adjunt\\w+|siguiente|de\\s+arriba|de\\s+abajo))' +
  '|(\\yla\\s+imagen\\s+(muestra|adjunt\\w+|superior|inferior|siguiente|anterior)\\y)' +
  '|((observa|observe|obsérv\\w+|f[íi]jese\\s+en)\\s+(la|el)\\s+(siguiente\\s+)?(imagen|figura|gr[áa]fico|icono|s[íi]mbolo|captura))' +
  '|(seg[úu]n\\s+(la\\s+imagen|la\\s+figura|el\\s+gr[áa]fico\\s+adjunt|muestra\\s+la\\s+(imagen|figura)|se\\s+muestra\\s+en\\s+la\\s+(imagen|figura)))' +
  '|(¿qu[ée]\\s+(significa|representa|indica)\\s+(este|el\\s+siguiente)\\s+(icono|s[íi]mbolo|pictograma|gr[áa]fico))' +
  '|(\\y(icono|s[íi]mbolo|pictograma|gr[áa]fico|captura|divisa|distintivo|emblema)\\s+(mostrad\\w+|adjunt\\w+|que\\s+se\\s+muestra|siguiente|anterior|de\\s+la\\s+(imagen|figura|fotograf\\w+))\\y)' +
  '|(\\y(restas|celda|celdas|f[óo]rmula|f[óo]rmulas|tabla|query|consulta|marca|base\\s+de\\s+datos|diagrama)\\w*\\s+\\w*\\s*(de|en)\\s+la\\s+imagen\\y)' +
  '|(\\yde\\s+la\\s+imagen[,. ]+(indica|se[ñn]ale|cu[áa]l|obten|calcul))' +
  // DEIXIS NUMERADA — «en la figura 1», «el resultado de la Figura 2», «ver fig. 3». [T-691]
  //
  // La cazó una usuaria (Laura Simar, impugnación `99ec0b16`): *«No se pueden ver las imágenes,
  // así que no sabía qué responder»*. El detector daba CERO ese día porque todos sus patrones
  // piden deixis con «siguiente/anterior/adjunta/mostrada», y una figura ROTULADA no dice nada de
  // eso: dice su número, porque el enunciado da por hecho que la tienes delante.
  //
  // Acotado a `figura|fig.|imagen` A PROPÓSITO, con el número PEGADO. Medido sobre las activas al
  // añadirlo: con `tabla` y `gráfico` dentro salían 4 y **dos eran falsos positivos** («en una
  // tabla 2x2» del test de Chi cuadrado, y «las tablas 'tabla1' y 'tabla2'» de un INNER JOIN);
  // sin ellos quedan 2, y las dos son irresolubles de verdad. Un rótulo numerado no tiene uso
  // conceptual: nadie escribe «figura 1» sin una figura 1.
  '|(\\y(figura|fig\\.|imagen)\\s*[0-9])'

// Guardas contra falsos positivos por HOMONIMIA: "imagen" en sentido no gráfico.
const VD_FP =
  'imagen corporal|imagen p[úu]blica|imagen de la administraci|imagen de las mujeres|' +
  'de la imagen y|imagen y (el |del )?sonido|imagen y sonido|derecho a la propia imagen|' +
  'reproducci[óo]n del sonido|de la imagen o|icono (muestra|con forma|que representa a)|' +
  's[íi]mbolo (¶|de p[áa]rrafo)|figura (jur[íi]dic|del? |profesional)'

// Guarda de AUTOCONTENCIÓN: la consulta completa está a la vista (enunciado u opciones).
const VD_SQL = '\\yselect\\y.*\\yfrom\\y'

/**
 * Traduce un patrón de Postgres (ARE) al dialecto de JavaScript.
 * Único punto de divergencia real entre ambos motores en estos patrones:
 *   - `\y` (frontera de palabra en Postgres) → `\b` en JS.
 *   - Postgres hace que `.` case con salto de línea por defecto; en JS hace falta la flag `s`.
 * Se traduce en vez de mantener una segunda copia de los patrones: así el predicado JS que
 * usan los tests y el `WHERE` que corre en Postgres salen de la MISMA cadena.
 */
function toJsRegex(pgPattern, flags = 'is') {
  return new RegExp(pgPattern.replace(/\\y/g, '\\b'), flags)
}

/** ¿El texto invoca un visual (y no es una de las homonimias conocidas)? */
function invokesVisual(questionText) {
  const t = String(questionText || '')
  if (!t) return false
  return toJsRegex(VD_STRONG).test(t) && !toJsRegex(VD_FP).test(t)
}

/** ¿La pregunta trae la consulta SQL a la vista (enunciado u opciones)? */
function hasSelfContainedSql(questionText, options = []) {
  const blob = [questionText, ...(Array.isArray(options) ? options : [])]
    .map((x) => String(x || ''))
    .join(' ')
  return toJsRegex(VD_SQL).test(blob)
}

/** ¿Hay imagen almacenada? (`content_data` vacío cuenta como que NO). */
function hasStoredImage({ imageUrl, contentData } = {}) {
  if (imageUrl) return true
  if (contentData == null) return false
  const s = typeof contentData === 'string' ? contentData : JSON.stringify(contentData)
  return !['{}', 'null', '', undefined].includes(s)
}

/**
 * Veredicto por pregunta — espejo en JS del `WHERE` que corre en Postgres.
 * Existe para poder CALIBRAR el detector en tests con preguntas reales, sin BD.
 * La detección autoritativa la hace Postgres; este predicado debe coincidir con ella.
 *
 * @returns {{flagged: boolean, reason: string}} `reason` explica por qué NO se marca.
 */
function classifyVisualDeixis({ questionText, options = [], imageUrl = null, contentData = null } = {}) {
  if (hasStoredImage({ imageUrl, contentData })) return { flagged: false, reason: 'tiene_imagen' }
  if (!invokesVisual(questionText)) return { flagged: false, reason: 'sin_deixis_visual' }
  if (hasSelfContainedSql(questionText, options)) return { flagged: false, reason: 'sql_autocontenido' }
  return { flagged: true, reason: 'deixis_sin_imagen' }
}

module.exports = {
  VISUAL_NOUNS,
  VD_STRONG,
  VD_FP,
  VD_SQL,
  toJsRegex,
  invokesVisual,
  hasSelfContainedSql,
  hasStoredImage,
  classifyVisualDeixis,
}
