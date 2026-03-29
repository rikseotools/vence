// __tests__/api/hot-articles/checkHotArticle.test.ts
import { safeParseCheckHotArticleRequest, normalizeOposicionSlug } from '@/lib/api/hot-articles/schemas'

describe('checkHotArticle schemas', () => {
  describe('safeParseCheckHotArticleRequest', () => {
    it('valida request correcto', () => {
      const result = safeParseCheckHotArticleRequest({
        articleId: '123e4567-e89b-12d3-a456-426614174000',
        userOposicion: 'auxiliar_administrativo_estado',
        currentOposicion: 'auxiliar-administrativo-cyl',
      })
      expect(result.success).toBe(true)
    })

    it('rechaza articleId no UUID', () => {
      const result = safeParseCheckHotArticleRequest({
        articleId: 'not-a-uuid',
        userOposicion: 'auxiliar_administrativo_estado',
        currentOposicion: 'auxiliar-administrativo-cyl',
      })
      expect(result.success).toBe(false)
    })

    it('rechaza sin userOposicion', () => {
      const result = safeParseCheckHotArticleRequest({
        articleId: '123e4567-e89b-12d3-a456-426614174000',
        currentOposicion: 'auxiliar-administrativo-cyl',
      })
      expect(result.success).toBe(false)
    })

    it('rechaza sin currentOposicion', () => {
      const result = safeParseCheckHotArticleRequest({
        articleId: '123e4567-e89b-12d3-a456-426614174000',
        userOposicion: 'auxiliar_administrativo_estado',
      })
      expect(result.success).toBe(false)
    })

    it('rechaza userOposicion vacío', () => {
      const result = safeParseCheckHotArticleRequest({
        articleId: '123e4567-e89b-12d3-a456-426614174000',
        userOposicion: '',
        currentOposicion: 'auxiliar-administrativo-cyl',
      })
      expect(result.success).toBe(false)
    })
  })

  describe('normalizeOposicionSlug', () => {
    it('convierte underscores a dashes', () => {
      expect(normalizeOposicionSlug('auxiliar_administrativo_estado')).toBe('auxiliar-administrativo-estado')
    })

    it('no modifica slugs con dashes', () => {
      expect(normalizeOposicionSlug('auxiliar-administrativo-estado')).toBe('auxiliar-administrativo-estado')
    })

    it('maneja slug mixto', () => {
      expect(normalizeOposicionSlug('auxiliar_administrativo-cyl')).toBe('auxiliar-administrativo-cyl')
    })
  })
})
