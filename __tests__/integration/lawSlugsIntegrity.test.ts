/**
 * Tests de integridad: todas las leyes activas deben tener slug.
 * Detecta el bug de Madrid (leyes importadas sin slug → 404 en /leyes/[slug]).
 *
 * Requiere .env.local con credenciales reales de Supabase.
 * Se salta automáticamente si no hay BD disponible.
 */
import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        apikey: REAL_KEY!,
        Authorization: `Bearer ${REAL_KEY}`,
      },
    }, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error(`Failed to parse: ${data.substring(0, 200)}`))
        }
      })
    }).on('error', reject)
  })
}

const describeIfDb = hasRealDb ? describe : describe.skip

describeIfDb('Law slugs integrity', () => {
  let activeLaws: Array<{ id: string; short_name: string; slug: string | null }>

  beforeAll(async () => {
    activeLaws = await supabaseGet('laws', 'select=id,short_name,slug&is_active=eq.true')
  }, 15000)

  test('all active laws must have a slug', () => {
    const missingSlug = activeLaws.filter(l => !l.slug)
    if (missingSlug.length > 0) {
      const names = missingSlug.map(l => l.short_name).join(', ')
      throw new Error(`${missingSlug.length} leyes activas sin slug (causaría 404 en /leyes/[slug]): ${names}`)
    }
  })

  test('slugs must be unique', () => {
    const slugs = activeLaws.filter(l => l.slug).map(l => l.slug!)
    const seen = new Set<string>()
    const duplicates: string[] = []
    slugs.forEach(s => {
      if (seen.has(s)) duplicates.push(s)
      seen.add(s)
    })
    expect(duplicates).toEqual([])
  })

  test('slugs must be URL-safe (lowercase, dashes, no special chars)', () => {
    const invalid = activeLaws
      .filter(l => l.slug && !/^[a-z0-9-]+$/.test(l.slug))
      .map(l => `${l.short_name}: "${l.slug}"`)
    expect(invalid).toEqual([])
  })
})
