import { render } from '@testing-library/react'
import CcaaFlag, { hasCcaaFlag } from '@/components/CcaaFlag'

const KNOWN_CCAA = [
  'auxiliar_administrativo_carm',
  'auxiliar_administrativo_cyl',
  'auxiliar_administrativo_madrid',
  'auxiliar_administrativo_andalucia',
]

describe('CcaaFlag', () => {
  describe('hasCcaaFlag', () => {
    test.each(KNOWN_CCAA)('devuelve true para %s', (id) => {
      expect(hasCcaaFlag(id)).toBe(true)
    })

    test('devuelve false para oposiciones sin bandera', () => {
      expect(hasCcaaFlag('auxiliar_administrativo_estado')).toBe(false)
      expect(hasCcaaFlag('tramitacion_procesal')).toBe(false)
      expect(hasCcaaFlag('inventada')).toBe(false)
      expect(hasCcaaFlag('')).toBe(false)
    })
  })

  describe('renderizado', () => {
    test.each(KNOWN_CCAA)('renderiza SVG para %s', (id) => {
      const { container } = render(<CcaaFlag oposicionId={id} />)
      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()
      expect(svg?.getAttribute('viewBox')).toBe('0 0 20 14')
    })

    test('devuelve null para oposición desconocida', () => {
      const { container } = render(<CcaaFlag oposicionId="no_existe" />)
      expect(container.innerHTML).toBe('')
    })

    test('aplica tamaño sm por defecto', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_carm" />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('width')).toBe('20')
      expect(svg?.getAttribute('height')).toBe('14')
    })

    test('aplica tamaño md', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_carm" size="md" />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('width')).toBe('30')
      expect(svg?.getAttribute('height')).toBe('21')
    })

    test('aplica tamaño lg', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_carm" size="lg" />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('width')).toBe('40')
      expect(svg?.getAttribute('height')).toBe('28')
    })

    test('fallback a sm con tamaño desconocido', () => {
      // @ts-expect-error - testing invalid size
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_carm" size="xl" />)
      const svg = container.querySelector('svg')
      expect(svg?.getAttribute('width')).toBe('20')
      expect(svg?.getAttribute('height')).toBe('14')
    })

    test('aplica className custom', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_cyl" className="mi-clase" />)
      const span = container.querySelector('span')
      expect(span?.className).toContain('mi-clase')
    })

    test('SVG tiene estilos de borde y rounded', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_madrid" />)
      const svg = container.querySelector('svg')
      expect(svg?.classList.contains('rounded-sm')).toBe(true)
      expect(svg?.classList.contains('inline-block')).toBe(true)
    })
  })

  describe('contenido SVG por bandera', () => {
    test('Madrid tiene fondo rojo y 7 círculos blancos', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_madrid" />)
      const circles = container.querySelectorAll('circle')
      expect(circles).toHaveLength(7)
      circles.forEach(c => expect(c.getAttribute('fill')).toBe('#fff'))
      const rect = container.querySelector('rect')
      expect(rect?.getAttribute('fill')).toBe('#BF0000')
    })

    test('Andalucía tiene 3 franjas (2 verdes + 1 blanca) y 1 círculo', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_andalucia" />)
      const rects = container.querySelectorAll('rect')
      expect(rects).toHaveLength(3)
      const circles = container.querySelectorAll('circle')
      expect(circles).toHaveLength(1)
    })

    test('CyL tiene 4 cuadrantes', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_cyl" />)
      const rects = container.querySelectorAll('rect')
      // 4 cuadrantes + 2 castillos = 6 rects
      expect(rects.length).toBeGreaterThanOrEqual(4)
    })

    test('CARM tiene fondo carmesí', () => {
      const { container } = render(<CcaaFlag oposicionId="auxiliar_administrativo_carm" />)
      const rect = container.querySelector('rect')
      expect(rect?.getAttribute('fill')).toBe('#9B154A')
    })
  })
})
