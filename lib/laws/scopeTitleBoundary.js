// lib/laws/scopeTitleBoundary.js
//
// Detecta el OFF-BY-ONE DE FRONTERA DE TÍTULO en topic_scope: un artículo
// escopado que pertenece a un título que el epígrafe NO nombra.
//
// Punto ciego real (24/07/2026, LOSU Tema 6 Téc. Aux. Univ. Murcia, caso Mario):
// el epígrafe nombraba "Título I, Título II, Título IX Cap I" pero el scope tenía
// art.1 (Título Preliminar) y art.6 (Título III). Lo introdujo el PROPIO
// verify:scope al razonar por RANGO contiguo ("Título I+II = arts 1-6") en vez de
// por pertenencia real a cada título (I+II = arts 2-5); cogió un artículo de más
// en cada frontera. Ni el detector de sobre-inclusión (`scopeOverInclusion`, busca
// "casi la ley ENTERA") ni los de huecos lo ven: el scope es ajustado y sirve
// preguntas → parece sano. Solo lo caza mapear CADA artículo a su título.
//
// DETERMINISTA. Necesita la estructura título→rango de la ley (de
// `parseBoeSections` sobre el índice del BOE). Solo APLICA cuando el epígrafe
// ENUMERA títulos explícitos ("Título I", "Título IX"); si es prosa descriptiva
// sin títulos → no aplica (eso es scopeOverInclusion).
//
// CommonJS puro (como parseBoeSections.js) → lo usan a la vez el test, el runner
// `scripts/scope/sim-title-boundary.ts` y `scripts/health-sweep.cjs`, SIN mirror
// que se desincronice. Fijado por __tests__/lib/laws/scopeTitleBoundary.test.ts.

// Matcher ley↔epígrafe COMPARTIDO (lib/laws/lawNameMatch.cjs): se usa para ATAR cada
// referencia de título a la ley que la nombra (ver `titlesForLaw`). Antes vivía dentro de
// scripts/audit-epigrafe-scope.cjs y no era reutilizable (T-129).
const { nameReferenced, extractLawRefs, norm } = require('./lawNameMatch.cjs')

const ROMAN = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }

/** "IX" → 9. null si no es romano válido. */
function romanToInt(s) {
  s = String(s || '').toUpperCase().replace(/\.BIS$/, '')
  let n = 0
  for (let i = 0; i < s.length; i++) {
    const cur = ROMAN[s[i]]
    const nxt = ROMAN[s[i + 1]]
    if (cur == null) return null
    n += nxt && cur < nxt ? -cur : cur
  }
  return s.length ? n : null
}

/** num de sección de parseBoeSections ('Preliminar'|'I'|'IV'…) → entero (0=Preliminar). */
function seccionNumToInt(num) {
  if (num == null) return null
  if (/prelim/i.test(String(num))) return 0
  return romanToInt(num)
}

