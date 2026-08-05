/**
 * siguienteId.test.ts — la numeración del backlog solo la deciden las fichas. (T-563)
 *
 * El caso que fija es real y del 05/08/2026: `backlog.cjs reserve` le quitaba los no-dígitos a
 * CUALQUIER id de `backlog_tasks`, así que la fila del canario `CANARY-coord-20450` votó como
 * 20450 y la ficha siguiente nació **T-20451**.
 *
 * Lo peligroso no fue el número raro: fue que **nada falló**. La PK seguía siendo única, el
 * INSERT fue correcto, y el backlog habría seguido en T-20452, T-20453… hasta que alguien mirara.
 */
import path from 'path'
import { createRequire } from 'module'

const req = createRequire(__filename)
const { siguienteId } = req(path.join(__dirname, '..', '..', 'lib/backlog/siguienteId.cjs'))

describe('siguienteId', () => {
  it('sigue la serie', () => {
    expect(siguienteId(['T-001', 'T-560', 'T-561']).siguiente).toBe('T-562')
  })

  it('IGNORA un id que no es una ficha — el caso del canario', () => {
    const r = siguienteId(['T-560', 'T-561', 'CANARY-coord-20450'])
    expect(r.siguiente).toBe('T-562')
    expect(r.maximo).toBe(561)
    expect(r.ignorados).toEqual(['CANARY-coord-20450'])
  })

  it('acepta filas {id} igual que cadenas (es lo que devuelve la consulta)', () => {
    expect(siguienteId([{ id: 'T-561' }, { id: 'CANARY-coord-20450' }]).siguiente).toBe('T-562')
  })

  it('una tabla sin fichas empieza en T-001, no en NaN', () => {
    expect(siguienteId([]).siguiente).toBe('T-001')
    expect(siguienteId(['CANARY-x-999']).siguiente).toBe('T-001')
  })

  it('rellena a tres dígitos, y no los recorta cuando sobran', () => {
    expect(siguienteId(['T-008']).siguiente).toBe('T-009')
    expect(siguienteId(['T-1200']).siguiente).toBe('T-1201')
  })

  it('no se traga variantes que SE PARECEN a una ficha', () => {
    // Sin esto volvería a colarse cualquier cosa con dígitos: la regla es la forma exacta.
    const r = siguienteId(['T-561', 'T-562-bis', 'X-999', 'T562', 'CANARY-coord-20450'])
    expect(r.siguiente).toBe('T-562')
    expect(r.ignorados.sort()).toEqual(['CANARY-coord-20450', 'T-562-bis', 'T562', 'X-999'])
  })

  it('deja ver QUÉ ignoró — el dato que faltaba el día del T-20451', () => {
    expect(siguienteId(['T-1', 'CANARY-coord-20450']).ignorados).toContain('CANARY-coord-20450')
  })
})
