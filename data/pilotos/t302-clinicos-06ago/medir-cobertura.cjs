// Mide cobertura de claves antes/después de un enriquecimiento propuesto, SOLO LECTURA
// (VENCE_LECTOR_URL). Gemelo de solo-lectura de data/pilotos/t291-escalon2-30jul/aplicar-articulo.cjs
// — ese script escribe (--apply, vía DATABASE_URL); este NUNCA escribe, es deliberado para T-302:
// el worker que lo corrió no tiene permiso de escritura en la BD de negocio.
const path = require('path'), fs = require('fs')
const ROOT = path.resolve(__dirname, '../../..')
require(path.join(ROOT, 'node_modules/dotenv')).config({ path: path.join(ROOT, '.env.local') })
const postgres = require(path.join(ROOT, 'node_modules/postgres'))
const [ley, num, fichero] = process.argv.slice(2).filter(a => !a.startsWith('--'))
const sql = postgres(process.env.VENCE_LECTOR_URL + '?sslmode=require', { ssl: { rejectUnauthorized: false }, max: 2 })
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
const STOP = new Set(['excel', 'celda', 'celdas', 'funcion', 'funciones', 'formula', 'formulas', 'valor', 'valores', 'datos', 'rango', 'opcion', 'todas', 'todos', 'entre', 'sobre', 'cuando'])
function cobertura(qs, texto) {
  let cub = 0, tot = 0, faltan = []
  for (const r of qs) {
    const clave = r['option_' + 'abcd'[r.correct_option]] || ''
    const toks = [...new Set(norm(clave).replace(/[^a-z0-9. ]/g, ' ').split(/\s+/)
      .map(t => t.replace(/^[.]+|[.]+$/g, '')).filter(t => t.length >= 5 && !STOP.has(t)))]
    if (!toks.length) continue
    tot++
    if (toks.some(t => norm(texto).includes(t))) cub++
    else faltan.push(clave.slice(0, 80))
  }
  return { cub, tot, faltan }
}
;(async () => {
  const nuevo = fs.readFileSync(fichero, 'utf8')
  const [a] = await sql`SELECT a.id, a.content, a.title FROM articles a JOIN laws l ON l.id = a.law_id
    WHERE l.short_name = ${ley} AND a.article_number = ${num}`
  if (!a) { console.error('❌ artículo no encontrado'); process.exit(1) }
  const qs = await sql`SELECT correct_option, option_a, option_b, option_c, option_d
    FROM questions WHERE primary_article_id = ${a.id} AND is_active`
  const antes = cobertura(qs, a.content)
  const despues = cobertura(qs, nuevo)
  console.log(`${ley} art.${num} «${a.title}»`)
  console.log(`  ${a.content.length} → ${nuevo.length} chars (×${(nuevo.length / a.content.length).toFixed(1)})`)
  console.log(`  cobertura de las claves — antes: ${antes.cub}/${antes.tot} · después: ${despues.cub}/${despues.tot}`)
  if (despues.faltan.length) {
    console.log('  aún sin cubrir:')
    for (const f of despues.faltan) console.log('    -', f)
  }
  console.log('\n🔎 SOLO LECTURA — este script nunca escribe. Aplicar requiere DATABASE_URL de escritura (fuera del alcance de este worker).')
  await sql.end()
})().catch(e => { console.error('❌', e.message); process.exit(1) })
