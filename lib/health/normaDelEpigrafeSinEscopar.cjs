/**
 * El epígrafe NOMBRA una norma que el banco TIENE con preguntas… y el tema no la escopa. (T-055)
 *
 * ## Por qué hace falta un detector nuevo, y no lo cubre ninguno de los que ya hay
 *
 * Caso real que lo motiva (30/07/2026): el **Tema 1 de Guardia Civil** se titula «Derechos Humanos»
 * y su epígrafe enumera **14 normas**; su `topic_scope` tenía **2**. Las otras —DUDH, CEDH, PIDESC,
 * PIDCP, Carta de DDFF de la UE, Convención y Protocolo contra la tortura— existían en el banco con
 * **859 preguntas activas, escritas y verificadas**, sirviéndose a **Policía Nacional**. El opositor
 * de Guardia Civil no practicaba ninguna.
 *
 * Ninguna vigilancia lo veía, y cada una por su motivo:
 *   · el detector de leyes huérfanas ([T-055]) busca leyes con scope **cero** — estas tienen scope,
 *     en OTRA oposición;
 *   · `empty_topic` / `low_coverage` miran si el tema tiene preguntas — este tenía 229;
 *   · `scope_titulo_huerfano` trabaja dentro de UNA ley (títulos con hueco), no entre normas;
 *   · el verificador epígrafe↔scope razona sobre la materia y da por bueno un scope «coherente».
 *
 * Es el hueco simétrico de la SOBRE-inclusión: allí el scope es más ancho que el epígrafe; aquí es
 * **más estrecho**, y el coste lo paga el opositor en forma de temas que no puede practicar.
 *
 * ## Criterio (determinista, sin IA)
 *
 * Se marca cuando: el epígrafe nombra la norma **por su nombre** ∧ la norma tiene preguntas activas
 * ∧ el tema NO la escopa. Nada de sinónimos ni de «parece que encaja»: si el programa no la nombra,
 * aquí no se opina — eso es criterio humano y va por el pipeline `verify:scope`.
 */

/** Palabras que no distinguen una norma de otra: aparecen en casi cualquier epígrafe. */
const VACIAS = new Set(['ley', 'real', 'decreto', 'orden', 'texto', 'refundido', 'organica', 'orgánica',
  'reglamento', 'directiva', 'sobre', 'para', 'contra', 'entre', 'como', 'otros', 'otras', 'demas', 'demás'])

const normaliza = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/** Palabras significativas de un nombre de norma (>3 letras y que aporten algo). */
function significativas(nombre) {
  return normaliza(nombre).split(/[^a-z0-9]+/).filter((w) => w.length > 3 && !VACIAS.has(w))
}

/**
 * ¿El epígrafe nombra esta norma?
 *
 * Exige **al menos 2 palabras significativas** y que estén TODAS. La razón es de precisión medida:
 * con una sola palabra, `CE` no tiene ninguna (no marcaría nunca, bien) pero `Ley 39/2015` casaría
 * con cualquier epígrafe que mencione «2015», y una bandeja con ruido se deja de mirar. Dos palabras
 * ya son una firma: «Pacto Internacional de Derechos Económicos, Sociales y Culturales» no aparece
 * por accidente.
 */
function epigrafeNombraLey(epigrafe, shortName, fullName, { minPalabras = 3 } = {}) {
  const epi = normaliza(epigrafe)
  if (!epi) return { nombra: false }
  for (const candidato of [fullName, shortName]) {
    const palabras = significativas(candidato)
    if (palabras.length >= minPalabras && palabras.every((w) => epi.includes(w))) return { nombra: true, por: candidato }
  }
  return { nombra: false }
}

/**
 * Severidad del hallazgo.
 *
 * `error` cuando la norma **ya se sirve en otra oposición**: eso prueba que el contenido es bueno y
 * está listo, así que el hueco no es una carencia de contenido sino un fallo de reparto — se arregla
 * con una fila de `topic_scope` y el opositor gana el tema entero. Es el caso de Guardia Civil T1.
 * `warn` cuando no se sirve en ninguna parte: puede ser contenido a medio construir, y ahí la
 * decisión no es tan automática.
 *
 * El umbral de preguntas existe para no llenar el panel con contenedores de 3 preguntas sueltas: por
 * debajo, escopar cuesta más que lo que aporta (la misma conclusión a la que llegó [T-055] con su
 * cola larga de 97 leyes de 1-4 preguntas).
 */
/**
 * ¿La oposición ya sirve un contenedor de la MISMA FAMILIA que el candidato?
 *
 * Sin esto el detector marca falsos positivos caros: una oposición que examina **Excel 2016** y lo
 * escopa correctamente saldría acusada de «no sirve Excel 365» porque su epígrafe nombra la hoja de
 * cálculo. Lo mismo con Word/LibreOffice y con los contenedores clínicos, que existen por comunidad
 * («Atención primaria y especializada» frente a su equivalente autonómico). La versión concreta que
 * examina cada convocatoria **se averigua, no se deduce** ([T-311]), así que el detector no puede
 * opinar sobre CUÁL debe servirse: solo debe callarse cuando ya se sirve una.
 *
 * Familia = comparten al menos UNA palabra distintiva del nombre corto («excel», «outlook»,
 * «writer»). Empezó exigiendo dos y no servía: medido el 30/07 sobre `auxiliar_administrativo_clm`,
 * los tres hallazgos del top eran versiones —el tema escopa `Excel 2019` y el detector le pedía
 * `Excel 365`— y la exclusión no disparaba porque «Excel 365» solo aporta una palabra («365» tiene
 * 3 letras y cae). Con productos, una palabra ES la familia; el riesgo de callar de más es menor que
 * el de mandar a alguien a «arreglar» un temario que estaba bien.
 */
function mismaFamiliaYaServida(candidata, yaServidas) {
  const pal = new Set(significativas(candidata))
  if (!pal.size) return false
  for (const s of yaServidas) {
    const comunes = significativas(s).filter((w) => pal.has(w))
    if (comunes.length >= 1) return { ley: s, comunes }
  }
  return false
}

function clasificar({ preguntasActivas, servidaEnOtraOposicion, minimo = 20 }) {
  if (!preguntasActivas || preguntasActivas < minimo) return null
  return servidaEnOtraOposicion ? 'error' : 'warn'
}

module.exports = { epigrafeNombraLey, clasificar, mismaFamiliaYaServida, significativas, VACIAS }
