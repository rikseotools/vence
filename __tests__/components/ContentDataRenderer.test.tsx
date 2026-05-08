import { render } from '@testing-library/react'
import ContentDataRenderer from '@/components/ContentDataRenderer'

// Mock MarkdownExplanation to verify it receives content
jest.mock('@/components/MarkdownExplanation', () => {
  return function MockMarkdown({ content }: { content: string }) {
    // Render markdown-like bold as actual bold (simulating what ReactMarkdown does)
    const html = content.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    return <span data-testid="markdown" dangerouslySetInnerHTML={{ __html: html }} />
  }
})

describe('ContentDataRenderer', () => {
  describe('instructions rendering', () => {
    test('renders instructions with markdown bold', () => {
      const { container } = render(
        <ContentDataRenderer
          contentData={{
            instructions: [
              '**Categoría C:** Documentos urgentes.',
              '**Categoría B:** Documentos normales.',
            ]
          }}
        />
      )

      const strongs = container.querySelectorAll('strong')
      expect(strongs.length).toBeGreaterThanOrEqual(2)
      expect(strongs[0].textContent).toBe('Categoría C:')
      expect(strongs[1].textContent).toBe('Categoría B:')
    })

    test('renders instructions without markdown as plain text', () => {
      const { getByText } = render(
        <ContentDataRenderer
          contentData={{
            instructions: ['Regla simple sin formato.']
          }}
        />
      )

      expect(getByText('Regla simple sin formato.')).toBeTruthy()
    })

    test('does not render raw ** asterisks to the user', () => {
      const { container } = render(
        <ContentDataRenderer
          contentData={{
            instructions: ['**Categoría A:** Texto descriptivo.']
          }}
        />
      )

      // Should NOT contain literal ** in rendered output
      const text = container.textContent || ''
      expect(text).not.toContain('**')
      expect(text).toContain('Categoría A:')
    })
  })

  describe('text_passage rendering', () => {
    test('renders text_passage with markdown', () => {
      const { container } = render(
        <ContentDataRenderer
          contentData={{
            text_passage: 'El **Estado** tiene 542.125 empleados.'
          }}
        />
      )

      const strongs = container.querySelectorAll('strong')
      expect(strongs.length).toBe(1)
      expect(strongs[0].textContent).toBe('Estado')
    })

    test('does not render raw ** in text_passage', () => {
      const { container } = render(
        <ContentDataRenderer
          contentData={{
            text_passage: '**Importante:** Este es el dato clave.'
          }}
        />
      )

      const text = container.textContent || ''
      expect(text).not.toContain('**')
    })
  })

  describe('empty/null content_data', () => {
    test('returns null for empty content_data', () => {
      const { container } = render(
        <ContentDataRenderer contentData={{}} />
      )
      expect(container.innerHTML).toBe('')
    })

    test('returns null for null content_data', () => {
      const { container } = render(
        <ContentDataRenderer contentData={null} />
      )
      expect(container.innerHTML).toBe('')
    })
  })

  describe('image_base64 rendering (preguntas técnicas: Word/Excel/Windows)', () => {
    const TINY_PNG_B64 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

    test('renders <img> with image_base64 src when only image_base64 is set', () => {
      const { container } = render(
        <ContentDataRenderer contentData={{ image_base64: TINY_PNG_B64 }} />
      )
      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toBe(TINY_PNG_B64)
      expect(img!.getAttribute('alt')).toBe('Imagen de la pregunta')
    })

    test('prefers image_base64 over image_url when both present (no double render)', () => {
      const { container } = render(
        <ContentDataRenderer
          contentData={{ image_base64: TINY_PNG_B64 }}
          imageUrl="https://example.com/icon.png"
        />
      )
      const imgs = container.querySelectorAll('img')
      expect(imgs.length).toBe(1)
      expect(imgs[0].getAttribute('src')).toBe(TINY_PNG_B64)
    })

    test('renders image_url when image_base64 is absent', () => {
      const { container } = render(
        <ContentDataRenderer
          contentData={null}
          imageUrl="https://example.com/icon.png"
        />
      )
      const img = container.querySelector('img')
      expect(img).not.toBeNull()
      expect(img!.getAttribute('src')).toBe('https://example.com/icon.png')
    })

    test('renders image_base64 alongside instructions/text_passage without conflict', () => {
      const { container } = render(
        <ContentDataRenderer
          contentData={{
            image_base64: TINY_PNG_B64,
            instructions: ['**Categoría A:** Texto.'],
          }}
        />
      )
      expect(container.querySelector('img')).not.toBeNull()
      expect(container.querySelectorAll('strong').length).toBeGreaterThanOrEqual(1)
    })

    test('regresión: pregunta legislativa pura (sin content_data ni image) no renderiza nada', () => {
      const { container } = render(<ContentDataRenderer contentData={null} />)
      expect(container.querySelector('img')).toBeNull()
      expect(container.innerHTML).toBe('')
    })
  })
})
