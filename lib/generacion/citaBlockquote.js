/**
 * ¿La CITA del blockquote es literal del artículo?
 *
 * Modo de fallo (26/07/2026, batch `gen_lbrl_bis_20260726`): la explicación abre
 * un blockquote **entre comillas**, que el opositor lee como transcripción de la
 * ley, y dentro se ha colado una palabra que el precepto no dice en esa frase. El
 * caso real: el art. 116 bis.3 de la LBRL usa «La Diputación **provincial** o
 * entidad equivalente **asistirá**…» en su primera frase y «La Diputación o
 * entidad equivalente **propondrá y coordinará**…» en la segunda; la cita mezcló
 * ambas y presentó como literal un «La Diputación provincial o entidad
 * equivalente propondrá y coordinará» que la ley no contiene.
 *
 * Por qué merece un check propio: **es el único defecto de esta familia que se
 * puede comprobar mecánicamente**. Los demás (glosa que describe el artículo en
 * vez de la opción, opción que trunca una condición) exigen criterio; este es una
 * comparación de subcadena. Lo cazó una auditoría ciega, y una auditoría cuesta
 * minutos y tokens: si la máquina puede, que lo haga la máquina.
 *
 * OJO — no confundir con `citaTruncada.js`, que resuelve el problema INVERSO: allí
 * la cita SÍ es literal pero está cortada antes de la cláusula que la condiciona.
 * Aquí la cita no es literal en absoluto.
 */
const { norm } = require('./citaTruncada')

/**
 * Quita la puntuación (un punto perdido en el import no es un falseo de cita) y
 * UNIFICA TODAS LAS COMILLAS por punto de código.
 *
 * Lo segundo salió de calibrar el check sobre el propio banco: el art. 87 bis.3 de
 * la LJCA entrecomilla el «Boletín Oficial del Estado» con comillas tipográficas
 * dobles (U+201C/U+201D) y la cita usaba angulares (U+00AB/U+00BB). Mismo texto,
 * distinto glifo → falso positivo. Un check de literalidad que no tolera el estilo
 * de comilla acaba ignorándose, que es la peor forma de morir para un gate.
 */
const COMILLAS = /[\u00AB\u00BB\u201C\u201D\u2018\u2019\u0022\u0027]/g
const sinPuntuacion = (t) => norm(t).replace(COMILLAS, '').replace(/[.,;:]/g, '')

/**
 * Extrae los fragmentos entrecomillados de los blockquotes de la explicación.
 * Una cita puede saltar de un apartado a otro con puntos suspensivos: cada tramo
 * se devuelve por separado, porque solo los tramos son contiguos en la ley.
 *
 * LA ELIPSIS TAMBIÉN SE ESCRIBE ENTRE PARÉNTESIS, y hay que comérselos con ella. El manual de
 * generación sanciona las DOS formas («usar puntos suspensivos / paréntesis para señalar elipsis
 * explícita»), pero al trocear solo por `…`/`...` los paréntesis se quedaban pegados al tramo
 * —«…también especiales (» / «): 1.º Si carecen…»— y ningún tramo era ya subcadena del artículo.
 * Medido el 08/08/2026 al insertar el lote de Mecánico-Conductor T10: **3 de 22 preguntas en rojo,
 * las 3 correctas**, y de las 3 una era justamente la que se había reparado ANTES para cumplir la
 * convención. Un gate que castiga seguir el manual es un gate que enseña a saltárselo.
 */
function fragmentosCitados(explicacion) {
  const texto = String(explicacion || '')
  const bloques = texto
    .split('\n')
    .filter((l) => l.trimStart().startsWith('>'))
    .map((l) => l.replace(/^\s*>\s?/, ''))
    .join('\n')
  const entrecomillados = [...bloques.matchAll(/"([\s\S]*?)"/g)].map((m) => m[1])
  return entrecomillados
    .flatMap((c) => c.split(/\s*\(?\s*(?:…|\.\.\.)\s*\)?\s*/))
    .map((f) => f.trim())
    .filter(Boolean)
}

/**
 * @param {string} explicacion
 * @param {string} contenidoArticulo
 * @param {{minLongitud?:number}} opts fragmentos más cortos se ignoran: una cita de
 *   tres palabras no prueba nada y dispara ruido.
 * @returns {{literal:boolean, comprobados:number, divergencias:Array<{fragmento:string}>}}
 */
function analizaCitaBlockquote(explicacion, contenidoArticulo, { minLongitud = 25 } = {}) {
  const art = sinPuntuacion(contenidoArticulo)
  const frags = fragmentosCitados(explicacion).filter((f) => f.length >= minLongitud)
  const divergencias = []
  for (const f of frags) {
    if (!art.includes(sinPuntuacion(f))) divergencias.push({ fragmento: f })
  }
  return { literal: divergencias.length === 0, comprobados: frags.length, divergencias }
}

module.exports = { analizaCitaBlockquote, fragmentosCitados, sinPuntuacion }
