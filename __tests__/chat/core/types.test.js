// __tests__/chat/core/types.test.js
// Tests para validación de tipos y schemas del chat

import {
  questionContextSchema,
  chatMessageSchema,
  chatRequestSchema,
} from '@/lib/chat/core/types'

describe('Chat Core Types', () => {

  // ============================================
  // QUESTION CONTEXT SCHEMA
  // ============================================
  describe('questionContextSchema', () => {

    test('debe validar un contexto de pregunta completo', () => {
      const validContext = {
        questionId: '123e4567-e89b-12d3-a456-426614174000',
        questionText: '¿Cuál es el plazo?',
        options: ['10 días', '15 días', '20 días', '30 días'],
        selectedAnswer: 1,
        correctAnswer: 2,
        lawName: 'Ley 39/2015',
        articleNumber: '21',
        explanation: 'El artículo 21 establece...',
      }

      const result = questionContextSchema.safeParse(validContext)
      expect(result.success).toBe(true)
    })

    test('debe validar un contexto mínimo (vacío)', () => {
      const result = questionContextSchema.safeParse({})
      expect(result.success).toBe(true)
    })

    test('debe rechazar selectedAnswer fuera de rango', () => {
      const invalid = {
        selectedAnswer: 5, // Fuera de rango 0-3
      }

      const result = questionContextSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    test('debe rechazar correctAnswer fuera de rango', () => {
      const invalid = {
        correctAnswer: -1, // Fuera de rango 0-3
      }

      const result = questionContextSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })

    test('debe rechazar questionId mal formateado', () => {
      const invalid = {
        questionId: 'not-a-uuid',
      }

      const result = questionContextSchema.safeParse(invalid)
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // CHAT MESSAGE SCHEMA
  // ============================================
  describe('chatMessageSchema', () => {

    test('debe validar mensaje de usuario', () => {
      const message = {
        role: 'user',
        content: 'Hola, tengo una duda',
      }

      const result = chatMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('debe validar mensaje de assistant', () => {
      const message = {
        role: 'assistant',
        content: '¡Claro! Te ayudo.',
      }

      const result = chatMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('debe validar mensaje de system', () => {
      const message = {
        role: 'system',
        content: 'Eres un asistente experto.',
      }

      const result = chatMessageSchema.safeParse(message)
      expect(result.success).toBe(true)
    })

    test('debe rechazar role inválido', () => {
      const message = {
        role: 'invalid',
        content: 'Mensaje',
      }

      const result = chatMessageSchema.safeParse(message)
      expect(result.success).toBe(false)
    })

    test('debe rechazar mensaje sin content', () => {
      const message = {
        role: 'user',
      }

      const result = chatMessageSchema.safeParse(message)
      expect(result.success).toBe(false)
    })
  })

  // ============================================
  // CHAT REQUEST SCHEMA
  // ============================================
  describe('chatRequestSchema', () => {

    test('debe validar request mínimo válido', () => {
      const request = {
        messages: [
          { role: 'user', content: '¿Qué dice el artículo 21?' }
        ],
      }

      const result = chatRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    test('debe validar request completo', () => {
      const request = {
        messages: [
          { role: 'user', content: 'Pregunta 1' },
          { role: 'assistant', content: 'Respuesta 1' },
          { role: 'user', content: 'Pregunta 2' },
        ],
        domain: 'search',
        questionContext: {
          questionText: '¿Cuál es el plazo?',
        },
        conversationId: '123e4567-e89b-12d3-a456-426614174000',
        isPremium: true,
      }

      const result = chatRequestSchema.safeParse(request)
      expect(result.success).toBe(true)
    })

    test('debe aplicar default isPremium = false', () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hola' }
        ],
      }

      const result = chatRequestSchema.parse(request)
      expect(result.isPremium).toBe(false)
    })

    test('debe rechazar request sin mensajes', () => {
      const request = {
        messages: [],
      }

      const result = chatRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })

    test('debe rechazar conversationId mal formateado', () => {
      const request = {
        messages: [
          { role: 'user', content: 'Hola' }
        ],
        conversationId: 'not-a-uuid',
      }

      const result = chatRequestSchema.safeParse(request)
      expect(result.success).toBe(false)
    })
  })

})
