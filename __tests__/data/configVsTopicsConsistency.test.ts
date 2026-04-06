// __tests__/data/configVsTopicsConsistency.test.ts
// Test de consistencia: verifica que oposiciones.ts NO contradiga la tabla topics.
// Si el programa oficial cambia, hay que actualizar AMBOS (o migrar a BD única).
import { OPOSICIONES } from '@/lib/config/oposiciones'

// Mock supabase para queries directas
const mockTopics: Array<{ position_type: string; topic_number: number; title: string }> = []
let mockLoaded = false

async function loadTopicsFromBd() {
  if (mockLoaded) return
  try {
    const dotenv = require('dotenv')
    dotenv.config({ path: '.env.local' })
    const { createClient } = require('@supabase/supabase-js')
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    const { data } = await supabase
      .from('topics')
      .select('position_type, topic_number, title')
      .eq('is_active', true)
      .order('topic_number')
    if (data) mockTopics.push(...data)
    mockLoaded = true
  } catch {
    // Sin BD disponible, skip
  }
}

beforeAll(async () => {
  await loadTopicsFromBd()
}, 15000)

describe('Config oposiciones.ts vs BD topics', () => {
  it('cada oposición en config debe tener el mismo número de temas que en BD', () => {
    if (mockTopics.length === 0) return // skip sin BD

    for (const opo of OPOSICIONES) {
      const configThemes = opo.blocks.flatMap(b => b.themes)
      const bdTopics = mockTopics.filter(t => t.position_type === opo.positionType)

      if (bdTopics.length === 0) continue // oposición sin topics en BD (normal para nuevas)

      expect(configThemes.length).toBe(bdTopics.length)
    }
  })

  it('los IDs de temas en config deben coincidir con topic_number en BD', () => {
    if (mockTopics.length === 0) return

    for (const opo of OPOSICIONES) {
      const configThemes = opo.blocks.flatMap(b => b.themes)
      const bdTopics = mockTopics.filter(t => t.position_type === opo.positionType)

      if (bdTopics.length === 0) continue

      const configIds = new Set(configThemes.map(t => t.id))
      const bdIds = new Set(bdTopics.map(t => t.topic_number))

      // Todos los IDs de config deben existir en BD
      for (const id of configIds) {
        expect(bdIds.has(id)).toBe(true)
      }
    }
  })

  it('no debe haber desfase de contenido entre config y BD (nombres similares)', () => {
    if (mockTopics.length === 0) return

    const mismatches: string[] = []

    for (const opo of OPOSICIONES) {
      const configThemes = opo.blocks.flatMap(b => b.themes)
      const bdTopics = mockTopics.filter(t => t.position_type === opo.positionType)

      if (bdTopics.length === 0) continue

      for (const ct of configThemes) {
        const bdTopic = bdTopics.find(t => t.topic_number === ct.id)
        if (!bdTopic) continue

        // Normalizar para comparar
        const normalize = (s: string) => s.toLowerCase()
          .replace(/[áà]/g, 'a').replace(/[éè]/g, 'e').replace(/[íì]/g, 'i')
          .replace(/[óò]/g, 'o').replace(/[úù]/g, 'u')
          .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()

        const configNorm = normalize(ct.name)
        const bdNorm = normalize(bdTopic.title)

        // Al menos deben compartir alguna palabra clave (3+ chars)
        const configWords = configNorm.split(' ').filter(w => w.length >= 3)
        const bdWords = bdNorm.split(' ').filter(w => w.length >= 3)
        const shared = configWords.filter(w => bdWords.includes(w))

        if (shared.length === 0) {
          mismatches.push(`${opo.slug} T${ct.id}: config="${ct.name}" vs BD="${bdTopic.title}"`)
        }
      }
    }

    if (mismatches.length > 0) {
      fail(`Desfase config vs BD detectado:\n${mismatches.join('\n')}`)
    }
  })
})
