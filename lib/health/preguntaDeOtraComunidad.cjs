/**
 * lib/health/preguntaDeOtraComunidad.cjs — ¿esta pregunta EXAMINA normativa de una comunidad
 * autónoma distinta de la que estudia el opositor? (T-732, 08/08/2026)
 *
 * ## POR QUÉ EXISTE
 *
 * Alba España (premium, TCAE de Madrid) impugnó tres veces el mismo día. Una de ellas:
 * *«ESTOY ESTUDIANDO COMUNIDAD DE MADRID NO DE VALENCIA»*. Al medir aparecieron **388 preguntas
 * activas** de normativa autonómica colgadas de artículos que escopan diez o más oposiciones —
 * contenedores compartidos sin ningún filtro por comunidad. La peor pregunta por la *Constitución
 * Federal andaluza* la reciben **116 oposiciones**.
 *
 * Duele más de lo que parece porque **la respuesta correcta cambia según la comunidad** (los
 * residuos citostáticos son rojos en Andalucía y azules en la referencia nacional). No es temario
 * de más: es una clave falsa para su examen.
 *
 * ## LAS DOS TRAMPAS QUE ESTE FICHERO EXISTE PARA EVITAR
 *
 * Las dos se pagaron midiendo a mano el 08/08, y las dos dan números que parecen buenos:
 *
 * **1. `SAS` casa dentro de «ca·sas», «ta·sas», «ma·sas».** Con el patrón mal acotado salieron
 * 2.493 casos de los que **2.341 eran falsos**. Por eso las SIGLAS se buscan respetando
 * mayúsculas y con límite de palabra a los DOS lados, y los NOMBRES de comunidad aparte. Nunca en
 * el mismo patrón: las siglas necesitan mayúsculas y los nombres no.
 *
 * **2. MENCIONAR una comunidad no es EXAMINARLA**, y esto es lo que decide si el arreglo se puede
 * automatizar (no se puede). *«Según la Ley General de Sanidad, las áreas de salud extenderán…»*
 * es una pregunta NACIONAL y correcta cuya explicación cita a Canarias como excepción. La señal
 * que las separa es **dónde** aparece la comunidad: lo que define qué se pregunta es el
 * ENUNCIADO (y la opción correcta), no la explicación.
 *
 * ## QUÉ NO HACE
 *
 * No decide sola: marca candidatos para que una persona los lea. Y **nunca propone desactivar**:
 * cada una de estas preguntas es legítima para SU comunidad (la de Abucasis es correcta para
 * Valencia), así que la salida es moverlas, no borrarlas.
 */

/** Siglas de servicios de salud → comunidad. Se buscan CASE-SENSITIVE (ver trampa 1). */
const SIGLAS = {
  SAS: 'Andalucía',
  SERGAS: 'Galicia',
  SESCAM: 'Castilla-La Mancha',
  SACYL: 'Castilla y León',
  SESPA: 'Asturias',
  IBSALUT: 'Illes Balears',
  SCS: 'Canarias',
  ICS: 'Cataluña',
  Osakidetza: 'País Vasco',
  Abucasis: 'Comunitat Valenciana',
  Diraya: 'Andalucía',
  Jimena: 'Andalucía',
  IANUS: 'Galicia',
  SELENE: 'Región de Murcia',
}

/**
 * Siglas AMBIGUAS: significan cosas distintas según la comunidad y **no deciden por sí solas**.
 * `SMS` es a la vez *Servicio Madrileño de Salud* y *Servicio Murciano de Salud* — midiendo el
 * 08/08, dos preguntas del presupuesto del Servicio **Madrileño** salieron marcadas como ajenas a
 * Madrid, que es exactamente lo contrario de la verdad.
 */
const SIGLAS_AMBIGUAS = { SMS: ['Comunidad de Madrid', 'Región de Murcia'] }

