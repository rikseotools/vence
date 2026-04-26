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
})
