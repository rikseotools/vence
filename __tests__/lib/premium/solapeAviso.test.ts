/**
 * El aviso de solape de cobro (T-355).
 *
 * Decide qué se le dice a alguien justo antes de cobrarle, así que las dos direcciones importan:
 * callar cuando hay solape le cuesta dinero, y avisar cuando no lo hay le asusta sin motivo y
 * puede costar una venta.
 */
import { avisoSolape } from '@/lib/api/premium/solapeAviso'

const AHORA = new Date('2026-07-31T12:00:00Z')
const enDias = (d: number) => new Date(AHORA.getTime() + d * 86_400_000)

describe('avisoSolape', () => {
  it('avisa cuando la suscripción actual dura meses (el caso de los trimestrales y semestrales)', () => {
    const r = avisoSolape(enDias(92), AHORA)
    expect(r.solapa).toBe(true)
    expect(r.dias).toBe(92)
    expect(r.texto).toContain('92 días')
    expect(r.texto).toContain('octubre') // la fecha va con todas las letras, no en ISO
  })

  it('calla si no le queda suscripción viva (el caso de los 199 ya caídos)', () => {
    expect(avisoSolape(null, AHORA)).toEqual({ solapa: false, dias: 0, texto: '' })
  })

  it('calla si la suscripción ya venció', () => {
    expect(avisoSolape(enDias(-3), AHORA).solapa).toBe(false)
  })

  // Un día de solape no merece asustar a nadie: el día que se contrata suele ser el mismo en que
  // caduca lo anterior, y el aviso costaría más que el importe.
  it('calla por un solo día', () => {
    expect(avisoSolape(enDias(1), AHORA).solapa).toBe(false)
    expect(avisoSolape(enDias(2), AHORA).solapa).toBe(true)
  })

  it('una fecha ilegible no genera aviso (nunca inventa un plazo)', () => {
    expect(avisoSolape('el mes que viene' as unknown as string, AHORA).solapa).toBe(false)
  })

  it('acepta la fecha como string ISO, que es como llega de la BD', () => {
    expect(avisoSolape(enDias(40).toISOString(), AHORA).dias).toBe(40)
  })

  it('el texto le ofrece esperar: la oferta no se pierde por no contratar hoy', () => {
    expect(avisoSolape(enDias(30), AHORA).texto).toContain('tu precio te espera igual')
  })
})