/**
 * Nombres de comunidad → forma canónica. Se buscan sin distinguir mayúsculas.
 *
 * ⚠️ **Los GENTILICIOS son imprescindibles, no un extra.** El caso que abrió esta ficha —
 * *«¿Dónde y en qué año se redactó la Constitución Federal **andaluza**?»*, servida a 116
 * oposiciones— no dice «Andalucía» en ninguna parte. Buscando solo el nombre de la comunidad, la
 * pregunta más flagrante de las 388 se clasificaba como «limpia».
 */
const NOMBRES = [
  [/\bAndaluc[ií]a\b|\bandaluz(a|as|es)?\b/i, 'Andalucía'],
  [/\bComunidad Valenciana\b|\bComunitat Valenciana\b|\bGeneralitat Valenciana\b|\bvalenciana?s?\b/i, 'Comunitat Valenciana'],
  [/\bCatalu[ñn]a\b|\bCatalunya\b|\bcatalana?s?\b/i, 'Cataluña'],
  [/\bGalicia\b|\bgallega?s?\b/i, 'Galicia'],
  [/\bPa[ií]s Vasco\b|\bEuskadi\b|\bvasca?s?\b/i, 'País Vasco'],
  [/\bCanarias\b|\bcanarias?\b/i, 'Canarias'],
  [/\bRegi[oó]n de Murcia\b|\bmurciana?s?\b/i, 'Región de Murcia'],
  [/\bExtremadura\b|\bextreme[ñn]a?s?\b/i, 'Extremadura'],
  [/\bArag[oó]n\b|\baragonesa?s?\b/i, 'Aragón'],
  [/\bAsturias\b|\basturiana?s?\b/i, 'Asturias'],
  [/\bCantabria\b|\bc[áa]ntabra?s?\b/i, 'Cantabria'],
  [/\bNavarra\b|\bnavarra?s?\b/i, 'Navarra'],
  [/\bIlles Balears\b|\bIslas Baleares\b|\bbalear(es)?\b/i, 'Illes Balears'],
  [/\bCastilla-La Mancha\b|\bCastilla la Mancha\b|\bmanchega?s?\b/i, 'Castilla-La Mancha'],
  [/\bCastilla y Le[oó]n\b|\bcastellanoleonesa?s?\b/i, 'Castilla y León'],
  [/\bLa Rioja\b|\briojana?s?\b/i, 'La Rioja'],
  [/\bComunidad de Madrid\b|\bSERMAS\b|\bmadrile[ñn]a?s?\b/i, 'Comunidad de Madrid'],
]

/** Comunidades citadas en un texto, con la evidencia que las delata. */
function comunidadesEn(texto) {
  const t = String(texto || '')
  const out = new Map()

  for (const [sigla, ccaa] of Object.entries(SIGLAS)) {
    // Límite de palabra a los DOS lados y sin bajar a minúsculas: es lo que evita «ca·sas».
    if (new RegExp(`\\b${sigla}\\b`).test(t)) out.set(ccaa, sigla)
  }
  for (const [re, ccaa] of NOMBRES) {
    const m = t.match(re)
    if (m && !out.has(ccaa)) out.set(ccaa, m[0])
  }
  return [...out].map(([comunidad, evidencia]) => ({ comunidad, evidencia }))
}

/**
 * ¿La comunidad aparece como EXCEPCIÓN de una regla nacional?
 *
 * Calibrando contra `tcae_sermas_madrid` el 08/08 salió este falso positivo: *«Como regla general
 * y con las excepciones de Baleares, Canarias, Ceuta y Melilla, el área de salud extenderá…»*. Es
 * una pregunta **nacional y correcta** (lo dice la Ley General de Sanidad), y estaba en el
 * ENUNCIADO, así que el criterio de «enunciado = examen» la marcaba como defecto.
 *
 * La señal es la palabra que introduce la lista: quien dice «salvo Canarias» no está examinando
 * Canarias, está describiendo el alcance de una norma estatal.
 */
function esExcepcion(texto, evidencia) {
  const t = String(texto || '')
  const i = t.indexOf(evidencia)
  if (i < 0) return false
  // Ventana corta hacia atrás: «con las excepciones de Baleares, Canarias…» cabe de sobra, y no
  // tanto como para capturar un «excepto» de otra frase.
  return /\b(excepci[oó]n|excepciones|excepto|salvo)\b/i.test(t.slice(Math.max(0, i - 70), i))
}

