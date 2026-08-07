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

/**
 * num de sección de parseBoeSections ('Preliminar'|'I'|'IV'…) → entero (0=Preliminar).
 *
 * T-333 (06/08/2026): Sección/Subsección numeran en ARÁBIGO ("Sección 1", "Sección 2"), no en
 * romano como Título/Capítulo — confirmado contra la API real del BOE (ver
 * `parseSeccionesSubsecciones` en lib/laws/parseBoeSections.js). Sin esta rama, `romanToInt('1')`
 * devuelve `null` (ninguna cifra arábiga es un carácter romano válido) y el bucle de
 * `classifyTitleBoundary` hacía `continue` en la línea `if (tInt == null) continue` — el
 * artículo se saltaba en SILENCIO, sin overflow y sin figurar en `unmapped`: exactamente el
 * mismo "verde que no vio nada" que esta ficha vino a arreglar, pero un nivel más abajo.
 */
function seccionNumToInt(num) {
  if (num == null) return null
  if (/prelim/i.test(String(num))) return 0
  if (/^\d+$/.test(String(num))) return Number.parseInt(num, 10)
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

// Prefijo ESTRUCTURAL ("Capítulo II.", "Título III.") que antepone `law_sections.title`
// (T-223, 06/08/2026) — la rúbrica del BOE en vivo (`rubricaVigente`) llega YA limpia, sin él,
// así que quitarlo es un no-op para ese llamador y una corrección real para el otro. Sin
// limpiarlo, "capitulo"/"titulo" cuenta como TOKEN de materia y contamina el match en las dos
// direcciones: infla `rt` con una palabra que el epígrafe nunca repite (nunca ayuda) y, en
// rúbricas de una sola palabra real ("Capítulo III. Organización"), el par ['capitulo',
// 'organizacion'] nunca alcanza el examen de abajo aunque "organización" esté LITERAL en el
// epígrafe — es la causa exacta del caso raíz de T-223 (Decreto 53/1989 Cap. III, ver
// __tests__/lib/laws/scopeTitleBoundary.test.ts).
const RE_PREFIJO_SECCION = /^\s*(?:cap[íi]tulo|t[íi]tulo|libro|parte|secci[óo]n)\s+(?:preliminar|[ivxlcdm]+|[a-záéíóúñ]+)\.?\s*[-.:]?\s*/i
function limpiaRubrica(r) {
  return String(r || '').replace(RE_PREFIJO_SECCION, '').trim()
}

// Umbral de longitud para una rúbrica que se reduce a UNA sola palabra de materia (T-223).
// Más alto que el general (6) a propósito: con una sola palabra no hay "frase compartida" que
// exigir (la prueba fuerte de más abajo), así que la única defensa contra falsos positivos es
// que la palabra sea lo bastante RARA para no aparecer por casualidad. Calibrado en
// `scripts/scope/sim-rubrica-solo.cjs` contra el banco real antes de habilitarlo en badge.
const MIN_TOKEN_SOLO = 8

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
 *
 * ── RÚBRICA DE UNA SOLA PALABRA DE MATERIA (T-223, 06/08/2026) ──────────────────────────────
 * La prueba de arriba (≥2 tokens compartidos) exige que la rúbrica tenga AL MENOS 2 palabras
 * significativas — así lo fija a propósito el test «un solo token compartido nunca exime».
 * Pero muchos capítulos se nombran con UNA sola palabra de materia ("Capítulo III.
 * Organización", caso raíz T-223: Decreto 53/1989 EAP Murcia, epígrafe "…funciones y
 * organización del Equipo…") y ahí la rúbrica misma, tras `limpiaRubrica`, solo tiene un
 * token — nunca puede llegar a 2 compartidos, así que quedaba SIEMPRE fuera aunque el epígrafe
 * la nombrara LITERAL. No es el mismo caso que el test de arriba (ahí la rúbrica SÍ tiene ≥2
 * tokens propios y solo 1 coincide; aquí la rúbrica en sí no tiene más que uno).
 * Sin la "frase compartida" como prueba (no hay frase con una sola palabra), la única defensa
 * es la RAREZA: token largo (`MIN_TOKEN_SOLO`, más exigente que el general) y que aparezca tal
 * cual en el epígrafe. Precisión calibrada bank-wide en `scripts/scope/sim-rubrica-solo.cjs`
 * antes de usarse como señal de badge — igual que el resto de bandas HIGH de este detector.
 */
function epigrafeNamesRubrica(epigrafe, rubrica) {
  const seq = sigTokens(limpiaRubrica(rubrica))
  const rt = [...new Set(seq)]
  const et = new Set(sigTokens(epigrafe))
  if (rt.length === 1) {
    const [token] = rt
    return token.length >= MIN_TOKEN_SOLO && et.has(token)
  }
  if (rt.length < 2) return false
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
  // T-223 (06/08/2026): antes, sin NINGÚN "Título N"/"Capítulo N" nombrado por NÚMERO, el
  // detector se callaba entero — aunque el epígrafe nombrara secciones concretas por su
  // RÚBRICA ("funciones y organización", sin decir "Capítulo II/III"). Caso raíz: Decreto
  // 53/1989 EAP Murcia T9 (feedback de Luisa), donde `allowedTitles` sale vacío porque el
  // epígrafe no dice "Capítulo" en ningún sitio, y aun así SÍ nombra dos capítulos por su
  // materia. Basta con que UNA sección case por rúbrica para que merezca la pena mirar: el
  // bucle de abajo YA sabe eximir por rúbrica caso a caso (línea de `epigrafeNamesRubrica`
  // unas líneas más abajo) — lo único que faltaba era no cortar ANTES de intentarlo.
  const porRubrica = (secciones || []).some((s) => s.rubrica && epigrafeNamesRubrica(epigrafe, s.rubrica))
  if (!allowedTitles.length && !porRubrica) return { applicable: false, allowedTitles: [], overflow: [], unmapped: [] }

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
 * `classifyTitleBoundary`, pero SOLO por RÚBRICA — nunca por número. (T-467, 07/08/2026)
 *
 * ## Por qué hace falta una función APARTE, no un flag en `classifyTitleBoundary`
 *
 * `allowedTitles` sale de `titlesForLaw`/`epigrafeTitles`, que buscan la palabra literal
 * "Título" en el epígrafe — NUNCA "Capítulo". Eso es intencional cuando `secciones` son
 * TÍTULOS (el nivel que el epígrafe sí numera así en prosa). Pero un CAPÍTULO reutiliza la
 * MISMA numeración romana que un título ("Capítulo II" y "Título II" son ambos `num:'II'`), y
 * los rangos de artículos de un capítulo NO tienen nada que ver con los de la mención "Título
 * N" que dio ese número — son dos ejes de numeración distintos que **comparten el alfabeto**.
 *
 * Medido en directo (LO 3/2018, Título III "Derechos de las personas", Capítulo I=art.11,
 * Capítulo II=arts.12-18): el epígrafe dice *"Título II. Principios… Título III. Derechos de
 * las personas."* — `allowedTitles=[2,3]` por las menciones de TÍTULO. Pasar los capítulos de
 * Título III a `classifyTitleBoundary` compara sus `.num` (I=1, II=2) contra ese `[2,3]`:
 * Capítulo II se exime **por casualidad numérica** (su "2" coincide con "Título II", que no
 * tiene NADA que ver con él) y Capítulo I sale como overflow **cuando en realidad el epígrafe
 * ya concede el Título III entero por número** — el capítulo nunca debió mirarse aislado.
 * Aislar por título padre (agrupar los capítulos de CADA título por separado) no basta: el
 * `allowedTitles` sigue viniendo de TODO el epígrafe, así que la colisión numérica persiste
 * aunque los rangos ya no se mezclen entre títulos.
 *
 * La única exención que tiene sentido para un capítulo es la MATERIA: si el epígrafe lo nombra
 * por su rúbrica ("Encargado del tratamiento y Delegado de protección de datos" = Cap. II+III),
 * se libra; si no, es overflow. Nunca por su número romano, que no significa nada fuera de su
 * propio título.
 *
 * @param {string} epigrafe
 * @param {{num:string,from:number,to:number,rubrica?:string}[]} capitulos  SOLO los capítulos de
 *        UN título (ver `gruposCapituloPorTitulo` en el runner) — no de la ley entera
 * @param {(string|number)[]} scopedArticles
 * @returns {{applicable:boolean, overflow:{article:number,titulo:string}[]}}
 */
function classifyByRubricaOnly(epigrafe, capitulos, scopedArticles) {
  const porRubrica = (capitulos || []).some((c) => c.rubrica && epigrafeNamesRubrica(epigrafe, c.rubrica))
  if (!porRubrica) return { applicable: false, overflow: [] }

  const overflow = []
  for (const raw of scopedArticles || []) {
    const a = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
    if (!Number.isInteger(a) || String(raw).trim() !== String(a)) continue
    const sec = (capitulos || []).find((c) => a >= c.from && a <= c.to)
    if (!sec) continue // no pertenece a NINGÚN capítulo de este título → no es asunto de esta llamada
    if (sec.rubrica && epigrafeNamesRubrica(epigrafe, sec.rubrica)) continue
    overflow.push({ article: a, titulo: sec.num })
  }
  return { applicable: true, overflow }
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

/**
 * Decide el veredicto final cuando `classifyTitleBoundary` se corrió en VARIOS niveles
 * estructurales de la misma ley (T-333, 06/08/2026: título/capítulo solo ven el epígrafe que
 * nombra TÍTULOS; cuando nombra secciones o subsecciones, esos niveles se callan enteros aunque
 * el epígrafe discrimine perfectamente un peldaño más abajo — caso real: Ley 9/2017 Tema 22,
 * cuyo Título Preliminar entero (arts. 1-27) queda "sin overflow" porque a nivel TÍTULO no hay
 * nada que discriminar, y el problema real —el epígrafe nombra 4 de las 5 secciones, dejando la
 * Sección 2.ª «Negocios y contratos excluidos» fuera— solo se ve a nivel SECCIÓN).
 *
 * Regla: preferir el nivel MÁS FINO que muestre overflow REAL — es la evidencia de que el
 * epígrafe SÍ discrimina dentro de ese nivel, que es justo lo que un nivel más grueso no podía
 * ver. Si ningún nivel muestra overflow, quedarse con el primero que sea `applicable` (para
 * poder afirmar "sin overflow" con fundamento, no por no haber mirado). Si ninguno es
 * `applicable`, no hay nada que afirmar — fail-safe, igual que el resto de este módulo.
 *
 * @param {{tipo:string, resultado:{applicable:boolean, overflow:object[]}}[]} porNivel
 *   de MÁS FINO a MÁS GRUESO (p.ej. subsección, sección, capítulo, título).
 * @returns {{tipo:string, resultado:object}|null}
 */
function resolverNivelDecisivo(porNivel) {
  for (const p of porNivel || []) {
    if (p.resultado.applicable && p.resultado.overflow.length) return p
  }
  const limpio = (porNivel || []).find((p) => p.resultado.applicable)
  return limpio || null
}

// `mencionesNorma` y `extractLawRefs` se exportan para que la atribución «cada sección
// pertenece a la ÚLTIMA norma mencionada antes de ella» (T-129) tenga UN solo modelo. La usa
// también `epigrafeEnumeraSecciones` ([T-528]): al escribirla sin ella reprodujo exactamente el
// fallo que T-129 arregló aquí — atribuyó los libros de la LECrim a la Ley 4/2015 porque los dos
// viven en el mismo epígrafe de guardia_civil.
module.exports = { classifyTitleBoundary, classifyByRubricaOnly, titulosMencionados, seccionNumToInt, epigrafeTitles, titlesForLaw, romanToInt, epigrafeNamesRubrica, resumenBarrida, mencionesNorma, extractLawRefs, resolverNivelDecisivo }
