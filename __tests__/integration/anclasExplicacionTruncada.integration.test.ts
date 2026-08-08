/**
 * [T-718] Las anclas de `explicacionTruncada` contra la BASE DE DATOS REAL.
 *
 * Este detector vive de sus EXCLUSIONES: el criterio ingenuo —«no acaba en signo de cierre»— da
 * **8.938 de 136.310** explicaciones activas y casi todas están bien; el criterio gramatical deja
 * **112**. Las dos anclas negativas fijan las dos razones de esa diferencia (terminar en una URL
 * y cerrar con una locución), que son justo las que se pierden cuando alguien «simplifica» el
 * criterio. Sin ellas, aflojarlo no rompe ningún test: solo multiplica el trabajo por ochenta.
 */
import type { Client } from 'pg'
import { openTestClient } from '../helpers/db'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { clasificaTruncada, ANCLAS } = require('@/lib/health/explicacionTruncada.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validarAnclas } = require('@/lib/calidad/anclas.cjs')

interface Ancla { id: string; porque: string }

describe('[T-718] anclas de explicacionTruncada contra datos reales', () => {
  let db: Client
  beforeAll(async () => { db = await openTestClient() }, 30000)
  afterAll(async () => { await db?.end() })

  const q = async (id: string) => {
    const { rows } = await db.query('SELECT id, explanation FROM questions WHERE id = $1', [id])
    return rows[0] ?? null
  }
  const truncada = (fila: unknown) => Boolean(clasificaTruncada(fila)?.truncada)

  it('están bien declaradas', () => {
    expect(validarAnclas(ANCLAS)).toBeNull()
  })

  it('la POSITIVA sigue cortada y el detector la ve', async () => {
    const { id, porque } = ANCLAS.positivos[0] as Ancla
    const fila = await q(id)
    expect(fila === null ? `El ancla positiva ${id} ya no existe (${porque}). Sustitúyela.` : '').toBe('')
    // Si alguien la ARREGLA (deseable), este test lo dice y se cambia el ancla — no se borra.
    expect({ id, truncada: truncada(fila) }).toEqual({ id, truncada: true })
  }, 30000)

  it.each((ANCLAS.negativos as Ancla[]).map((a) => [a.id, a.porque]))(
    'la NEGATIVA %s NO se marca',
    async (id, porque) => {
      const fila = await q(id)
      expect(fila === null ? `El ancla negativa ${id} ya no existe (${porque}). Sustitúyela.` : '').toBe('')
      expect({ id, truncada: truncada(fila) }).toEqual({ id, truncada: false })
    },
    30000,
  )
})
