// __tests__/security/contentDataIntegrity.test.ts
// Tests de integridad: detectar preguntas activas con datos visuales faltantes
// Previene el incidente de Marzo 2026: preguntas con "cuadro/tabla" activas sin content_data
//
// Ejecutar: npx jest __tests__/security/contentDataIntegrity --no-coverage

import { resolve } from 'path'
import { readFileSync } from 'fs'

function loadRealEnv() {
  try {
    const envPath = resolve(__dirname, '../../.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const vars: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) vars[match[1].trim()] = match[2].trim()
    }
    return vars
  } catch {
    return {}
  }
}

const realEnv = loadRealEnv()
const SUPABASE_URL = realEnv.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = realEnv.SUPABASE_SERVICE_ROLE_KEY || realEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
const canRun = !!(SUPABASE_URL && SUPABASE_KEY)

const describeIf = canRun ? describe : describe.skip

async function query(table: string, params: string): Promise<unknown[]> {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${params}`
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY!}`,
    },
  })
  if (!res.ok) throw new Error(`Query failed: ${res.status} ${await res.text()}`)
  return res.json()
}

describeIf('Content Data Integrity', () => {

  // Restaurar fetch real (jest.setup.js lo mockea globalmente)
  const realFetch = jest.requireActual('node-fetch') as typeof fetch
  let originalFetch: typeof fetch

  beforeAll(() => {
    originalFetch = global.fetch
    global.fetch = realFetch
  })

  afterAll(() => {
    global.fetch = originalFetch
  })

  test('NO debe haber preguntas psicotécnicas activas con cuadro/tabla en texto y content_data vacío', async () => {
    // Obtener psicotécnicas activas con content_data vacío
    const rows = await query(
      'psychometric_questions',
      'select=id,question_text,content_data&is_active=eq.true&content_data=eq.%7B%7D'
    ) as Array<{ id: string; question_text: string; content_data: Record<string, unknown> }>

    const patterns = ['cuadro', 'tabla', 'figura', 'imagen', 'gráfico']
    const problematic = rows.filter(q => {
      const text = (q.question_text || '').toLowerCase()
      return patterns.some(p => text.includes(p))
    })

    if (problematic.length > 0) {
      console.error(
        `${problematic.length} preguntas psicotécnicas activas referencian datos visuales sin content_data:`,
        problematic.map(q => q.id.substring(0, 8))
      )
    }

    expect(problematic.length).toBe(0)
  }, 15000)

  test('NO debe haber preguntas psicotécnicas activas de tipo data_tables sin content_data', async () => {
    const rows = await query(
      'psychometric_questions',
      'select=id,question_text&is_active=eq.true&question_subtype=eq.data_tables&content_data=eq.%7B%7D'
    ) as Array<{ id: string; question_text: string }>

    if (rows.length > 0) {
      console.error(
        `${rows.length} preguntas data_tables activas sin content_data:`,
        rows.map(q => q.id.substring(0, 8))
      )
    }

    expect(rows.length).toBe(0)
  }, 15000)

  test('NO debe haber preguntas legislativas activas que referencien imágenes no disponibles', async () => {
    // Patrones que indican referencia a imagen/tabla visual
    const patterns = [
      'siguiente imagen', 'imagen que se muestra', 'tabla mostrada',
      'mostrada a continuación', 'anexo Excel', 'la imagen de Excel'
    ]

    let total = 0
    for (const pattern of patterns) {
      // Excluir preguntas que YA tienen image_url (imágenes en Supabase Storage)
      const rows = await query(
        'questions',
        `select=id&is_active=eq.true&image_url=is.null&question_text=ilike.*${encodeURIComponent(pattern)}*`
      ) as Array<{ id: string }>
      total += rows.length
    }

    if (total > 0) {
      console.error(`${total} preguntas legislativas activas referencian imágenes no disponibles (sin image_url)`)
    }

    expect(total).toBe(0)
  }, 30000)

  test('NO debe haber preguntas PRL activas vinculadas a Art. 40/43 CE', async () => {
    // Buscar artículos 40 y 43 de la CE
    const laws = await query('laws', 'select=id&short_name=eq.CE') as Array<{ id: string }>
    if (!laws.length) return

    const ceId = laws[0].id
    const articles = await query(
      'articles',
      `select=id&law_id=eq.${ceId}&article_number=in.("40","43")`
    ) as Array<{ id: string }>

    if (!articles.length) return

    for (const art of articles) {
      const questions = await query(
        'questions',
        `select=id,question_text&is_active=eq.true&primary_article_id=eq.${art.id}`
      ) as Array<{ id: string; question_text: string }>

      const prlWrong = questions.filter(q =>
        /prevención.*riesgo|riesgo.*laboral|486\/1997|31\/1995|seguridad.*salud.*trabajo/i.test(q.question_text || '')
      )

      if (prlWrong.length > 0) {
        console.error(
          `${prlWrong.length} preguntas PRL activas vinculadas a CE Art. ${art.id.substring(0, 8)}:`,
          prlWrong.map(q => q.id.substring(0, 8))
        )
      }

      expect(prlWrong.length).toBe(0)
    }
  }, 15000)
})
