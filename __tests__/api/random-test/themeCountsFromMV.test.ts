/** @jest-environment node */
// Tests de getThemeCountsFromMV: el fast-path que lee los conteos por tema de las
// MVs (topic_law_question_summary + topic_official_by_position) en vez del join
// 4-tablas + count(DISTINCT) en vivo. Verifica mapeo, lee de las MVs (no del join),
// el lower-case de exam_position y los edge cases (sin temas / sin posiciones).

import { getThemeCountsFromMV } from '@/lib/api/topic-data/mv-queries'

function fakeDb(rows: unknown[]) {
  return { execute: jest.fn().mockResolvedValue(rows) } as never
}

describe('getThemeCountsFromMV', () => {
  it('topicNumbers vacío → [] sin tocar BD', async () => {
    const db = fakeDb([])
    const r = await getThemeCountsFromMV(db, 'pt', [], ['x'])
    expect(r).toEqual([])
    expect((db as unknown as { execute: jest.Mock }).execute).not.toHaveBeenCalled()
  })

  it('mapea filas de la MV a {topicNumber,total,official} con coerción numérica', async () => {
    const db = fakeDb([
      { topic_number: 1, total: '157', official: '6' },
      { topic_number: 2, total: 0, official: 0 },
    ])
    const r = await getThemeCountsFromMV(db, 'auxiliar_administrativo_estado', [1, 2], ['auxiliar administrativo'])
    expect(r).toEqual([
      { topicNumber: 1, total: 157, official: 6 },
      { topicNumber: 2, total: 0, official: 0 },
    ])
  })

  it('lee de las MVs (NO del join en vivo) y filtra por positionType', async () => {
    const db = fakeDb([])
    await getThemeCountsFromMV(db, 'PT_TEST', [1], ['pos'])
    const s = JSON.stringify((db as unknown as { execute: jest.Mock }).execute.mock.calls[0][0])
    expect(s).toContain('topic_law_question_summary')
    expect(s).toContain('topic_official_by_position')
    expect(s).toContain('PT_TEST')
    expect(s).not.toContain('count(DISTINCT') // no es el join pesado en vivo
  })

  it('validPositions vacío → official = 0 (sin subquery de oficiales)', async () => {
    const db = fakeDb([])
    await getThemeCountsFromMV(db, 'pt', [1], [])
    const s = JSON.stringify((db as unknown as { execute: jest.Mock }).execute.mock.calls[0][0])
    expect(s).not.toContain('topic_official_by_position')
  })

  it('lowercasea exam_position (la MV guarda lower(exam_position))', async () => {
    const db = fakeDb([])
    await getThemeCountsFromMV(db, 'pt', [1], ['Auxiliar Administrativo Del Estado'])
    const s = JSON.stringify((db as unknown as { execute: jest.Mock }).execute.mock.calls[0][0])
    expect(s).toContain('auxiliar administrativo del estado')
    expect(s).not.toContain('Auxiliar Administrativo Del Estado')
  })
})
