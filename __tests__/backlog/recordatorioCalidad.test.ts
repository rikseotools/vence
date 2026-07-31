/**
 * @jest-environment node
 */
// El recordatorio de calidad llega al EMPEZAR la tarea, no al arrancar la sesión (T-433).
//
// La exigencia —no chapuzas, integrar en vez de crear silos, capas de seguridad— llevaba tiempo
// en CLAUDE.md y aun así había que repetirla a mano cada poco. No es desidia: CLAUDE.md se lee
// UNA VEZ al arrancar, y cuando media hora después se coge una tarea está sepultada bajo
// doscientas líneas. Una regla que vive donde nadie mira en el momento de la verdad no se cumple.
//
// Y los guardarraíles que ya existían actúan TARDE: el pre-push exige capas con el trabajo ya
// hecho, y los registros avisan en CI. Ninguno devuelve las horas de construir algo que ya existía.
import { readFileSync } from 'fs'
import { join } from 'path'

const cli = readFileSync(join(process.cwd(), 'scripts/backlog.cjs'), 'utf8')

describe('el recordatorio está donde se empieza a trabajar', () => {
  it('`claim` lo imprime (es el único punto por el que pasa TODA tarea)', () => {
    expect(cli).toMatch(/recordarComoSeTrabaja\(row\.title\)/)
  })

  it('cubre las cuatro cosas que se piden, no una genérica', () => {
    const f = cli.slice(cli.indexOf('function recordarComoSeTrabaja'), cli.indexOf('function recordarComoSeTrabaja') + 2200)
    expect(f).toMatch(/tools:buscar/)        // 1. ¿ya existe?
    expect(f).toMatch(/silos/)               // 2. integrar, no duplicar
    expect(f).toMatch(/canary|guardarra/)    // 3. capas
    expect(f).toMatch(/vence-sim|playwright/i) // 4. el simulador que ya hay
  })

  // Un bloque largo y genérico se vuelve papel pintado a la tercera vez: se salta con la vista,
  // igual que se saltaba el aviso de CLAUDE.md. Por eso va corto y CON las palabras de la tarea.
  it('el comando de búsqueda va ya escrito con las palabras de ESA tarea', () => {
    const f = cli.slice(cli.indexOf('function recordarComoSeTrabaja'))
    expect(f).toMatch(/claves\.join/)
    expect(f).toMatch(/PARADAS/)             // sin palabras de relleno
  })

  it('dice que las capas son SOLO las necesarias (no pide burocracia)', () => {
    expect(cli).toMatch(/SOLO las que hagan falta/)
  })

  it('avisa de que el pre-push ya lo exige (el recordatorio no es una opinión)', () => {
    expect(cli).toMatch(/pre-push EXIGE/)
  })
})
