/**
 * @jest-environment node
 */
// El mensaje final de `crear-worktree.sh` (T-415/T-431).
//
// Crear el worktree y ENTRAR en él son dos cosas, y el script solo decía «→ cd <dir>» — que se
// lee como información, no como el paso sin el cual todo lo demás no sirve. Medido el 31/07:
// cinco worktrees creados correctamente (al día con origin/main) y CERO sesiones dentro, mientras
// seis sesiones seguían compartiendo el índice de git del checkout principal.
//
// Una herramienta que se puede ejecutar entera y dejarte donde estabas tiene que DECIRLO.
import { readFileSync } from 'fs'
import { join } from 'path'

const sh = readFileSync(join(process.cwd(), 'scripts/worktrees/crear-worktree.sh'), 'utf8')

describe('crear-worktree.sh — el mensaje final no puede leerse a medias', () => {
  it('avisa de que CREARLO NO ES ENTRAR', () => {
    expect(sh).toMatch(/CREARLO NO ES ENTRAR/)
  })

  it('dice que la sesión que lo ejecuta se queda donde estaba', () => {
    expect(sh).toMatch(/SIGUE en el\s*\n?\s*#?\s*checkout principal/)
  })

  it('da las DOS formas de usarlo, no solo un `cd` suelto', () => {
    expect(sh).toMatch(/esta misma sesión se muda/)
    expect(sh).toMatch(/sesión NUEVA/)
  })

  it('da la comprobación de que funcionó (si no, no hay forma de saberlo)', () => {
    expect(sh).toMatch(/git rev-parse --show-toplevel/)
  })

  it('sigue creando la rama desde origin/main (lo que hace el aislamiento real)', () => {
    expect(sh).toMatch(/origin\/main/)
  })
})
