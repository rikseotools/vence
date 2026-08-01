/**
 * @jest-environment node
 */
// Guardarraíl de `resume_check`: UN solo escritor, y un solo verbo que lo cumple. (T-449)
//
// `resume_check` es la columna que decide qué sale en «⏰ IMPLEMENTADAS Y SIN COMPROBAR», que es
// lo PRIMERO que lee toda sesión al empezar. Su valor entero depende de que lo que anuncia sea
// verdad, así que la columna no puede repartirse entre criterios distintos: es la lección del
// quinto escritor de `seguimiento_url` [T-130], aquí sobre el dato que ordena el trabajo.
//
// El reparto correcto, y lo que este test fija:
//   · `pause`      es el ÚNICO que la ESCRIBE (y obliga a declarar una espera: reloj o deploy);
//   · `verificado` es el ÚNICO que la CUMPLE (la vacía dejando constancia en `progress_note`);
//   · `release`    NO la toca — y eso es a propósito, ver abajo.
//
// Por qué `release` no la limpia: soltar una tarea sin avanzar no dice nada sobre si el pendiente
// se comprobó. Si `release` lo borrase, perderíamos la señal justo cuando sigue siendo cierta. Lo
// que estaba mal no era `release`, era que faltaba el verbo para decir «ya lo comprobé» — que es
// lo que se añadió.
import { readFileSync } from 'fs'
import { join } from 'path'

const ROOT = join(__dirname, '..', '..')
const CLI = readFileSync(join(ROOT, 'scripts', 'backlog.cjs'), 'utf8')
const RUNBOOK = readFileSync(join(ROOT, 'docs', 'runbooks', 'tareas-pendientes.md'), 'utf8')

/** El cuerpo de un `else if (cmd === 'x') { … }` hasta el siguiente comando. */
function bloqueDe(cmd: string): string {
  const i = CLI.indexOf(`cmd === '${cmd}'`)
  if (i < 0) return ''
  const j = CLI.indexOf("cmd === '", i + 10)
  return CLI.slice(i, j < 0 ? CLI.length : j)
}

describe('resume_check — un escritor, un verbo que lo cumple', () => {
  it('el verbo `verificado` existe en el CLI', () => {
    expect(CLI).toContain("cmd === 'verificado'")
  })

  it('`pause` sigue siendo el único que ESCRIBE resume_check con un valor', () => {
    const escriben = ['pause', 'verificado', 'release', 'done', 'reopen', 'snooze', 'wake']
      .filter((c) => /resume_check\s*=\s*\$\{/.test(bloqueDe(c)))
    expect(escriben).toEqual(['pause'])
  })

  it('`verificado` la VACÍA (no la reescribe con otro criterio)', () => {
    expect(bloqueDe('verificado')).toMatch(/resume_check\s*=\s*NULL/)
  })

  it('`verificado` exige la nota: sin ella es indistinguible de «lo doy por bueno»', () => {
    const b = bloqueDe('verificado')
    expect(b).toMatch(/--nota/)
    expect(b).toMatch(/process\.exit\(2\)/)
  })

  it('`verificado` conserva el pendiente cumplido en progress_note (no lo borra sin rastro)', () => {
    expect(bloqueDe('verificado')).toMatch(/progress_note\s*=\s*concat_ws/)
  })

  it('la decisión vive en el núcleo puro, no inline en el CLI', () => {
    expect(bloqueDe('verificado')).toContain('puedeMarcarseVerificada(')
  })

  // `release` sigue sin tocarla A PROPÓSITO (ver la cabecera). Este test evita que alguien lo
  // «arregle» borrándola ahí: sería perder la señal cuando todavía es cierta.
  it('`release` NO toca resume_check', () => {
    expect(bloqueDe('release')).not.toMatch(/resume_check/)
  })

  it('el runbook documenta el verbo (si no, nadie sabrá que existe)', () => {
    expect(RUNBOOK).toContain('verificado')
    expect(RUNBOOK).toMatch(/ya se comprob|ya lo comprob/i)
  })
})
