/**
 * Portal de empleo público oficial por CCAA / ciudad autónoma — fallback para
 * asignar `seguimiento_url` a una oposición recién catalogada cuando no hay
 * donante (otra fila del MISMO organismo con URL ya validada).
 *
 * ## Por qué es un núcleo propio y no un objeto suelto dentro del script (T-616)
 *
 * El fallback vivía dentro de `scripts/assign-seguimiento-urls.cjs` y se
 * consultaba con `CCAA_FALLBACK[t.ccaa]`, con `t.ccaa` tomado tal cual de la
 * señal que descubrió la fila. Pero las etiquetas que produce el radar **llevan
 * el boletín pegado**: `regional_scan` emite `'Castilla y León (BOCYL)'`,
 * `'C. Valenciana (DOGV)'`, `'Asturias (BOPA)'`, `'Murcia (BORM)'`, mientras el
 * mapa tenía las claves desnudas. Resultado medido el 06/08/2026 sobre las
 * catalogadas sin fuente: **por CCAA: 0** — el fallback llevaba mudo desde que
 * los boletines autonómicos empezaron a emitir convocatorias (16/07/2026), que
 * es justo de donde viene hoy la mayoría de lo que se cataloga.
 *
 * Un mapa cuyo acierto depende de que dos sistemas escriban la etiqueta igual no
 * es un mapa: es una coincidencia. Por eso la resolución se normaliza (sufijo de
 * boletín fuera, sin acentos, sin puntuación) y vive aquí, con tests.
 *
 * ⚠️ Convive un SEGUNDO espacio de claves: el agregador PAG identifica Ceuta y
 * Melilla por su **código numérico** (`'51'`, `'52'`), no por su nombre. Se
 * conservan y además se aceptan por nombre.
 *
 * NUNCA añadir aquí una URL sin comprobar que el cron puede leerla: el llamador
 * la pasa por `seguimientoVigilable`, pero una URL que no vigila nada es un
 * hueco con nombre (ver `docs/runbooks/salud-radar.md`).
 */

/** Portales oficiales, server-rendered. Clave = nombre canónico normalizado. */
const CCAA_FALLBACK = {
  Madrid: 'https://www.comunidad.madrid/empleo',
  Cantabria: 'https://empleopublico.cantabria.es/funcionarios',
  Canarias:
    'https://www.gobiernodecanarias.org/administracionespublicas/funcionpublica/acceso/convocatorias-en-curso/',
  Navarra: 'https://www.navarra.es/es/empleo-publico/convocatorias',
  'La Rioja': 'https://www.larioja.org/empleo-publico/es/oposiciones',
  Galicia:
    'https://www.xunta.gal/es/funcion-publica/procesos-selectivos/oferta-publica-de-emprego',
  Aragón: 'https://empleopublico.aragon.es/',
  'Castilla y León': 'https://empleopublico.jcyl.es/',
  'Castilla-La Mancha': 'https://empleopublico.castillalamancha.es/',
  Andalucía:
    'https://www.juntadeandalucia.es/institutodeadministracionpublica/empleado',
  'C. Valenciana':
    'https://www.gva.es/es/inicio/atencion_ciudadano/buscadores/busc_empleo_publico',
  '51': 'https://www.ceuta.es/ceuta/por-servicios/tablon', // Ceuta (código PAG)
  '52': 'https://sede.melilla.es/sta/CarpetaPublic/doEvent?APP_CODE=STA&PAGE_CODE=PTS2_TABLON_DESC', // Melilla (código PAG)
}

/**
 * Sinónimos → clave canónica del mapa. Cubre las variantes con las que cada
 * capa nombra la misma comunidad (el adapter de boletín, el PAG y el nombre
 * de la administración no coinciden entre sí).
 */
const ALIAS = {
  ceuta: '51',
  melilla: '52',
  'ciudad autonoma de ceuta': '51',
  'ciudad autonoma de melilla': '52',
  'comunidad valenciana': 'C. Valenciana',
  'comunitat valenciana': 'C. Valenciana',
  valencia: 'C. Valenciana',
  'castilla la mancha': 'Castilla-La Mancha',
  'comunidad de madrid': 'Madrid',
  'principado de asturias': 'Asturias',
  'region de murcia': 'Murcia',
  'islas baleares': 'Baleares',
  'illes balears': 'Baleares',
  euskadi: 'País Vasco',
  'pais vasco': 'País Vasco',
  catalunya: 'Cataluña',
}

/**
 * Claves que el mapa no tenía y que el radar SÍ produce.
 *
 * Solo entran URLs **medidas** con las cabeceras del cron. Se probaron seis el
 * 06/08/2026 y solo una sirve contenido: `gencat.cat/ocupacio-publica`,
 * `empleopublico.carm.es` y `asturias.es/empleo-publico` devuelven `fetch_error`
 * (y Baleares/Extremadura ni se llegaron a medir), así que **no se apuntan**:
 * una fuente que el fetcher no sabe leer no es una fuente, es un hueco con
 * nombre — y el mapa se lee como "esta CCAA está cubierta".
 *
 * Cataluña, Murcia y Asturias siguen sin portal utilizable: sus catalogadas
 * salen en "sin match", que es el estado honesto. Para darles uno hay que
 * encontrar una URL servida en HTML y comprobarla con
 * `node scripts/seguimiento/repuntar-url.cjs`, no elegirla a ojo.
 */
Object.assign(CCAA_FALLBACK, {
  'País Vasco': 'https://www.euskadi.eus/empleo-publico/', // medido: sirve contenido
})

/** Quita acentos, el sufijo de boletín «(BOCYL)» y la puntuación. */
function normalizeCcaaKey(label) {
  return String(label || '')
    .replace(/\([^)]*\)/g, ' ') // «Castilla y León (BOCYL)» → «Castilla y León»
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Índice de búsqueda: clave normalizada → clave canónica del mapa.
const INDICE = {}
for (const k of Object.keys(CCAA_FALLBACK)) INDICE[normalizeCcaaKey(k)] = k
for (const [alias, canon] of Object.entries(ALIAS)) INDICE[normalizeCcaaKey(alias)] = canon

/**
 * Devuelve el portal oficial de la CCAA de esa etiqueta, o `null` si no se
 * reconoce. `null` es un resultado LEGÍTIMO: el llamador lo reporta como "sin
 * match" en vez de inventarse una URL.
 */
function urlFallbackPorCcaa(label) {
  const canon = INDICE[normalizeCcaaKey(label)]
  return canon ? CCAA_FALLBACK[canon] || null : null
}

module.exports = { CCAA_FALLBACK, normalizeCcaaKey, urlFallbackPorCcaa }
