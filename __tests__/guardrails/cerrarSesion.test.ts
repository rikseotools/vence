/**
 * @jest-environment node
 */
// Cerrar una sesión no puede perder trabajo ni contexto (T-438).
//
// Al borrar el worktree, lo que no esté en origin/main se pierde PARA SIEMPRE: el rescate de
// T-430 —que enseña lo que dejó la sesión anterior— solo funciona si el worktree sigue existiendo.
// Por eso el cierre no puede depender de que alguien recuerde subir: tiene que impedirlo.
import { readFileSync } from 'fs'
import { join } from 'path'

const sh = readFileSync(join(process.cwd(), 'scripts/worktrees/borrar-worktree.sh'), 'utf8')

describe('borrar-worktree.sh — las cuatro cosas que no puede dejar pasar', () => {
  it('ABORTA si hay commits que no están en origin/main', () => {
    expect(sh).toMatch(/origin\/main\.\.\$BRANCH/)
    expect(sh).toMatch(/Aborto para no perderlos/)
  })

  it('ABORTA si hay cambios sin commitear', () => {
    expect(sh).toMatch(/cambios sin commitear/)
  })

  it('suelta los claims de la cola de impugnaciones', () => {
    expect(sh).toMatch(/cola\.cjs release-all/)
  })

  // El hueco encontrado el 31/07: soltaba los de la cola pero NO los del backlog, así que la
  // tarea seguía reclamada hasta caducar el lease y —lo caro— el «dónde la dejé» se perdía.
  it('ABORTA si la sesión tiene tareas del BACKLOG cogidas', () => {
    expect(sh).toMatch(/backlog\.cjs mine/)
    expect(sh).toMatch(/tareas del BACKLOG cogidas/)
  })

  // No se sueltan solas a propósito: soltar sin decir dónde se dejó la tarea es indistinguible
  // de un abandono, y la siguiente sesión empieza de cero.
  it('no las suelta solo: exige `done` o `pause` y lo explica', () => {
    expect(sh).toMatch(/backlog\.cjs done/)
    expect(sh).toMatch(/backlog\.cjs pause/)
    expect(sh).toMatch(/indistinguible de un abandono/)
  })

  it('todo lo anterior se puede saltar solo con --force explícito', () => {
    // Se cuentan las apariciones de la guarda, no un `if` literal: dos de ellas van en
    // condición combinada (`[ -n "$DIRT" ] && [ "$FORCE" != 1 ]`) y una regex de `if` las perdía.
    const guardas = sh.match(/"\$FORCE" != 1/g) || []
    expect(guardas.length).toBeGreaterThanOrEqual(3)
  })
})
