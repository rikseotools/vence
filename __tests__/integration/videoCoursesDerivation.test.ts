/**
 * Test de integración: derivación de vídeo-cursos por tema contra BD real.
 *
 * Blinda el fix del caso María José/Valencia (08/06/2026). Verifica que:
 *   1. El vínculo curso↔ley está íntegro (los 7 cursos activos tienen law_id).
 *   2. La derivación produce los cursos correctos por oposición (Valencia: 5).
 *   3. Respeta la versión: Madrid (Windows 10) NO recibe el curso de Windows 11.
 *
 * Si este test falla:
 *   - Cursos sin law_id → alguien rompió el vínculo (revisar migración 20260608).
 *   - Valencia sin cursos → regresión del fetcher o del topic_scope.
 *   - Madrid con windows-11 → el bug de versión reapareció.
 *
 * Auto-skip sin credenciales (CI sin BD). Usa fetch a la REST API directa (NO
 * supabase-js, que está mockeado en jest; NI pg, que no va en jsdom). Service
 * role para bypassear RLS, igual que el fetcher real.
 */
import https from 'https'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', override: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const hasDb = !!(URL && KEY && !URL.includes('test.supabase.co'))
const d = hasDb ? describe : describe.skip

// https (módulo node), NO fetch ni supabase-js — ambos están mockeados/ausentes
// en el entorno jsdom de jest. Patrón de los demás integration tests del proyecto.
function rest<T = Record<string, unknown>>(table: string, params: string): Promise<T[]> {
  return new Promise((resolve, reject) => {
    https
      .get(
        `${URL}/rest/v1/${table}?${params}`,
        { headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` } },
        (res) => {
          let data = ''
          res.on('data', (c) => (data += c))
          res.on('end', () => {
            try {
              resolve(JSON.parse(data))
            } catch {
              reject(new Error(`Failed to parse ${table}: ${data.substring(0, 200)}`))
            }
          })
        },
      )
      .on('error', reject)
  })
}

// Réplica de la derivación del fetcher (queries separadas + cruce en JS).
async function derivedCoursesFor(positionType: string): Promise<string[]> {
  const topics = await rest<{ id: string }>('topics', `position_type=eq.${positionType}&select=id`)
  const topicIds = topics.map((t) => t.id)
  if (topicIds.length === 0) return []

  const scope = await rest<{ law_id: string | null }>(
    'topic_scope',
    `topic_id=in.(${topicIds.join(',')})&select=law_id`,
  )
  const lawIds = new Set(scope.map((s) => s.law_id).filter(Boolean))

  const courses = await rest<{ slug: string; law_id: string | null }>(
    'video_courses',
    `is_active=eq.true&select=slug,law_id`,
  )
  return courses
    .filter((c) => c.law_id && lawIds.has(c.law_id))
    .map((c) => c.slug)
    .sort()
}

d('Derivación de vídeo-cursos (integración BD)', () => {
  it('los cursos activos tienen law_id (vínculo íntegro)', async () => {
    const courses = await rest<{ slug: string; law_id: string | null }>(
      'video_courses',
      `is_active=eq.true&select=slug,law_id`,
    )
    expect(courses.length).toBeGreaterThanOrEqual(7)
    expect(courses.filter((c) => !c.law_id).map((c) => c.slug)).toEqual([])
  })

  it('Valencia (auxiliar) deriva sus 5 cursos de informática', async () => {
    const slugs = await derivedCoursesFor('auxiliar_administrativo_valencia')
    expect(slugs).toEqual(
      ['excel-365', 'explorador-windows-11', 'outlook-365', 'windows-11', 'word-365'].sort(),
    )
  })

  it('Madrid usa Windows 10 → NO recibe Windows 11 (versión correcta)', async () => {
    const slugs = await derivedCoursesFor('auxiliar_administrativo_madrid')
    expect(slugs).not.toContain('windows-11')
    expect(slugs).not.toContain('explorador-windows-11')
    expect(slugs).toContain('word-365')
    expect(slugs).toContain('excel-365')
  })
})
