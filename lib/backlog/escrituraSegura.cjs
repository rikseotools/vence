// lib/backlog/escrituraSegura.cjs — la ÚNICA forma de escribir en tareas-pendientes.md. [T-387]
//
// El patrón que había en TODO el CLI hasta hoy era `read → transformar → write`, sin nada entre
// medias. Para un comando síncrono y rápido el hueco es pequeño, pero no es cero: la ficha de
// [T-387] lo documenta explícito («el fichero cambia bajo los pies, pasó dos veces el 31/07») —
// una sesión larga que encadena varias operaciones, o dos invocaciones del CLI solapadas en el
// mismo worktree (un `sync` automático y un cierre manual, por ejemplo), pueden escribir sobre
// una foto del fichero que ya no es la última.
//
// La defensa es barata y no necesita un lock de verdad (fcntl/flock): control de concurrencia
// OPTIMISTA. Se lee, se transforma, y justo ANTES de escribir se vuelve a leer — si el contenido
// no es EXACTAMENTE el que se usó para calcular el resultado, se aborta sin escribir nada. Un
// «inténtalo otra vez» es siempre más barato que corromper el fichero de otra sesión.
'use strict'

const fs = require('fs')

/**
 * @param path         ruta del fichero
 * @param transformar  (contenidoActual) => {ok:true, md, ...extra} | {ok:false, motivo, ...extra}
 *                      función PURA — no toca disco, solo calcula el resultado
 * @returns el resultado de `transformar` tal cual si `ok:false`, o con un motivo
 *          `cambio_bajo_los_pies` si el fichero cambió entre la lectura y la escritura (sin
 *          escribir nada), o `{...resultado, escrito:true}` si se escribió.
 */
function leerTransformarEscribir(path, transformar) {
  const original = fs.readFileSync(path, 'utf8')
  const resultado = transformar(original)
  if (!resultado || !resultado.ok) return resultado

  // Relectura INMEDIATAMENTE antes de escribir: es la comprobación, no un formalismo. Si algo
  // escribió en el hueco entre la primera lectura y este punto, el contenido ya no coincide.
  const actual = fs.readFileSync(path, 'utf8')
  if (actual !== original) {
    return { ok: false, motivo: 'cambio_bajo_los_pies', detalle: 'el fichero cambió entre la lectura y la escritura — reinténtalo' }
  }

  fs.writeFileSync(path, resultado.md)
  return { ...resultado, escrito: true }
}

module.exports = { leerTransformarEscribir }
