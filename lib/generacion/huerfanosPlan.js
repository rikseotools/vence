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

/** ¿Dispara este tema el finding? @param {{n:number, cubiertos:number}} t */
function disparaFinding({ n, cubiertos }) {
  if (n < UMBRALES.minArticulos) return false
  if (cubiertos >= n) return false
  if (cubiertos / n < UMBRALES.minCobertura) return false
  return n - cubiertos >= UMBRALES.minHuecos
}

const claveArt = (f) => `${f.leySlug}#${f.articulo}`

/** Agrupa las filas por tema y evalúa el finding. `cubiertosExtra` = simulación. */
function estadoPorTema(filas, cubiertosExtra = new Set()) {
  const porTema = new Map()
  for (const f of filas) {
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
 * @param {Array} filas
 * @param {{soloQueDisparan?:boolean, cubiertosExtra?:Set<string>, demanda?:Object<string,number>|Map<string,number>}} opts
 */
function rankingHuerfanos(filas, { soloQueDisparan = true, cubiertosExtra = new Set(), demanda } = {}) {
  const dem = demanda instanceof Map ? demanda : new Map(Object.entries(demanda || {}))
  const temas = new Set(temasQueDisparan(filas, cubiertosExtra).map((t) => t.topicId))
  const porArt = new Map()
  for (const f of filas) {
    if (f.cubierto || cubiertosExtra.has(claveArt(f))) continue
    if (soloQueDisparan && !temas.has(f.topicId)) continue
    const k = claveArt(f)
    if (!porArt.has(k)) {
      porArt.set(k, { leySlug: f.leySlug, ley: f.ley, articulo: f.articulo, oposiciones: new Set(), temas: new Set() })
    }
    porArt.get(k).oposiciones.add(f.pt)
    porArt.get(k).temas.add(f.topicId)
  }
  return [...porArt.values()]
    .map((a) => ({
      leySlug: a.leySlug,
      ley: a.ley,
      articulo: a.articulo,
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
function proponeLote(filas, { maxArticulos = 6, excluirLeyes = [] } = {}) {
  const ranking = rankingHuerfanos(filas).filter((a) => !excluirLeyes.includes(a.leySlug))
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
  disparaFinding,
  estadoPorTema,
  temasQueDisparan,
  rankingHuerfanos,
  simulaCobertura,
  proponeLote,
}
