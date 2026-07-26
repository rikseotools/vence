/**
 * Planificador de la campaña de **artículos huérfanos** (`article_no_coverage`,
 * T-115): artículos que están en el `topic_scope` con texto real importado pero
 * **0 preguntas activas** → nunca le salen al opositor aunque el tema rebose.
 *
 * Núcleo PURO: recibe las filas `(oposición, tema, ley, artículo, ¿cubierto?)` y
 * decide. No habla con la BD (eso es `scripts/huerfanos-plan.cjs`), así que se
 * puede testear con fixtures y simular sin tocar producción.
 *
 * ── La decisión de diseño que importa ──
 * La ficha original de T-115 decía "trocear por oposición". **Es el troceado
 * equivocado**: la pregunta cuelga del ARTÍCULO, así que cubrir un artículo apaga
 * el hueco en TODAS las oposiciones que lo escopan a la vez. Medido el 26/07:
 * LPRL art. 10 aparece en 23 oposiciones y Ley 7/1985 art. 2 en 29 → 31
 * preguntas apagaron 43 temas. Ir oposición por oposición habría costado ~30
 * lotes para el mismo efecto. Por eso `rankingHuerfanos` ordena por ALCANCE.
 */

/**
 * Umbrales del detector `article_no_coverage`. Son un ESPEJO de
 * `backend/src/content-health-sweep/content-health-sweep.service.ts` (y de su
 * gemelo `scripts/health-sweep.cjs`); si allí se recalibran y aquí no, el
 * planificador propondría lotes que no apagan nada. Lo vigila el test de
 * paridad `huerfanosPlan.test.js` → "los umbrales no han derivado del detector".
 */
const UMBRALES = {
  minArticulos: 4, // el tema debe tener ≥4 artículos con contenido
  minCobertura: 0.6, // y estar mayormente cubierto (si no, es low_coverage, otro problema)
  minHuecos: 4, // y acumular ≥4 artículos sin preguntas
}

/**
 * Naturaleza de un `article_number` a partir de su forma.
 *
 * POR QUÉ EXISTE (T-146, 26/07/2026): el detector filtra
 * `article_number ~ '^[0-9]+$'`, así que **todo artículo que no sea un entero puro
 * es invisible a la campaña de cobertura**. Medido ese día: 1.312 artículos activos
 * escopados son no numéricos y **715 sirven 0 preguntas con texto real**. Pero
 * meterlos todos en el badge sería peor que el hueco: una disposición final de
 * "entrada en vigor" no es materia de examen. Hace falta distinguir, y distinguir
 * es mirar la FORMA del número, que es lo que hace esta función.
 *
 * La familia que de verdad importa es la de **reforma** (`bis`/`ter`/`quáter`…):
 * son artículos introducidos por una modificación posterior, sustantivos (1.345 ch
 * de media) y donde vive el Derecho más nuevo — justo lo que más cae en examen.
 *
 * OJO con el parseo: hay artículos escritos `6bis` (sin espacio, Ley 19/2013) y
 * otros `367 quáter`, así que el sufijo se compara sobre el número YA separado en
 * vez de buscar la subcadena. Buscar "ter" suelto casa dentro de `DAtrigésima`.
 *
 * @param {string|number} numero
 * @returns {{tipo:string, numerado:boolean, esReforma:boolean}}
 */
function naturalezaArticulo(numero) {
  const n = String(numero ?? '').trim()
  const r = (tipo, esReforma = false) => ({ tipo, numerado: /^[0-9]+$/.test(n), esReforma })
  if (/^[0-9]+$/.test(n)) return r('ordinario')
  // "127 bis", "6bis", "367 quáter" → artículo de reforma.
  if (/^[0-9]+\s*(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)$/i.test(n)) return r('reforma', true)
  // "301.1" → apartado de un artículo ordinario (leyes editoriales que numeran así).
  if (/^[0-9]+\.[0-9]+$/.test(n)) return r('apartado')
  if (/^d\.?\s*a/i.test(n)) return r('adicional')
  if (/^d\.?\s*t/i.test(n)) return r('transitoria')
  if (/^d\.?\s*f/i.test(n)) return r('final')
  if (/^d\.?\s*d/i.test(n)) return r('derogatoria')
  return r('otro')
}

