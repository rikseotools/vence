/**
 * @jest-environment node
 *
 * Test de INTEGRACIÓN del buscador de CONTENIDO de /teoria (FTS sobre el texto
 * de los artículos, columna `teoria_content_tsv` + config spanish_unaccent).
 *
 * Verifica contra BD real (readonly):
 *   1. Encuentra artículos por su texto y devuelve fragmento resaltado.
 *   2. INSENSIBLE A ACENTOS: "cotizacion" (sin tilde) encuentra "cotización".
 *   3. Query vacía → sin resultados (no escanea).
 *   4. AISLAMIENTO: usa su columna propia; NO pisa `content_tsv` del chat.
 *
 * Si se salta: falta DATABASE_URL en .env.local.
 */
import dotenv from 'dotenv'
import { Client } from 'pg'
import {
  searchTeoriaContent,
  HL_START,
  HL_END,
} from '@/lib/api/laws/teoriaCatalog'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL
const d = hasDb ? describe : describe.skip

d('Buscador de contenido /teoria (FTS, BD real)', () => {
  it('encuentra artículos por su texto, con fragmento resaltado', async () => {
    const r = await searchTeoriaContent({ q: 'excedencia voluntaria', limit: 10 })
    expect(r.total).toBeGreaterThan(0)
    expect(r.hits.length).toBeGreaterThan(0)
    const h = r.hits[0]
    expect(h.lawShortName).toBeTruthy()
    expect(h.href).toMatch(/^\/teoria\//)
    // el snippet trae los sentinelas de resaltado
    expect(h.snippet.includes(HL_START) && h.snippet.includes(HL_END)).toBe(true)
  }, 30000)

  it('es INSENSIBLE A ACENTOS: "cotizacion" encuentra "cotización"', async () => {
    const r = await searchTeoriaContent({ q: 'cotizacion' })
    expect(r.total).toBeGreaterThan(0)
    // algún fragmento debe contener la forma acentuada
    const joined = r.hits.map((h) => h.snippet).join(' ').toLowerCase()
    expect(joined).toContain('cotización')
  }, 30000)

  it('query vacía → sin resultados', async () => {
    expect((await searchTeoriaContent({ q: '' })).total).toBe(0)
    expect((await searchTeoriaContent({ q: '   ' })).total).toBe(0)
  })

  it('AISLAMIENTO: existe teoria_content_tsv y el content_tsv del chat sigue vivo', async () => {
    const c = new Client({
      connectionString: (DB_URL as string).replace(/\?.*$/, ''),
      ssl: { rejectUnauthorized: false },
    })
    await c.connect()
    try {
      const cols = await c.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name='articles' AND column_name IN ('teoria_content_tsv','content_tsv')`
      )
      const names = cols.rows.map((r) => r.column_name)
      expect(names).toContain('teoria_content_tsv') // la mía
      expect(names).toContain('content_tsv') // la del chat, intacta
      // el trigger del chat sigue registrado (no lo pisé)
      const trg = await c.query<{ tgname: string }>(
        `SELECT tgname FROM pg_trigger WHERE tgrelid='public.articles'::regclass AND NOT tgisinternal`
      )
      const tnames = trg.rows.map((r) => r.tgname)
      expect(tnames).toContain('articles_tsv_trigger') // chat
      expect(tnames).toContain('tg_teoria_content_tsv') // mía
    } finally {
      await c.end().catch(() => {})
    }
  }, 30000)
})
