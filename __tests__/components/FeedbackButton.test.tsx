import { render } from '@testing-library/react'
import FeedbackButton from '@/components/FeedbackButton'

describe('FeedbackButton', () => {
  test('renderiza un enlace a /soporte', () => {
    const { container } = render(<FeedbackButton />)
    const link = container.querySelector('a')
    expect(link).not.toBeNull()
    expect(link?.getAttribute('href')).toBe('/soporte')
  })

  test('tiene posición fija', () => {
    const { container } = render(<FeedbackButton />)
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper?.className).toContain('fixed')
    expect(wrapper?.className).toContain('bottom-6')
    expect(wrapper?.className).toContain('right-6')
  })

  test('tiene aria-label para accesibilidad', () => {
    const { container } = render(<FeedbackButton />)
    const link = container.querySelector('a')
    expect(link?.getAttribute('aria-label')).toBe('Contactar soporte')
  })

  test('muestra texto "Soporte" en desktop', () => {
    const { container } = render(<FeedbackButton />)
    const spans = container.querySelectorAll('span')
    const textSpan = Array.from(spans).find(s => s.textContent === 'Soporte')
    expect(textSpan).not.toBeUndefined()
  })
})
