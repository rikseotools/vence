/**
 * GUARDARRAÍL — `done` sigue moviendo la ficha sola al cerrar. [T-387]
 *
 * Hasta esta tarea, `done` cerraba el estado en Postgres y le decía a la sesión «AHORA muévela
 * tú a ## Hechas» — y cada sesión lo hacía con su propio script de usar y tirar. Medido el 31/07:
 * 91 commits/día sobre el fichero, y una sola sesión necesitó CUATRO scripts ad-hoc en un día,
 * uno de los cuales se llevó por delante la cabecera `## Hechas` entera.
 *
 * Este test no verifica la LÓGICA de mover (eso lo hacen `moverFicha.test.ts` y
 * `escrituraSegura.test.ts`, con datos): verifica que el CLI sigue LLAMANDO a esa lógica desde
 * `done`, no que alguien la quitó sin querer al tocar otra cosa cerca. Es el mismo patrón que
 * `degradadorSelladoCriterioUnico.guardrail.test.ts` usa para su propio caso.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const SRC = readFileSync(join(__dirname, '..', '..', 'scripts', 'backlog.cjs'), 'utf8')

describe('scripts/backlog.cjs — `done` sigue escribiendo el markdown, no solo avisando', () => {
  it('importa la única puerta de escritura (escrituraSegura) y la lógica de mover (moverFicha)', () => {
    expect(SRC).toMatch(/require\([^)]*escrituraSegura\.cjs['"]\)/)
    expect(SRC).toMatch(/require\([^)]*moverFicha\.cjs['"]\)/)
  })

  it('el bloque de `done` llama a leerTransformarEscribir con moverAHechas, no solo imprime el aviso', () => {
    const iDone = SRC.indexOf(`cmd === 'done'`)
    expect(iDone).toBeGreaterThan(-1)
    const iSiguienteComando = SRC.indexOf(`\n    else if (cmd ===`, iDone)
    const bloqueDone = SRC.slice(iDone, iSiguienteComando > -1 ? iSiguienteComando : iDone + 6000)

    expect(bloqueDone).toContain('leerTransformarEscribir(MD')
    expect(bloqueDone).toContain('moverAHechas(md, row.id')
  })

  it('sigue habiendo un plan B textual para cuando el movimiento automático falla (fail-open, no bloquea el cierre en BD)', () => {
    const iDone = SRC.indexOf(`cmd === 'done'`)
    const iSiguienteComando = SRC.indexOf(`\n    else if (cmd ===`, iDone)
    const bloqueDone = SRC.slice(iDone, iSiguienteComando > -1 ? iSiguienteComando : iDone + 6000)
    // Si el movimiento automático no puede (formato no reconocido, ficha ya movida a mano, una
    // carrera que no se resolvió reintentando…) tiene que seguir habiendo instrucción manual —
    // un `done` que se cae por un problema de FORMATO del markdown, cuando el estado en BD ya
    // se cerró, sería peor que el problema que esto arregla.
    expect(bloqueDone).toMatch(/no se pudo mover sola|muévela tú/)
  })

  it('el comando `mover` manual existe, para el resto de casos (huérfanas, cerradas fuera del CLI…)', () => {
    expect(SRC).toMatch(/cmd === 'mover'/)
  })

  it('`reopen` hace el movimiento INVERSO sola (Hechas→Abiertas), mismo hueco que `done`', () => {
    const iReopen = SRC.indexOf(`cmd === 'reopen'`)
    expect(iReopen).toBeGreaterThan(-1)
    const iSiguienteComando = SRC.indexOf(`\n    else if (cmd ===`, iReopen)
    const bloqueReopen = SRC.slice(iReopen, iSiguienteComando > -1 ? iSiguienteComando : iReopen + 4000)
    expect(bloqueReopen).toContain('leerTransformarEscribir(MD')
    expect(bloqueReopen).toContain('moverAAbiertas(md, row.id')
  })

  it('los escritores existentes (ficha nueva, reubicar) pasan también por la puerta única, no por fs.writeFileSync suelto', () => {
    // No es exhaustivo (no puede serlo desde fuera del parser real), pero sí cubre el caso que
    // motivó la tarea: dos escritores del MISMO fichero con criterios distintos no protegen nada.
    const usosDeLeerTransformarEscribir = (SRC.match(/leerTransformarEscribir\(/g) || []).length
    expect(usosDeLeerTransformarEscribir).toBeGreaterThanOrEqual(3) // done, ficha --texto, reubicar --apply
  })
})
