import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * El dossier de feedback tiene que seguir poniendo delante el RASTRO DE ERRORES del usuario (T-649).
 *
 * El defecto que esto vigila no fue un bug: fue una AUSENCIA. Durante meses el dossier volcó
 * `user_interactions` (los clics) y nunca `observable_events` (los errores), así que quien
 * respondía tenía que acordarse de ir a buscarlos a mano. Con Lourdes (`e790c7bf`) no se hizo, y
 * se le atribuyó su cuelgue a la avería que estaba abierta ese día. Una ausencia no enrojece
 * ningún test por sí sola —por eso hace falta este—, y se restaura sola en cuanto alguien
 * reordena el fichero.
 */
const RAIZ = join(__dirname, '..', '..')
const DOSSIER = join(RAIZ, 'scripts/impugnaciones/revisar-feedback.cjs')
const NUCLEO = join(RAIZ, 'lib/impugnaciones/rastroDeErrores.cjs')

describe('el dossier de feedback no puede quedarse sin el rastro de errores (T-649)', () => {
  const fuente = readFileSync(DOSSIER, 'utf8')

  it('consulta observable_events del usuario, no solo sus clics', () => {
    expect(fuente).toMatch(/FROM observable_events/)
    expect(fuente).toMatch(/user_id=\$\{fb\.user_id\}/)
  })

  it('acota la consulta a la ventana del núcleo, no a un rango escrito a mano', () => {
    // Una ventana inventada aquí sería una segunda definición del criterio: el día que se ajuste
    // (p.ej. a 6 h) el núcleo diría una cosa y el dossier enseñaría otra.
    expect(fuente).toMatch(/ventanaRastro/)
    expect(fuente).not.toMatch(/interval\s+'\d+\s+hour/i)
  })

  it('usa el núcleo puro y NO reimplementa el agrupado', () => {
    expect(fuente).toMatch(/lib['/\\, ]+impugnaciones['/\\, ]+rastroDeErrores\.cjs/)
    expect(fuente).toMatch(/agruparRastro/)
    expect(fuente).toMatch(/lineasRastro/)
  })

  it('NO se traga el error de la consulta', () => {
    // Un `.catch(()=>[])` aquí produciría un «sin rastro» falso, que es peor que no tener el
    // bloque: se lee como «miré y no hay nada». Es el mismo modo de fallo que ya costó un
    // mensaje duplicado a un usuario (cabecera de este mismo fichero).
    const bloque = fuente.slice(fuente.indexOf('RASTRO DE ERRORES'), fuente.indexOf('ENFORCEMENT scope'))
    expect(bloque).not.toMatch(/catch\s*\(\s*\)\s*=>\s*\[\]/)
    expect(bloque).not.toMatch(/\.catch\(/)
  })

  it('la checklist sigue exigiendo no nombrar una causa que no esté en el rastro', () => {
    expect(fuente).toMatch(/NO nombro una causa que no salga en su RASTRO/)
  })

  it('el núcleo distingue ANTES de DESPUÉS, que es toda la lección', () => {
    const nucleo = readFileSync(NUCLEO, 'utf8')
    expect(nucleo).toMatch(/antes/)
    expect(nucleo).toMatch(/despues/)
    // Sin la etiqueta explícita, los dos cubos se leen como una lista por fecha y vuelve el fallo.
    expect(nucleo).toMatch(/NO explica su aviso/)
  })
})
