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

module.exports = { comunidadesEn, ambiguasEn, esExcepcion, clasificar, ANCLAS, SIGLAS, SIGLAS_AMBIGUAS, NOMBRES }
