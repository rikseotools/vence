/**
 * @jest-environment node
 *
 * El despertar por deploy TIENE que marcar el pendiente ([T-463], 01/08/2026).
 *
 * POR QUÉ ESTE GUARDARRAÍL Y NO SOLO LOS TESTS DE LA REGLA: el defecto original no fue una
 * regla mal escrita —no había regla ninguna—, fue que al limpiar la columna `wake_on_deploy_sha`
 * nadie tocaba el TEXTO que la duplicaba en prosa. Un test de `marcarDesplegado` seguiría en
 * verde con la llamada quitada del `deployed`, y volveríamos a tener tareas desplegadas que en
 * `list` parecen bloqueadas (10 de 10, medido).
 *
 * Se comprueba sobre el código porque el camino toca BD y no se puede ejercitar aquí.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const CLI = join(__dirname, '..', '..', 'scripts', 'backlog.cjs')

describe('backlog.cjs — el despertar marca el pendiente como desplegado', () => {
  const fuente = readFileSync(CLI, 'utf8')

  it('importa la regla desde su núcleo puro (sin copiarla)', () => {
    // Una segunda copia del criterio es como nacieron los cinco escritores de [T-130].
    expect(fuente).toMatch(/require\(['"]\.\.\/lib\/backlog\/marcaDesplegado\.cjs['"]\)/)
  })

  it('la llama al despertar', () => {
    expect(fuente).toMatch(/marcarDesplegado\s*\(\s*t\.resume_check/)
  })

  it('escribe el resultado en el MISMO UPDATE que limpia la columna', () => {
    // Si fueran dos escrituras, un fallo entre ambas dejaría justo el estado que se quiere
    // evitar: columna limpia y texto mintiendo.
    const bloque = fuente.slice(fuente.indexOf('SET wake_on_deploy_sha = NULL'))
    expect(bloque.slice(0, 400)).toMatch(/resume_check\s*=\s*COALESCE\(/)
  })

  it('usa COALESCE para no borrar el pendiente cuando no hay nada que marcar', () => {
    // `marcarDesplegado` devuelve null si el texto no habla de deploy o ya está marcado; sin el
    // COALESCE ese null vaciaría el `resume_check` y se perdería el contexto de la tarea.
    expect(fuente).toMatch(/resume_check\s*=\s*COALESCE\(\$\{marcado\},\s*resume_check\)/)
  })
})