/** ¿Dispara este tema el finding? @param {{n:number, cubiertos:number}} t */
function disparaFinding({ n, cubiertos }) {
  if (n < UMBRALES.minArticulos) return false
  if (cubiertos >= n) return false
  if (cubiertos / n < UMBRALES.minCobertura) return false
  return n - cubiertos >= UMBRALES.minHuecos
}

const claveArt = (f) => `${f.leySlug}#${f.articulo}`

/**
 * Agrupa las filas por tema y evalúa el finding. `cubiertosExtra` = simulación.
 *
 * ⚠️ **Fidelidad del espejo (T-146):** las filas con `numerado === false` se
 * DESCARTAN aquí a propósito. El detector del backend no las ve (filtra
 * `~ '^[0-9]+$'`), así que si el planificador las contase, su veredicto de "este
 * tema dispara" dejaría de coincidir con el badge real y el test de paridad pasaría
 * mintiendo: mismo código, universo distinto. La deuda de esos artículos se mira
 * con `rankingHuerfanos({incluirNoNumerados:true})`, que es otra pregunta.
 * Las filas sin el campo (fixtures antiguos) se tratan como numeradas.
 */
function estadoPorTema(filas, cubiertosExtra = new Set()) {
  const porTema = new Map()
  for (const f of filas) {
    if (f.numerado === false) continue
    const k = f.topicId
    if (!porTema.has(k)) {
      porTema.set(k, { pt: f.pt, topicId: f.topicId, tema: f.tema, n: 0, cubiertos: 0, huecos: [] })
    }
    const t = porTema.get(k)
    t.n++
    if (f.cubierto || cubiertosExtra.has(claveArt(f))) t.cubiertos++
    else t.huecos.push(claveArt(f))
  }
  return [...porTema.values()].map((t) => ({ ...t, dispara: disparaFinding(t) }))
}

/** Temas que hoy disparan el finding, con sus huecos. */
function temasQueDisparan(filas, cubiertosExtra = new Set()) {
  return estadoPorTema(filas, cubiertosExtra).filter((t) => t.dispara)
}

/**
 * Artículos huérfanos ordenados por ALCANCE (nº de oposiciones distintas que los
 * escopan).
 *
 * ⚠️ **El badge a cero NO significa temario cubierto.** El detector exige ≥4
 * huecos, así que cubrir 1 de 4 ya lo apaga y deja **3 artículos sirviendo 0
 * preguntas**, ahora invisibles. Por eso:
 *   - `soloQueDisparan: true` (por defecto) = trabajo que MUEVE el badge.
 *   - `soloQueDisparan: false` = la deuda REAL de cobertura del temario, la que
 *     hay que mirar para no declarar victoria antes de tiempo.
 *
 * `demanda` (opcional, 26/07/2026) añade **a cuántos opositores llega** cada
 * artículo: el alcance (nº de oposiciones) dice en cuántos sitios sale, no cuánta
 * gente lo ve, y no son lo mismo. Medido ese día: dos leyes con el MISMO
 * rendimiento por artículo escrito estaban delante de 3.130 y 733 usuarios
 * respectivamente. No altera el orden —que sigue siendo por alcance— pero se
 * imprime al lado para que quien decide vea las dos cosas.
 *
 * `oposicion` (26/07/2026) acota el ranking a los huecos de UNA oposición, para la
 * estrategia de **cerrarla del todo** en vez de perseguir el badge por alcance.
 * Nació de medir el cruce hueco × demanda: las oposiciones con más opositores
 * tienen POCOS huecos (Auxiliar del Estado: 2.174 usuarios y 37 huecos) y las que
 * concentran el hueco tienen poca demanda (Tramitación Procesal: 529 huecos, 335
 * usuarios). Cerrar las primeras es barato y se nota; la cola larga no.
 * El alcance y los usuarios que se reportan siguen siendo los **globales**: cubrir
 * el artículo beneficia igual a las demás oposiciones, y ocultarlo haría parecer el
 * trabajo menos rentable de lo que es.
 *
 * @param {Array} filas
 * @param {{soloQueDisparan?:boolean, cubiertosExtra?:Set<string>, demanda?:Object<string,number>|Map<string,number>, oposicion?:string|null}} opts
 */
