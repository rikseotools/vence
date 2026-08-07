/**
 * Recompensa de 1 € por impugnación ACEPTADA (decisión Manuel 28/07).
 *
 * Se testea la POLÍTICA pura (`shouldRewardResolvedDispute`) + el importe + el tope mensual, que es
 * donde vive el dinero. El anti-duplicado real es físico (índice único parcial `dispute_id`) y se
 * verifica contra RDS en la simulación de integración, no aquí.
 */
import { shouldRewardResolvedDispute, rewardAmount, withinRewardMonthlyCap, REWARD_AMOUNTS, IMPUGNACION_MONTHLY_CAP, rewardSourceText } from '@/lib/referrals/logic'

describe('recompensa por impugnación aceptada', () => {
  // El MOTIVO forma parte de la política desde el 28/07 (solo pagan los verificables; ver
  // `recompensaPorTipoDeImpugnacion.test.ts`). Aquí se fija uno que paga para poder aislar las
  // demás dimensiones —estado, origen, plan, usuario— sin que el tipo las tape.
  const base = { status: 'resolved', source: 'user', planType: 'premium', userId: 'u1', disputeType: 'respuesta_incorrecta' }

  it('son 1 €, ni más ni menos', () => {
    expect(REWARD_AMOUNTS.impugnacion).toBe(1)
    expect(rewardAmount('impugnacion')).toBe(1)
  })

  it('concede cuando se acepta a un premium', () => {
    expect(shouldRewardResolvedDispute(base)).toBe(true)
  })

  it('NO paga si la impugnación se desestima', () => {
    expect(shouldRewardResolvedDispute({ ...base, status: 'rejected' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...base, status: 'pending' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...base, status: 'reviewing' })).toBe(false)
  })

  it('NO paga a usuarios que no son premium (decisión Manuel: el programa es solo-premium)', () => {
    expect(shouldRewardResolvedDispute({ ...base, planType: 'free' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...base, planType: 'trial' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...base, planType: null })).toBe(false)
  })

  it('NO paga las impugnaciones que genera la IA (source=ai_auto): no hay a quién pagar', () => {
    expect(shouldRewardResolvedDispute({ ...base, source: 'ai_auto' })).toBe(false)
  })

  it('NO paga si la impugnación no tiene usuario asociado', () => {
    expect(shouldRewardResolvedDispute({ ...base, userId: null })).toBe(false)
  })

  it('trata la ausencia de `source` como impugnación de usuario (psicotécnicas: esa columna no existe)', () => {
    expect(shouldRewardResolvedDispute({ status: 'resolved', planType: 'premium', userId: 'u1', disputeType: 'error_pregunta_respuesta' })).toBe(true)
  })

  it('NO paga si el motivo es de valoración personal, aunque todo lo demás cuadre', () => {
    // La política de tipos (28/07) no es un filtro más: era el 61 % de lo que se pagaba.
    expect(shouldRewardResolvedDispute({ ...base, disputeType: 'explicacion_confusa' })).toBe(false)
    expect(shouldRewardResolvedDispute({ ...base, disputeType: undefined })).toBe(false)
  })

  describe('forceRewardable — concesión A MANO del motivo subjetivo [T-388]', () => {
    it('un motivo subjetivo SÍ paga con forceRewardable', () => {
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'otro', forceRewardable: true })).toBe(true)
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'explicacion_confusa', forceRewardable: true })).toBe(true)
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'explicacion_mejorable', forceRewardable: true })).toBe(true)
    })

    it('sin forceRewardable (o en false) el subjetivo sigue sin pagar: no cambia el default', () => {
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'otro' })).toBe(false)
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'otro', forceRewardable: false })).toBe(false)
    })

    it('forceRewardable NO salta las demás condiciones — no es un "paga sí o sí"', () => {
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'otro', forceRewardable: true, status: 'rejected' })).toBe(false)
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'otro', forceRewardable: true, planType: 'free' })).toBe(false)
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'otro', forceRewardable: true, source: 'ai_auto' })).toBe(false)
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'otro', forceRewardable: true, userId: null })).toBe(false)
    })

    it('un motivo YA verificable con forceRewardable sigue pagando (no hay efecto doble)', () => {
      expect(shouldRewardResolvedDispute({ ...base, disputeType: 'respuesta_incorrecta', forceRewardable: true })).toBe(true)
    })
  })

  describe('tope mensual — es lo único que separa premiar calidad de pagar volumen', () => {
    it('deja pasar por debajo del tope y corta al llegar', () => {
      expect(withinRewardMonthlyCap('impugnacion', 0)).toBe(true)
      expect(withinRewardMonthlyCap('impugnacion', IMPUGNACION_MONTHLY_CAP - 1)).toBe(true)
      expect(withinRewardMonthlyCap('impugnacion', IMPUGNACION_MONTHLY_CAP)).toBe(false)
      expect(withinRewardMonthlyCap('impugnacion', IMPUGNACION_MONTHLY_CAP + 50)).toBe(false)
    })

    it('el caso real que motivó el tope: 25 aceptadas en un mes NO son 25 €', () => {
      const aceptadas = 25 // usuaria medida el 28/07: 76 en 90 días
      const pagadas = Array.from({ length: aceptadas }, (_, i) => withinRewardMonthlyCap('impugnacion', i)).filter(Boolean).length
      expect(pagadas).toBe(IMPUGNACION_MONTHLY_CAP)
      expect(pagadas * rewardAmount('impugnacion')).toBeLessThanOrEqual(10)
    })

    it('no toca los topes de las otras fuentes', () => {
      expect(withinRewardMonthlyCap('bug', 99)).toBe(true)     // sin tope duro
      expect(withinRewardMonthlyCap('ugc', 3)).toBe(false)     // 3/mes
    })
  })

  it('la fuente tiene etiqueta propia: el usuario nunca ve el identificador crudo', () => {
    expect(rewardSourceText('impugnacion')).toBe('⚖️ Impugnaciones aceptadas')
    // Y las que ya existían siguen etiquetadas (el mapa es ÚNICO y compartido por los 3 paneles).
    expect(rewardSourceText('referido')).toContain('Recomendaciones')
    expect(rewardSourceText('bug')).toContain('Mejoras')
    expect(rewardSourceText('ugc')).toContain('Opiniones')
    expect(rewardSourceText('registro_activo')).toContain('Registros')
  })
})
