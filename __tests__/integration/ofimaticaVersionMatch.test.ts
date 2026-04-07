/**
 * Test: Verifica que la versión de software en el epígrafe de cada tema
 * coincide con la versión de la ley virtual en el topic_scope.
 *
 * Previene vincular un tema "Word 2016" a la ley genérica "Procesadores de texto" (365).
 * Se salta en CI si no hay credenciales de BD.
 */
import dotenv from 'dotenv'
import https from 'https'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { apikey: REAL_KEY!, Authorization: `Bearer ${REAL_KEY}` },
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`${table}: ${res.statusCode}`))
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

// Leyes genéricas (365) que NO deben usarse cuando el epígrafe pide versión específica
const GENERIC_365_LAWS = [
  'Procesadores de texto',
  'Hojas de cálculo. Excel',
  'Base de datos: Access',
  'Correo electrónico',
]

// Mapa: clave de versión → short_names aceptables en scope
const ACCEPTABLE_SCOPE: Record<string, string[]> = {
  'word-2016': ['Word 2016'],
  'word-2019': ['Word 2019'],
  'word-2021': ['Word 2021'],
  'word-365': ['Procesadores de texto', 'Word 365'],
  'excel-2016': ['Excel 2016'],
  'excel-2019': ['Excel 2019'],
  'excel-2021': ['Excel 2021'],
  'excel-365': ['Hojas de cálculo. Excel', 'Excel 365'],
  'outlook-2016': ['Outlook 2016'],
  'outlook-2019': ['Outlook 2019'],
  'outlook-2021': ['Outlook 2021'],
  'outlook-365': ['Correo electrónico', 'Outlook 365'],
  'access-2016': ['Access 2016'],
  'access-2019': ['Access 2019'],
  'access-2021': ['Access 2021'],
  'access-365': ['Base de datos: Access', 'Access 365'],
  'powerpoint-2016': ['PowerPoint 2016'],
  'powerpoint-2019': ['PowerPoint 2019'],
  'powerpoint-365': ['PowerPoint 365'],
  'W10': ['Windows 10', 'Explorador Windows 10'],
  'W11': ['Windows 11', 'Explorador Windows 11'],
  'LO': ['LibreOffice Writer', 'LibreOffice Calc', 'LibreOffice Base'],
}

function detectVersions(text: string): Array<{ product: string; version: string; key: string }> {
  const results: Array<{ product: string; version: string; key: string }> = []
  const products = [
    { name: 'word', regex: /word\s*(2016|2019|2021|365)/i },
    { name: 'excel', regex: /excel\s*(2016|2019|2021|365)/i },
    { name: 'outlook', regex: /outlook\s*(2016|2019|2021|365)/i },
    { name: 'access', regex: /access\s*(2016|2019|2021|365)/i },
    { name: 'powerpoint', regex: /powerpoint\s*(2016|2019|2021|365)/i },
  ]
  for (const p of products) {
    const match = text.match(p.regex)
    if (match) results.push({ product: p.name, version: match[1], key: `${p.name}-${match[1]}` })
  }
  if (/windows\s*10/i.test(text)) results.push({ product: 'windows', version: '10', key: 'W10' })
  if (/windows\s*11/i.test(text)) results.push({ product: 'windows', version: '11', key: 'W11' })
  if (/libreoffice/i.test(text)) results.push({ product: 'libreoffice', version: 'any', key: 'LO' })
  return results
}

interface TopicRow { id: string; topic_number: number; title: string; epigrafe: string | null; position_type: string }
interface ScopeRow { topic_id: string; law_id: string }
interface LawRow { id: string; short_name: string }
interface OpoRow { slug: string }

const describeIf = hasRealDb ? describe : describe.skip

describeIf('Ofimática: versión epígrafe ↔ scope sin mismatches', () => {
  test('Ningún tema con versión específica usa ley genérica 365', async () => {
    const opos = await supabaseGet<OpoRow>('oposiciones', 'select=slug&is_active=eq.true')
    const allLaws = await supabaseGet<LawRow>('laws', 'select=id,short_name&is_active=eq.true')
    const lawMap = new Map(allLaws.map(l => [l.id, l.short_name]))

    const issues: string[] = []

    for (const o of opos) {
      const pt = o.slug.replace(/-/g, '_')
      const topics = await supabaseGet<TopicRow>(
        'topics',
        `select=id,topic_number,title,epigrafe,position_type&position_type=eq.${pt}&is_active=eq.true`
      )

      for (const t of topics) {
        const epText = t.epigrafe || t.title || ''
        const versions = detectVersions(epText)
        if (versions.length === 0) continue

        const scopes = await supabaseGet<ScopeRow>(
          'topic_scope',
          `select=topic_id,law_id&topic_id=eq.${t.id}`
        )
        if (scopes.length === 0) continue // sin scope = en elaboración, OK

        const scopeNames = scopes.map(s => lawMap.get(s.law_id) || 'UNKNOWN')

        for (const dv of versions) {
          const acceptable = ACCEPTABLE_SCOPE[dv.key]
          if (!acceptable) continue

          const hasCorrectLaw = scopeNames.some(sn => acceptable.includes(sn))
          const usesGeneric = scopeNames.some(sn => GENERIC_365_LAWS.includes(sn))
          const isSpecificVersion = dv.version !== '365' && dv.key !== 'LO'

          if (!hasCorrectLaw && usesGeneric && isSpecificVersion) {
            issues.push(
              `${o.slug} T${t.topic_number}: epígrafe=${dv.product} ${dv.version}, ` +
              `scope=${scopeNames.filter(sn => GENERIC_365_LAWS.includes(sn)).join('+')} (genérico 365)`
            )
          }
        }
      }
    }

    if (issues.length > 0) {
      console.error('\nMismatches versión ofimática encontrados:')
      issues.forEach(i => console.error('  ❌ ' + i))
    }

    expect(issues).toEqual([])
  }, 120000)
})
