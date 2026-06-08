// __tests__/lib/api/temario/deriveVideoCourses.test.ts
//
// Tests de la derivación de vídeo-cursos por tema (lib/api/temario/videoCourses.ts).
//
// Reemplaza el mapping hardcodeado `topicVideoCourses` (frágil — caso María José/
// Valencia 08/06: Valencia sin cursos por olvido, Madrid con versión equivocada).
// La derivación cruza las leyes del tema con video_courses.law_id → fuente única,
// versión correcta, cero mapping que olvidar. Estos tests blindan ese contrato.

import { deriveVideoCourses, type VideoCourseRow } from '@/lib/api/temario/videoCourses'

// Catálogo de cursos de ejemplo (con law_id ficticios estables).
const LAW = {
  word365: 'law-word-365',
  excel365: 'law-excel-365',
  windows11: 'law-windows-11',
  windows10: 'law-windows-10', // existe como ley pero NO tiene curso
  access365: 'law-access-365',
}

const row = (slug: string, lawId: string | null, order: number, extra: Partial<VideoCourseRow> = {}): VideoCourseRow => ({
  slug,
  title: `Curso de ${slug}`,
  totalLessons: 3,
  totalDurationMinutes: 100,
  description: `desc ${slug}`,
  lawId,
  isActive: true,
  orderPosition: order,
  ...extra,
})

const CATALOG: VideoCourseRow[] = [
  row('word-365', LAW.word365, 1),
  row('excel-365', LAW.excel365, 2),
  row('access-365', LAW.access365, 3),
  row('windows-11', LAW.windows11, 4),
]

describe('deriveVideoCourses — derivación por leyes del tema', () => {

  it('devuelve los cursos cuyas leyes están en el tema', () => {
    const courses = deriveVideoCourses([LAW.word365, LAW.excel365], CATALOG)
    expect(courses.map(c => c.slug)).toEqual(['word-365', 'excel-365'])
  })

  it('RESPETA LA VERSIÓN: tema con Windows 10 NO muestra el curso de Windows 11', () => {
    // Caso Madrid: su temario tiene Windows 10 (sin curso), no Windows 11.
    const courses = deriveVideoCourses([LAW.windows10], CATALOG)
    expect(courses).toEqual([])
  })

  it('tema sin ninguna ley con curso → array vacío', () => {
    const courses = deriveVideoCourses(['law-cualquiera', 'law-otra'], CATALOG)
    expect(courses).toEqual([])
  })

  it('ignora cursos inactivos', () => {
    const catalog = [...CATALOG, row('word-365-beta', LAW.word365, 0, { isActive: false })]
    const courses = deriveVideoCourses([LAW.word365], catalog)
    // Solo el activo, no el beta inactivo (aunque comparta ley)
    expect(courses.map(c => c.slug)).toEqual(['word-365'])
  })

  it('ignora cursos sin law_id', () => {
    const catalog = [...CATALOG, row('huerfano', null, 0)]
    const courses = deriveVideoCourses(['law-cualquiera'], catalog)
    expect(courses).toEqual([])
  })

  it('ordena por orderPosition', () => {
    const courses = deriveVideoCourses([LAW.windows11, LAW.word365, LAW.access365], CATALOG)
    // order: word(1) < access(3) < windows(4)
    expect(courses.map(c => c.slug)).toEqual(['word-365', 'access-365', 'windows-11'])
  })

  it('dedup defensivo por slug', () => {
    const catalog = [...CATALOG, row('word-365', LAW.word365, 9)] // duplicado mismo slug
    const courses = deriveVideoCourses([LAW.word365], catalog)
    expect(courses.filter(c => c.slug === 'word-365')).toHaveLength(1)
  })

  it('mapea los campos del banner y normaliza nulls a 0', () => {
    const catalog = [row('x', LAW.word365, 0, { totalLessons: null, totalDurationMinutes: null })]
    const [c] = deriveVideoCourses([LAW.word365], catalog)
    expect(c).toEqual({
      slug: 'x', title: 'Curso de x', totalLessons: 0, totalDurationMinutes: 0, description: 'desc x',
    })
  })

  it('input vacío de leyes → array vacío', () => {
    expect(deriveVideoCourses([], CATALOG)).toEqual([])
  })

  // ── Casos reales documentados (de la simulación contra BD) ──

  it('caso Valencia: temario con Word/Excel/Windows11 → muestra esos cursos', () => {
    // Valencia (auxiliar) tiene en scope: Word 365, Excel 365, Windows 11.
    const courses = deriveVideoCourses([LAW.word365, LAW.excel365, LAW.windows11], CATALOG)
    expect(courses.map(c => c.slug).sort()).toEqual(['excel-365', 'windows-11', 'word-365'])
  })

  it('caso Madrid: Word/Excel/Access pero Windows 10 → NO windows-11', () => {
    // Madrid tiene Windows 10 (sin curso) → la derivación corrige el bug del
    // mapping viejo, que mostraba windows-11 por error.
    const courses = deriveVideoCourses([LAW.word365, LAW.excel365, LAW.access365, LAW.windows10], CATALOG)
    const slugs = courses.map(c => c.slug)
    expect(slugs).toContain('word-365')
    expect(slugs).toContain('access-365')
    expect(slugs).not.toContain('windows-11') // ← el fix
  })
})
