import {
  summarizeLawInclusion,
  inclusionBadgeLabel,
  type LawStatLite,
} from '@/lib/laws/lawInclusionSummary'

const LAWS: LawStatLite[] = [
  { law_short_name: 'Ley 39/2015', display_name: 'Ley 39/2015 (Procedimiento)', questions_count: 4200, articles_with_questions: 100 },
  { law_short_name: 'Ley 40/2015', display_name: 'Ley 40/2015 (Régimen Jurídico)', questions_count: 1800, articles_with_questions: 80 },
  { law_short_name: 'CE', display_name: 'Constitución', questions_count: 900, articles_with_questions: 60 },
]

describe('summarizeLawInclusion', () => {
  it('CASO ALFONSO (25/07): 40/2015 acotada a 5 arts + 39/2015 sin acotar → 39/2015 ENTERA y flag mixto', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['Ley 39/2015', 'Ley 40/2015'],
      selectedArticlesByLaw: new Map([
        ['Ley 40/2015', new Set(['32', '33', '34', '35', '36'])],
      ]),
      selectedSectionFiltersCount: 0,
      lawsData: LAWS,
    })
    const l39 = out.perLaw.find(l => l.lawShortName === 'Ley 39/2015')!
    const l40 = out.perLaw.find(l => l.lawShortName === 'Ley 40/2015')!
    expect(l40.mode).toBe('articles')
    expect(l40.narrowedCount).toBe(5)
    expect(l39.mode).toBe('whole') // ← lo que le sorprendía: entra completa
    expect(out.wholeLaws).toEqual(['Ley 39/2015'])
    expect(out.narrowedLaws).toEqual(['Ley 40/2015'])
    expect(out.mixedWholeAndNarrowed).toBe(true) // ← dispara el aviso
    expect(out.wholeQuestionsTotal).toBe(4200)
  })

  it('todas acotadas por artículos → sin flag mixto', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['Ley 39/2015', 'Ley 40/2015'],
      selectedArticlesByLaw: new Map([
        ['Ley 39/2015', new Set(['1', '2'])],
        ['Ley 40/2015', new Set(['32'])],
      ]),
      selectedSectionFiltersCount: 0,
      lawsData: LAWS,
    })
    expect(out.wholeLaws).toEqual([])
    expect(out.mixedWholeAndNarrowed).toBe(false)
    expect(out.perLaw.every(l => l.mode === 'articles')).toBe(true)
  })

  it('todas enteras (varias leyes sin acotar) → NO es mixto (no hay acotada que contraste)', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['Ley 39/2015', 'Ley 40/2015'],
      selectedArticlesByLaw: new Map(),
      selectedSectionFiltersCount: 0,
      lawsData: LAWS,
    })
    expect(out.wholeLaws.sort()).toEqual(['Ley 39/2015', 'Ley 40/2015'])
    expect(out.narrowedLaws).toEqual([])
    expect(out.mixedWholeAndNarrowed).toBe(false)
    expect(out.wholeQuestionsTotal).toBe(6000)
  })

  it('una sola ley con títulos → mode=sections (los títulos solo aplican con 1 ley)', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['CE'],
      selectedArticlesByLaw: new Map(),
      selectedSectionFiltersCount: 3,
      lawsData: LAWS,
    })
    expect(out.perLaw[0].mode).toBe('sections')
    expect(out.perLaw[0].narrowedCount).toBe(3)
    expect(out.mixedWholeAndNarrowed).toBe(false) // 1 sola ley → nunca mixto
  })

  it('títulos con MÚLTIPLES leyes NO cuentan como acotación (isOnlySelected=false) → whole', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['Ley 39/2015', 'Ley 40/2015'],
      selectedArticlesByLaw: new Map([['Ley 40/2015', new Set(['32'])]]),
      selectedSectionFiltersCount: 5, // se ignora: hay 2 leyes
      lawsData: LAWS,
    })
    const l39 = out.perLaw.find(l => l.lawShortName === 'Ley 39/2015')!
    expect(l39.mode).toBe('whole')
    expect(out.mixedWholeAndNarrowed).toBe(true)
  })

  it('acepta selectedArticlesByLaw como Record (además de Map)', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['Ley 40/2015', 'Ley 39/2015'],
      selectedArticlesByLaw: { 'Ley 40/2015': ['32', '33'] },
      selectedSectionFiltersCount: 0,
      lawsData: LAWS,
    })
    expect(out.perLaw.find(l => l.lawShortName === 'Ley 40/2015')!.mode).toBe('articles')
    expect(out.perLaw.find(l => l.lawShortName === 'Ley 39/2015')!.mode).toBe('whole')
    expect(out.mixedWholeAndNarrowed).toBe(true)
  })

  it('deduplica leyes repetidas en la entrada', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['CE', 'CE'],
      selectedArticlesByLaw: new Map(),
      selectedSectionFiltersCount: 0,
      lawsData: LAWS,
    })
    expect(out.perLaw).toHaveLength(1)
  })

  it('ley sin questions_count → wholeQuestionsCount 0 sin romper', () => {
    const out = summarizeLawInclusion({
      selectedLaws: ['Rara'],
      selectedArticlesByLaw: new Map(),
      selectedSectionFiltersCount: 0,
      lawsData: [{ law_short_name: 'Rara', questions_count: null }],
    })
    expect(out.perLaw[0].wholeQuestionsCount).toBe(0)
    expect(out.perLaw[0].displayName).toBe('Rara') // cae al short_name
  })

  it('selección vacía → summary vacío, sin flag', () => {
    const out = summarizeLawInclusion({
      selectedLaws: [],
      selectedArticlesByLaw: new Map(),
      selectedSectionFiltersCount: 0,
      lawsData: LAWS,
    })
    expect(out.perLaw).toEqual([])
    expect(out.mixedWholeAndNarrowed).toBe(false)
    expect(out.wholeQuestionsTotal).toBe(0)
  })
})

describe('inclusionBadgeLabel', () => {
  it('artículos (plural/singular)', () => {
    expect(inclusionBadgeLabel({ lawShortName: 'x', displayName: 'x', mode: 'articles', narrowedCount: 5, wholeQuestionsCount: 0 })).toBe('5 artículos')
    expect(inclusionBadgeLabel({ lawShortName: 'x', displayName: 'x', mode: 'articles', narrowedCount: 1, wholeQuestionsCount: 0 })).toBe('1 artículo')
  })
  it('títulos (plural/singular)', () => {
    expect(inclusionBadgeLabel({ lawShortName: 'x', displayName: 'x', mode: 'sections', narrowedCount: 2, wholeQuestionsCount: 0 })).toBe('2 títulos')
    expect(inclusionBadgeLabel({ lawShortName: 'x', displayName: 'x', mode: 'sections', narrowedCount: 1, wholeQuestionsCount: 0 })).toBe('1 título')
  })
  it('ley entera con y sin conteo', () => {
    expect(inclusionBadgeLabel({ lawShortName: 'x', displayName: 'x', mode: 'whole', narrowedCount: 0, wholeQuestionsCount: 4200 })).toBe('toda la ley (4200 preg.)')
    expect(inclusionBadgeLabel({ lawShortName: 'x', displayName: 'x', mode: 'whole', narrowedCount: 0, wholeQuestionsCount: 0 })).toBe('toda la ley')
  })
})
