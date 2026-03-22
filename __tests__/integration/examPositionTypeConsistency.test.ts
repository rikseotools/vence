/**
 * Test exhaustivo: verifica que las 16 páginas de examen resuelven
 * correctamente su position_type via slugToPositionType() y que
 * cada valor existe en la BD con topics y topic_scopes.
 */
import https from 'https'
import dotenv from 'dotenv'
import { slugToPositionType } from '@/lib/config/oposiciones'
import { getValidExamPositions } from '@/lib/config/exam-positions'

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
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Failed to parse: ${data.substring(0, 200)}`)) }
      })
    }).on('error', reject)
  })
}

// Los 16 slugs que tienen página de examen
const EXAM_PAGE_SLUGS = [
  'administrativo-estado',
  'auxiliar-administrativo-estado',
  'auxiliar-administrativo-andalucia',
  'auxiliar-administrativo-aragon',
  'auxiliar-administrativo-asturias',
  'auxiliar-administrativo-ayuntamiento-valencia',
  'auxiliar-administrativo-baleares',
  'auxiliar-administrativo-canarias',
  'auxiliar-administrativo-carm',
  'auxiliar-administrativo-clm',
  'auxiliar-administrativo-cyl',
  'auxiliar-administrativo-extremadura',
  'auxiliar-administrativo-galicia',
  'auxiliar-administrativo-madrid',
  'auxiliar-administrativo-valencia',
  'tramitacion-procesal',
]

describe('Exam page position_type consistency (unit)', () => {
  it.each(EXAM_PAGE_SLUGS)('%s → slugToPositionType returns non-empty string', (slug) => {
    const pt = slugToPositionType(slug)
    expect(pt).toBeTruthy()
    expect(typeof pt).toBe('string')
    expect(pt.length).toBeGreaterThan(0)
  })

  it.each(EXAM_PAGE_SLUGS)('%s → position_type uses underscores not dashes', (slug) => {
    const pt = slugToPositionType(slug)
    expect(pt).not.toContain('-')
  })

  it('auxiliar-administrativo-estado has valid exam positions', () => {
    const pt = slugToPositionType('auxiliar-administrativo-estado')
    const positions = getValidExamPositions(pt)
    expect(positions.length).toBeGreaterThan(0)
  })
})

const describeIfDb = hasRealDb ? describe : describe.skip

describeIfDb('Exam page position_type consistency (DB)', () => {
  it.each(EXAM_PAGE_SLUGS)('%s → has topics in DB', async (slug) => {
    const pt = slugToPositionType(slug)
    const rows = await supabaseGet<{ id: string }>(
      'topics',
      `select=id&position_type=eq.${pt}&limit=1`
    )
    expect(rows.length).toBeGreaterThan(0)
  }, 30000)

  it.each(EXAM_PAGE_SLUGS)('%s → has topic_scopes in DB', async (slug) => {
    const pt = slugToPositionType(slug)
    // Get topic IDs first
    const topics = await supabaseGet<{ id: string }>(
      'topics',
      `select=id&position_type=eq.${pt}&limit=100`
    )
    expect(topics.length).toBeGreaterThan(0)

    // Check at least one has scope
    const topicIds = topics.map(t => t.id)
    const scopes = await supabaseGet<{ id: string }>(
      'topic_scope',
      `select=id&topic_id=in.(${topicIds.join(',')})&limit=1`
    )
    expect(scopes.length).toBeGreaterThan(0)
  }, 30000)
})