// Tokens de contenido (≥6 letras, sin stopwords largas) para cotejar la RÚBRICA de
// un título contra el epígrafe. SIN stemming a propósito: "funciones" (epígrafe,
// Título I LOSU) NO debe casar con "función docente" (rúbrica Título III) — si
// stemizáramos, enmascararíamos el overflow real del art.6. Match exacto tras
// normalizar acentos/mayúsculas.
const STOP_RUBRICA = new Set(['sobre', 'entre', 'desde', 'hasta', 'contra', 'segun', 'entrada', 'mediante'])
function sigTokens(s) {
  return (String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').match(/[a-z0-9ñ]+/g) || [])
    .filter((w) => w.length >= 6 && !STOP_RUBRICA.has(w))
}

/**
 * ¿El epígrafe nombra un título por su MATERIA (rúbrica)? Exime del overflow los
 * títulos que el epígrafe cita por nombre aunque NO por número (caso CE Título VIII
 * "De la Organización Territorial del Estado" en un epígrafe que dice justo eso).
 * Conservador: exige ≥2 tokens de contenido compartidos Y que cubran ≥50% de la
 * rúbrica (un solo token común, p.ej. "estado", no basta para eximir).
 *
 * TERCERA CONDICIÓN — una FRASE compartida, no palabras sueltas (26/07/2026). El solape
 * de bolsa de palabras se dispara solo en las leyes cuyas rúbricas comparten plantilla, y
 * ahí exime lo que no debe. Medido en el CP de `guardia_civil` T8, cuyo epígrafe NO
 * menciona ni Hacienda ni la seguridad colectiva:
 *   "De los delitos contra la Hacienda Pública y contra la Seguridad Social" → 3/5 = 60% → eximía
 *   "De los delitos contra la seguridad colectiva"                          → 2/3 = 67% → eximía
 * Bastaba con que el epígrafe dijera "delitos", "medidas de seguridad" y "Administración
 * Pública" en cualquier parte. Y esto NO es un falso positivo cualquiera: la exención es lo
 * que SILENCIA el overflow, así que cada exención de más es sobre-inclusión real que el
 * detector se traga — un falso NEGATIVO, de los que no se ven.
 *
 * "Nombrar un título por su materia" significa que la materia aparece como FRASE, así que
 * se exige que ≥2 tokens significativos consecutivos de la rúbrica aparezcan también
 * consecutivos en el epígrafe. Cubre el caso para el que nació la exención (CE Título VIII
 * "De la Organización Territorial del Estado") y tolera que la rúbrica lleve una cola que
 * el epígrafe no repite: "Instituciones de autogobierno **de la Comunidad**" se exime
 * porque el epígrafe dice "Instituciones de autogobierno".
 *
 * ⚠️ INTENTO DESCARTADO, y lo cazó la medición: exigir el ÚLTIMO token significativo de la
 * rúbrica. Corta bien la plantilla del CP, pero rompe justo ese caso —
 * `auxiliar_administrativo_diputacion_leon` T4, Estatuto de CyL Título II — porque la cola
 * "de la Comunidad" no está en el epígrafe (que dice "Comunidades"), y marcaba 19 artículos
 * que el epígrafe SÍ pide. No volver a ello.
 *
 * ⚠️ LÍMITE CONOCIDO: "Delitos contra la Administración de Justicia" sigue eximiéndose en un
 * epígrafe que solo nombra "Delitos contra la Administración Pública", porque comparten la
 * frase entera menos el sustantivo final. Es un falso NEGATIVO que se queda; distinguirlo
 * por parecido de cadenas no es fiable y este detector es de recall alto con adjudicación
 * humana detrás.
 */
function epigrafeNamesRubrica(epigrafe, rubrica) {
  const seq = sigTokens(rubrica)
  const rt = [...new Set(seq)]
  if (rt.length < 2) return false
  const et = new Set(sigTokens(epigrafe))
  const shared = rt.filter((w) => et.has(w))
  if (shared.length < 2 || shared.length / rt.length < 0.5) return false
  // ¿alguna pareja consecutiva de la rúbrica aparece también consecutiva en el epígrafe?
  const eSeq = sigTokens(epigrafe)
  for (let i = 0; i + 1 < seq.length; i++) {
    for (let j = 0; j + 1 < eSeq.length; j++) {
      if (eSeq[j] === seq[i] && eSeq[j + 1] === seq[i + 1]) return true
    }
  }
  return false
}

/**
 * Menciones de TÍTULO en el epígrafe, con su POSICIÓN y los títulos que abarcan.
 * @param {string} texto
 * @returns {{idx:number, values:number[]}[]}
 *
 * UN SOLO TOKENIZADOR (26/07/2026). Antes había DOS regex distintas leyendo lo mismo:
 * la de `epigrafeTitles` y otra dentro de `titlesForLaw`. Arreglé el soporte de plurales en
 * la primera y el detector siguió igual, porque cuando se pasa la ley manda la segunda:
 * `guardia_civil` T7 seguía con `permitidos:[0]` y marcaba el Libro I entero del Código
 * Civil. Es la misma trampa que hoy se documentó para los dos parsers del índice del BOE
 * (`parseBoeSections` y `mapaBloquesPorArticulo`): dos lectores del mismo texto, el arreglo
 * en uno solo. Ahora las dos funciones llaman aquí.
 *
 * Numerales romanos case-SENSITIVE a propósito: con flag `i`, "[IVXLC]+" casaría palabras
 * normales tras "título " ("Título civil" → c,i,v,i,l están todas en el set).
 */
function titulosMencionados(texto) {
  const out = []
  // El lookahead `(?![A-Za-z…])` NO es cosmético: sin él, "Título III, Capítulo II" leía la
  // **C** de "Capítulo" como el romano 100 y añadía un título 100 inexistente a los
  // permitidos. Lo encontré al revisar la lista de cambios de la propia medición, no en los
  // tests. Cada romano tiene que acabar donde acaba la palabra.
  const ROM = '[IVXLC]+(?![A-Za-zÁÉÍÓÚÑáéíóúñ])'
  // El grupo `(?:\([^)]*\))?` deja SALTAR un paréntesis dentro de la enumeración. Los
  // epígrafes gallegos lo usan para acotar: "títulos preliminar, I, II (capítulos I, II y XI),
  // VII y VIII". Sin él, la lista se cortaba en el II y los Títulos VII y VIII salían como
  // fuera de programa siendo pedidos. El contenido del paréntesis NO se lee como títulos
  // (se limpia antes de extraer los romanos): son capítulos, y el detector razona por título.
  const re = new RegExp(
    `(?:[Tt][íi]tulos?|T[ÍI]TULOS?)\\s+((?:del\\s+|DEL\\s+)?(?:${ROM}|[Pp]reliminar|PRELIMINAR)` +
    `(?:\\s*(?:\\([^)]*\\))?\\s*(?:,|y|e|al|a|AL|A|-|–)\\s*${ROM})*)`, 'g')
  let m
  while ((m = re.exec(String(texto || ''))) !== null) {
    const bruto = m[1].replace(/^(?:del|DEL)\s+/, '')
    const cola = bruto.replace(/\([^)]*\)/g, ' ')
    // "preliminar" NO puede cortar la lista: "títulos preliminar, I, II, III, IV y V" son
    // SEIS títulos. Antes se devolvía solo [0] y los cinco romanos siguientes se perdían, así
    // que el detector daba por fuera de programa los Títulos I-V de la Ley 39/2015 en cinco
    // oposiciones — 50 artículos por scope, todos falsos positivos. Bug propio, cazado al
    // adjudicar los "hallazgos" que había producido.
    const prelim = /prelim/i.test(cola)
    const nums = [...cola.matchAll(/[IVXLC]+(?![A-Za-zÁÉÍÓÚÑáéíóúñ])/g)].map((x) => romanToInt(x[0])).filter((v) => v != null)
    if (prelim && !nums.length) { out.push({ idx: m.index, values: [0] }); continue }
    if (!nums.length) continue
    if (prelim) out.push({ idx: m.index, values: [0] })
    // ¿RANGO ("del I al XII", "I a V") o ENUMERACIÓN ("I, II y III")? Solo el rango expande.
    const esRango = nums.length === 2 && /\s(?:al|a|AL|A|-|–)\s/.test(cola)
    if (esRango && nums[1] > nums[0] && nums[1] - nums[0] <= 30) {
      const vals = []
      for (let v = nums[0]; v <= nums[1]; v++) vals.push(v)
      out.push({ idx: m.index, values: vals })
    } else out.push({ idx: m.index, values: nums })
  }
  return out
}

