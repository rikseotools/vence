/**
 * Arrastre de los controles flotantes (examen) y de la píldora de meta diaria.
 *
 * Lo que fijan estos casos salió de fallos vistos en la verificación con navegador:
 *   - guardar la posición como DESPLAZAMIENTO hacía que al recargar el control apareciera
 *     en otro sitio (la posición "natural" cuelga de la cabecera, que cambia de alto);
 *   - sin umbral, arrastrar disparaba también el clic (el reloj cambiaba de modo al moverlo).
 */
import {
  clampPosAbsoluta,
  clampOffsetArrastre,
  esArrastre,
  parsearPosAbsoluta,
  UMBRAL_ARRASTRE_PX,
} from '@/lib/ui/arrastrable'

describe('clampPosAbsoluta', () => {
  const viewport = { viewportWidth: 390, viewportHeight: 844, width: 120, height: 48 }

  it('deja pasar una posición que cabe entera', () => {
    expect(clampPosAbsoluta({ left: 20, top: 200, ...viewport })).toEqual({ left: 20, top: 200 })
  })

  it('no deja que se salga por arriba ni por la izquierda', () => {
    expect(clampPosAbsoluta({ left: -500, top: -500, ...viewport })).toEqual({ left: 4, top: 4 })
  })

  it('no deja que se pierda por abajo ni por la derecha', () => {
    // 390-120-4 = 266 · 844-48-4 = 792
    expect(clampPosAbsoluta({ left: 9999, top: 9999, ...viewport })).toEqual({ left: 266, top: 792 })
  })

  it('en una pantalla más pequeña que el control, lo pega al margen (no genera negativos)', () => {
    const r = clampPosAbsoluta({ left: 300, top: 300, width: 500, height: 900, viewportWidth: 390, viewportHeight: 844 })
    expect(r).toEqual({ left: 4, top: 4 })
  })

  it('redondea a píxeles enteros', () => {
    expect(clampPosAbsoluta({ left: 20.4, top: 200.6, ...viewport })).toEqual({ left: 20, top: 201 })
  })
})

describe('esArrastre', () => {
  it('un temblor por debajo del umbral es un TOQUE, no un arrastre', () => {
    expect(esArrastre(3, 3)).toBe(false)
    expect(esArrastre(0, 0)).toBe(false)
  })

  it('a partir del umbral es arrastre, en cualquier dirección', () => {
    expect(esArrastre(UMBRAL_ARRASTRE_PX, 0)).toBe(true)
    expect(esArrastre(0, -UMBRAL_ARRASTRE_PX)).toBe(true)
    expect(esArrastre(-40, 90)).toBe(true)
  })
})

describe('parsearPosAbsoluta', () => {
  it('lee una posición válida', () => {
    expect(parsearPosAbsoluta('{"left":10,"top":20}')).toEqual({ left: 10, top: 20 })
  })

  it('basura en localStorage no rompe el render: vuelve a la posición de fábrica', () => {
    for (const basura of [null, undefined, '', 'no-json', '{}', '{"left":"a","top":2}', '{"left":null,"top":null}', 'null']) {
      expect(parsearPosAbsoluta(basura as string)).toBeNull()
    }
  })

  it('rechaza valores no finitos (un NaN guardado dejaría el control inalcanzable)', () => {
    expect(parsearPosAbsoluta('{"left":null,"top":5}')).toBeNull()
  })
})

describe('clampOffsetArrastre (el que sigue usando la píldora de meta diaria)', () => {
  it('devuelve el desplazamiento relativo ya corregido al viewport', () => {
    const r = clampOffsetArrastre({
      naturalLeft: 100, naturalTop: 100, baseX: 0, baseY: 0, dx: 50, dy: 50,
      width: 100, height: 40, viewportWidth: 390, viewportHeight: 844,
    })
    expect(r).toEqual({ x: 50, y: 50 })
  })

  it('recorta el desplazamiento que sacaría el elemento de la pantalla', () => {
    const r = clampOffsetArrastre({
      naturalLeft: 100, naturalTop: 100, baseX: 0, baseY: 0, dx: 9999, dy: 9999,
      width: 100, height: 40, viewportWidth: 390, viewportHeight: 844,
    })
    expect(r).toEqual({ x: 186, y: 700 }) // 390-100-4=286 → 186 · 844-40-4=800 → 700
  })
})
