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


/**
 * UNIVERSO del detector `article_no_coverage`, en SQL y en JS — **la misma regla escrita una
 * sola vez**.
 *
 * Hasta el 29/07/2026 el detector filtraba `article_number ~ '^[0-9]+$'` (entero puro), así que
 * `bis`/`ter`/`quáter` eran invisibles: medido, **163 artículos de reforma escopados sirviendo
 * cero preguntas** que el badge no podía ver nunca. Se amplía a la familia de reforma y **solo a
 * ella**: las disposiciones (adicional/transitoria/final/derogatoria) son otras 503 y en su
 * mayoría no son materia de examen — meterlas inundaría el panel con trabajo que nadie va a
 * hacer, que es peor que no verlas.
 *
 * Impacto medido antes de aplicarlo (RDS, 29/07): 348 → **353 temas** y 6.242 → **6.363
 * artículos**. Un +1,4%: el badge sigue siendo legible.
 *
 * El backend (`content-health-sweep.service.ts`) NO puede importar de `lib/` —proyecto NestJS
 * aparte—, así que lo copia inline con su nota de sincronía y lo vigila
 * `__tests__/health/content-sweep-parity.test.ts`.
 */
const SQL_UNIVERSO_COBERTURA =
  "(a.article_number ~ '^[0-9]+$' OR a.article_number ~* '^[0-9]+ ?(bis|ter|qu[aá]ter|quinquies|sexies|septies|octies|nonies|decies)$')"

/**
 * Orden de los ejemplos del hallazgo. **No se puede castear a `int`**: en cuanto entra `6bis`,
 * `(a.article_number)::int` revienta la consulta entera con «invalid input syntax for integer».
 * Se ordena por el prefijo numérico y, a igualdad, por el texto — así `6` va antes que `6bis` y
 * ambos antes que `7`.
 */
const SQL_ORDEN_ARTICULO =
  "(substring(a.article_number from '^[0-9]+'))::int, a.article_number"

/** ¿Cuenta esta fila para el detector? Espejo EXACTO de `SQL_UNIVERSO_COBERTURA`. */
function cuentaParaCobertura(numero) {
  const nat = naturalezaArticulo(numero)
  return nat.numerado || nat.esReforma
}

/** ¿Dispara este tema el finding? @param {{n:number, cubiertos:number}} t */
function disparaFinding({ n, cubiertos }) {
  if (n < UMBRALES.minArticulos) return false
  if (cubiertos >= n) return false
  if (cubiertos / n < UMBRALES.minCobertura) return false
  return n - cubiertos >= UMBRALES.minHuecos
}

/**
 * Umbrales de `cobertura_banda_ciega` (T-543, 05/08/2026): la banda que ni
 * `article_no_coverage` (exige ≥60% cubierto) ni `low_coverage` (exige <6 preguntas
 * servidas) pueden ver — un tema con ≥4 huecos, cobertura de artículos <60% y, aun así,
 * ≥6 preguntas servidas.
 *
 * `minPreguntas` **no** es un umbral nuevo: es el mismo corte que `low_coverage` usa
 * para "cobertura fina" (<6), invertido — por debajo ya lo caza ese detector.
 *
 * `maxPreguntas` SÍ es nuevo y es la decisión de calibración. Medido contra RDS el
 * 05/08/2026: la banda sin acotar (`>=6 && <0.6 && >=4 huecos`) da **218 temas / 74
 * oposiciones**, pero la MEDIANA de preguntas servidas en esa banda es **92** y el p75 es
 * **293** — con cientos de preguntas un opositor tarda semanas en agotar el pool y no
 * "nota" el hueco (verificado a mano: un tema con 287 preguntas y 45% de cobertura de
 * artículos no es el mismo problema que uno con 20 y 23%, aunque el ratio de artículos
 * sea parecido). El dolor real —repetir preguntas dentro de la MISMA sesión de estudio—
 * empieza por debajo del preset de test más grande de la app (100, ver
 * `customQuestionCap` en `TestConfigurator.tsx`): con ≤50 preguntas servidas, un solo
 * test del preset "50" ya fuerza repetición o se queda corto. Con este corte quedan
 * **69 temas / 38 oposiciones** — la parte que de verdad se nota al estudiar, sin
 * inundar el badge con los 218 (la ficha de origen es explícita: "bajar el umbral y ya"
 * es como se mata un badge).
 */
