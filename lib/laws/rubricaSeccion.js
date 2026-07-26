// Núcleo PURO de la reparación de rúbricas de `law_sections` (T-140, 26/07/2026).
// Lo consume `scripts/reparar-rubricas-law-sections.cjs`, que solo hace I/O (BOE + BD).
//
// ── EL DEFECTO QUE MOTIVA ESTO ──
// `poblar-law-sections-boe.cjs` sacaba la rúbrica de una sección con un regex sobre el
// cuerpo CRUDO del bloque del BOE, capturando hasta 140 caracteres sin punto. El cuerpo
// crudo trae TODAS las redacciones históricas y también las notas editoriales, así que
// salían dos defectos, medidos sobre 2.048 secciones del banco (50 afectadas):
//
//   · Nota pegada al título: «Título III. Del recurso de amparo constitucional **Ténganse
//     en cuenta los artículos 53.2…**» (LOTC). Se le muestra al usuario en /leyes/<slug>.
//   · **Rúbrica DEROGADA**, que es lo grave: «Título VI. Del control previo de
//     inconstitucionalidad» cuando la vigente es «De la declaración sobre la
//     constitucionalidad de los tratados internacionales». El regex cogía la PRIMERA
//     coincidencia del cuerpo, que es la redacción más antigua.

/**
 * ¿Está esta rúbrica contaminada? Tres familias, todas vistas en datos reales:
 *   1. nota de vigencia («Ténganse en cuenta…»),
 *   2. remisión editorial («Véase…», «Redactado conforme a…»),
 *   3. el encabezado de sección REPETIDO — síntoma de que se pegaron dos redacciones
 *      seguidas, y la señal de que la primera puede estar derogada.
 */
const SUCIA = /T[ée]ngan?se en cuenta|V[ée]a(?:se|nse)\b|redactad[oa]s? (?:conforme|por|seg[úu]n)/i

/**
 * Encabezado de sección del BOE pegado dentro del título, en MAYÚSCULAS.
 *
 * OJO: case-SENSITIVE a propósito, y es lo que le da precisión. Nuestro poblador escribe el
 * prefijo en mixto ("Título VI. …"), mientras que el encabezado que se cuela del cuerpo del
 * BOE viene siempre en caja alta ("TÍTULO VI", "TITULO VIII", "CAPÍTULO II"). Buscar dos
 * apariciones sin distinguir caja marcaba en falso cualquier rúbrica que MENCIONE la palabra
 * ("Título V. De las infracciones al Título VII"), que es legítima.
 */
const CABECERA_PEGADA = /\b(?:T[IÍ]TULO|CAP[IÍ]TULO|LIBRO)\s+(?:[IVXLCDM]+|[ÚU]NICO|PRELIMINAR|PRIMERO|SEGUNDO|TERCERO)\b/

/** @param {string} titulo `law_sections.title` */
function esRubricaSucia(titulo) {
  const s = String(titulo || '')
  return SUCIA.test(s) || CABECERA_PEGADA.test(s)
}

const norm = (x) =>
  String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()

/**
 * ¿La rúbrica que trae el BOE es una LIMPIEZA del título guardado, y no un reemplazo?
 *
 * Esta es la guarda de seguridad del reparador, y por qué existe: el blockId de cada
 * sección se recupera casando el `section_number` guardado con el índice actual del BOE, y
 * ese emparejamiento puede fallar. Si falla, el script escribiría en una sección la rúbrica
 * de OTRA — destruyendo un dato correcto para "arreglarlo".
 *
 * En la contaminación REAL la rúbrica vigente siempre está ya dentro del título guardado
 * (la nota va detrás, o la rúbrica nueva aparece tras el encabezado repetido). Así que
 * exigir contención convierte la reparación en algo que solo puede ACORTAR o SELECCIONAR
 * lo que ya había: nunca inventa texto nuevo.
 *
 * Lo enseñó la LOPJ en el dry-run: su «Título IV» pasaba de *"De la fe pública judicial y
 * de la documentación"* a *"De los órganos del Consejo General del Poder Judicial"*, porque
 * es una ley de nivel LIBRO y sus títulos REINICIAN por libro (hay varios «Título IV»).
 *
 * @param {string} tituloGuardado  `law_sections.title` actual
 * @param {string} rubricaBoe      rúbrica limpia que devuelve el BOE
 */
function rubricaEsLimpiezaDe(tituloGuardado, rubricaBoe) {
  const r = norm(rubricaBoe)
  if (!r) return false
  return norm(tituloGuardado).includes(r)
}

/**
 * ¿Son ambiguos los números de sección de esta ley? Pasa en las leyes de nivel LIBRO, donde
 * los títulos reinician por libro: casar por número asignaría la rúbrica de otro libro.
 * @param {{num:string}[]} secciones salida de `parseBoeSections`
 */
function numerosAmbiguos(secciones) {
  const nums = (secciones || []).map((s) => String(s.num).toLowerCase())
  return new Set(nums).size !== nums.length
}

module.exports = { esRubricaSucia, rubricaEsLimpiezaDe, numerosAmbiguos, SUCIA, CABECERA_PEGADA }