/** Títulos NOMBRADOS explícitamente en el epígrafe → enteros únicos (0=Preliminar). */
function epigrafeTitles(epigrafe) {
  const out = new Set()
  const texto = epigrafe || ''
  // Numerales romanos: case-SENSITIVE a propósito. Con flag `i`, "[IVXLC]+" casaría
  // palabras normales tras "título " ("Título civil" → c,i,v,i,l son todas del set) y
  // metería títulos fantasma en la lista de permitidos.
  //
  // PLURALES, RANGOS Y ENUMERACIONES (26/07/2026). El patrón solo veía "Título <romano>" en
  // singular, y eso deja DOS agujeros que producen falsos positivos sobre bloques enteros
  // correctamente escopados:
  //   · el plural no casaba EN ABSOLUTO ("Títulos" = "Título"+"s", así que `\s+` fallaba)
  //     → "Títulos I, II y III" devolvía CERO títulos permitidos;
  //   · el rango en palabras tampoco → `guardia_civil` T7 dice "LIBRO I. De las Personas.
  //     TÍTULOS del I al XII" y el detector daba por fuera de programa TODO el Libro I.
  // Medido en el banco: 16 epígrafes de 3.707 usan alguna forma plural (2 con "del X al Y",
  // 7 con "X a Y", 6 con enumeración "X, Y y Z"). Poco frecuente, pero cuando pasa el falso
  // positivo no es de un artículo: es del bloque completo.
  for (const men of titulosMencionados(texto)) men.values.forEach((v) => out.add(v))
  // "Preliminar" SÍ va case-insensitive: los boletines lo escriben de las tres formas
  // ("Título Preliminar", "Título preliminar", "TÍTULO PRELIMINAR") y no colisiona con
  // nada. FALSO POSITIVO REAL que arregla (25/07): Técnico Auxiliar UMU T1, cuyo epígrafe
  // oficial dice "Título preliminar. Título I…" en minúscula → el detector no lo veía,
  // daba los arts 1-9 de la CE por fuera de programa y marcaba un overflow inexistente.
  if (/(?:t[íi]tulo)\s+preliminar/i.test(texto)) out.add(0)
  return [...out].sort((a, b) => a - b)
}

