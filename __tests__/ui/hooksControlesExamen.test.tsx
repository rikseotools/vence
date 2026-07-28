/**
 * Integración (jsdom) de los tres hooks que sostienen los controles flotantes del examen.
 *
 * Capa intermedia entre los helpers puros (`__tests__/ui/stickyOffset.test.ts`,
 * `arrastrable.test.ts`) y el navegador de verdad (`e2e/authed/examen-controles.spec.ts`):
 * aquí se comprueba el CABLEADO — que se mide la cabecera, que un arrastre no dispara el clic,
 * que la posición se guarda y se recupera, y que el observador se engancha aunque el nodo
 * aparezca tarde (el componente tiene returns tempranos: con un `useRef` normal el observador
 * se montaba sobre `null` y los controles no salían nunca).
 */
import React from 'react'
import { render, screen, act, fireEvent } from '@testing-library/react'
import { useOffsetCabecera } from '@/hooks/useOffsetCabecera'
import { useArrastrable } from '@/hooks/useArrastrable'
import { useFueraDePantalla } from '@/hooks/useFueraDePantalla'

// ── Dobles de observadores (jsdom no los trae) ──────────────────────────────
let ultimoIO: { cb: IntersectionObserverCallback; nodos: Element[] } | null = null

beforeEach(() => {
  localStorage.clear()
  ultimoIO = null
  ;(globalThis as any).ResizeObserver = class {
    observe() {}
    disconnect() {}
  }
  ;(globalThis as any).IntersectionObserver = class {
    constructor(cb: IntersectionObserverCallback) {
      ultimoIO = { cb, nodos: [] }
    }
    observe(n: Element) { ultimoIO!.nodos.push(n) }
    disconnect() {}
  }
})

/** Simula lo que devolvería el navegador para un elemento. */
function fijarRect(el: Element, rect: Partial<DOMRect>) {
  el.getBoundingClientRect = () => ({
    top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON: () => ({}), ...rect,
  }) as DOMRect
}

describe('useOffsetCabecera', () => {
  function Sonda() {
    const offset = useOffsetCabecera()
    return <span data-testid="offset">{offset}</span>
  }

  it('mide la cabecera real y coloca debajo (no detrás)', () => {
    const cab = document.createElement('header')
    document.body.appendChild(cab)
    fijarRect(cab, { top: 0, bottom: 105, height: 105 })
    render(<Sonda />)
    expect(screen.getByTestId('offset').textContent).toBe('105')
    cab.remove()
  })

  it('sin cabecera no desplaza nada', () => {
    render(<Sonda />)
    expect(screen.getByTestId('offset').textContent).toBe('0')
  })

  it('cuenta la fila marcada que asoma por debajo, e IGNORA lo demás', () => {
    const cab = document.createElement('header')
    fijarRect(cab, { top: 0, bottom: 105, height: 105 })
    // Fila legítima (racha/leyes en móvil): marcada, cuenta.
    const fila = document.createElement('div')
    fila.setAttribute('data-cabecera-fila', 'extra')
    fijarRect(fila, { top: 105, bottom: 142, height: 37 })
    // Menú desplegable oculto: NO marcado. Antes se colaba y hundía la barra media pantalla.
    const menu = document.createElement('div')
    fijarRect(menu, { top: 105, bottom: 561, height: 456 })
    cab.append(fila, menu)
    document.body.appendChild(cab)

    render(<Sonda />)
    expect(screen.getByTestId('offset').textContent).toBe('142')
    cab.remove()
  })
})

