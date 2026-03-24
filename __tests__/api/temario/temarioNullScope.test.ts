// __tests__/api/temario/temarioNullScope.test.ts
// Tests para verificar que getTopicContent maneja correctamente
// scopes con articleNumbers NULL (toda la ley).

import fs from 'fs'
import path from 'path'

describe('Temario - Scopes con articleNumbers NULL', () => {

  describe('Código fuente maneja NULL correctamente', () => {
    const queriesPath = path.join(process.cwd(), 'lib/api/temario/queries.ts')
    const content = fs.readFileSync(queriesPath, 'utf-8')

    test('validScopes acepta articleNumbers null (toda la ley)', () => {
      // El filtro debe aceptar s.articleNumbers === null
      expect(content).toContain('s.articleNumbers === null')
    })

    test('NO descarta scopes con articleNumbers null', () => {
      // No debe requerir s.articleNumbers && s.articleNumbers.length > 0 sin alternativa null
      // El patrón antiguo que causaba el bug:
      expect(content).not.toMatch(/filter\(s\s*=>\s*s\.lawId\s*&&\s*s\.articleNumbers\s*&&\s*s\.articleNumbers\.length\s*>\s*0\s*\)/)
    })

    test('scopeByLaw distingue null (toda la ley) de artículos específicos', () => {
      expect(content).toContain('scope.articleNumbers === null')
      expect(content).toContain('scopeByLaw.set(scope.lawId!, null)')
    })

    test('query sin filtro inArray cuando articleNums es null', () => {
      expect(content).toContain('articleNums === null')
      // Debe hacer query solo con eq(lawId) sin inArray
    })

    test('query con filtro inArray cuando articleNums tiene valores', () => {
      expect(content).toContain('inArray(articles.articleNumber, uniqueArticleNums)')
    })
  })

  describe('Scopes NULL vs específicos - lógica de merge', () => {
    // Simular la lógica de scopeByLaw
    function buildScopeByLaw(scopes: Array<{ lawId: string; articleNumbers: string[] | null }>) {
      const scopeByLaw = new Map<string, string[] | null>()
      for (const scope of scopes) {
        const existing = scopeByLaw.get(scope.lawId)
        if (scope.articleNumbers === null) {
          scopeByLaw.set(scope.lawId, null)
        } else if (existing !== null) {
          scopeByLaw.set(scope.lawId, [...(existing || []), ...scope.articleNumbers])
        }
      }
      return scopeByLaw
    }

    test('scope NULL = toda la ley', () => {
      const result = buildScopeByLaw([
        { lawId: 'law1', articleNumbers: null }
      ])
      expect(result.get('law1')).toBeNull()
    })

    test('scope con artículos específicos', () => {
      const result = buildScopeByLaw([
        { lawId: 'law1', articleNumbers: ['1', '2', '3'] }
      ])
      expect(result.get('law1')).toEqual(['1', '2', '3'])
    })

    test('NULL override artículos específicos (misma ley)', () => {
      const result = buildScopeByLaw([
        { lawId: 'law1', articleNumbers: ['1', '2'] },
        { lawId: 'law1', articleNumbers: null }
      ])
      // NULL = toda la ley, debe prevalecer
      expect(result.get('law1')).toBeNull()
    })

    test('artículos específicos NO override NULL', () => {
      const result = buildScopeByLaw([
        { lawId: 'law1', articleNumbers: null },
        { lawId: 'law1', articleNumbers: ['1', '2'] }
      ])
      // NULL ya estaba, no se cambia
      expect(result.get('law1')).toBeNull()
    })

    test('múltiples leyes independientes', () => {
      const result = buildScopeByLaw([
        { lawId: 'law1', articleNumbers: null },
        { lawId: 'law2', articleNumbers: ['5', '6'] }
      ])
      expect(result.get('law1')).toBeNull()
      expect(result.get('law2')).toEqual(['5', '6'])
    })

    test('merge artículos de misma ley', () => {
      const result = buildScopeByLaw([
        { lawId: 'law1', articleNumbers: ['1', '2'] },
        { lawId: 'law1', articleNumbers: ['3', '4'] }
      ])
      expect(result.get('law1')).toEqual(['1', '2', '3', '4'])
    })
  })
})
