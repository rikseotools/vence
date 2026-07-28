/**
 * La recompensa de 1 € por impugnación aceptada solo se concede por motivos VERIFICABLES.
 *
 * Por qué existe esta política (28/07/2026): la recompensa se lanzó pagando por cualquier
 * impugnación `resolved` de un premium. Medido sobre 90 días, eso son 322 impugnaciones aceptadas,
 * de las cuales **195 (61 %) eran de motivo subjetivo** — `otro` (113), `explicacion_confusa` (47),
 * `explicacion_mejorable` (35) — y una sola usuaria concentraba 70. Sumado a que el manual (§7.3)
 * manda mejorar toda explicación mejorable, `explicacion_confusa` era un camino casi garantizado a
 * `resolved`: 10 €/mes por persona (el tope) sin que hubiéramos cometido error alguno.
 *
 * La regla es objetividad, no esfuerzo: se paga cuando aceptar significa que teníamos un error
 * DEMOSTRABLE contra la fuente. Lo subjetivo se sigue premiando, pero A MANO.
 */
import {
  shouldRewardResolvedDispute,
  disputeTypeIsRewardable,
  DISPUTE_REWARD_BY_TYPE,
} from '@/lib/referrals/logic'
import { ALL_DISPUTE_TYPES } from '@/lib/api/v2/dispute/types'

const premiumAceptada = (disputeType: string | null) => ({
  status: 'resolved',
  source: 'user',
  planType: 'premium',
  userId: '00000000-0000-4000-8000-000000000001',
  disputeType,
})

describe('qué motivos de impugnación pagan', () => {
  it('paga los motivos verificables contra la fuente', () => {
    for (const t of ['respuesta_incorrecta', 'no_literal', 'desacuerdo_correcta', 'mal_formulada', 'pregunta_repetida', 'tema_incorrecto', 'error_pregunta_respuesta']) {
      expect(shouldRewardResolvedDispute(premiumAceptada(t))).toBe(true)
    }
  })

  it('NO paga los motivos de opinión, ni siquiera aceptados a un premium', () => {
    // Estos son el 61 % del volumen aceptado: es el grueso de lo que la política corta.
    for (const t of ['explicacion_confusa', 'explicacion_mejorable', 'otro']) {
      expect(shouldRewardResolvedDispute(premiumAceptada(t))).toBe(false)
    }
  })

  it('un tipo desconocido NO paga (el dinero falla cerrado)', () => {
    // Si en la BD aparece un valor fuera del dominio, la duda no se resuelve pagando.
    expect(disputeTypeIsRewardable('tipo_que_no_existe')).toBe(false)
    expect(disputeTypeIsRewardable(null)).toBe(false)
    expect(disputeTypeIsRewardable(undefined)).toBe(false)
    expect(shouldRewardResolvedDispute(premiumAceptada(null))).toBe(false)
  })

  it('el tipo no salta las demás condiciones (rechazada, IA, free)', () => {
    const tipoBueno = 'respuesta_incorrecta'
    expect(shouldRewardResolvedDispute({ ...premiumAceptada(tipoBueno), status: 'rejected' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...premiumAceptada(tipoBueno), source: 'ai_auto' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...premiumAceptada(tipoBueno), planType: 'free' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...premiumAceptada(tipoBueno), userId: null })).toBe(false)
  })
})

describe('la clasificación no puede tener huecos', () => {
  it('TODOS los tipos de impugnación existentes están clasificados', () => {
    // El `Record<DisputeType, boolean>` ya lo garantiza en compilación; esto lo defiende también en
    // ejecución por si alguien amplía el dominio con un cast. Un tipo sin clasificar heredaría una
    // política que nadie eligió — que es exactamente cómo se cuelan los fallos silenciosos.
    const sinClasificar = ALL_DISPUTE_TYPES.filter((t) => typeof DISPUTE_REWARD_BY_TYPE[t] !== 'boolean')
    expect(sinClasificar).toEqual([])
  })

  it('la clasificación no inventa tipos que no existen', () => {
    const inventados = Object.keys(DISPUTE_REWARD_BY_TYPE).filter(
      (t) => !(ALL_DISPUTE_TYPES as readonly string[]).includes(t),
    )
    expect(inventados).toEqual([])
  })
})
