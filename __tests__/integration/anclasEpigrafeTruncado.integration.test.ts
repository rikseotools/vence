/**
 * [T-718] Las anclas de `epigrafeTruncado` se ejercitan CONTRA LA BASE DE DATOS REAL.
 *
 * Un ancla que solo vive en un comentario no protege de nada: hay que ir a buscar esos dos temas
 * y pasarlos por el detector de verdad. Es la diferencia entre declarar una calibración y tenerla
 * — la misma que separa «verificado» de «se firmó verificado», que es de lo que va [T-465].
 *
 * Si el ancla positiva deja de estar truncada (alguien la arregló, que es lo deseable) o
 * cualquiera de las dos desaparece, este test lo DICE con el id delante: un ancla obsoleta se
 * sustituye por otra verificada a mano, no se borra para que pase.
 */
import type { Client } from 'pg'
import { openTestClient } from '../helpers/db'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analizarEpigrafeTruncado, ANCLAS } = require('@/lib/health/epigrafeTruncado.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validarAnclas } = require('@/lib/calidad/anclas.cjs')

describe('[T-718] anclas de epigrafeTruncado contra datos reales', () => {
  let db: Client

  beforeAll(async () => { db = await openTestClient() }, 30000)
  afterAll(async () => { await db?.end() })

  const epigrafeDe = async (id: string): Promise<string | null> => {
    const { rows } = await db.query('SELECT epigrafe FROM topics WHERE id = $1', [id])
    return rows.length ? rows[0].epigrafe : null
  }

  it('están bien declaradas', () => {
    expect(validarAnclas(ANCLAS)).toBeNull()
  })

  it('el ancla POSITIVA sigue existiendo y el detector la marca', async () => {
    const { id, porque } = ANCLAS.positivos[0]
    const epigrafe = await epigrafeDe(id)
    expect(
      epigrafe === null ? `El ancla positiva ${id} ya no está en topics (${porque}). Sustitúyela.` : '',
    ).toBe('')
    expect({ id, truncado: analizarEpigrafeTruncado(epigrafe).truncado }).toEqual({ id, truncado: true })
  }, 30000)

  it('el ancla NEGATIVA existe y el detector NO la marca (el «:» del medio es legítimo)', async () => {
    const { id, porque } = ANCLAS.negativos[0]
    const epigrafe = await epigrafeDe(id)
    expect(
      epigrafe === null ? `El ancla negativa ${id} ya no está en topics (${porque}). Sustitúyela.` : '',
    ).toBe('')
    expect({ id, truncado: analizarEpigrafeTruncado(epigrafe).truncado }).toEqual({ id, truncado: false })
  }, 30000)
})
