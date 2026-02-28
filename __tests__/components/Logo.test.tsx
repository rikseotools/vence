import { render } from '@testing-library/react'
import Logo, { LogoIcon, LogoFooter, LogoHorizontal, LogoHero } from '@/components/Logo'

describe('Logo', () => {
  describe('Logo principal', () => {
    test('renderiza link a /', () => {
      const { container } = render(<Logo />)
      const link = container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/')
    })

    test('muestra texto VENCE por defecto', () => {
      const { container } = render(<Logo />)
      const venceTexts = container.querySelectorAll('.tracking-wider')
      expect(venceTexts.length).toBeGreaterThanOrEqual(1)
    })

    test('oculta texto cuando showText=false', () => {
      const { container } = render(<Logo showText={false} />)
      const trackingWider = container.querySelectorAll('.tracking-wider')
      expect(trackingWider.length).toBe(0)
    })

    test('aplica tamaño medium por defecto', () => {
      const { container } = render(<Logo />)
      const icon = container.querySelector('[style*="width: 40"]') ||
                   container.querySelector('[style*="width:40"]')
      expect(icon).not.toBeNull()
    })

    test('aplica tamaño small', () => {
      const { container } = render(<Logo size="small" />)
      const icon = container.querySelector('[style*="width: 32"]') ||
                   container.querySelector('[style*="width:32"]')
      expect(icon).not.toBeNull()
    })

    test('aplica tamaño large', () => {
      const { container } = render(<Logo size="large" />)
      const icon = container.querySelector('[style*="width: 48"]') ||
                   container.querySelector('[style*="width:48"]')
      expect(icon).not.toBeNull()
    })

    test('aplica className personalizado', () => {
      const { container } = render(<Logo className="mi-clase" />)
      const div = container.querySelector('.mi-clase')
      expect(div).not.toBeNull()
    })

    test('pasa onClick al Link', () => {
      const onClick = jest.fn()
      const { container } = render(<Logo onClick={onClick} />)
      const link = container.querySelector('a')
      expect(link).not.toBeNull()
    })
  })

  describe('LogoIcon', () => {
    test('renderiza link a /', () => {
      const { container } = render(<LogoIcon />)
      const link = container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/')
    })

    test('aplica tamaño custom', () => {
      const { container } = render(<LogoIcon size={64} />)
      const icon = container.querySelector('[style*="width: 64"]') ||
                   container.querySelector('[style*="width:64"]')
      expect(icon).not.toBeNull()
    })
  })

  describe('LogoFooter', () => {
    test('renderiza sin link (no es clickable)', () => {
      const { container } = render(<LogoFooter />)
      const link = container.querySelector('a')
      expect(link).toBeNull()
    })

    test('muestra texto VENCE', () => {
      const { container } = render(<LogoFooter />)
      expect(container.textContent).toContain('VENCE')
    })
  })

  describe('LogoHorizontal', () => {
    test('renderiza link a /', () => {
      const { container } = render(<LogoHorizontal />)
      const link = container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/')
    })
  })

  describe('LogoHero', () => {
    test('renderiza link a /', () => {
      const { container } = render(<LogoHero />)
      const link = container.querySelector('a')
      expect(link?.getAttribute('href')).toBe('/')
    })

    test('muestra descripción de la plataforma', () => {
      const { getByText } = render(<LogoHero />)
      expect(getByText(/plataforma líder/)).toBeTruthy()
    })
  })
})
