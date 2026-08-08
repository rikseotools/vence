/**
 * [T-718] Las anclas de `opcionesDuplicadas` contra la BASE DE DATOS REAL.
 *
 * Este detector tiene una «mejora» que se pide sola al leerlo —comparar las opciones en
 * minúsculas— y que ya fabricó **8 preguntas rotas inexistentes** (manual de impugnaciones,
 * 31/07/2026: dos consultas seguidas dieron «48 con 8 irresolubles» cuando eran 33 y ninguna).
 * Las anclas negativas son justo ese caso: opciones donde **la mayúscula ES la respuesta**.
 *
 * Se ejercitan contra RDS y no con fixtures a propósito: lo que se quiere fijar es que el
 * criterio sigue midiendo bien EL BANCO, no un ejemplo escrito para que salga bien.
 */
import type { Client } from 'pg'
import { openTestClient } from '../helpers/db'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { paresDuplicados, ANCLAS } = require('@/lib/health/opcionesDuplicadas.cjs')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { validarAnclas } = require('@/lib/calidad/anclas.cjs')

interface Ancla { id: string; porque: string }

describe('[T-718] anclas de opcionesDuplicadas contra datos reales', () => {
  let db: Client
  beforeAll(async () => { db = await openTestClient() }, 30000)
  afterAll(async () => { await db?.end() })

  const pregunta = async (id: string) => {
    const { rows } = await db.query(
      'SELECT id, option_a, option_b, option_c, option_d, correct_option FROM questions WHERE id = $1',
      [id],
    )
    return rows[0] ?? null
  }

  it('están bien declaradas', () => {
    expect(validarAnclas(ANCLAS)).toBeNull()
  })

  it('la POSITIVA sigue teniendo dos opciones idénticas y el detector las ve', async () => {
    const { id, porque } = ANCLAS.positivos[0] as Ancla
    const q = await pregunta(id)
    expect(q === null ? `El ancla positiva ${id} ya no existe (${porque}). Sustitúyela.` : '').toBe('')
    expect({ id, pares: paresDuplicados(q).length > 0 }).toEqual({ id, pares: true })
  }, 30000)

  it.each((ANCLAS.negativos as Ancla[]).map((a) => [a.id, a.porque]))(
    'la NEGATIVA %s NO se marca (la caja es la respuesta)',
    async (id, porque) => {
      const q = await pregunta(id)
      expect(q === null ? `El ancla negativa ${id} ya no existe (${porque}). Sustitúyela.` : '').toBe('')
      // Si alguien mete un `lower()` en `normalizarOpcion`, esto se pone rojo con el id delante.
      expect({ id, pares: paresDuplicados(q).length }).toEqual({ id, pares: 0 })
    },
    30000,
  )
})
