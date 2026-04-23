/**
 * Detecta artículos con contenido placeholder (texto genérico tipo
 * "Artículo X del Decreto..." en vez del contenido legal real).
 * Bug reportado por tatianacedenozamora@gmail.com (22/04/2026) —
 * 6 artículos del Decreto 69/2017 CM tenían placeholder desde su creación.
 */

import dotenv from 'dotenv'
import https from 'https'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function queryArticles(filter: string): Promise<{ article_number: string; law_id: string }[]> {
  const restUrl = `${REAL_URL}/rest/v1/articles?select=article_number,law_id&is_active=eq.true&${filter}&limit=50`
  return new Promise((resolve, reject) => {
    https.get(restUrl, {
      headers: {
        apikey: REAL_KEY!,
        Authorization: `Bearer ${REAL_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Failed to parse: ${data.substring(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

describe('Article content — no placeholders', () => {
  const runIf = hasRealDb ? it : it.skip

  runIf('no articles start with "Artículo N del" (placeholder pattern)', async () => {
    const placeholders: string[] = []

    for (let i = 1; i <= 20; i++) {
      const filter = `content=like.Art%C3%ADculo+${i}+del*`
      const rows = await queryArticles(filter)
      for (const r of rows) {
        placeholders.push(`Art. ${r.article_number} (law: ${r.law_id.substring(0, 8)})`)
      }
    }

    if (placeholders.length > 0) {
      console.error(`\n❌ ${placeholders.length} artículos con contenido placeholder:`)
      for (const p of placeholders) console.error(`  ${p}`)
    }

    expect(placeholders).toHaveLength(0)
  })
})
