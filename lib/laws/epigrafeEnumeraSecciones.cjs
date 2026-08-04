// lib/laws/epigrafeEnumeraSecciones.cjs — ¿el epígrafe enumera SECCIONES de la ley? (T-528)
//
// ── LA PREGUNTA, Y POR QUÉ ES DETERMINISTA ──────────────────────────────────────────────────
//
// Un `topic_scope` con `article_numbers = NULL` significa «toda la ley». Eso es CORRECTO cuando
// el epígrafe pide la norma entera (`fix-topic-scope-null-whole-law`), y es sobre-inclusión
// cuando el epígrafe enumera partes concretas. Hoy nada distingue un caso del otro: los 1.957
// scopes «ley entera» de temas activos se ven igual, y **1.501 están marcados
// `verified_correct`** ([T-528]).
//
// La distinción no necesita inteligencia: necesita el ÍNDICE. Si el epígrafe nombra DOS o más
// secciones reales de esa ley y el scope dice «entera», es una contradicción mecánica.
//
// ── QUÉ LO SEPARA DEL DETECTOR QUE YA HAY ───────────────────────────────────────────────────
//
// `lib/laws/scopeOverInclusion.ts` razona sobre el TEXTO del epígrafe (cuenta segmentos, busca
// palabras de cierre). No mira la ley: no puede, no recibe su estructura. Por eso su banda MEDIA
// es una cola de revisión y no un hallazgo. Aquí se contrasta contra las secciones REALES que
// devuelve `parseBoeSections` sobre el índice del BOE, así que lo que sale es una contradicción
// comprobable, no una sospecha.
//
// ── LO QUE NO SE PUEDE MEDIR, DICHO EN VOZ ALTA ─────────────────────────────────────────────
//
// Solo hay índice para las leyes con `boe_url` de BOE consolidado: **476 de las 1.957 filas
// (24%)**. Del resto —autonómicas, reglamentos propios, leyes virtuales de ofimática— este
// núcleo NO opina, y es importante que no lo simule: un detector que calla sobre el 76% y no lo
// dice invita a leer su cero como «no hay problema».

// La atribución sección→ley NO se reimplementa: se reutiliza el modelo de T-129 que ya vive en
// `scopeTitleBoundary` («cada sección pertenece a la ÚLTIMA norma mencionada antes de ella»).
// Escribir esto sin él reprodujo su mismo fallo en la primera medición: en `guardia_civil` T9 se
// atribuyeron a la Ley 4/2015 los libros de la Ley de Enjuiciamiento Criminal, porque las dos
// están en el mismo epígrafe.
const { mencionesNorma, extractLawRefs } = require('./scopeTitleBoundary')

const normTxt = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

/** Ordinales romanos que aparecen en los temarios (hasta XX cubre cualquier ley real). */
const ROMANOS = 'I|II|III|IV|V|VI|VII|VIII|IX|X|XI|XII|XIII|XIV|XV|XVI|XVII|XVIII|XIX|XX'

/**
 * Secciones que el epígrafe nombra POR SU ORDINAL («Título III», «Capítulo I»).
 *
 * Se busca el ordinal pegado a su palabra (`título`/`capítulo`/`libro`) y no suelto, porque un
 * romano aislado en un temario suele ser otra cosa (un anexo, el nombre de un rey).
 *
 * @param {string} epigrafe
 * @param {{shortName?:string,name?:string}} [ley]  si se pasa, SOLO devuelve las secciones que
 *        cuelgan de ESA norma (modelo T-129). Sin ella, todas: comportamiento legacy.
 * @returns {{tipo: string, num: string}[]} en orden de aparición, sin repetir
 */
function seccionesNombradas(epigrafe, ley) {
  const txt = String(epigrafe || '')
  const re = new RegExp(`\\b(t[ií]tulos?|cap[ií]tulos?|libros?)\\s+(?:(${ROMANOS})\\b|(preliminar))`, 'gi')
  const vistas = new Set()
  const salida = []
  // Normas citadas en el epígrafe, para saber de cuál cuelga cada sección.
  const normas = ley && (ley.shortName || ley.name) ? mencionesNorma(txt) : null
  const refsLey = normas ? extractLawRefs(`${ley.shortName || ''} ${ley.name || ''}`) : null
  const normLey = normas ? normTxt(`${ley.shortName || ''} ${ley.name || ''}`) : null
  let m
  while ((m = re.exec(txt)) !== null) {
    const tipo = m[1].toLowerCase().replace(/s$/, '').replace(/í/, 'i')
    const num = (m[2] || m[3]).toUpperCase()
    if (normas) {
      let dueno = null
      for (const n of normas) { if (n.idx < m.index) dueno = n; else break }
      // Sin norma citada antes → genérico, cuenta para la ley que se clasifica (igual que T-129).
      if (dueno) {
        const esEsta = dueno.ref ? refsLey.has(dueno.ref) : normLey.includes(normTxt(dueno.etiqueta))
        if (!esEsta) continue
      }
    }
    const clave = `${tipo}:${num}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    salida.push({ tipo, num })
  }
  return salida
}

/**
 * ¿Hay contradicción entre este epígrafe y un scope que dice «toda la ley»?
 *
 * @param {string} epigrafe
 * @param {{num: string}[]} secciones  secciones REALES de la ley (de `parseBoeSections`)
 * @param {{shortName?:string,name?:string}} [ley]  para atribuir cada sección a su norma (T-129)
 * @returns {{contradice: boolean, nombradas: object[], reconocidas: string[], motivo: string}}
 */
function contradiceLeyEntera(epigrafe, secciones, ley) {
  const nombradas = seccionesNombradas(epigrafe, ley)
  const reales = new Set((secciones || []).map(s => String(s.num).toUpperCase()))
  // Solo cuentan las que EXISTEN en la ley: un «Título IV» que la norma no tiene es una errata
  // del temario o una referencia a otra norma, y no prueba nada sobre el reparto de ESTA.
  const reconocidas = nombradas.filter(n => reales.has(n.num)).map(n => `${n.tipo} ${n.num}`)
  // Se exigen DOS. Con una sola no se puede distinguir «solo entra el Título III» de una simple
  // mención de contexto dentro de una materia más amplia, y esa banda daría ruido.
  const contradice = reconocidas.length >= 2
  return {
    contradice,
    nombradas,
    reconocidas,
    motivo: contradice
      ? `el epígrafe nombra ${reconocidas.length} secciones de la ley (${reconocidas.join(', ')}) y el scope dice «toda la ley»`
      : nombradas.length
        ? `nombra ${nombradas.length} sección(es), ${reconocidas.length} reconocida(s) en la ley: insuficiente`
        : 'el epígrafe no enumera secciones (pedir la ley entera es coherente)',
  }
}

module.exports = { seccionesNombradas, contradiceLeyEntera }