function rankingHuerfanos(filas, { soloQueDisparan = true, cubiertosExtra = new Set(), demanda, oposicion = null, incluirNoNumerados = false, tipos = null } = {}) {
  const dem = demanda instanceof Map ? demanda : new Map(Object.entries(demanda || {}))
  const temas = new Set(temasQueDisparan(filas, cubiertosExtra).map((t) => t.topicId))
  const tiposOk = tipos ? new Set(tipos) : null
  // Claves de artículo huérfanas EN esa oposición (si se acota).
  const deLaOposicion = oposicion
    ? new Set(filas.filter((f) => f.pt === oposicion && !f.cubierto && !cubiertosExtra.has(claveArt(f))).map(claveArt))
    : null
  const porArt = new Map()
  for (const f of filas) {
    if (f.cubierto || cubiertosExtra.has(claveArt(f))) continue
    if (soloQueDisparan && !temas.has(f.topicId)) continue
    if (deLaOposicion && !deLaOposicion.has(claveArt(f))) continue
    const nat = naturalezaArticulo(f.articulo)
    // Por defecto el ranking sigue mirando el mismo universo que el badge; ver la
    // deuda invisible es una petición EXPLÍCITA, para que nadie confunda las dos.
    if (!incluirNoNumerados && !nat.numerado) continue
    if (tiposOk && !tiposOk.has(nat.tipo)) continue
    const k = claveArt(f)
    if (!porArt.has(k)) {
      porArt.set(k, { leySlug: f.leySlug, ley: f.ley, articulo: f.articulo, tipo: nat.tipo, conNotaVigencia: !!f.conNotaVigencia, oposiciones: new Set(), temas: new Set() })
    }
    porArt.get(k).oposiciones.add(f.pt)
    porArt.get(k).temas.add(f.topicId)
  }
  return [...porArt.values()]
    .map((a) => ({
      leySlug: a.leySlug,
      ley: a.ley,
      articulo: a.articulo,
      tipo: a.tipo,
      conNotaVigencia: a.conNotaVigencia,
      nOposiciones: a.oposiciones.size,
      nTemas: a.temas.size,
      // Usuarios por OPOSICIÓN distinta: un opositor no cuenta dos veces porque
      // su oposición escope el artículo en dos temas.
      usuarios: [...a.oposiciones].reduce((n, pt) => n + (dem.get(pt) || 0), 0),
      oposiciones: [...a.oposiciones].sort(),
    }))
    .sort((x, y) => y.nOposiciones - x.nOposiciones || y.nTemas - x.nTemas || String(x.articulo).localeCompare(String(y.articulo), 'es', { numeric: true }))
}

/**
 * Impacto de cubrir un conjunto de artículos (`[{leySlug, articulo}]`), ANTES de
 * escribir una sola pregunta.
 */
