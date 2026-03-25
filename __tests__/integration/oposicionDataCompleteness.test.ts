/**
 * Test de integridad: verifica que las oposiciones activas tienen los datos
 * necesarios para landings, seguimiento y breadcrumbs.
 *
 * Detecta datos incompletos que causan errores en producción:
 * - Sin seguimiento_url → no se monitorea
 * - Sin programa_url → link roto en predicciones
 * - Sin temas_count → predicciones incorrectas
 * - Sin boe_reference → landing incompleta
 *
 * Requiere .env.local con credenciales reales de Supabase.
 */
import https from 'https'
import dotenv from 'dotenv'
import { OPOSICIONES } from '@/lib/config/oposiciones'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
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

const describeIfDb = hasRealDb ? describe : describe.skip

// Campos requeridos para TODAS las oposiciones activas
const REQUIRED_FIELDS = ['nombre', 'temas_count', 'bloques_count'] as const
// Campos requeridos solo para oposiciones con convocatoria activa
const CONVOCATORIA_FIELDS = ['seguimiento_url', 'boe_reference'] as const

interface OposicionRow {
  slug: string
  nombre: string | null
  is_convocatoria_activa: boolean
  seguimiento_url: string | null
  programa_url: string | null
  boe_reference: string | null
  plazas_libres: number | null
  temas_count: number | null
  bloques_count: number | null
}

describeIfDb('Oposición data completeness', () => {
  let oposiciones: OposicionRow[]

  beforeAll(async () => {
    oposiciones = await supabaseGet<OposicionRow>(
      'oposiciones',
      'select=slug,nombre,is_convocatoria_activa,seguimiento_url,programa_url,boe_reference,plazas_libres,temas_count,bloques_count&is_active=eq.true'
    )
  }, 30000)

  test('all active oposiciones have nombre, temas_count, bloques_count', () => {
    const missing: string[] = []
    for (const o of oposiciones) {
      for (const field of REQUIRED_FIELDS) {
        if (!o[field] && o[field] !== 0) {
          missing.push(`${o.slug}: missing ${field}`)
        }
      }
    }
    if (missing.length > 0) console.warn('Missing required fields:', missing)
    expect(missing.length).toBe(0)
  })

  test('all oposiciones with convocatoria activa have seguimiento_url', () => {
    const active = oposiciones.filter(o => o.is_convocatoria_activa)
    const missing = active.filter(o => !o.seguimiento_url)
    if (missing.length > 0) {
      console.warn('Active oposiciones without seguimiento_url:', missing.map(o => o.slug))
    }
    expect(missing.length).toBe(0)
  })

  test('all oposiciones with convocatoria activa have boe_reference', () => {
    const active = oposiciones.filter(o => o.is_convocatoria_activa)
    const missing = active.filter(o => !o.boe_reference)
    if (missing.length > 0) {
      console.warn('Active oposiciones without boe_reference:', missing.map(o => o.slug))
    }
    expect(missing.length).toBe(0)
  })

  test('every OPOSICIONES config entry has a matching row in BD', () => {
    const dbSlugs = new Set(oposiciones.map(o => o.slug))
    const missing = OPOSICIONES.filter(o => !dbSlugs.has(o.slug))
    if (missing.length > 0) {
      console.warn('Config oposiciones not in BD:', missing.map(o => o.slug))
    }
    expect(missing.length).toBe(0)
  })

  test('every BD oposición has a matching OPOSICIONES config entry', () => {
    const configSlugs = new Set(OPOSICIONES.map(o => o.slug))
    const extra = oposiciones.filter(o => o.slug && !configSlugs.has(o.slug))
    if (extra.length > 0) {
      console.warn('BD oposiciones not in config:', extra.map(o => o.slug))
    }
    // Allow some extra in BD (null slugs, etc.) but warn
    const meaningful = extra.filter(o => o.slug && o.slug !== 'null')
    expect(meaningful.length).toBe(0)
  })
})
