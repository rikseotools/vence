/**
 * @jest-environment jsdom
 */
import { render } from '@testing-library/react'
import MarkdownQuestionText from '@/components/MarkdownQuestionText'

describe('MarkdownQuestionText', () => {
  it('texto vacío no renderiza nada', () => {
    const { container } = render(<MarkdownQuestionText text="" />)
    expect(container.firstChild).toBeNull()
  })

  it('rama plain (sin * ni ~~) envuelve el texto en <span> con whitespace-pre-line para preservar \\n', () => {
    const { container } = render(<MarkdownQuestionText text={'A\nB\nC'} />)
    const span = container.querySelector('span')
    expect(span).not.toBeNull()
    expect(span?.className).toBe('whitespace-pre-line')
    expect(span?.textContent).toBe('A\nB\nC')
  })

  it('rama plain con \\r\\n también queda en <span> whitespace-pre-line', () => {
    const { container } = render(<MarkdownQuestionText text={'Caso:\r\nLínea 2'} />)
    const span = container.querySelector('span')
    expect(span?.className).toBe('whitespace-pre-line')
  })

  it('rama markdown (con *) NO usa whitespace-pre-line — pasa por ReactMarkdown', () => {
    const { container } = render(<MarkdownQuestionText text={'Hola **mundo**'} />)
    // El wrapper exterior tiene className por defecto vacío (no whitespace-pre-line)
    const outerSpan = container.querySelector('span')
    expect(outerSpan?.className).not.toContain('whitespace-pre-line')
  })

  it('rama markdown con ~~ tampoco usa whitespace-pre-line', () => {
    const { container } = render(<MarkdownQuestionText text={'Hola ~~tachado~~'} />)
    const outerSpan = container.querySelector('span')
    expect(outerSpan?.className).not.toContain('whitespace-pre-line')
  })
})