/**
 * ¿La pregunta se examina sobre una norma ESTATAL, citando la comunidad como caso o ejemplo?
 *
 * Calibrando la cola completa el 08/08 salió el falso positivo más numeroso, y es el que habría
 * mandado a reescribir preguntas perfectas: *«el Príncipe heredero tendrá la dignidad de Príncipe
 * de **Asturias**»* (art. 57 CE), *«¿cuántos senadores corresponden a **Extremadura**?»* (art. 69
 * CE), *«¿cuáles son las Comunidades Autónomas históricas?»*. Son materia **nacional**: la
 * comunidad aparece porque la Constitución la nombra, no porque se examine su normativa.
 *
 * ⚠️ La trampa dentro de la trampa: *«¿Dónde se redactó la **Constitución Federal andaluza**?»*
 * también contiene la palabra «Constitución» y **sí es un defecto**. Por eso no basta buscar
 * «Constitución»: hay que reconocer la ESTATAL (Española, de 1978, «la CE», «artículo N de la
 * Constitución»), y esa nunca lleva un gentilicio pegado.
 */
/**
 * Normas ESTATALES del temario común. Si la pregunta se examina sobre una de ellas, la comunidad
 * que aparezca es un EJEMPLO del supuesto, no la materia.
 *
 * Leyendo la cabecera de la cola el 08/08, las tres primeras no oficiales eran falsos positivos y
 * las tres por esto: *«obtiene un puesto en la Junta de Andalucía»* (art. 88 EBEP), *«Universidades
 * privadas de la Comunidad de Madrid»* (art. 2 Ley 39/2015), *«el archipiélago balear y canario»*
 * (art. 3 LBRL). En las tres, la respuesta es la misma en cualquier comunidad.
 */
const NORMAS_ESTATALES = [
  /\bEstatuto B[áa]sico del Empleado P[úu]blico\b|\bEBEP\b|\bRDL?\s*5\/2015\b|\bReal Decreto Legislativo 5\/2015\b/i,
  /\bLey\s*39\/2015\b/i,
  /\bLey\s*40\/2015\b/i,
  /\bLey\s*7\/1985\b|\bLBRL\b|\bBases del R[ée]gimen Local\b/i,
  /\bLey\s*14\/1986\b|\bLey General de Sanidad\b/i,
  /\bLey\s*41\/2002\b/i,
  /\bLey\s*55\/2003\b|\bEstatuto Marco\b/i,
  /\bLey\s*31\/1995\b|\bPrevenci[óo]n de Riesgos Laborales\b/i,
  /\bLey\s*9\/2017\b|\bContratos del Sector P[úu]blico\b/i,
  /\bLey\s*19\/2013\b/i,
  /\bLO\s*3\/2018\b|\bLey Org[áa]nica 3\/2018\b/i,
  /\bLO\s*3\/2007\b|\bLey Org[áa]nica 3\/2007\b/i,
  /\bEstatuto de los Trabajadores\b/i,
]

function materiaEstatal(texto) {
  const t = String(texto || '')
  // La norma examinada manda sobre la comunidad citada: si es estatal, la comunidad es el ejemplo.
  if (NORMAS_ESTATALES.some((re) => re.test(t))) return true
  // «Príncipe/Princesa de Asturias» es un TÍTULO de la Corona, no la comunidad — y aparece mucho
  // (cuatro casos en la cabecera de la cola). Lo mismo el Estatuto de Autonomía citado desde la CE.
  if (/\b(Pr[íi]ncipe|Princesa)\s+de\s+Asturias\b/i.test(t)) return true
  return /\bConstituci[óo]n Española\b/i.test(t)
    || /\bConstituci[óo]n de 1978\b/i.test(t)
    || /\bart[íi]culo\s+\d+[\d.]*\s+(de la\s+)?(Constituci[óo]n|CE)\b/i.test(t)
    || /\bart\.?\s*\d+[\d.]*\s+CE\b/.test(t)
    || /\bComunidades Aut[óo]nomas hist[óo]ricas\b/i.test(t)
}