// Normas SIN número que los epígrafes citan por nombre (las numeradas las saca
// `extractLawRefs`). Sirven para detectar que junto a un título se nombra OTRA ley.
// ⚠️ `\b` tras "constitución" es IMPRESCINDIBLE: sin él, "Tribunal **Constitucional**" y
// "reforma **constitucional**" —que aparecen en casi todos los epígrafes de la CE junto a sus
// propios títulos— se leían como "otra norma" y el título se descartaba. Lo cazó la medición
// controlada (al Título IX de la CE le faltaba el permiso en 4 oposiciones).
//
// LOS CÓDIGOS CITADOS POR NOMBRE también son menciones de norma (26/07/2026). Sin ellos,
// una norma que el epígrafe NO nombra con número queda INVISIBLE, sus títulos se leen como
// "genéricos" y —esto es lo grave— **los genéricos se conceden a TODAS las leyes del tema**.
// Caso real, `guardia_civil` T9: el epígrafe abre con *"Real Decreto de 14 de septiembre de
// 1882, aprobatorio de la Ley de Enjuiciamiento Criminal"* (sin nº que la regex pueda ver),
// así que los diez títulos de la LECrim se volvían genéricos y la LOPJ heredaba
// `permitidos:[1,2,3,4,5,6,8]` cuando su temario solo le da Libro I Tít. IV y Libro VII
// Tít. I-III. Resultado: 130 artículos fuera de programa (466 preguntas) que el detector NO
// podía ver, y encima informaba `bound:true`, o sea "he atribuido bien".
// Se listan solo códigos que los temarios citan por nombre de forma inequívoca. NO se añade
// "Real Decreto de <fecha>": esa mención no casa con el `short_name` de ninguna ley, así que
// pasaría a dueño desconocido y el detector se callaría (fail-safe, pero perdiendo la señal).
const NORMAS_SIN_NUMERO = /constituci[óo]n\b|estatuto\s+de\s+autonom[íi]a|texto\s+refundido|carta\s+de\s+derechos|\btratado\b|ley\s+de\s+enjuiciamiento\s+(?:criminal|civil)|c[óo]digo\s+(?:penal|civil|de\s+comercio)|estatuto\s+de\s+los\s+trabajadores/i

