// __tests__/components/DailyGoalBanner.test.ts
//
// Tests de los helpers puros de DailyGoalBanner (barra de meta diaria movible +
// ocultable). NO montan el componente React (demasiados mocks de auth/supabase)
// — testean los helpers exportados que contienen la lógica de negocio:
//   - effectiveBannerVisible: visibilidad efectiva a partir de la preferencia
//   - nextBannerVisible:      valor al pulsar el toggle
//   - clampBannerOffset:      el arrastre nunca se sale del viewport

// Mock de supabase para no disparar el cliente real al importar la cadena de
// módulos (AuthContext → supabase). Mismo patrón que QuestionEvolution.test.ts.
jest.mock('@/lib/supabase', () => ({
  getSupabaseClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }) }) }),
  }),
}))

import {
  effectiveBannerVisible,
  nextBannerVisible,
  clampBannerOffset,
} from '@/components/DailyGoalBanner'

describe('effectiveBannerVisible — default visible salvo flag explícito false', () => {
  it('true → visible', () => {
    expect(effectiveBannerVisible(true)).toBe(true)
  })
  it('false → oculta (la ✕ pone false)', () => {
    expect(effectiveBannerVisible(false)).toBe(false)
  })
  it('null (aún no cargado / sin preferencia) → visible por defecto', () => {
    expect(effectiveBannerVisible(null)).toBe(true)
  })
  it('undefined → visible por defecto', () => {
    expect(effectiveBannerVisible(undefined)).toBe(true)
  })
})

describe('nextBannerVisible — invierte el estado efectivo', () => {
  it('visible → siguiente oculta', () => {
    expect(nextBannerVisible(true)).toBe(false)
  })
  it('oculta → siguiente visible', () => {
    expect(nextBannerVisible(false)).toBe(true)
  })
  it('compone con effectiveBannerVisible: undefined (visible) → toggle = ocultar', () => {
    expect(nextBannerVisible(effectiveBannerVisible(undefined))).toBe(false)
  })
  it('compone: false (oculta) → toggle = mostrar', () => {
    expect(nextBannerVisible(effectiveBannerVisible(false))).toBe(true)
  })
})

describe('clampBannerOffset — la barra nunca se pierde fuera del viewport', () => {
  // Posición natural de la barra: arriba-derecha del header, 100x24 px.
  const natural = {
    naturalLeft: 800,
    naturalTop: 10,
    width: 100,
    height: 24,
    viewportWidth: 1000,
    viewportHeight: 800,
  }

  it('sin movimiento ni base → offset {0,0}', () => {
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: 0, dy: 0 })
    expect(r).toEqual({ x: 0, y: 0 })
  })

  it('arrastre dentro de los límites → offset = desplazamiento', () => {
    // mover 50px a la izquierda, 100px abajo (absLeft 750, absTop 110: ambos in-bounds)
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: -50, dy: 100 })
    expect(r).toEqual({ x: -50, y: 100 })
  })

  it('arrastre demasiado a la derecha → clampado al borde derecho (con margen)', () => {
    // absLeft pedido 800+500=1300; máximo = 1000-100-4 = 896 → offset = 896-800 = 96
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: 500, dy: 0 })
    expect(r.x).toBe(96)
  })

  it('arrastre demasiado a la izquierda → clampado al margen (no se sale por la izquierda)', () => {
    // absLeft pedido 800-2000 = -1200; mínimo = margin 4 → offset = 4-800 = -796
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: -2000, dy: 0 })
    expect(r.x).toBe(-796)
  })

  it('arrastre demasiado abajo → clampado al borde inferior (con margen)', () => {
    // absTop pedido 10+2000 = 2010; máximo = 800-24-4 = 772 → offset = 772-10 = 762
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: 0, dy: 2000 })
    expect(r.y).toBe(762)
  })

  it('arrastre demasiado arriba → clampado al margen superior', () => {
    // absTop pedido 10-500 = -490; mínimo = 4 → offset = 4-10 = -6
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: 0, dy: -500 })
    expect(r.y).toBe(-6)
  })

  it('acumula sobre una posición base previa', () => {
    // ya estaba desplazada -100; un dx de -30 más → absLeft 800-100-30=670 (in-bounds) → offset -130
    const r = clampBannerOffset({ ...natural, baseX: -100, baseY: 0, dx: -30, dy: 0 })
    expect(r.x).toBe(-130)
  })

  it('respeta un margen custom', () => {
    // margin 20: máximo absLeft = 1000-100-20 = 880 → offset 80
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: 500, dy: 0, margin: 20 })
    expect(r.x).toBe(80)
  })

  it('re-clamp de posición guardada: offset que cabía en pantalla ancha se corrige en una estrecha', () => {
    // Guardada en viewport ancho: offset x=+96 (barra pegada al borde derecho de 1000px).
    // Al reabrir en viewport estrecho (400px), ese mismo offset la sacaría fuera →
    // re-clamp con dx=dy=0 sobre la posición aplicada debe recolocarla dentro.
    const applied = { x: 96, y: 0 }
    const rectLeft = 896 // natural(800) + applied.x(96), pero en 400px de ancho está fuera
    const reclamped = clampBannerOffset({
      naturalLeft: rectLeft - applied.x, // natural = 800
      naturalTop: 10 - applied.y,
      baseX: applied.x, baseY: applied.y, dx: 0, dy: 0,
      width: 100, height: 24, viewportWidth: 400, viewportHeight: 800,
    })
    const absLeft = (rectLeft - applied.x) + reclamped.x
    expect(absLeft + 100).toBeLessThanOrEqual(400 - 4) // cabe en el viewport estrecho
    expect(absLeft).toBeGreaterThanOrEqual(4)
  })

  it('el resultado clampado siempre deja la barra completamente visible', () => {
    const r = clampBannerOffset({ ...natural, baseX: 0, baseY: 0, dx: 9999, dy: 9999 })
    const absLeft = natural.naturalLeft + r.x
    const absTop = natural.naturalTop + r.y
    expect(absLeft).toBeGreaterThanOrEqual(4)
    expect(absLeft + natural.width).toBeLessThanOrEqual(natural.viewportWidth - 4)
    expect(absTop).toBeGreaterThanOrEqual(4)
    expect(absTop + natural.height).toBeLessThanOrEqual(natural.viewportHeight - 4)
  })
})
