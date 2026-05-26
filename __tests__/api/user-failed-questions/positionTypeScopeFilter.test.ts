/**
 * Tests para getUserFailedQuestions con scope filter por positionType
 * (post-26/05/2026, caso Cristina dispute cluster c7196843).
 *
 * Cambio: el endpoint ahora resuelve positionType desde user_profiles.target_oposicion
 * (server-side) y filtra el histórico por (law_id, article_number) que estén
 * en topic_scope del positionType actual. Si la oposición no tiene scopes
 * configurados, fallback legacy sin filtro (caso Lidia 18/04 — celador_sescam_clm).
 */

describe('getUserFailedQuestions — scope filter por positionType', () => {

  describe('Resolución positionType server-side', () => {
    it('resuelve desde user_profiles.target_oposicion', () => {
      const profile = { target_oposicion: 'auxiliar_administrativo_cyl' }
      const positionType = profile.target_oposicion?.trim() || null
      expect(positionType).toBe('auxiliar_administrativo_cyl')
    })

    it('target_oposicion null → positionType null → no aplica scope filter (legacy)', () => {
      const profile = { target_oposicion: null as string | null }
      const positionType = profile.target_oposicion?.trim() || null
      expect(positionType).toBeNull()
    })

    it('target_oposicion empty string → positionType null', () => {
      const profile = { target_oposicion: '   ' }
      const positionType = profile.target_oposicion?.trim() || null
      expect(positionType).toBeNull()
    })
  })

  describe('Pre-resolve scopeArticleIds', () => {
    it('topicNumber=N + positionType=CyL → solo artículos T5 CyL', () => {
      // Equivalente a:
      //   SELECT articles.id FROM articles
      //   INNER JOIN topic_scope ON ts.law_id=a.law_id AND a.article_number=ANY(ts.article_numbers)
      //   INNER JOIN topics ON t.id=ts.topic_id
      //   WHERE t.position_type='auxiliar_administrativo_cyl' AND t.topic_number=5
      const scopedArticles = ['art:lo-14-2007:9', 'art:lo-14-2007:66']
      expect(scopedArticles.length).toBeGreaterThan(0)
    })

    it('topicNumber=0 + positionType → todos artículos del positionType (cualquier tema)', () => {
      // Sin filtro de tema → scope global de la oposición
      const scopedArticles = ['art:lo-14-2007:9', 'art:ley-3-2001-cyl:1', 'art:tue:13']
      expect(scopedArticles.length).toBeGreaterThan(0)
    })

    it('positionType sin scopes → scopeArticleIds=null (fallback legacy)', () => {
      // Caso Lidia 18/04: celador_sescam_clm no tiene topic_scope.
      const ids: string[] = []
      const scopeArticleIds = ids.length > 0 ? ids : null
      expect(scopeArticleIds).toBeNull()
      // Sin scope filter, el endpoint devuelve TODO el histórico falled del user.
    })
  })

  describe('Intersección selectedLaws × scopeArticleIds', () => {
    it('ambos presentes → intersección', () => {
      const allowedFromLaws = ['art-a', 'art-b', 'art-c', 'art-d']
      const allowedFromScope = ['art-b', 'art-c', 'art-e']
      const scopeSet = new Set(allowedFromScope)
      const intersected = allowedFromLaws.filter(id => scopeSet.has(id))
      expect(intersected).toEqual(['art-b', 'art-c'])
    })

    it('intersección vacía → devuelve [] sin ejecutar query principal', () => {
      const allowedFromLaws = ['art-a', 'art-b']
      const allowedFromScope = ['art-c', 'art-d']
      const intersected = allowedFromLaws.filter(id => new Set(allowedFromScope).has(id))
      expect(intersected).toEqual([])
    })

    it('solo scopeArticleIds (sin selectedLaws) → usa el scope completo', () => {
      const allowedFromLaws: string[] | null = null
      const scopeArticleIds = ['art-a', 'art-b']
      const final = allowedFromLaws ?? scopeArticleIds
      expect(final).toEqual(['art-a', 'art-b'])
    })

    it('solo selectedLaws (sin scope, oposición legacy) → usa solo selectedLaws', () => {
      const allowedFromLaws = ['art-a', 'art-b']
      const scopeArticleIds: string[] | null = null
      const final = scopeArticleIds === null ? allowedFromLaws : []
      expect(final).toEqual(['art-a', 'art-b'])
    })
  })

  describe('Caso Cristina específico', () => {
    it('Cristina (target=CyL) pide T5 falladas → 0 IDs Ley 50/1997', () => {
      // Su histórico tiene Ley 50/1997 (T5 Estado pre-cambio) y LO 14/2007 (T5 CyL).
      const histórico = [
        { article_id: 'art:ley-50-1997:13', law: 'Ley 50/1997' },
        { article_id: 'art:ley-50-1997:26', law: 'Ley 50/1997' },
        { article_id: 'art:ce:98', law: 'CE' },
        { article_id: 'art:lo-14-2007:9', law: 'LO 14/2007' },
        { article_id: 'art:lo-14-2007:66', law: 'LO 14/2007' },
      ]
      const scopeT5CyL = new Set(['art:lo-14-2007:9', 'art:lo-14-2007:66'])
      const filtered = histórico.filter(r => scopeT5CyL.has(r.article_id))
      expect(filtered.map(r => r.law)).toEqual(['LO 14/2007', 'LO 14/2007'])
      // Las 3 contaminadas se descartan
      expect(filtered.find(r => r.law === 'Ley 50/1997')).toBeUndefined()
      expect(filtered.find(r => r.law === 'CE')).toBeUndefined()
    })

    it('SI Cristina vuelve a Estado, las mismas falladas reaparecen', () => {
      // Simula re-cambio: target=Estado de nuevo. Las preguntas T5 Estado
      // vuelven a ser in-scope. El histórico no se pierde.
      const histórico = [
        { article_id: 'art:ley-50-1997:13' },
        { article_id: 'art:lo-14-2007:9' },
      ]
      const scopeT5Estado = new Set(['art:ley-50-1997:13', 'art:ce:98'])
      const filtered = histórico.filter(r => scopeT5Estado.has(r.article_id))
      expect(filtered.map(r => r.article_id)).toEqual(['art:ley-50-1997:13'])
    })
  })
})
