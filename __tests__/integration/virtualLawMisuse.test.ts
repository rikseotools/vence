/**
 * Test de integración: detecta leyes mal marcadas como `is_virtual=true`.
 *
 * Contexto (25/06/2026): una ley `is_virtual=true` es un CONTENEDOR didáctico
 * para contenido SIN norma legal real (ofimática Word/Excel, teoría sanitaria).
 * Si una ley tiene fuente oficial (`boe_url` / `boe_id`) es una norma REAL y
 * debe ser legislativa (`is_virtual=false`) — y sus preguntas `approved`, no
 * `tech_approved`.
 *
 * Incidente: al recuperar la #100 del supuesto CARM se creó por error como
 * virtual el "Plan General de PRL de la CARM" (que tiene apoyo legal, BORM
 * 174/2010). Al construir esta guarda se descubrieron 8 leyes mal marcadas,
 * incluidas 4 leyes sanitarias reales (Ley 6/2002 Salud Aragón, Ley 12/2001
 * LOSCAM, Ley 8/2008 Galicia, Ley 3/2009 Murcia) — la idea errónea
 * "sanidad = virtual". Las 8 se reclasificaron a legislativa.
 *
 * Manual: docs/maintenance/importar-examen-oficial-completo.md §7.4.quater.1
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
    https
      .get(url, { headers: { apikey: REAL_KEY!, Authorization: `Bearer ${REAL_KEY}` } }, (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          try {
            resolve(JSON.parse(data))
          } catch {
            reject(new Error(`Failed to parse: ${data.substring(0, 200)}`))
          }
        })
      })
      .on('error', reject)
  })
}

describe('Leyes virtuales — no deben tener fuente legal oficial', () => {
  if (!hasRealDb) {
    test.skip('Skipped: NEXT_PUBLIC_SUPABASE_URL no configurado', () => {})
    return
  }

  test('Ninguna ley is_virtual=true debe tener boe_url ni boe_id (sería una norma real mal clasificada)', async () => {
    const params = [
      'select=id,short_name,boe_url,boe_id',
      'is_virtual=is.true',
      'or=(boe_url.not.is.null,boe_id.not.is.null)',
      'limit=200',
    ].join('&')

    const rows = await supabaseGet<{ id: string; short_name: string; boe_url: string | null; boe_id: string | null }>(
      'laws',
      params
    )

    if (rows.length > 0) {
      console.error('\n❌ LEYES VIRTUALES CON FUENTE OFICIAL (deberían ser legislativas):')
      rows.forEach((r) => console.error(`   - ${r.short_name} | boe_url:${r.boe_url || '-'} | boe_id:${r.boe_id || '-'} | ${r.id}`))
      console.error('\n   is_virtual es solo para contenido SIN norma legal (ofimática/teoría).')
      console.error('   Fix: UPDATE laws SET is_virtual=false + re-transicionar sus preguntas tech_approved → approved.')
      console.error('   Manual: docs/maintenance/importar-examen-oficial-completo.md §7.4.quater.1\n')
    }

    expect(rows.map((r) => r.short_name)).toEqual([])
  }, 20000)
})
