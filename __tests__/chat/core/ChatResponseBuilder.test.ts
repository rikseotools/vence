// __tests__/chat/core/ChatResponseBuilder.test.js
// Tests para el builder de respuestas del chat

// Polyfill para TextEncoder/TextDecoder en jsdom
import { TextEncoder, TextDecoder } from 'util'
global.TextEncoder = TextEncoder
global.TextDecoder = TextDecoder

import {
  ChatResponseBuilder,
  StreamEncoder,
} from '@/lib/chat/core/ChatResponseBuilder'

describe('ChatResponseBuilder', () => {

  // ============================================
  // BUILDER BÁSICO
  // ============================================
  describe('Basic Builder', () => {

    test('debe crear respuesta básica', () => {
      const response = new ChatResponseBuilder()
        .text('Hola, te ayudo')
        .build()

      expect(response.content).toBe('Hola, te ayudo')
    })

    test('debe incluir domain en metadata', () => {
      const response = new ChatResponseBuilder()
        .domain('search')
        .text('Resultado de búsqueda')
        .build()

      expect(response.metadata?.domain).toBe('search')
    })

    test('debe incluir processingTime en metadata', () => {
      const response = new ChatResponseBuilder()
        .text('Respuesta')
        .processingTime(150)
        .build()

      expect(response.metadata?.processingTime).toBe(150)
    })

    test('debe incluir sources en metadata', () => {
      const sources = [
        { lawName: 'Ley 39/2015', articleNumber: '21' },
        { lawName: 'Ley 40/2015', articleNumber: '5' },
      ]

      const response = new ChatResponseBuilder()
        .text('Respuesta con fuentes')
        .addSources(sources)
        .withSourcesBlock()
        .build()

      expect(response.metadata?.sources).toHaveLength(2)
      expect(response.metadata?.sources[0].lawName).toBe('Ley 39/2015')
    })

    test('debe incluir verificationResult en metadata', () => {
      const verification = {
        isCorrect: true,
        correctAnswer: 2,
        explanation: 'El artículo 21 establece...',
      }

      const response = new ChatResponseBuilder()
        .text('Verificación')
        .verification(verification)
        .build()

      expect(response.metadata?.verificationResult?.isCorrect).toBe(true)
      expect(response.metadata?.verificationResult?.correctAnswer).toBe(2)
    })

    test('debe soportar chaining completo', () => {
      const response = new ChatResponseBuilder()
        .domain('verification')
        .text('Respuesta completa')
        .addSources([{ lawName: 'CE', articleNumber: '1' }])
        .withSourcesBlock()
        .verification({ isCorrect: false, correctAnswer: 1 })
        .processingTime(200)
        .build()

      expect(response.content).toContain('Respuesta completa')
      expect(response.metadata?.domain).toBe('verification')
      expect(response.metadata?.processingTime).toBe(200)
      expect(response.metadata?.sources).toHaveLength(1)
      expect(response.metadata?.verificationResult?.isCorrect).toBe(false)
    })
  })

  // ============================================
  // TEXTOS ESPECIALES
  // ============================================
  describe('Special Text Cases', () => {

    test('debe manejar texto vacío', () => {
      const response = new ChatResponseBuilder()
        .text('')
        .build()

      expect(response.content).toBe('')
    })

    test('debe manejar texto con caracteres especiales', () => {
      const text = '¿Cuál es el plazo? → 10 días\n\n**Importante:** Art. 21'
      const response = new ChatResponseBuilder()
        .text(text)
        .build()

      expect(response.content).toBe(text)
    })

    test('debe manejar texto largo', () => {
      const longText = 'A'.repeat(10000)
      const response = new ChatResponseBuilder()
        .text(longText)
        .build()

      expect(response.content).toHaveLength(10000)
    })

    test('debe preservar emojis', () => {
      const text = '📊 Estadísticas ✅ Completado 🎯'
      const response = new ChatResponseBuilder()
        .text(text)
        .build()

      expect(response.content).toContain('📊')
      expect(response.content).toContain('✅')
    })
  })

})

describe('StreamEncoder', () => {

  // ============================================
  // ENCODE TEXT (Formato Legacy - default)
  // ============================================
  describe('encodeText', () => {
    let encoder

    beforeEach(() => {
      encoder = new StreamEncoder() // Default: legacy format
    })

    test('debe codificar texto como data: event (formato legacy)', () => {
      const encoded = encoder.encodeText('Hola')
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('data:')
      expect(decoded).toContain('"type":"content"') // Legacy usa 'content'
      expect(decoded).toContain('"content":"Hola"')
    })

    test('debe manejar texto con saltos de línea', () => {
      const encoded = encoder.encodeText('Línea 1\nLínea 2')
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('Línea 1')
    })

    test('debe usar formato v2 cuando se especifica', () => {
      const v2Encoder = new StreamEncoder(false) // V2 format
      const encoded = v2Encoder.encodeText('Hola')
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('"type":"text"') // V2 usa 'text'
    })
  })

  // ============================================
  // ENCODE METADATA
  // ============================================
  describe('encodeMetadata', () => {
    let encoder

    beforeEach(() => {
      encoder = new StreamEncoder() // Default: legacy format
    })

    test('debe codificar metadata correctamente (formato legacy)', () => {
      const metadata = {
        domain: 'search',
        processingTime: 150,
      }

      const encoded = encoder.encodeMetadata(metadata)
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('"type":"meta"') // Legacy usa 'meta'
      expect(decoded).toContain('"searchMethod":"search"')
    })

    test('debe incluir sources si existen', () => {
      const metadata = {
        domain: 'search',
        sources: [{ lawName: 'Ley 39/2015', articleNumber: '21' }],
      }

      const encoded = encoder.encodeMetadata(metadata)
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('sources')
      expect(decoded).toContain('Ley 39/2015')
    })
  })

  // ============================================
  // ENCODE ERROR
  // ============================================
  describe('encodeError', () => {

    test('debe codificar error correctamente', () => {
      const encoder = new StreamEncoder()
      const encoded = encoder.encodeError('Algo salió mal')
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('"type":"error"')
      expect(decoded).toContain('Algo salió mal')
    })
  })

  // ============================================
  // ENCODE DONE
  // ============================================
  describe('encodeDone', () => {

    test('debe codificar done event (formato legacy)', () => {
      const encoder = new StreamEncoder() // Legacy format
      const encoded = encoder.encodeDone({
        potentialErrorDetected: false,
        questionId: null,
        suggestions: null,
      })
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('"type":"done"')
      expect(decoded).toContain('"potentialErrorDetected":false')
    })

    test('debe codificar done event simple (formato v2)', () => {
      const encoder = new StreamEncoder(false) // V2 format
      const encoded = encoder.encodeDone()
      const decoded = new TextDecoder().decode(encoded)

      expect(decoded).toContain('"type":"done"')
    })
  })

})
