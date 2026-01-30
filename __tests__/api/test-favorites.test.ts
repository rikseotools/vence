/**
 * Tests para el sistema de favoritos de configuraciones de test
 */

// Mock window para evitar errores de jest.setup.js
if (typeof window === 'undefined') {
  (global as any).window = { matchMedia: () => ({ matches: false, addListener: () => {}, removeListener: () => {} }) }
}

import {
  testFavoriteDataSchema,
  createFavoriteRequestSchema,
  deleteFavoriteRequestSchema,
  getUserFavoritesRequestSchema,
  safeParseCreateFavoriteRequest,
  safeParseDeleteFavoriteRequest,
  safeParseGetUserFavoritesRequest
} from '@/lib/api/test-favorites/schemas'

describe('Test Favorites - Schema Validation', () => {
  const validUserId = '550e8400-e29b-41d4-a716-446655440000'
  const validFavoriteId = '660e8400-e29b-41d4-a716-446655440001'

  describe('getUserFavoritesRequestSchema', () => {
    it('should accept valid userId', () => {
      const result = getUserFavoritesRequestSchema.safeParse({ userId: validUserId })
      expect(result.success).toBe(true)
    })

    it('should reject invalid UUID', () => {
      const result = getUserFavoritesRequestSchema.safeParse({ userId: 'not-a-uuid' })
      expect(result.success).toBe(false)
    })

    it('should reject missing userId', () => {
      const result = getUserFavoritesRequestSchema.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('createFavoriteRequestSchema', () => {
    const validRequest = {
      userId: validUserId,
      name: 'CE Títulos I y II',
      selectedLaws: ['CE', 'Ley-39-2015'],
      selectedArticlesByLaw: { 'CE': ['1', '2', '3'] }
    }

    it('should accept valid create request', () => {
      const result = createFavoriteRequestSchema.safeParse(validRequest)
      expect(result.success).toBe(true)
    })

    it('should accept request with optional description', () => {
      const result = createFavoriteRequestSchema.safeParse({
        ...validRequest,
        description: 'Para repasar derechos fundamentales'
      })
      expect(result.success).toBe(true)
    })

    it('should accept request with optional positionType', () => {
      const result = createFavoriteRequestSchema.safeParse({
        ...validRequest,
        positionType: 'auxiliar_administrativo_estado'
      })
      expect(result.success).toBe(true)
    })

    it('should reject empty name', () => {
      const result = createFavoriteRequestSchema.safeParse({
        ...validRequest,
        name: ''
      })
      expect(result.success).toBe(false)
    })

    it('should reject name longer than 100 chars', () => {
      const result = createFavoriteRequestSchema.safeParse({
        ...validRequest,
        name: 'a'.repeat(101)
      })
      expect(result.success).toBe(false)
    })

    it('should reject empty selectedLaws array', () => {
      const result = createFavoriteRequestSchema.safeParse({
        ...validRequest,
        selectedLaws: []
      })
      expect(result.success).toBe(false)
    })

    it('should reject invalid userId', () => {
      const result = createFavoriteRequestSchema.safeParse({
        ...validRequest,
        userId: 'invalid'
      })
      expect(result.success).toBe(false)
    })

    it('should accept articles as numbers or strings', () => {
      const result = createFavoriteRequestSchema.safeParse({
        ...validRequest,
        selectedArticlesByLaw: { 'CE': [1, 2, '3', 4] }
      })
      expect(result.success).toBe(true)
    })

    it('should default selectedArticlesByLaw to empty object', () => {
      const result = createFavoriteRequestSchema.safeParse({
        userId: validUserId,
        name: 'Test',
        selectedLaws: ['CE']
      })
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.selectedArticlesByLaw).toEqual({})
      }
    })
  })

  describe('deleteFavoriteRequestSchema', () => {
    it('should accept valid delete request', () => {
      const result = deleteFavoriteRequestSchema.safeParse({
        id: validFavoriteId,
        userId: validUserId
      })
      expect(result.success).toBe(true)
    })

    it('should reject invalid favorite id', () => {
      const result = deleteFavoriteRequestSchema.safeParse({
        id: 'invalid',
        userId: validUserId
      })
      expect(result.success).toBe(false)
    })

    it('should reject missing userId', () => {
      const result = deleteFavoriteRequestSchema.safeParse({
        id: validFavoriteId
      })
      expect(result.success).toBe(false)
    })
  })

  describe('testFavoriteDataSchema', () => {
    const validFavorite = {
      id: validFavoriteId,
      userId: validUserId,
      name: 'Mi favorito',
      description: null,
      selectedLaws: ['CE'],
      selectedArticlesByLaw: {},
      positionType: null,
      createdAt: '2026-01-30T10:00:00Z',
      updatedAt: '2026-01-30T10:00:00Z'
    }

    it('should accept valid favorite data', () => {
      const result = testFavoriteDataSchema.safeParse(validFavorite)
      expect(result.success).toBe(true)
    })

    it('should accept favorite with description', () => {
      const result = testFavoriteDataSchema.safeParse({
        ...validFavorite,
        description: 'Una descripción'
      })
      expect(result.success).toBe(true)
    })
  })

  describe('safeParse helper functions', () => {
    it('safeParseGetUserFavoritesRequest should work', () => {
      const result = safeParseGetUserFavoritesRequest({ userId: validUserId })
      expect(result.success).toBe(true)
    })

    it('safeParseCreateFavoriteRequest should work', () => {
      const result = safeParseCreateFavoriteRequest({
        userId: validUserId,
        name: 'Test',
        selectedLaws: ['CE']
      })
      expect(result.success).toBe(true)
    })

    it('safeParseDeleteFavoriteRequest should work', () => {
      const result = safeParseDeleteFavoriteRequest({
        id: validFavoriteId,
        userId: validUserId
      })
      expect(result.success).toBe(true)
    })
  })
})
