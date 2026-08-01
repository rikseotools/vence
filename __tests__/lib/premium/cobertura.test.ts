/**
 * «No pagar dos veces al volver» (T-363).
 *
 * Decide DOS cosas de dinero a la vez: qué se le dice a alguien antes de cobrarle y qué fecha se le
 * manda a Stripe como `trial_end`. Un error aquí no se ve en pantalla: se ve en el banco.
 */
import { coberturaPendiente, trazaCobertura } from '@/lib/api/premium/cobertura'

const AHORA = new Date('2026-07-31T12:00:00Z')
const enDias = (d: number) => new Date(AHORA.getTime() + d * 86_400_000)

describe('coberturaPendiente', () => {
  it('aplaza el cobro a la fecha exacta en que se le acaba lo pagado', () => {
    const fin = enDias(92)
    const r = coberturaPendiente(fin, AHORA)
    expect(r.aplica).toBe(true)
    expect(r.dias).toBe(92)
    expect(r.trialEnd).toBe(Math.floor(fin.getTime() / 1000)) // lo que se le manda a Stripe
    expect(r.texto).toContain('no se te cobrará nada hasta')
  })

  it('sin cobertura viva no aplaza nada (los que ya cayeron pagan desde hoy)', () => {
    expect(coberturaPendiente(null, AHORA)).toEqual({ aplica: false, trialEnd: null, dias: 0, texto: '' })
  })

  it('con la cobertura ya vencida tampoco', () => {
    expect(coberturaPendiente(enDias(-5), AHORA).aplica).toBe(false)
  })

  // Stripe rechaza un `trial_end` a menos de 48 h. Mandárselo igual sería un error de pago en la
  // cara del usuario, así que por debajo de ese umbral simplemente no se aplaza.
  it('por debajo de 48 h no se aplaza, porque Stripe lo rechazaría', () => {
    expect(coberturaPendiente(enDias(1), AHORA).aplica).toBe(false)
    expect(coberturaPendiente(enDias(3), AHORA).aplica).toBe(true)
  })

  it('una fecha ilegible no inventa un aplazamiento', () => {
    expect(coberturaPendiente('el mes que viene' as unknown as string, AHORA).aplica).toBe(false)
  })

  it('acepta el string ISO que devuelve la BD', () => {
    expect(coberturaPendiente(enDias(40).toISOString(), AHORA).dias).toBe(40)
  })

  it('la fecha se escribe con letras, no en ISO: la lee una persona', () => {
    expect(coberturaPendiente(new Date('2026-10-30T12:00:00Z'), AHORA).texto).toContain('octubre')
  })
})

// El aplazamiento se decidía y no quedaba rastro salvo un console.log que no mira nadie. Como el
// fallo es invisible en pantalla y solo se ve en el banco del usuario semanas después, lo que se
// guarda tiene que bastar para juzgar el caso SIN volver a ejecutarlo.
describe('trazaCobertura — el rastro que deja un checkout con precio heredado', () => {
  it('cuando aplaza, guarda la fecha del primer cobro, que es el dato que se puede contrastar', () => {
    const fin = enDias(92)
    const t = trazaCobertura(coberturaPendiente(fin, AHORA), true)
    expect(t).toEqual({
      aplaza: true,
      dias: 92,
      primerCobro: fin.toISOString(),
      motivo: null,
    })
  })

  // Las dos formas de no aplazar son distintas y hay que poder separarlas: una es el caso normal
  // y la otra es el borde donde se escondería un error de cálculo.
  it('sin cobertura previa: no aplazar es lo correcto, y se dice por qué', () => {
    const t = trazaCobertura(coberturaPendiente(null, AHORA), false)
    expect(t.aplaza).toBe(false)
    expect(t.motivo).toBe('sin_cobertura_previa')
  })

  it('con cobertura por debajo de 48 h: tampoco aplaza, pero NO es el mismo caso', () => {
    const t = trazaCobertura(coberturaPendiente(enDias(1), AHORA), true)
    expect(t.aplaza).toBe(false)
    expect(t.motivo).toBe('menos_de_48h')
  })

  it('un aplaza:false sin motivo sería injuzgable, así que siempre lo lleva', () => {
    for (const previa of [true, false]) {
      expect(trazaCobertura(coberturaPendiente(null, AHORA), previa).motivo).not.toBeNull()
    }
  })
})
