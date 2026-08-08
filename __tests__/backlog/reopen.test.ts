/**
 * @jest-environment node
 */
// El comando `reopen` existe y hace lo que promete (30/07).
//
// ## Por qué hizo falta
//
// Deshacer un cierre equivocado no tenía comando, y el hueco mordió DOS VECES el mismo día:
//   1. Por la mañana, 3 fichas cerradas EN FALSO hubo que reabrirlas a mano.
//   2. Por la tarde, T-270 se cerró y **lo cazó el guardarraíl `cpuBoundRoutes`**: su lista de
//      excepciones exige ficha ABIERTA, así que cerrarla dejaba la excepción huérfana. El
//      argumento para cerrarla era de contabilidad; el código sostenía lo contrario.
//
// Mientras el estado está mal, la tarea **desaparece de `list`**: enterrar trabajo, que es
// justo el riesgo que motivó la revisión de esa misma mañana.
//
// No se ejecuta el CLI contra la BD: se verifica el CONTRATO del comando sobre el fuente, que es
// lo que se puede comprobar sin una base de datos delante.

import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(process.cwd(), 'scripts', 'backlog.cjs'), 'utf8')
const BLOQUE = SRC.slice(SRC.indexOf("cmd === 'reopen'"), SRC.indexOf("cmd === 'release'"))

describe('backlog.cjs reopen', () => {
  it('el comando existe y está anunciado en la ayuda', () => {
    expect(SRC).toContain("cmd === 'reopen'")
    const uso = SRC.split('\n').find((l) => l.includes('Uso: backlog.cjs list'))
    expect(uso).toContain('reopen <id> --motivo')
  })

  it('EXIGE motivo: reabrir es rehacer una decisión y debe quedar por qué', () => {
    expect(BLOQUE).toMatch(/arg\('--motivo'\)/)
    expect(BLOQUE).toMatch(/if \(!id \|\| !motivo\)/)
  })

  it('solo reabre lo que está CERRADO (no toca una tarea viva)', () => {
    expect(BLOQUE).toMatch(/status !== 'done'/)
  })

  it('devuelve la tarea al pool: open, sin outcome, sin cierre y sin claim colgando', () => {
    // Un reopen que dejara `claimed_by` puesto la haría invisible para las demás sesiones: el
    // mismo enterramiento por otra vía.
    for (const trozo of ["status = 'open'", 'outcome = NULL', 'closed_at = NULL', 'claimed_by = NULL', 'lease_until = NULL']) {
      expect(BLOQUE).toContain(trozo)
    }
  })

  it('CONSERVA el cierre anterior en la nota, no lo borra', () => {
    // Si se borrara, la siguiente sesión tendría que repetir la investigación que llevó a reabrir.
    expect(BLOQUE).toContain('progress_note = concat_ws')
    expect(BLOQUE).toMatch(/cierre anterior/)
    expect(BLOQUE).toMatch(/REABIERTA: /)
  })

  it('marca la cabecera de la ficha y regenera el índice ella sola (T-532, ya no hace falta moverla a mano)', () => {
    // Hasta T-532 esto imprimía «AHORA devuelve su entrada a "## Abiertas" en el markdown» — una
    // instrucción que, con «una ficha = un fichero», apuntaba a un índice GENERADO: seguirla a
    // mano podía perderse en silencio (si algo regeneraba el índice antes) o tardar en cazarse
    // hasta CI. Ahora el propio comando llama a `reabrirCabecera` + `regenerarIndice`.
    expect(BLOQUE).toMatch(/MF\.reabrirCabecera/)
    expect(BLOQUE).toMatch(/FD\.regenerarIndice\(\)/)
  })

  it('los parámetros del concat_ws van casteados (sin ::text, Postgres no infiere el tipo)', () => {
    // Fallo real al estrenarlo: «could not determine data type of parameter $1».
    expect(BLOQUE).toMatch(/\}::text/)
  })
})
