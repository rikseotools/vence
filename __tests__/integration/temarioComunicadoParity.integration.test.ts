/**
 * @jest-environment node
 */
// __tests__/integration/temarioComunicadoParity.integration.test.ts
//
// GUARDARRAÍL: la señal SQL del detector de "comunicado de temario" (en
// scripts/temario/detect-temario-revision.cjs + verify:epigrafe dump) DEBE coincidir con la
// función pura JS lib/temario/temarioRefiningDoc.js sobre los documentos reales del hub. Si
// divergen, el forcing function ("verifica contra los comunicados que afinan el programa")
// fallaría. Nace del caso CARM (ofimática en un comunicado 2025, no en el programa base 2016).
// Corre en CI contra PROD read-only.
import dotenv from 'dotenv'
import postgres from 'postgres'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { esTemarioRefiningDoc } = require('../../lib/temario/temarioRefiningDoc.js')

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('temario comunicado — paridad JS ↔ SQL (hub)', () => {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url)
  const sql = postgres(url, { ssl: local ? false : { rejectUnauthorized: false }, onnotice: () => {} })

  afterAll(async () => {
    await sql.end()
  })

  test('la señal SQL (>=5 Tema o PowerPoint+Excel) coincide con esTemarioRefiningDoc(JS) en docs reales', async () => {
    // muestra mixta: docs con señal SQL positiva + una muestra general
    const rows = await sql`
      SELECT id, extracted_text,
        ((SELECT count(*) FROM regexp_matches(extracted_text, 'tema[[:space:]]+[0-9]+', 'gi')) >= 5
         OR (extracted_text ~* 'powerpoint' AND extracted_text ~* 'excel')) AS sql_flag
      FROM convocatoria_documentos
      WHERE extracted_text IS NOT NULL
      ORDER BY (extracted_text ~* 'powerpoint' AND extracted_text ~* 'excel') DESC, length(extracted_text) DESC
      LIMIT 60`
    const mismatches = rows
      .filter((r) => esTemarioRefiningDoc(r.extracted_text) !== r.sql_flag)
      .map((r) => r.id)
    expect(mismatches).toEqual([])
    // 60 s, no los 10 por defecto: la muestra son los documentos MÁS GRANDES a propósito (hasta
    // 1,2 MB cada uno) y traerlos tarda ~14 s. Con el timeout por defecto el test moría antes de
    // comparar nada y su rojo se leía como "flaky", que es como se tardó un mes en ver que la
    // señal SQL no casaba NADA.
  }, 60_000)

  test('el caso CARM: hay >=1 documento de temario (ofimática) en su convocatoria vigente', async () => {
    const rows = await sql`
      SELECT count(*)::int AS n
      FROM convocatoria_documentos cd
      JOIN convocatorias cv ON cv.id = cd.convocatoria_id AND cv.is_current
      JOIN oposiciones o ON o.id = cv.oposicion_id
      WHERE o.slug = 'auxiliar-administrativo-carm' AND cd.extracted_text IS NOT NULL
        AND (cd.extracted_text ~* 'powerpoint' AND cd.extracted_text ~* 'excel')`
    expect(rows[0].n).toBeGreaterThanOrEqual(1)
  })
})
