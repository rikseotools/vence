/**
 * @jest-environment node
 *
 * Test de integridad: el simulacro NUNCA debe devolver preguntas legislativas
 * con menos de 4 opciones de respuesta.
 *
 * Contexto del bug original (16/05/2026):
 *
 *   sampleLegislativeByArticles() filtraba solo por is_active y
 *   primary_article_id, sin tener en cuenta el número de opciones.
 *
 *   Como las preguntas del banco InnoTest de Policía Nacional (10.740q,
 *   formato 3 opciones A/B/C) están vinculadas a artículos universales
 *   (Constitución, EBEP, TUE, LOPD…), 611 preguntas PN podían colarse en
 *   simulacros AAE — que es formato 4 opciones — confundiendo al opositor.
 *
 *   Fix: añadir isNotNull(questions.optionD) al WHERE. Commit c99573e6.
 *
 * Este test garantiza que la regresión no vuelva a aparecer.
 *
 * Requiere:
 * - .env.local con credenciales reales de Supabase (service role) → para
 *   verificar el escenario latente en BD.
 * - Dev server corriendo en localhost:3000 (`npm run dev`) → para verificar
 *   el endpoint del simulacro.
 *
 * En CI sin servicio, los tests respectivos se skipean.
 */
import http from 'http'
import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))
const DEV_BASE = process.env.DEV_BASE_URL || 'http://localhost:3000'

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

interface SimulacroQuestion {
  id: string
  questionType: string
  questionText: string
  optionA?: string | null
  optionB?: string | null
  optionC?: string | null
  optionD?: string | null
}

function httpGetJson<T = unknown>(url: string, timeoutMs = 30_000): Promise<T> {
  const client = url.startsWith('https') ? https : http
  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { reject(new Error(`Failed to parse: ${data.substring(0, 200)}`)) }
      })
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error('timeout'))
    })
  })
}

async function fetchSimulacro(oposicion: string): Promise<{
  success: boolean
  questions?: SimulacroQuestion[]
  error?: string
}> {
  // Timeout generoso: el simulacro real puede tardar 15-30s.
  return httpGetJson(`${DEV_BASE}/api/v2/simulacro/questions?oposicion=${oposicion}`, 45_000)
}

async function devServerAlive(): Promise<boolean> {
  // Probe ligero a un endpoint barato (la API de psychometric devuelve rápido).
  // El simulacro real puede tardar 10-20s en cold start; no usarlo para health check.
  return new Promise((resolve) => {
    const req = http.get(`${DEV_BASE}/api/psychometric-test-data`, (res) => {
      res.resume()
      resolve(res.statusCode === 200)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(5000, () => { req.destroy(); resolve(false) })
  })
}

describe('simulacro: invariante de número de opciones', () => {
  let devAlive = false

  beforeAll(async () => {
    devAlive = await devServerAlive()
  })

  it('si dev server está vivo: el simulacro AAE solo devuelve legislativas con 4 opciones', async () => {
    if (!devAlive) {
      // eslint-disable-next-line no-console
      console.warn(`⏭️  Saltado: dev server no responde en ${DEV_BASE}`)
      return
    }

    // Generar 3 simulacros independientes para reducir varianza del random sampling.
    for (let i = 0; i < 3; i++) {
      const result = await fetchSimulacro('auxiliar-administrativo-estado')
      expect(result.success).toBe(true)

      const legislativas = (result.questions ?? []).filter(
        (q) => q.questionType !== 'psychometric'
      )
      expect(legislativas.length).toBeGreaterThan(0)

      const threeOptions = legislativas.filter((q) => q.optionD == null)
      if (threeOptions.length > 0) {
        // eslint-disable-next-line no-console
        console.error(
          'Preguntas con 3 opciones detectadas en simulacro AAE:',
          threeOptions.slice(0, 5).map((q) => ({
            id: q.id,
            text: q.questionText?.slice(0, 80),
          }))
        )
      }
      expect(threeOptions.length).toBe(0)
    }
  }, 60_000)

  ;(hasRealDb ? it : it.skip)(
    'BD: si existen preguntas legislativas con 3 opciones, todas deben tener un tag identificable (PN u otro)',
    async () => {
      // Sanidad: verificar que las preguntas con 3 opciones están tagueadas
      // para que un futuro filtro por tags también funcionara como salvaguarda.
      const sample = await supabaseGet<{ tags: string[] | null }>(
        'questions',
        'select=tags&is_active=eq.true&option_d=is.null&limit=200'
      )
      const untagged = sample.filter(q => !q.tags || q.tags.length === 0)
      if (untagged.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(`⚠️  ${untagged.length}/${sample.length} preguntas con 3 opciones sin tags`)
      }
      expect(untagged.length).toBe(0)
    },
    20_000
  )
})
