// __tests__/navigation/anclaArticulo.test.ts
//
// [T-611] El ancla con la que el temario devuelve al usuario AL ARTÍCULO donde estaba.
// Es la misma función que usa el componente (nada de test-copia): si esto cambia de forma,
// los enlaces de vuelta guardados en sesión dejan de casar y la vuelta se pierde en silencio
// — que es exactamente el fallo que reportó una usuaria premium.
import { anclaArticulo } from '@/lib/navigation/backToArticleLink'

describe('anclaArticulo', () => {
  it('construye un ancla estable con la ley y el artículo', () => {
    expect(anclaArticulo('CE', '116')).toBe('art-ce-116')
    expect(anclaArticulo('Ley 7/1985', '24')).toBe('art-ley-7-1985-24')
  })

  it('DISTINGUE el mismo número en leyes distintas del mismo tema', () => {
    // Sin la ley en el ancla, el art. 1 de las tres leyes de un tema colisionaría y la
    // vuelta llevaría al artículo de otra norma.
    const anclas = ['CE', 'Ley 39/2015', 'LPRL'].map((l) => anclaArticulo(l, 1))
    expect(new Set(anclas).size).toBe(3)
  })

  it('admite identificadores NO numéricos (disposiciones, bis/ter)', () => {
    expect(anclaArticulo('LO 3/2007', '55 ter')).toBe('art-lo-3-2007-55-ter')
    expect(anclaArticulo('LO 3/2007', 'DA 1')).toBe('art-lo-3-2007-da-1')
    expect(anclaArticulo('EBEP', 'D. F. 2ª')).toBe('art-ebep-d-f-2')
  })

  it('sale limpio para un id de HTML y para un fragmento de URL', () => {
    const casos: Array<[string, string | number]> = [
      ['Ley 2/2015 (Galicia)', '  7  '],
      ['Código Civil', '1.976'],
      ['Estatuto de Autonomía — Andalucía', '55 bis'],
    ]
    for (const [ley, art] of casos) {
      const a = anclaArticulo(ley, art)!
      expect(a).toMatch(/^art-[a-z0-9-]+$/)
      expect(a).toBe(encodeURIComponent(a))
      expect(a).not.toMatch(/--|-$/)
    }
  })

  it('quita las tildes (el fragmento viaja en la URL)', () => {
    expect(anclaArticulo('Régimen Jurídico', '3')).toBe('art-regimen-juridico-3')
  })

  it('devuelve null cuando falta cualquiera de las dos piezas', () => {
    // Mejor SIN ancla que con una a medias: el componente cae al comportamiento de siempre
    // (volver arriba del tema) en vez de dejar un `id` ambiguo que apunte a otro artículo.
    expect(anclaArticulo(null, '3')).toBeNull()
    expect(anclaArticulo('CE', null)).toBeNull()
    expect(anclaArticulo('', '3')).toBeNull()
    expect(anclaArticulo('CE', '')).toBeNull()
    expect(anclaArticulo('CE', undefined)).toBeNull()
    expect(anclaArticulo('***', '3')).toBeNull()
  })

  it('es DETERMINISTA: el que se guarda al salir es el que se busca al volver', () => {
    // El enlace se guarda en sessionStorage antes del test y se resuelve al volver, quizá
    // minutos después y tras un repintado: si no fuera estable, la vuelta no encontraría nada.
    for (const [l, a] of [['CE', '116'], ['Ley 7/1985', '24'], ['LO 3/2007', '55 ter']] as const) {
      expect(anclaArticulo(l, a)).toBe(anclaArticulo(l, a))
    }
  })
})
