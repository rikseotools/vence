// T-190 — ¿los 4 documentos re-clonados traen ya la ficha de ANÁLISIS con las plazas en cifra?
const { Client } = require('pg')
const { pgConfig } = require('../lib/db/pgSsl.cjs')

const CASOS = [
  ['auxiliar-administrativo-ayuntamiento-madrid', 'BOE-A-2024-21734', 256],
  ['auxiliar-administrativo-ayuntamiento-cordoba', 'BOE-A-2026-9772', 55],
  ['auxiliar-administrativo-diputacion-zaragoza', 'BOE-A-2026-6897', 26],
  ['administrativo-diputacion-valencia', 'BOE-A-2026-9387', 66],
]

;(async () => {
  const c = new Client(pgConfig()); await c.connect()
  const filas = []
  for (const [slug, ref, plazas] of CASOS) {
    const r = await c.query(`
      select d.url, length(d.extracted_text) chars, d.extracted_text txt
      from convocatoria_documentos d
      join convocatorias cv on cv.id = d.convocatoria_id
      join oposiciones o on o.id = cv.oposicion_id
      where o.slug = $1 and d.url like '%' || $2 || '%'
      order by d.fetched_at desc limit 1`, [slug, ref])
    if (!r.rows[0]) { filas.push({ slug, estado: '❌ no encontrado' }); continue }
    const t = r.rows[0].txt || ''
    filas.push({
      slug: slug.slice(0, 42),
      chars: r.rows[0].chars,
      analisis: /AN[ÁA]LISIS/i.test(t) ? '✅' : '❌',
      turno_libre: /Turno libre/i.test(t) ? '✅' : '❌',
      [`cifra ${plazas}`]: t.includes(String(plazas)) ? '✅' : '❌',
      es_txtphp: /txt\.php/.test(r.rows[0].url) ? '✅' : '❌',
    })
  }
  console.table(filas)
  const malo = filas.some(f => Object.values(f).includes('❌') || f.estado)
  console.log(malo ? '❌ alguno no trae la ficha' : '✅ los 4 traen la ficha de análisis con su cifra')
  await c.end()
})().catch(e => { console.error(e.message); process.exit(1) })
