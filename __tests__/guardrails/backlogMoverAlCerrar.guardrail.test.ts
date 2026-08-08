/**
 * GUARDARRAÍL — al cerrar una tarea, el CLI deja el markdown bien SOLO. [T-387, adaptado en T-532]
 *
 * ── LO QUE PROTEGE, QUE NO HA CAMBIADO ──────────────────────────────────────────────────────
 * Hasta [T-387], `done` cerraba el estado en Postgres y le decía a la sesión «AHORA muévela tú a
 * ## Hechas» — y cada sesión lo hacía con su propio script de usar y tirar. Medido el 31/07: 91
 * commits/día sobre el fichero, y una sola sesión necesitó CUATRO scripts ad-hoc en un día, uno
 * de los cuales se llevó por delante la cabecera `## Hechas` entera. Este guardarraíl existe para
 * que nadie vuelva a dejar ese paso «para que lo haga una persona».
 *
 * ── POR QUÉ SE REESCRIBIÓ (08/08) ───────────────────────────────────────────────────────────
 * La versión original comprobaba que `done` llamase a `moverAHechas` dentro de
 * `leerTransformarEscribir`. Eso describía el mundo de **un solo markdown con dos secciones**, y
 * [T-532] («una ficha = un fichero») lo sustituyó: ahora cada ficha vive en
 * `docs/roadmap/tareas/T-nnn.md`, `tareas-pendientes.md` es un índice GENERADO, y la sección la
 * decide la CABECERA (el `✅`), no la posición. Ya no hay dos sitios entre los que mover nada.
 *
 * Comprobado al mergear las dos ramas: el test original daba 5 fallos contra un `backlog.cjs`
 * que hace lo correcto — estaba midiendo una implementación que ya no existe. **Se conserva la
 * garantía y se cambia la forma de comprobarla**: que `done` y `reopen` sigan tocando el markdown
 * ellos mismos, ahora por la vía nueva (marcar la cabecera + regenerar el índice), y que quede un
 * plan B textual si no pueden. Borrarlo habría sido perder la protección; dejarlo como estaba,
 * tener el CI en rojo por hacer las cosas bien.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(__dirname, '..', '..', 'scripts', 'backlog.cjs'), 'utf8')

/** El bloque de un comando del CLI, para no confundir lo que hace `done` con lo que hace otro. */
function bloqueDe(cmd: string, largo = 6000): string {
  const i = SRC.indexOf(`cmd === '${cmd}'`)
  expect(i).toBeGreaterThan(-1)
  const j = SRC.indexOf(`\n    else if (cmd ===`, i)
  return SRC.slice(i, j > -1 ? j : i + largo)
}

describe('scripts/backlog.cjs — `done` sigue escribiendo el markdown, no solo avisando', () => {
  it('importa la lógica de marcar la cabecera y el directorio de fichas', () => {
    expect(SRC).toMatch(/require\([^)]*marcarFicha\.cjs['"]\)/)
    expect(SRC).toMatch(/require\([^)]*fichasDir\.cjs['"]\)/)
  })

  it('`done` cierra la cabecera y regenera el índice, no imprime un «muévela tú»', () => {
    const done = bloqueDe('done')
    expect(done).toMatch(/cerrarCabecera/)
    expect(done).toMatch(/regenerarIndice|escribirFicha/)
  })

  it('`reopen` hace lo inverso solo, que es el mismo hueco visto del otro lado', () => {
    const reopen = bloqueDe('reopen', 4000)
    expect(reopen).toMatch(/reabrirCabecera/)
  })

  it('sigue habiendo plan B textual: un fallo de FORMATO no puede tumbar un cierre ya escrito en BD', () => {
    // El estado en Postgres ya está cerrado cuando se toca el markdown. Si esto se cae en vez de
    // avisar, deja la tarea cerrada en la tabla y abierta en el fichero — peor que el problema
    // que el guardarraíl arregla.
    const done = bloqueDe('done')
    expect(done).toMatch(/no se pudo|muévela tú|a mano/i)
  })

  it('la escritura del markdown pasa por la puerta única, no por `fs.writeFileSync` suelto', () => {
    // No es exhaustivo (no puede serlo desde fuera del parser real), pero cubre el caso que
    // motivó la tarea: dos escritores del MISMO fichero con criterios distintos no protegen nada.
    const porLaPuerta = (SRC.match(/leerTransformarEscribir\(|FD\.escribirFicha\(|FD\.regenerarIndice\(/g) || []).length
    expect(porLaPuerta).toBeGreaterThanOrEqual(3)
  })

  it('nadie edita `tareas-pendientes.md` a mano: es un índice generado [T-532]', () => {
    // La regresión que este fichero vigila ahora: volver a escribir en el índice deshace T-532 en
    // silencio, porque el siguiente `regenerarIndice()` se lo lleva por delante.
    const sinComentarios = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*(\/\/|\*).*$/gm, '')
    expect(sinComentarios).not.toMatch(/writeFileSync\(\s*MD\b/)
  })
})
