/**
 * Núcleo PURO — priorización de la campaña `article_no_coverage` (T-112).
 *
 * EL PROBLEMA QUE RESUELVE
 * ------------------------
 * El detector `article_no_coverage` emite UN hallazgo por oposición, así que el
 * badge dice "104 oposiciones" y se lee como "104 trabajos". No lo es: **una
 * pregunta cuelga del ARTÍCULO, y el artículo es una fila compartida** por todas
 * las oposiciones que lo escopan (modelo nuclear de CLAUDE.md). Generar
 * preguntas de un artículo lo repara en TODAS a la vez.
 *
 * Medido el 26/07/2026 sobre el banco vivo: 6.533 pares (artículo, tema) sobre
 * solo **3.075 artículos únicos** → factor de reuso 2,1×. Y el reparto es muy
 * desigual: la LPRL cerraba 19 temas con 6 artículos (3,17 temas por artículo)
 * mientras la media ronda 0,4. Elegir por corazonada cuesta 8× más trabajo para
 * el mismo resultado; de ahí este módulo.
 *
 * QUÉ ES "CERRAR" UN TEMA
 * -----------------------
 * El detector solo dispara con ≥4 artículos sin preguntas (`HUECOS_MIN`). Bajar
 * de ahí APAGA el hallazgo, pero dejar 3 huérfanos a propósito es maquillar el
 * badge, no arreglar el contenido. Por eso el ranking mide `temasACero`
 * (cobertura completa) y expone `temasBajoUmbral` aparte: el primero es trabajo
 * real, el segundo es el efecto sobre el panel. Nunca optimizar por el segundo.
 *
 * Puro a propósito (sin BD, sin red): el runner `scripts/cobertura-huerfanos.cjs`
 * pone los datos y esto decide. Así se puede testear con fixtures.
 */

// Umbrales del detector REAL. Espejo de `article_no_coverage` en
// `backend/src/content-health-sweep/content-health-sweep.service.ts` (el @Cron
// que escribe el badge) y su gemelo `scripts/health-sweep.cjs`. Si allí cambian
// y aquí no, este módulo priorizaría sobre un universo que ya no es el que se
// mide → el test `__tests__/lib/salud/coberturaHuerfanos.test.js` compara los
// tres a nivel de texto para que no puedan divergir en silencio.
const UMBRALES = {
  /** mínimo de artículos con contenido en el tema para que se evalúe */
  MIN_ARTS_TEMA: 4,
  /** cobertura mínima ya existente (si baja de aquí es `low_coverage`, otro kind) */
  COBERTURA_MIN: 0.6,
  /** huecos mínimos para que el tema dispare el hallazgo */
  HUECOS_MIN: 4,
}

/**
 * Agrupa los pares (artículo huérfano, tema) por tema.
 * @param {Array<{position_type:string, topic_id:string, topic_number?:number, article_id:string}>} pares
 * @returns {Map<string, {positionType:string, topicNumber:number|undefined, articulos:Set<string>}>}
 */
function agruparPorTema(pares) {
  const temas = new Map()
  for (const p of pares) {
    let t = temas.get(p.topic_id)
    if (!t) {
      t = { positionType: p.position_type, topicNumber: p.topic_number, articulos: new Set() }
      temas.set(p.topic_id, t)
    }
    t.articulos.add(p.article_id)
  }
  return temas
}

/**
 * Simula qué pasaría si se generasen preguntas para `cubiertos`.
 *
 * @param {Array} pares pares (artículo huérfano, tema) del universo actual.
 * @param {Iterable<string>} cubiertos article_ids que quedarían cubiertos.
 * @returns {{temasACero:number, temasBajoUmbral:number, findingsCerrados:number, articulos:number}}
 *   - temasACero        : temas sin NINGÚN artículo huérfano (arreglo real).
 *   - temasBajoUmbral   : temas que dejan de disparar el detector (efecto badge).
 *   - findingsCerrados  : oposiciones que pierden su hallazgo por completo.
 */
function simularCobertura(pares, cubiertos) {
  const set = cubiertos instanceof Set ? cubiertos : new Set(cubiertos)
  const temas = agruparPorTema(pares)
  // LÍNEA BASE: qué oposiciones disparan HOY. No vale contar sobre todas las
  // que aparecen en `pares`: una oposición cuyo tema ya está por debajo del
  // umbral no tiene hallazgo que cerrar, y contarla inflaría el resultado sin
  // que nadie lo notara (el número seguiría pareciendo razonable). En el runner
  // los pares vienen ya filtrados a temas que disparan, así que la línea base
  // coincide con el total — pero el módulo no puede depender de que quien lo
  // llame filtre bien.
  const oposicionesAntes = new Set()
  const oposicionesDespues = new Set()
  let temasACero = 0
  let temasBajoUmbral = 0

  for (const t of temas.values()) {
    if (t.articulos.size >= UMBRALES.HUECOS_MIN) oposicionesAntes.add(t.positionType)
    let restantes = 0
    for (const a of t.articulos) if (!set.has(a)) restantes++
    if (restantes === 0) temasACero++
    if (restantes < UMBRALES.HUECOS_MIN) temasBajoUmbral++
    else oposicionesDespues.add(t.positionType)
  }

  let findingsCerrados = 0
  for (const pt of oposicionesAntes) if (!oposicionesDespues.has(pt)) findingsCerrados++

  return { articulos: set.size, temasACero, temasBajoUmbral, findingsCerrados }
}