function simulaCobertura(filas, articulos) {
  const extra = new Set(articulos.map((a) => `${a.leySlug}#${a.articulo}`))
  const antes = temasQueDisparan(filas)
  const despues = temasQueDisparan(filas, extra)
  const idsDespues = new Set(despues.map((t) => t.topicId))
  const opoAntes = new Set(antes.map((t) => t.pt))
  const opoDespues = new Set(despues.map((t) => t.pt))
  return {
    temasAntes: antes.length,
    temasDespues: despues.length,
    temasApagados: antes.filter((t) => !idsDespues.has(t.topicId)).map((t) => ({ pt: t.pt, tema: t.tema })),
    oposicionesAntes: opoAntes.size,
    oposicionesDespues: opoDespues.size,
    oposicionesLimpias: [...opoAntes].filter((p) => !opoDespues.has(p)).sort(),
    // Huérfanos que SIGUEN sin preguntas en los temas que dejan de disparar: el
    // finding se apaga pero el opositor sigue sin ver esos artículos. Se reporta
    // a propósito para que el lote no se cierre creyendo el tema cubierto.
    huerfanosResidualesEnTemasApagados: antes
      .filter((t) => !idsDespues.has(t.topicId))
      .flatMap((t) => t.huecos.filter((h) => !extra.has(h)))
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .sort(),
  }
}

/**
 * Propone el siguiente lote: **una sola ley** (regla del manual — scope estrecho)
 * y sus N artículos huérfanos de mayor alcance. La ley elegida es la del artículo
 * más transversal que quede sin cubrir.
 *
 * @param {Array} filas
 * @param {{maxArticulos?:number, excluirLeyes?:string[]}} opts
 */
function proponeLote(filas, { maxArticulos = 6, excluirLeyes = [], demanda, oposicion = null } = {}) {
  // Un artículo con NOTA DE VIGENCIA no se PROPONE automáticamente: puede tener un
  // inciso anulado por el TC o remitir a preceptos nulos, y generar sobre él enseñaría
  // Derecho inoperante. Sigue apareciendo en el ranking marcado 🚫 para que se decida a
  // mano. Nace del art. 87 ter de la LJCA (26/07/2026, T-151).
  const ranking = rankingHuerfanos(filas, { demanda, oposicion })
    .filter((a) => !excluirLeyes.includes(a.leySlug) && !a.conNotaVigencia)
  if (!ranking.length) return null
  const leySlug = ranking[0].leySlug
  const articulos = ranking.filter((a) => a.leySlug === leySlug).slice(0, maxArticulos)
  return {
    leySlug,
    ley: articulos[0].ley,
    articulos,
    impacto: simulaCobertura(filas, articulos),
  }
}

/**
 * Marca qué artículos del ranking pertenecen a una ley con **batch reciente de
 * otra sesión**.
 *
 * POR QUÉ (26/07/2026, colisión real): dos sesiones generaron sobre los MISMOS
 * cinco artículos de la LPRL con 13 minutos de diferencia y hubo que jubilar 9
 * preguntas por redundancia de fondo. El dedup del pipeline NO lo evita: compara
 * enunciados, y dos preguntas que evalúan lo mismo con otras palabras se le
 * escapan (solo las caza el Jaccard de la opción correcta, y para entonces el
 * lote ya está escrito). `--excluir` existía, pero exige saber de antemano qué
 * excluir: esto lo detecta.
 *
 * AVISA, NO DECIDE: no filtra el ranking. Continuar una ley que otra sesión dejó
 * a medias puede ser lo correcto; lo que no puede pasar es elegirla sin saberlo.
 *
 * @param {Array<{leySlug:string}>} ranking
 * @param {Iterable<string>} leyesEnCurso slugs con batch reciente
 */
function marcaEnCurso(ranking, leyesEnCurso) {
  const enCurso = leyesEnCurso instanceof Set ? leyesEnCurso : new Set(leyesEnCurso || [])
  return ranking.map((r) => ({ ...r, enCurso: enCurso.has(r.leySlug) }))
}

module.exports = {
  marcaEnCurso,
  UMBRALES,
  naturalezaArticulo,
  disparaFinding,
  estadoPorTema,
  temasQueDisparan,
  rankingHuerfanos,
  simulaCobertura,
  proponeLote,
}