/**
 * ¿El texto cita una norma AUTONÓMICA? (reglamento/decreto/ley «de <comunidad>», o el nombre de
 * un gobierno autonómico). Es lo que convierte una explicación en la prueba de que la clave no es
 * estatal — y por tanto de que el enunciado tenía que haberlo dicho.
 */
function normaAutonomicaEn(texto) {
  const t = String(texto || '')
  if (materiaEstatal(t)) return false
  return /\b(Reglamento|Decreto|Ley|Orden|Resoluci[óo]n)\b[^.]{0,60}\bde\s+(Andaluc[íi]a|Catalu[ñn]a|Galicia|Extremadura|Arag[óo]n|Cantabria|Navarra|Canarias|Asturias)\b/i.test(t)
    || /\b(Junta de Andaluc[íi]a|Generalitat|Xunta|Gobierno Vasco|Junta de Castilla|Principado de Asturias|Comunidad de Madrid|Govern)\b/i.test(t)
    || /\bnormativa (auton[óo]mica|de la comunidad)\b/i.test(t)
}

/** Siglas ambiguas presentes: obligan a leer, nunca deciden. */
function ambiguasEn(texto) {
  const t = String(texto || '')
  return Object.entries(SIGLAS_AMBIGUAS)
    .filter(([sigla]) => new RegExp(`\\b${sigla}\\b`).test(t))
    .map(([sigla, posibles]) => ({ sigla, posibles }))
}

/**
 * ¿Qué le pasa a esta pregunta respecto a la comunidad del opositor?
 *
 * @param {object} p
 * @param {string} p.questionText   enunciado
 * @param {string} [p.correcta]     texto de la opción correcta
 * @param {string} [p.explanation]  explicación
 * @param {string} [p.comunidad]    comunidad de la oposición que la sirve (forma canónica)
 * @returns {{veredicto: 'examina_otra'|'menciona'|'propia'|'ambigua'|'limpia', comunidades: string[], motivo: string}}
 *
 * `examina_otra` = **defecto**: la comunidad ajena está en el enunciado o en la respuesta correcta,
 * o sea que es el objeto de examen.
 * `menciona` = la comunidad solo sale en la explicación → casi siempre correcta (cita incidental,
 * una excepción, un ejemplo). No es defecto por sí sola.
 */
