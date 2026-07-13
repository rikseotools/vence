// Guardarraíl del bug flor/MariSol (13/07): "Volver a Tests" de la revisión
// mandaba a Estado a usuarios de otra oposición. La flagship es SOLO último recurso.
import { resolveReviewBackSlug, FLAGSHIP_OPOSICION_SLUG } from '@/lib/nav/reviewBackSlug'

describe('resolveReviewBackSlug — a qué oposición vuelve la revisión', () => {
  it('usa la oposición DEL USUARIO cuando el test no la trae (caso MariSol/GVA)', () => {
    const r = resolveReviewBackSlug(undefined, 'auxiliar-administrativo-valencia')
    expect(r.slug).toBe('auxiliar-administrativo-valencia')
    expect(r.usedFlagshipFallback).toBe(false)
  })

  it('prioriza la oposición del TEST si se conoce', () => {
    const r = resolveReviewBackSlug('tramitacion-procesal', 'auxiliar-administrativo-valencia')
    expect(r.slug).toBe('tramitacion-procesal')
    expect(r.usedFlagshipFallback).toBe(false)
  })

  it('flagship (Estado) SOLO como último recurso (ni test ni usuario)', () => {
    const r = resolveReviewBackSlug(null, null)
    expect(r.slug).toBe(FLAGSHIP_OPOSICION_SLUG)
    expect(r.usedFlagshipFallback).toBe(true) // señal para observabilidad
  })

  it('un usuario de Estado sigue yendo a Estado (sin regresión)', () => {
    const r = resolveReviewBackSlug(undefined, 'auxiliar-administrativo-estado')
    expect(r.slug).toBe('auxiliar-administrativo-estado')
    expect(r.usedFlagshipFallback).toBe(false)
  })

  it('strings vacíos/espacios se tratan como ausentes', () => {
    expect(resolveReviewBackSlug('', '   ').usedFlagshipFallback).toBe(true)
    expect(resolveReviewBackSlug('  ', 'granada-escala-administrativa').slug).toBe('granada-escala-administrativa')
  })
})
