// scripts/sim-boe-detector.ts
//
// SIMULACIÓN sobre casos REALES del detector de cambios de leyes (normalización + comparación
// de contenido servido). Prueba end-to-end que el arreglo:
//   (1) NO vuelve a marcar 'changed' las re-consolidaciones que hoy son falsos positivos
//       (Ley 4/2021 FPV y Ley 1/2015 Hacienda GVA, verificadas a mano el 24/07), y
//   (2) SÍ detecta un cambio real (se inyecta una modificación de 1 palabra en un artículo).
//
// Uso: node_modules/.bin/tsx -r tsconfig-paths/register scripts/sim-boe-detector.ts
// Env: DATABASE_URL (RDS). Red: descarga el consolidado del BOE (curl-like fetch).

import { readFileSync } from 'fs'
import { join } from 'path'
import pg from 'pg'
import { extractBoeArticles, classifyContentChange, type OurArticle } from '../lib/api/boe-changes/normalize'

function dbUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const env = readFileSync(join(__dirname, '..', '.env.local'), 'utf8')
  return (env.match(/^DATABASE_URL=(.*)$/m) as RegExpMatchArray)[1].trim()
}

const CASES = [
  { name: 'Ley 4/2021 FPV', lawId: '1c6a8da6-f371-47c0-a19a-d1ab2f1f06ae', boeId: 'BOE-A-2021-8880' },
  { name: 'Ley 1/2015 Hacienda GVA', lawId: '391b6356-b72e-4ebb-bc5b-a76b6a795762', boeId: 'BOE-A-2015-1952' },
]

async function fetchBoe(boeId: string): Promise<string> {
  const res = await fetch(`https://www.boe.es/buscar/act.php?id=${boeId}`, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VenceBot/1.0)' },
  })
  return res.text()
}

async function ourArticles(client: pg.Client, lawId: string): Promise<Map<string, OurArticle>> {
  const { rows } = await client.query(
    "SELECT article_number, is_active, coalesce(content,'') content FROM articles WHERE law_id=$1",
    [lawId],
  )
  const m = new Map<string, OurArticle>()
  for (const r of rows) m.set(String(r.article_number).toLowerCase(), { content: r.content, active: r.is_active })
  return m
}

async function main() {
  const client = new pg.Client({ connectionString: dbUrl(), ssl: { rejectUnauthorized: false } })
  await client.connect()
  let allOk = true

  for (const c of CASES) {
    const html = await fetchBoe(c.boeId)
    const boe = extractBoeArticles(html)
    const ours = await ourArticles(client, c.lawId)

    // (1) CASO REAL tal cual: debe salir SIN cambio (era falso positivo).
    const real = classifyContentChange(ours, boe)
    const ok1 = real.isRealChange === false
    allOk &&= ok1
    console.log(`\n═══ ${c.name} (${boe.size} arts BOE, ${ours.size} en BD)`)
    console.log(`  [real]      isRealChange=${real.isRealChange}  → ${ok1 ? '✅ sin falso positivo' : '❌ FALSO POSITIVO'}  (${real.reason})`)

    // (2) INYECCIÓN de cambio real: modifico 1 palabra de un artículo activo del BOE.
    const target = [...boe.keys()].find((n) => ours.get(n.toLowerCase())?.active && (boe.get(n) as string).length > 40)
    if (target) {
      const mutated = new Map(boe)
      const txt = boe.get(target) as string
      mutated.set(target, txt.replace(/\bpodrán\b/i, 'deberán').replace(/\bde\b/, 'DEL') /* fuerza 1 cambio */)
      const inj = classifyContentChange(ours, mutated)
      const ok2 = inj.isRealChange === true && inj.changedArticles.includes(target)
      allOk &&= ok2
      console.log(`  [inyectado] art ${target} 1 palabra cambiada → isRealChange=${inj.isRealChange}  → ${ok2 ? '✅ recall OK (lo caza)' : '❌ SE ESCAPA'}`)
    }
  }

  await client.end()
  console.log(`\n${allOk ? '✅ SIMULACIÓN PERFECTA' : '❌ SIMULACIÓN FALLÓ'}: falsos positivos eliminados + recall intacto sobre datos reales.`)
  process.exit(allOk ? 0 : 1)
}

main().catch((e) => {
  console.error('💥', e)
  process.exit(1)
})
