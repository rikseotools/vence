/**
 * Test de integridad: verifica que los artículos de leyes no tienen
 * código JavaScript, HTML entities, footer del BOE u otros artefactos de scraping.
 *
 * Previene regresiones como la Ley 1/1983 CM que tenía código JS incrustado.
 * Requiere .env.local con credenciales reales de Supabase.
 * Se salta automáticamente si no hay BD disponible.
 */
import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseRpc(query: string): Promise<unknown[]> {
  const url = `${REAL_URL}/rest/v1/rpc/exec_sql`
  // Use direct REST query instead
  const restUrl = `${REAL_URL}/rest/v1/articles?select=id,article_number,content&${query}&limit=20`
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

const describeIfDb = hasRealDb ? describe : describe.skip

describeIfDb('Article content integrity', () => {

  test('no articles have JavaScript code (document.querySelector)', async () => {
    const articles = await supabaseRpc('content=like.*document.querySelector*') as { article_number: string }[]
    expect(articles.length).toBe(0)
  }, 30000)

  test('no articles have JavaScript code (document.write)', async () => {
    const articles = await supabaseRpc('content=like.*document.write*') as { article_number: string }[]
    expect(articles.length).toBe(0)
  }, 30000)

  test('no articles have HTML entity &aacute;', async () => {
    const articles = await supabaseRpc('content=like.*%26aacute%3B*') as { article_number: string }[]
    expect(articles.length).toBe(0)
  }, 30000)

  test('no articles have HTML entity &iacute;', async () => {
    const articles = await supabaseRpc('content=like.*%26iacute%3B*') as { article_number: string }[]
    expect(articles.length).toBe(0)
  }, 30000)

  test('no articles have BOE code references (LE0000xxxxxx)', async () => {
    const articles = await supabaseRpc('content=like.*LE0000019668*') as { article_number: string }[]
    expect(articles.length).toBe(0)
  }, 30000)

  test('no articles have Newsletter/Cookies footer text', async () => {
    const articles = await supabaseRpc('content=like.*Newsletter Gestionar Cookies*') as { article_number: string }[]
    expect(articles.length).toBe(0)
  }, 30000)

})