function clasificar({ questionText, correcta, explanation, comunidad } = {}) {
  const enunciado = `${questionText || ''} ${correcta || ''}`
  const todo = `${enunciado} ${explanation || ''}`

  const enEnunciado = comunidadesEn(enunciado)
  const enTodo = comunidadesEn(todo)

  if (enTodo.length === 0) {
    const amb = ambiguasEn(todo)
    return amb.length
      ? { veredicto: 'ambigua', comunidades: [], motivo: `«${amb[0].sigla}» puede ser ${amb[0].posibles.join(' o ')}: hay que leerla` }
      : { veredicto: 'limpia', comunidades: [], motivo: 'no nombra ninguna comunidad' }
  }

  // Si la pregunta se examina sobre la Constitución u otra norma estatal, la comunidad es un caso
  // citado por esa norma, no la materia. Se decide ANTES que nada: es el falso positivo más
  // numeroso de la cola.
  if (materiaEstatal(todo)) {
    return {
      veredicto: 'menciona',
      comunidades: enTodo.map((x) => x.comunidad),
      motivo: 'se examina sobre norma estatal (la Constitución nombra a esa comunidad): materia nacional',
    }
  }

  const ajenasEnunciado = enEnunciado
    .filter((x) => x.comunidad !== comunidad)
    // Una comunidad citada como excepción de una regla estatal no es el objeto de examen.
    .filter((x) => !esExcepcion(enunciado, x.evidencia))
  if (ajenasEnunciado.length) {
    return {
      veredicto: 'examina_otra',
      comunidades: ajenasEnunciado.map((x) => x.comunidad),
      motivo: `el enunciado examina normativa de ${ajenasEnunciado.map((x) => x.comunidad).join(', ')} (por «${ajenasEnunciado[0].evidencia}»)`,
    }
  }

  if (enEnunciado.length) {
    return { veredicto: 'propia', comunidades: enEnunciado.map((x) => x.comunidad), motivo: 'examina la comunidad de la propia oposición' }
  }

  const ajenas = enTodo.filter((x) => x.comunidad !== comunidad)

  // ⚠️ EL CASO QUE DE VERDAD DUELE, y es el CONTRARIO del que parece.
  //
  // Si el enunciado NO nombra comunidad pero la explicación revela que la norma examinada es
  // autonómica, el opositor no tiene forma de saber que esa clave no es la suya. Es el caso que
  // provocó la impugnación de Alba: «Los residuos sanitarios citostáticos se recogerán:» con clave
  // ROJO, que es lo que dice el Reglamento de Residuos de Andalucía — mientras la referencia
  // nacional es azul. Sin el aviso en el enunciado, quien estudia en Madrid aprende mal.
  //
  // Las que SÍ nombran su comunidad (`examina_otra`) son ruido: molestan, pero no engañan.
  if (ajenas.length && enEnunciado.length === 0 && normaAutonomicaEn(explanation)) {
    return {
      veredicto: 'clave_autonomica_oculta',
      comunidades: ajenas.map((x) => x.comunidad),
      motivo: `el enunciado no dice de qué comunidad habla y la norma examinada es de ${ajenas.map((x) => x.comunidad).join(', ')}: la clave puede ser falsa para quien la recibe`,
    }
  }

  return ajenas.length
    ? {
      veredicto: 'menciona',
      comunidades: ajenas.map((x) => x.comunidad),
      motivo: `solo la explicación cita ${ajenas.map((x) => x.comunidad).join(', ')}: suele ser una excepción o un ejemplo, no el objeto de examen`,
    }
    : { veredicto: 'propia', comunidades: enTodo.map((x) => x.comunidad), motivo: 'solo cita su propia comunidad' }
}

/**
 * ANCLAS de calibración [T-718]: preguntas REALES del banco, leídas a mano el 08/08/2026 sobre
 * `tcae_sermas_madrid` (comunidad de referencia: Comunidad de Madrid).
 *
 * Los negativos son la mitad que salva: los tres primeros son preguntas **nacionales y correctas**
 * que la primera versión del criterio marcaba como defecto. Si alguien ensancha el patrón para
 * cazar más, saltan ellos antes de que la cifra llegue a ninguna parte.
 */
const ANCLAS = {
  positivos: [
    {
      id: '2f71a89e',
      porque: 'examina la «Constitución Federal andaluza» y la reciben 116 oposiciones; además solo dice el GENTILICIO, nunca «Andalucía»',
    },
    {
      id: '5596cd87',
      porque: 'examina el comité de ética de Castilla-La Mancha, servido a Madrid',
    },
    {
      id: 'b784d904',
      porque: 'la respuesta correcta es Abucasis II, herramienta de la Comunitat Valenciana: correcta allí, falsa para Madrid',
    },
  ],
  negativos: [
    {
      id: '97206eb8',
      porque: 'Ley General de Sanidad: cita Baleares y Canarias como EXCEPCIÓN del alcance estatal, no las examina',
    },
    {
      id: '198098a9',
      porque: 'pregunta de la Constitución que nombra el País Vasco de pasada: es nacional',
    },
    {
      id: '97703642',
      porque: 'presupuesto del Servicio Madrileño de Salud (SMS): es de SU comunidad — la sigla SMS también significa Servicio Murciano, y por eso no puede decidir sola',
    },
  ],
}

module.exports = { comunidadesEn, ambiguasEn, esExcepcion, materiaEstatal, normaAutonomicaEn, clasificar, ANCLAS, SIGLAS, SIGLAS_AMBIGUAS, NOMBRES }