describe('useArrastrable', () => {
  function Sonda({ alPulsar }: { alPulsar: () => void }) {
    const a = useArrastrable('test:pildora')
    return (
      <div ref={a.ref} onPointerDown={a.onPointerDown} style={a.estilo} data-testid="pildora">
        <button type="button" onClick={a.siNoArrastro(alPulsar)}>pulsar</button>
      </div>
    )
  }

  // jsdom no trae `PointerEvent`; se emula con `MouseEvent` del mismo tipo, que sí lleva
  // clientX/clientY (sin ellos el gesto se queda en NaN y no se mueve nada).
  const arrastrar = (el: Element, dx: number, dy: number) => {
    act(() => {
      el.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 100, clientY: 100 }))
    })
    act(() => {
      window.dispatchEvent(new MouseEvent('pointermove', { clientX: 100 + dx, clientY: 100 + dy }))
      window.dispatchEvent(new MouseEvent('pointerup', {}))
    })
  }

  it('un arrastre mueve el control y guarda la posición para la próxima vez', () => {
    const alPulsar = jest.fn()
    const { unmount } = render(<Sonda alPulsar={alPulsar} />)
    const pildora = screen.getByTestId('pildora')
    fijarRect(pildora, { top: 100, left: 100, bottom: 140, right: 220, width: 120, height: 40 })

    arrastrar(pildora, 40, 200)

    expect(pildora.style.position).toBe('fixed')
    expect(localStorage.getItem('arrastrable:test:pildora')).toBe(JSON.stringify({ left: 140, top: 300 }))

    // Y al volver a montar (recargar la página) reaparece donde se dejó.
    unmount()
    render(<Sonda alPulsar={alPulsar} />)
    expect(screen.getByTestId('pildora').style.top).toBe('300px')
  })

  it('arrastrar NO dispara la acción del botón (el reloj no cambiaba de modo al moverlo)', () => {
    const alPulsar = jest.fn()
    render(<Sonda alPulsar={alPulsar} />)
    const pildora = screen.getByTestId('pildora')
    fijarRect(pildora, { top: 100, left: 100, bottom: 140, right: 220, width: 120, height: 40 })

    arrastrar(pildora, 40, 200)
    fireEvent.click(screen.getByRole('button'))
    expect(alPulsar).not.toHaveBeenCalled()

    // Pero el clic siguiente sí funciona: el arrastre no deja el control muerto.
    fireEvent.click(screen.getByRole('button'))
    expect(alPulsar).toHaveBeenCalledTimes(1)
  })

  it('un temblor por debajo del umbral sigue siendo un toque', () => {
    const alPulsar = jest.fn()
    render(<Sonda alPulsar={alPulsar} />)
    const pildora = screen.getByTestId('pildora')
    fijarRect(pildora, { top: 100, left: 100, bottom: 140, right: 220, width: 120, height: 40 })

    arrastrar(pildora, 3, 2)
    fireEvent.click(screen.getByRole('button'))
    expect(alPulsar).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem('arrastrable:test:pildora')).toBeNull()
  })

  it('una posición corrupta en localStorage no rompe el render', () => {
    localStorage.setItem('arrastrable:test:pildora', '{{roto')
    render(<Sonda alPulsar={jest.fn()} />)
    expect(screen.getByTestId('pildora').style.position).toBe('')
  })
})

describe('useFueraDePantalla', () => {
  function Sonda({ tarde = false }: { tarde?: boolean }) {
    const { ref, fuera } = useFueraDePantalla<HTMLDivElement>()
    const [listo, setListo] = React.useState(!tarde)
    React.useEffect(() => { if (tarde) setListo(true) }, [tarde])
    return (
      <>
        <span data-testid="estado">{fuera ? 'fuera' : 'dentro'}</span>
        {listo && <div ref={ref} data-testid="observado" />}
      </>
    )
  }

  const avisar = (alturaVisible: number) => act(() => {
    ultimoIO!.cb(
      [{ intersectionRect: { height: alturaVisible } } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    )
  })

  it('marca "fuera" solo cuando queda poco a la vista', () => {
    render(<Sonda />)
    expect(screen.getByTestId('estado').textContent).toBe('dentro')

    avisar(0)
    expect(screen.getByTestId('estado').textContent).toBe('fuera')

    // Asomar un trozo pequeño no basta para esconder los controles: si no, saltar a una
    // pregunta de arriba los escondía en mitad del salto y no se podían encadenar.
    avisar(30)
    expect(screen.getByTestId('estado').textContent).toBe('fuera')

    avisar(200)
    expect(screen.getByTestId('estado').textContent).toBe('dentro')
  })

  it('se engancha aunque el nodo aparezca DESPUÉS del primer render', () => {
    render(<Sonda tarde />)
    expect(ultimoIO?.nodos.length).toBe(1)
    avisar(0)
    expect(screen.getByTestId('estado').textContent).toBe('fuera')
  })
})
