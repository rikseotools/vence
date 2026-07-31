/**
 * ¿La ficha que vas a crear YA EXISTE? — núcleo puro (T-359, 31/07/2026).
 *
 * ## Por qué existe
 *
 * El 31/07 empecé a diseñar un lote para crear 385 ofertas de precio a los usuarios del vaciado de
 * Stripe. **Otra sesión lo había construido el día anterior y lo tenía verificado en producción**
 * ([T-341]). No lo detectó ningún proceso: lo detectó Manuel preguntando *«investiga que no estés
 * duplicando algo que ya haya hecho otra sesión»*.
 *
 * Lo que había no bastaba, y conviene entender por qué:
 *   · el **claim** impide que dos sesiones cojan LA MISMA ficha — no que existan dos fichas para el
 *     mismo trabajo;
 *   · `tools:buscar` cubre HERRAMIENTAS, no tareas;
 *   · y `list` solo enseña lo ABIERTO, así que una tarea **cerrada ayer** es justo la que no se ve.
 *
 * `reserve` es el punto por el que toda ficha nueva tiene que pasar, y hasta hoy solo repartía
 * números. Aquí va la comprobación.
 *
 * ## Qué compara, y por qué así
 *
 * Palabras **distintivas** del título (y del `outcome` de las cerradas, donde suele estar el detalle
 * de lo que se hizo). Se descartan las genéricas: en este backlog «premium», «usuarios» o «sistema»
 * salen en decenas de fichas y no distinguen nada — si contaran, saltaría todo y el aviso se dejaría
 * de leer, que es como mueren los guardarraíles.
 *
 * NO usa IA ni embeddings a propósito: tiene que correr dentro de `reserve`, en frío, sin red y en
 * milisegundos. Un aviso que tarda se acaba quitando.
 */

/** Palabras que en ESTE backlog no distinguen una tarea de otra (medido sobre 337 títulos). */
const GENERICAS = new Set([
  'para', 'como', 'sobre', 'entre', 'desde', 'hasta', 'porque', 'cuando', 'donde', 'aunque',
  'todos', 'todas', 'otros', 'otras', 'nuevo', 'nueva', 'nuevos', 'nuevas', 'mismo', 'misma',
  'sistema', 'sistemas', 'usuario', 'usuarios', 'usuaria', 'usuarias', 'premium', 'cuenta', 'cuentas',
  'tarea', 'tareas', 'ficha', 'fichas', 'panel', 'badge', 'detector', 'detectores', 'aviso', 'avisos',
  'preguntas', 'pregunta', 'tema', 'temas', 'oposicion', 'oposiciones', 'datos', 'dato', 'campo',
  'error', 'errores', 'fallo', 'fallos', 'arreglar', 'arreglo', 'verificar', 'revisar', 'medir',
  'hacer', 'poner', 'dejar', 'tiene', 'tienen', 'esta', 'estan', 'sigue', 'siguen', 'puede', 'pueden',
  'nadie', 'ninguno', 'ninguna', 'solo', 'cada', 'antes', 'despues', 'ahora', 'hoy', 'dia', 'dias',
])

const normaliza = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palabras distintivas de un texto: >3 letras, no genéricas, sin duplicar. */
function distintivas(texto) {
  return [...new Set(normaliza(texto).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !GENERICAS.has(w)))]
}

/**
 * Candidatas a que la ficha nueva sea un duplicado.
 *
 * @param {string} titulo  el título que se va a reservar
 * @param {Array<{id:string,title:string,status:string,outcome?:string,closed_at?:any}>} existentes
 * @param {{minComunes?:number}} [opts]
 * @returns {Array<{id:string,title:string,status:string,comunes:string[]}>} ordenadas por solape
 *
 * El umbral por defecto son **3 palabras distintivas compartidas**. Con 2 saltaba demasiado (medido
 * sobre el backlog real); con 3, el caso que motivó esto —«botón», «vaciado», «precio»— sigue
 * saltando, que es la prueba que importa.
 */
function fichasParecidas(titulo, existentes, { minComunes = 3 } = {}) {
  const mias = new Set(distintivas(titulo))
  if (mias.size < minComunes) return []
  const out = []
  for (const t of existentes || []) {
    // El `outcome` de una CERRADA cuenta: ahí está lo que de verdad se hizo, y es donde se reconoce
    // el trabajo que uno está a punto de repetir. En una abierta, el título es lo único fiable.
    const texto = t.status === 'done' ? `${t.title || ''} ${t.outcome || ''}` : (t.title || '')
    const comunes = distintivas(texto).filter((w) => mias.has(w))
    if (comunes.length >= minComunes) out.push({ id: t.id, title: t.title, status: t.status, comunes })
  }
  return out.sort((a, b) => b.comunes.length - a.comunes.length)
}

module.exports = { fichasParecidas, distintivas, GENERICAS }