/**
 * Ranking de LEYES por rentabilidad: cuántos temas quedan a cero si se cubren
 * TODOS los artículos huérfanos de esa ley.
 *
 * Se rankea por ley (no por artículo suelto) porque es la unidad de trabajo
 * real: un batch se genera contra una ley, con su fuente oficial abierta y una
 * sola verificación contra el BOE. Partir el esfuerzo entre leyes multiplica el
 * coste fijo de verificación sin mejorar el resultado.
 *
 * SEGUNDA LENTE — `usuarios` (26/07/2026). El ratio dice cuánto cunde el
 * esfuerzo, pero no a cuánta gente llega. Son cosas distintas y se contradicen:
 * en la medición del 26/07, `RDL 5/2015` y `Ley 16/1985` empataban a ratio 1,0,
 * pero la primera estaba delante de ~3.000 opositores y la segunda de una
 * fracción. Ordenar solo por ratio manda a trabajar en huecos que no ve nadie.
 * Por eso `demandaPorOposicion` es opcional pero se recomienda pasarla: no
 * cambia el orden (que sigue siendo por rentabilidad), añade la columna para
 * que quien decide vea las dos cosas a la vez.
 *
 * TERCERA SEÑAL — `enCurso` (26/07/2026, a raíz de una colisión real). Con
 * varias sesiones a la vez, dos generaron sobre los MISMOS cinco artículos de la
 * LPRL con 13 minutos de diferencia: 9 preguntas nacieron redundantes y hubo que
 * jubilarlas. El dedup del pipeline no lo evita (compara enunciados, y ninguno
 * era idéntico al pie de la letra). Lo que lo evita es no elegir esa ley. Por eso
 * el ranking marca las leyes con batch reciente: **la coordinación no puede
 * depender de que alguien se acuerde de mirar**, igual que el guardarraíl de
 * push del backlog no depende de recordar el claim.
 *
 * @param {Array<{position_type:string, topic_id:string, article_id:string, law_key:string}>} pares
 * @param {Object<string,number>|Map<string,number>} [demandaPorOposicion] usuarios por `position_type`.
 * @param {Iterable<string>} [leyesEnCurso] `law_key`s con batch reciente de otra sesión.
 * @returns {Array<{ley:string, articulos:number, temasACero:number, temasBajoUmbral:number, findingsCerrados:number, ratio:number, usuarios:number, enCurso:boolean}>}
 *   ordenado por `ratio` (temas cerrados por artículo escrito) descendente.
 */
function rankearLeyes(pares, demandaPorOposicion, leyesEnCurso) {
  const enCurso = leyesEnCurso instanceof Set ? leyesEnCurso : new Set(leyesEnCurso || [])
  const dem =
    demandaPorOposicion instanceof Map
      ? demandaPorOposicion
      : new Map(Object.entries(demandaPorOposicion || {}))
  const porLey = new Map()
  const oposPorLey = new Map()
  for (const p of pares) {
    let s = porLey.get(p.law_key)
    if (!s) porLey.set(p.law_key, (s = new Set()))
    s.add(p.article_id)
    let o = oposPorLey.get(p.law_key)
    if (!o) oposPorLey.set(p.law_key, (o = new Set()))
    o.add(p.position_type)
  }

  const out = []
  for (const [ley, articulos] of porLey) {
    const sim = simularCobertura(pares, articulos)
    // Usuarios alcanzados: suma por OPOSICIÓN distinta, no por tema — un opositor
    // no cuenta dos veces porque su oposición tenga dos temas con el mismo hueco.
    let usuarios = 0
    for (const pt of oposPorLey.get(ley)) usuarios += dem.get(pt) || 0
    out.push({
      ley,
      articulos: articulos.size,
      temasACero: sim.temasACero,
      temasBajoUmbral: sim.temasBajoUmbral,
      findingsCerrados: sim.findingsCerrados,
      ratio: Number((sim.temasACero / articulos.size).toFixed(2)),
      usuarios,
      enCurso: enCurso.has(ley),
    })
  }
  // Desempate por temas cerrados: entre dos leyes igual de rentables, primero la
  // que cierra más (mismo coste fijo de verificación, más resultado).
  return out.sort((a, b) => b.ratio - a.ratio || b.temasACero - a.temasACero)
}

/**
 * Alcance de cada ARTÍCULO: en cuántos temas y oposiciones es huérfano. Sirve
 * para ordenar el trabajo DENTRO de un batch (empezar por el de más alcance) y
 * para justificar por qué un artículo aparentemente menor merece el esfuerzo.
 * @param {Array} pares
 * @returns {Array<{articleId:string, etiqueta:string|undefined, temas:number, oposiciones:number}>}
 */
function rankearArticulos(pares) {
  const porArt = new Map()
  for (const p of pares) {
    let a = porArt.get(p.article_id)
    if (!a) {
      a = { articleId: p.article_id, etiqueta: p.label, temas: new Set(), oposiciones: new Set() }
      porArt.set(p.article_id, a)
    }
    a.temas.add(p.topic_id)
    a.oposiciones.add(p.position_type)
  }
  return [...porArt.values()]
    .map((a) => ({ articleId: a.articleId, etiqueta: a.etiqueta, temas: a.temas.size, oposiciones: a.oposiciones.size }))
    .sort((x, y) => y.temas - x.temas || y.oposiciones - x.oposiciones)
}

module.exports = { UMBRALES, agruparPorTema, simularCobertura, rankearLeyes, rankearArticulos }
