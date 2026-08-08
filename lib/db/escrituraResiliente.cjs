// lib/db/escrituraResiliente.cjs — aislamiento por-fila al escribir hallazgos del barrido
// de salud (T-405, 08/08/2026).
//
// Vive en `lib/db/` y NO en `lib/health/` a propósito: no es un detector de calidad de
// contenido que necesite calibrarse contra datos reales (como sus vecinos de `lib/health/`,
// con su propio guardarraíl de "anclas" — T-718). Es infraestructura de ESCRITURA, del mismo
// tipo que `lib/db/filasAfectadas.ts` (T-613): cómo hablar con Postgres sin que un dato
// puntual tire abajo todo lo demás.
//
// ## El defecto que esto arregla
//
// La FASE de detección (`detectarTodo`) ya está aislada desde T-307 (30/07/2026): si un
// detector revienta, se escriben los hallazgos recogidos hasta ese punto en vez de perder el
// barrido entero. Pero la FASE de escritura —el `for` que hace un `INSERT` por hallazgo— no
// tenía ese mismo aislamiento: era un bucle secuencial sin try/catch propio, así que un SOLO
// registro que Postgres rechaza (encoding inválido, lo que sea) tira la excepción fuera del
// `for` y deja SIN REPONER todo lo que venía DESPUÉS en la lista — con sus filas viejas ya
// borradas por el `DELETE` previo (que sí se ejecuta antes de insertar nada) y nunca repuestas.
//
// Medido en vivo (08/08/2026) contra `content_health_findings`: **8 kinds completos con 0 filas**
// (`veredicto_verificacion_rojo` entre ellos, con 393 candidatos reales medidos aparte vía
// `VENCE_LECTOR_URL`) pese a que sus detectores SÍ corrían (aparecían en `kindsEvaluados`). No
// hubo ningún `sweep_incompleto` en el periodo — descarta que la fase de DETECCIÓN fallara — y
// la query de origen corre en <1s contra RDS real — descarta un `statement_timeout`. El patrón
// (kinds ausentes intercalados con kinds presentes, no un corte limpio "todo antes/después de
// una fecha") encaja con esto: una fila puntual que revienta el `INSERT`, en una posición
// distinta según qué detectores encontraron algo esa noche.
//
// ## Por qué aislar por FILA y no reintentar
//
// Un registro que Postgres rechaza no se cura repitiendo el mismo `INSERT` — es un dato, no una
// caída transitoria de red. Aislar (capturar, registrar, seguir con el siguiente) es lo correcto;
// reintentar no lo arreglaría y solo alargaría el barrido.

/**
 * Escribe una tanda de hallazgos aislando cada `INSERT`: si uno falla, se registra el fallo y
 * se continúa con el resto — nunca se pierde lo que SÍ se puede escribir por culpa de una fila
 * puntual.
 *
 * @param {Array<{kind: string}>} hallazgos
 * @param {(hallazgo: object) => Promise<void>} insertar función que hace el INSERT real de un hallazgo
 * @returns {Promise<Array<{kind: string, error: string}>>} filas que fallaron (vacío = todo escrito)
 */
async function escribirConAislamiento(hallazgos, insertar) {
  const fallos = []
  for (const f of hallazgos || []) {
    try {
      await insertar(f)
    } catch (e) {
      const msg = (e && e.message) || String(e)
      fallos.push({ kind: f.kind, error: String(msg).slice(0, 300) })
    }
  }
  return fallos
}

/**
 * Mensaje del hallazgo `sweep_escritura_incompleta` que resume los fallos de una pasada —
 * misma forma en el CLI y en el backend, para que no diverjan.
 * @param {Array<{kind: string, error: string}>} fallos
 */
function mensajeEscrituraIncompleta(fallos) {
  const kindsAfectados = [...new Set(fallos.map((x) => x.kind))]
  return `${fallos.length} hallazgo(s) de ${kindsAfectados.length} kind(s) no se pudieron escribir: ${kindsAfectados.join(', ')}`
}

module.exports = { escribirConAislamiento, mensajeEscrituraIncompleta }