const UMBRAL_BANDA_CIEGA = {
  minPreguntas: 6,
  maxPreguntas: 50,
}

/**
 * ¿Dispara este tema `cobertura_banda_ciega`? Mismo esqueleto que `disparaFinding`
 * (minArticulos/minHuecos) pero con la cobertura INVERTIDA (<60%, no ≥60%) y acotado
 * por volumen de preguntas servidas — ver `UMBRAL_BANDA_CIEGA`.
 *
 * @param {{n:number, cubiertos:number, preguntas:number}} t
 */
function disparaBandaCiega({ n, cubiertos, preguntas }) {
  if (n < UMBRALES.minArticulos) return false
  if (cubiertos >= n) return false
  if (n - cubiertos < UMBRALES.minHuecos) return false
  if (cubiertos / n >= UMBRALES.minCobertura) return false // eso ya lo ve article_no_coverage
  return preguntas >= UMBRAL_BANDA_CIEGA.minPreguntas && preguntas <= UMBRAL_BANDA_CIEGA.maxPreguntas
}

const claveArt = (f) => `${f.leySlug}#${f.articulo}`

/**
 * Agrupa las filas por tema y evalúa el finding. `cubiertosExtra` = simulación.
 *
 * ⚠️ **Fidelidad del espejo (T-146):** aquí se descarta lo que el detector NO ve, para que el
 * veredicto de "este tema dispara" coincida con el badge real; si no, el test de paridad
 * pasaría mintiendo (mismo código, universo distinto). Desde el 29/07 el universo incluye la
 * familia de **reforma** (`bis`/`ter`/`quáter`…), que antes era invisible, y sigue excluyendo
 * las **disposiciones**: ver `SQL_UNIVERSO_COBERTURA`. La deuda de lo excluido se mira con
 * `rankingHuerfanos({incluirNoNumerados:true})`, que es otra pregunta.
 * Las filas sin el campo (fixtures antiguos) se tratan como numeradas.
 */
function estadoPorTema(filas, cubiertosExtra = new Set()) {
  const porTema = new Map()
  for (const f of filas) {
    // El campo `numerado` viene del SQL del planificador; la naturaleza se recalcula del propio
    // número para no depender de que el llamador la traiga (fixtures antiguos incluidos).
    if (f.numerado === false && !cuentaParaCobertura(f.articulo)) continue
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
    // Por defecto el ranking mira el MISMO universo que el badge (numéricos + reforma); ver la
    // deuda que el detector sigue sin contar —disposiciones y demás— es una petición EXPLÍCITA,
    // para que nadie confunda "lo que hay que hacer" con "lo que además existe".
    if (!incluirNoNumerados && !cuentaParaCobertura(f.articulo)) continue
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

/**
 * ¿El ranking debe enseñar la DEUDA completa (`soloQueDisparan:false`) o solo lo que
 * mueve el badge? (T-543, 05/08/2026)
 *
 * `--oposicion` pregunta **"¿qué le falta a ESTE tema?"**, no "¿qué mueve el badge
 * global?" — son preguntas distintas y hasta ahora compartían la misma acotación. Un
 * tema de la banda ciega (huecos reales, pero no dispara NINGÚN finding porque su
 * cobertura es <60% Y tiene demasiadas preguntas servidas para `cobertura_banda_ciega`,
 * o al revés) salía invisible con `--oposicion sin --deuda`, aunque la propia
 * herramienta diga en su cabecera "cerrar UNA oposición". Por eso, si se pide una
 * oposición concreta, la deuda completa es el comportamiento por defecto; `--deuda`
 * sigue existiendo para pedirla sin acotar a ninguna oposición.
 *
 * @param {{deudaPedida?:boolean, oposicion?:string|null}} opts
 */
function usarDeudaCompleta({ deudaPedida = false, oposicion = null } = {}) {
  return !!deudaPedida || !!oposicion
}

module.exports = {
  marcaEnCurso,
  UMBRALES,
  UMBRAL_BANDA_CIEGA,
  naturalezaArticulo,
  disparaFinding,
  disparaBandaCiega,
  cuentaParaCobertura,
  SQL_UNIVERSO_COBERTURA,
  SQL_ORDEN_ARTICULO,
  estadoPorTema,
  temasQueDisparan,
  rankingHuerfanos,
  simulaCobertura,
  proponeLote,
  usarDeudaCompleta,
}
