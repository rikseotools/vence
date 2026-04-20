// __tests__/api/test-favorites-upsert.test.ts
// Tests for the favorite upsert (overwrite) flow

describe('Test Favorites — upsert flow', () => {
  // Simulates the frontend logic in TestConfigurator.saveCurrentAsFavorite

  const makeFavorite = (name: string, laws: string[] = ['CE']) => ({
    userId: 'user-123',
    name,
    description: null,
    selectedLaws: laws,
    selectedArticlesByLaw: {},
    positionType: 'auxiliar_administrativo_estado',
  })

  it('new favorite: uses POST', () => {
    const savedFavorites: { id: string; name: string }[] = []
    const trimmedName = 'Test 1'
    const existing = savedFavorites.find(f => f.name === trimmedName)

    expect(existing).toBeUndefined()
    const method = existing ? 'PUT' : 'POST'
    expect(method).toBe('POST')
  })

  it('duplicate name: uses PUT', () => {
    const savedFavorites = [{ id: 'fav-1', name: 'Test 1' }]
    const trimmedName = 'Test 1'
    const existing = savedFavorites.find(f => f.name === trimmedName)

    expect(existing).toBeDefined()
    expect(existing!.id).toBe('fav-1')
    const method = existing ? 'PUT' : 'POST'
    expect(method).toBe('PUT')
  })

  it('different name: uses POST even if other favorites exist', () => {
    const savedFavorites = [{ id: 'fav-1', name: 'Test 1' }]
    const trimmedName = 'Test 2'
    const existing = savedFavorites.find(f => f.name === trimmedName)

    expect(existing).toBeUndefined()
    const method = existing ? 'PUT' : 'POST'
    expect(method).toBe('POST')
  })

  it('name matching is exact (case sensitive)', () => {
    const savedFavorites = [{ id: 'fav-1', name: 'Test 1' }]

    expect(savedFavorites.find(f => f.name === 'Test 1')).toBeDefined()
    expect(savedFavorites.find(f => f.name === 'test 1')).toBeUndefined()
    expect(savedFavorites.find(f => f.name === 'Test 1 ')).toBeUndefined()
  })

  it('overwrite updates the existing entry in savedFavorites list', () => {
    const savedFavorites = [
      { id: 'fav-1', name: 'Test 1', selectedLaws: ['CE'] },
      { id: 'fav-2', name: 'Test 2', selectedLaws: ['Ley 39/2015'] },
    ]

    const existingFavorite = savedFavorites.find(f => f.name === 'Test 1')
    expect(existingFavorite).toBeDefined()

    // Simulate what the frontend does after successful PUT
    const updatedData = { id: 'fav-1', name: 'Test 1', selectedLaws: ['CE', 'Ley 40/2015'] }
    const updatedList = savedFavorites.map(f => f.id === existingFavorite!.id ? updatedData : f)

    expect(updatedList).toHaveLength(2) // Same count, no duplicates
    expect(updatedList[0].selectedLaws).toEqual(['CE', 'Ley 40/2015']) // Updated
    expect(updatedList[1].name).toBe('Test 2') // Untouched
  })

  it('new favorite prepends to list', () => {
    const savedFavorites = [
      { id: 'fav-1', name: 'Test 1' },
    ]

    const newData = { id: 'fav-2', name: 'Test 2' }
    const updatedList = [newData, ...savedFavorites]

    expect(updatedList).toHaveLength(2)
    expect(updatedList[0].name).toBe('Test 2') // New one first
    expect(updatedList[1].name).toBe('Test 1')
  })

  it('empty savedFavorites: always POST', () => {
    const savedFavorites: { name: string }[] = []
    const existing = savedFavorites.find(f => f.name === 'Test 1')
    expect(existing).toBeUndefined()
    expect(existing ? 'PUT' : 'POST').toBe('POST')
  })
})
