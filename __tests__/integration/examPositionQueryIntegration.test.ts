// __tests__/integration/examPositionQueryIntegration.test.ts
// Test de integración contra BD real para verificar que los filtros de
// exam_position funcionan correctamente (AND, no OR).
// Se salta si no hay credenciales reales de Supabase (CI-safe).

import { EXAM_POSITION_MAP, getValidExamPositions } from '@/lib/config/exam-positions'
import dotenv from 'dotenv'
import https from 'https'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

interface Question {
  id: string
  exam_position: string | null
  is_official_exam: boolean
}

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
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`))
          return
        }
        try { resolve(JSON.parse(data)) }
        catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

const describeIfDb = hasRealDb ? describe : describe.skip

describeIfDb('BD Real: filtro exam_position con .in()', () => {

  test('Estado y Madrid devuelven conjuntos disjuntos', async () => {
    const estadoPositions = getValidExamPositions('auxiliar_administrativo_estado')
    const madridPositions = getValidExamPositions('auxiliar_administrativo_madrid')

    const estadoFilter = estadoPositions.map(p => `exam_position.eq.${p}`).join(',')
    const madridFilter = madridPositions.map(p => `exam_position.eq.${p}`).join(',')

    const estadoQs = await supabaseGet<Question>(
      'questions',
      `select=id,exam_position&is_official_exam=is.true&is_active=is.true&or=(${estadoFilter})&limit=500`
    )
    const madridQs = await supabaseGet<Question>(
      'questions',
      `select=id,exam_position&is_official_exam=is.true&is_active=is.true&or=(${madridFilter})&limit=500`
    )

    const estadoIds = new Set(estadoQs.map(q => q.id))
    const overlap = madridQs.filter(q => estadoIds.has(q.id))
    expect(overlap.length).toBe(0)
  })

  test('preguntas filtradas por Estado tienen exam_position correcto', async () => {
    const positions = getValidExamPositions('auxiliar_administrativo_estado')
    const filter = positions.map(p => `exam_position.eq.${p}`).join(',')

    const questions = await supabaseGet<Question>(
      'questions',
      `select=id,exam_position&is_official_exam=is.true&is_active=is.true&or=(${filter})&limit=100`
    )

    for (const q of questions) {
      expect(positions.map(p => p.toLowerCase())).toContain(q.exam_position?.toLowerCase())
    }
  })

  test('preguntas filtradas por Madrid tienen exam_position correcto', async () => {
    const positions = getValidExamPositions('auxiliar_administrativo_madrid')
    const filter = positions.map(p => `exam_position.eq.${p}`).join(',')

    const questions = await supabaseGet<Question>(
      'questions',
      `select=id,exam_position&is_official_exam=is.true&is_active=is.true&or=(${filter})&limit=100`
    )

    expect(questions.length).toBeGreaterThan(0)
    for (const q of questions) {
      expect(positions.map(p => p.toLowerCase())).toContain(q.exam_position?.toLowerCase())
    }
  })

  test('cada exam_position en BD está cubierto por EXAM_POSITION_MAP', async () => {
    const questions = await supabaseGet<Question>(
      'questions',
      'select=exam_position&is_official_exam=is.true&is_active=is.true&exam_position=not.is.null&limit=2000'
    )

    const allMappedValues = Object.values(EXAM_POSITION_MAP).flat().map(v => v.toLowerCase())
    const bdValues = [...new Set(questions.map(q => q.exam_position?.toLowerCase()).filter(Boolean))]

    const unmapped = bdValues.filter(v => !allMappedValues.includes(v as string))
    if (unmapped.length > 0) {
      console.error('exam_position en BD sin mapear:', unmapped)
    }
    expect(unmapped.length).toBe(0)
  })

  test('no hay preguntas oficiales activas sin exam_position (< 10%)', async () => {
    const allOfficial = await supabaseGet<Question>(
      'questions',
      'select=id,exam_position&is_official_exam=is.true&is_active=is.true&limit=5000'
    )

    const nullCount = allOfficial.filter(q => !q.exam_position).length
    const total = allOfficial.length
    const pctNull = total > 0 ? (nullCount / total) * 100 : 0

    if (nullCount > 0) {
      console.warn(`⚠️ ${nullCount}/${total} (${pctNull.toFixed(1)}%) preguntas oficiales sin exam_position`)
    }
    expect(pctNull).toBeLessThan(10)
  })
})