// Menciones de NORMA en el epígrafe, con su posición: numeradas ("Ley 39/2015", "LO 3/2007")
// y sin número ("Constitución", "Estatuto de Autonomía"). Ordenadas por aparición.
function mencionesNorma(texto) {
  const out = []
  const reNum = /\b(?:ley\s+org[áa]nica|ley|l\.?o\.?|r\.?d\.?l\.?|real\s+decreto[\s-]?ley|real\s+decreto|r\.?d\.?|decreto|reglamento(?:\s*\(ue\))?)\s+(?:n[ºo.]?\s*)?(\d+\/\d{4})/gi
  let m
  while ((m = reNum.exec(texto)) !== null) out.push({ idx: m.index, ref: m[1], etiqueta: m[0] })
  const reNom = new RegExp(NORMAS_SIN_NUMERO.source, 'gi')
  while ((m = reNom.exec(texto)) !== null) out.push({ idx: m.index, ref: null, etiqueta: m[0] })
  return out.sort((a, b) => a.idx - b.idx)
}

/**
 * Títulos que el epígrafe permite PARA ESTA LEY (T-129).
 *
 * El problema que resuelve: `epigrafeTitles` devuelve todos los títulos del texto sin saber a
 * qué ley pertenecen, y `classifyTitleBoundary` los aplicaba a CADA ley del tema. Caso real
 * (`auxiliar_administrativo_ayuntamiento_marbella` T5): el epígrafe dice "(Constitución,
 * Título VIII)" y el detector aplicaba `permitidos:[8]` al **Estatuto de Autonomía de
 * Andalucía**, marcando 239 de sus 252 artículos como fuera de programa.
 *
 * MODELO: **cada título pertenece a la ÚLTIMA norma mencionada antes de él.** Así se escriben
 * estos epígrafes ("Ley X: Título A, Título B. Ley Y: Título C"), y es lo que hace falta para
 * repartir bien un tema multi-ley. Si antes del título no se nombra ninguna norma, es genérico
 * y vale para la ley que se está clasificando (no se empeora el comportamiento previo).
 * Si TODOS los títulos resultan de otra norma → `bound:false` ⇒ el detector NO opina (fail-safe:
 * mejor callarse que marcar la ley entera).
 *
 * ⚠️ DOS intentos anteriores fallaron y la medición controlada los cazó; no volver a ellos:
 *   1. Trocear por PARÉNTESIS: en la mayoría de epígrafes el paréntesis lleva el NÚMERO del
 *      título ("de los derechos fundamentales (título I)"), no una cláusula de ley → se perdía
 *      el "Título Preliminar" escrito fuera y reaparecían los falsos positivos de T-121.
 *   2. VENTANA de ±90 caracteres: se cuela en la cláusula de la ley siguiente → en
 *      `administrativo_gva` T10 descartaba el Título II de la LO 3/2007 porque a 90 caracteres
 *      aparecía "La Ley 9/2003, de la Generalitat".
 *
 * Sin `law` (llamada legacy) se comporta como antes: todos los títulos del epígrafe.
 */
function titlesForLaw(epigrafe, law) {
  const todos = epigrafeTitles(epigrafe)
  if (!law || (!law.shortName && !law.name)) return { titles: todos, bound: true }
  const texto = String(epigrafe || '')
  if (!todos.length) return { titles: [], bound: true }

  const idLey = `${law.shortName || ''} ${law.name || ''}`
  const refsLey = extractLawRefs(idLey)
  const normLey = norm(idLey)
  const normas = mencionesNorma(texto)

  const propios = new Set()
  let descartados = 0
  for (const men of titulosMencionados(texto)) {
    // Última norma mencionada ANTES de este título.
    let dueno = null
    for (const n of normas) { if (n.idx < men.idx) dueno = n; else break }
    if (!dueno) { men.values.forEach((v) => propios.add(v)); continue }   // sin norma previa → genérico
    const esEsta = dueno.ref ? refsLey.has(dueno.ref) : normLey.includes(norm(dueno.etiqueta))
    if (esEsta) men.values.forEach((v) => propios.add(v))
    else descartados++
  }
  if (!propios.size && descartados) return { titles: [], bound: false }
  return propios.size ? { titles: [...propios].sort((a, b) => a - b), bound: true } : { titles: todos, bound: true }
}

