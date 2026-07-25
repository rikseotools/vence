/**
 * @jest-environment node
 */
// __tests__/integration/docKeyParity.integration.test.ts
//
// GUARDARRAÍL JS↔SQL del hub de provenance (T-107). El canonicalizador JS
// (lib/convocatoria/canonicalizeBoletinUrl.cjs) y su espejo SQL `boletin_doc_key`
// DEBEN dar el mismo `doc_key` para los boletines reconocidos — si divergen, el backend
// (SQL) y los scripts (JS) generan doc_keys distintos → dedup roto en el hub.
//
// Corre contra PROD (read-only) en el job `integration` de CI → caza el DRIFT REAL que un
// test local no puede: alguien edita el JS y no el SQL (o al revés), o la función en RDS ≠
// la migración (hand-edit/migración sin aplicar, el gap que encontró la auditoría 25/07).
// `boletin_doc_key` es pura (sin acceso a tablas) → segura sobre la réplica read-only.
import dotenv from 'dotenv'
import postgres from 'postgres'
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { canonicalizeBoletinUrl } = require('../../lib/convocatoria/canonicalizeBoletinUrl.cjs')

dotenv.config({ path: '.env.local', override: true })
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

// Mismos fixtures que el canary CLI (scripts/provenance/canary-doc-key-parity.cjs): todos
// los boletines RECONOCIDOS, donde JS y SQL deben coincidir exactamente.
const FIXTURES = [
  'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262',
  'https://www.boe.es/boe/dias/2025/12/22/pdfs/BOE-A-2025-26262.pdf',
  'https://sede.inap.gob.es/sites/sede/files/public/2026-03/BOE-A-2026-6249.pdf',
  'https://www.bocm.es/boletin/CM_Orden_BOCM/2026/02/18/BOCM-20260218-2.PDF',
  'https://www.boe.es/buscar/act.php?id=BOE-A-2023-7500',
  'https://www.boe.es/x?id=BOE-B-2026-123',
  'https://dogv.gva.es/datos/2026/03/12/pdf/2026_8057_es.pdf',
  'https://dogv.gva.es/datos/2026/03/12/pdf/2026_8057_va.pdf',
  'https://bocyl.jcyl.es/boletines/2026/06/24/pdf/BOCYL-D-24062026-120-22.pdf',
  'https://portaldogc.gencat.cat/ca/document-del-dogc/?documentId=1035641',
  // patrones añadidos en la campaña T-107 (25/07) — deben tener paridad JS↔SQL o divergen en silencio
  'https://www.gobiernodecanarias.org/boc/2024/239/3965.html',           // BOC (Canarias)
  'https://www.gobiernodecanarias.org/boc/2024/239/3965.pdf',            // BOC .pdf → mismo docKey
  'https://www.juntadeandalucia.es/boja/2024/191/27',                    // BOJA (Andalucía)
  'https://www.xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0004_es.html', // DOG (Galicia)
  'https://www.xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0004_gl.html', // DOG _gl → mismo docKey
  'https://mia.aragon.es/documentos?csv=CSVS60B0W34IP1Q0XFIL',           // MIA (portal CSV Aragón)
  'https://carp-core-mia.aragon.es/rest/documentos/CSVS60B0W34IP1Q0XFIL/pdf', // MIA API → mismo docKey
]

const describeIfDb = process.env.DATABASE_URL ? describe : describe.skip

describeIfDb('doc_key — paridad JS ↔ SQL (boletin_doc_key en RDS)', () => {
  const url = (process.env.DATABASE_URL || '').split('?')[0]
  const local = /@(localhost|127\.0\.0\.1|host\.containers\.internal)[:/]/.test(url)
  const sql = postgres(url, { ssl: local ? false : { rejectUnauthorized: false }, onnotice: () => {} })

  afterAll(async () => {
    await sql.end()
  })

  test.each(FIXTURES)('JS y SQL coinciden en el doc_key de %s', async (u) => {
    const js = canonicalizeBoletinUrl(u).docKey
    const rows = await sql`SELECT boletin_doc_key(${u}) AS k`
    expect(rows[0].k).toBe(js)
  })
})
