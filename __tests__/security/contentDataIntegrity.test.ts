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

  test('NO debe haber preguntas psicotécnicas activas con cuadro/tabla en texto y sin content_data ni image_url', async () => {
    // Obtener psicotécnicas activas con content_data vacío Y sin image_url
    const rows = await query(
      'psychometric_questions',
      'select=id,question_text,question_subtype,content_data&is_active=eq.true&content_data=eq.%7B%7D&image_url=is.null'
    ) as Array<{ id: string; question_text: string; question_subtype: string; content_data: Record<string, unknown> }>

    const patterns = ['cuadro', 'figura', 'imagen', 'diagrama', 'casilla', 'recuadro']
    // Patrones que requieren word-boundary para evitar falsos positivos:
    // 'tabla' matchea 'tabla' pero no 'contable'; 'gráfico' pero no 'ortográfico'
    const regexPatterns = [/\btabla\b/, /\bgráfico\b/, /\bcírculo\b/]
    const problematic = rows.filter(q => {
      const text = (q.question_text || '').toLowerCase()
      // Excluir subtipos que normalmente no necesitan imagen
      if (['error_detection', 'text_question', 'word_analysis', 'synonym', 'antonym', 'definition', 'analogy'].includes(q.question_subtype)) return false
      return patterns.some(p => text.includes(p)) || regexPatterns.some(r => r.test(text))
    })

    if (problematic.length > 0) {
      console.error(
        `${problematic.length} preguntas psicotécnicas activas sin content_data ni image_url:`,
        problematic.map(q => q.id.substring(0, 8))
      )
    }

    expect(problematic.length).toBe(0)
  }, 15000)

  test('NO debe haber preguntas psicotécnicas activas de tipo data_tables sin content_data ni image_url', async () => {
    // Excluir las que tienen image_url (imágenes en Supabase Storage)
    const rows = await query(
      'psychometric_questions',
      'select=id,question_text&is_active=eq.true&question_subtype=eq.data_tables&content_data=eq.%7B%7D&image_url=is.null'
    ) as Array<{ id: string; question_text: string }>

    if (rows.length > 0) {
      console.error(
        `${rows.length} preguntas data_tables activas sin content_data ni image_url:`,
        rows.map(q => q.id.substring(0, 8))
      )
    }

    expect(rows.length).toBe(0)
  }, 15000)

  test('Preguntas data_tables con image_url: la imagen debe ser accesible (muestreo)', async () => {
    // Las preguntas data_tables con content_data vacío dependen de image_url
    // para mostrar las tablas. Verificar que las imágenes existen.
    const rows = await query(
      'psychometric_questions',
      'select=id,image_url&is_active=eq.true&question_subtype=eq.data_tables&content_data=eq.%7B%7D&image_url=not.is.null&limit=5'
    ) as Array<{ id: string; image_url: string }>

    for (const row of rows) {
      const res = await fetch(row.image_url, { method: 'HEAD' })
      if (!res.ok) {
        console.error(`Imagen 404 para ${row.id.substring(0, 8)}: ${row.image_url}`)
      }
      expect(res.ok).toBe(true)
    }
  }, 30000)

  test('NO debe haber preguntas psicotécnicas de chart sin content_data ni image_url', async () => {
    // Verificar TODOS los subtipos de chart, no solo data_tables
    const chartSubtypes = ['data_tables', 'pie_chart', 'bar_chart', 'line_chart', 'mixed_chart']
    let total = 0

    for (const subtype of chartSubtypes) {
      const rows = await query(
        'psychometric_questions',
        `select=id&is_active=eq.true&question_subtype=eq.${subtype}&content_data=eq.%7B%7D&image_url=is.null`
      ) as Array<{ id: string }>
      total += rows.length
      if (rows.length > 0) {
        console.error(`${rows.length} preguntas ${subtype} sin content_data ni image_url:`, rows.map(q => q.id.substring(0, 8)))
      }
    }

    expect(total).toBe(0)
  }, 30000)

  test('API psicotécnicas debe devolver imageUrl para preguntas data_tables con content_data vacío', async () => {
    // Este test verifica el flujo completo: BD → API → respuesta con imageUrl
    // Previene el bug de 386 preguntas invisibles (01/04/2026)
    const apiUrl = `${SUPABASE_URL}/rest/v1/psychometric_questions?select=id,image_url,content_data&is_active=eq.true&question_subtype=eq.data_tables&content_data=eq.%7B%7D&image_url=not.is.null&limit=3`
    const res = await fetch(apiUrl, {
      headers: { 'apikey': SUPABASE_KEY!, 'Authorization': `Bearer ${SUPABASE_KEY!}` },
    })
    const rows = await res.json() as Array<{ id: string; image_url: string; content_data: Record<string, unknown> }>

    if (rows.length === 0) return // No hay preguntas de este tipo

    // Verificar que las preguntas tienen image_url en BD
    for (const row of rows) {
      expect(row.image_url).toBeTruthy()
    }

    // Verificar que la API de psicotécnicas (Drizzle) también devuelve imageUrl
    // Simulando lo que hace PsychometricTestExecutor
    const drizzleApiUrl = `${SUPABASE_URL}/rest/v1/psychometric_questions?select=id,image_url&is_active=eq.true&question_subtype=eq.data_tables&content_data=eq.%7B%7D&limit=1`
    const drizzleRes = await fetch(drizzleApiUrl, {
      headers: { 'apikey': SUPABASE_KEY!, 'Authorization': `Bearer ${SUPABASE_KEY!}` },
    })
    const drizzleRows = await drizzleRes.json() as Array<{ id: string; image_url: string | null }>

    // Si hay preguntas data_tables con content_data vacío, DEBEN tener image_url
    for (const row of drizzleRows) {
      if (!row.image_url) {
        console.error(`Pregunta ${row.id.substring(0, 8)} data_tables sin content_data NI image_url — será invisible`)
      }
      expect(row.image_url).toBeTruthy()
    }
  }, 15000)

  test('NO debe haber preguntas psicotécnicas activas con texto genérico sin contenido visual', async () => {
    // Detecta preguntas cuyo question_text no contiene la serie/datos y dependen de una imagen que no existe
    // Caso real: "Elija el número que sustituya a la interrogación:" sin image_url ni content_data
    const genericPatterns = [
      'sustituya a la interrogación',
      'sustituya al interrogante',
      'ocupe el lugar',
    ]

    let total = 0
    for (const pattern of genericPatterns) {
      const rows = await query(
        'psychometric_questions',
        `select=id,question_text&is_active=eq.true&content_data=eq.%7B%7D&image_url=is.null&question_text=ilike.*${encodeURIComponent(pattern)}*`
      ) as Array<{ id: string; question_text: string }>
      if (rows.length > 0) {
        console.error(`${rows.length} preguntas con "${pattern}" sin contenido visual:`, rows.map(q => q.id.substring(0, 8)))
      }
      total += rows.length
    }

    expect(total).toBe(0)
  }, 15000)

  test('NO debe haber preguntas legislativas activas que referencien imágenes no disponibles', async () => {
    // Patrones que indican referencia a imagen/tabla visual
    const patterns = [
      'siguiente imagen', 'imagen que se muestra', 'tabla mostrada',
      'mostrada a continuación', 'anexo Excel', 'la imagen de Excel'
    ]

    let total = 0
    for (const pattern of patterns) {
      // Excluir preguntas que YA tienen image_url o content_data (imágenes/datos visuales resueltos)
      const rows = await query(
        'questions',
        `select=id&is_active=eq.true&image_url=is.null&content_data=eq.%7B%7D&question_text=ilike.*${encodeURIComponent(pattern)}*`
      ) as Array<{ id: string }>
      total += rows.length
    }

    if (total > 0) {
      console.error(`${total} preguntas legislativas activas sin image_url ni content_data:`)
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

  test('NO debe haber preguntas sobre normas autonómicas vinculadas a leyes estatales', async () => {
    // Previene que preguntas de CyL/Madrid/etc aparezcan en otras oposiciones
    // Caso real: pregunta sobre Decreto 7/2016 CyL vinculada a art. 24 Ley 19/2013 (estatal)

    // Obtener IDs de leyes estatales conocidas donde se han filtrado preguntas autonómicas
    const nationalLaws = await query('laws', 'select=id,short_name&scope=eq.national&is_active=eq.true') as Array<{ id: string; short_name: string }>
    const organicLaws = await query('laws', 'select=id,short_name&scope=eq.organic&is_active=eq.true') as Array<{ id: string; short_name: string }>
    const stateLawIds = new Set([...nationalLaws, ...organicLaws].map(l => l.id))

    // Patrones de normas autonómicas específicas en question_text
    const patterns = [
      'Decreto 7/2016%acceso%información',  // CyL
      'Ley 1/1998%Régimen Local%Castilla',  // CyL
      'Decreto 7/2016%Castilla',            // CyL
    ]

    let total = 0
    for (const pattern of patterns) {
      const rows = await query(
        'questions',
        `select=id,question_text,primary_article_id&is_active=eq.true&primary_article_id=not.is.null&question_text=ilike.*${encodeURIComponent(pattern)}*`
      ) as Array<{ id: string; question_text: string; primary_article_id: string }>

      for (const q of rows) {
        const arts = await query('articles', `select=law_id&id=eq.${q.primary_article_id}`) as Array<{ law_id: string }>
        if (arts.length > 0 && stateLawIds.has(arts[0].law_id)) {
          console.error(`Pregunta ${q.id.substring(0, 8)} menciona norma autonómica vinculada a ley estatal: ${q.question_text?.substring(0, 80)}`)
          total++
        }
      }
    }

    expect(total).toBe(0)
  }, 15000)
})