/**
 * @param {string} epigrafe        texto literal del epígrafe del tema
 * @param {{num:string,from:number,to:number}[]} secciones  estructura título→rango (parseBoeSections)
 * @param {(string|number)[]} scopedArticles  article_numbers de la entrada de topic_scope
 * @param {{shortName?:string,name?:string}} [law]  ley que se está clasificando (T-129: ata los
 *        títulos del epígrafe a SU ley; sin este dato se mantiene el comportamiento anterior)
 * @returns {{applicable:boolean, allowedTitles:number[], overflow:{article:number,titulo:string}[], unmapped:number[]}}
 */
function classifyTitleBoundary(epigrafe, secciones, scopedArticles, law) {
  const { titles: allowedTitles, bound } = titlesForLaw(epigrafe, law)
  // El epígrafe solo cualificaba títulos de OTRA ley → no hay nada que afirmar sobre esta.
  if (!bound) return { applicable: false, allowedTitles: [], overflow: [], unmapped: [] }
  if (!allowedTitles.length) return { applicable: false, allowedTitles: [], overflow: [], unmapped: [] }

  const overflow = []
  const unmapped = []
  for (const raw of scopedArticles || []) {
    // Solo artículos numéricos puros ("6"); "6.bis"/"DA1"/… fuera de v1.
    const a = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
    if (!Number.isInteger(a) || String(raw).trim() !== String(a)) continue

    const sec = (secciones || []).find((s) => a >= s.from && a <= s.to)
    if (!sec) { unmapped.push(a); continue } // sin estructura → NO se marca (fail-safe)
    const tInt = seccionNumToInt(sec.num)
    if (tInt == null) continue
    if (allowedTitles.includes(tInt)) continue                       // el epígrafe lo nombra por NÚMERO
    if (sec.rubrica && epigrafeNamesRubrica(epigrafe, sec.rubrica)) continue // …o por MATERIA (rúbrica)
    overflow.push({ article: a, titulo: sec.num })
  }
  return { applicable: true, allowedTitles, overflow, unmapped }
}

/**
 * ¿Significa ALGO el resultado de una barrida? (T-121, 26/07/2026)
 *
 * El runner `scripts/scope/sim-title-boundary.ts` imprimía "✅ Sin overflow" en tres
 * situaciones indistinguibles entre sí: banco sano, `position_type` con un typo (0 temas),
 * y —la peligrosa— índices del BOE que no se pudieron descargar, porque el fallo se tragaba
 * con `catch { continue }`. En una barrida bank-wide eso significa que si el BOE limita el
 * ritmo a mitad, las oposiciones restantes salen "limpias" y el informe es falso pero
 * precioso. Un verde solo vale si de verdad se evaluó algo y no se perdió nada por el camino.
 *
 * Núcleo puro para poder testear esa decisión; el runner solo imprime lo que diga esto.
 *
 * @param {{temas:number, evaluados:number, fetchFail:number, flagged:number}} c
 * @returns {{veredicto:'sin_temas'|'nada_evaluado'|'incompleto'|'limpio'|'con_hallazgos',
 *            concluyente:boolean, exitCode:number}}
 *   `concluyente:false` = el resultado NO permite afirmar nada sobre la salud del scope.
 */
function resumenBarrida({ temas = 0, evaluados = 0, fetchFail = 0, flagged = 0 } = {}) {
  if (!temas) return { veredicto: 'sin_temas', concluyente: false, exitCode: 3 }
  if (!evaluados) return { veredicto: 'nada_evaluado', concluyente: false, exitCode: 3 }
  // Con hallazgos el resultado ya es accionable aunque falte cobertura: lo encontrado
  // es real. Sin hallazgos y con huecos, el "limpio" no se puede afirmar.
  if (fetchFail && !flagged) return { veredicto: 'incompleto', concluyente: false, exitCode: 4 }
  return flagged
    ? { veredicto: 'con_hallazgos', concluyente: true, exitCode: 0 }
    : { veredicto: 'limpio', concluyente: true, exitCode: 0 }
}

module.exports = { classifyTitleBoundary, titulosMencionados, seccionNumToInt, epigrafeTitles, titlesForLaw, romanToInt, epigrafeNamesRubrica, resumenBarrida }
