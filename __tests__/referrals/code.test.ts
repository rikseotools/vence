// __tests__/referrals/code.test.ts — núcleo PURO de normalización del código de referido.
//
// Los casos "sucios" NO son inventados: están copiados de `observable_events` del 27/07/2026,
// donde 21 de los 216 clicks del sistema llegaron con el texto del mensaje pegado al código
// porque WhatsApp linkifica hasta el final del token. Ver lib/referrals/code.ts.

import { normalizeReferralCode, REFERRAL_CODE_LENGTH } from '@/lib/referrals/code'

describe('normalizeReferralCode', () => {
  describe('entradas canónicas (no se toca nada)', () => {
    it('acepta un código exacto y NO lo marca como saneado', () => {
      expect(normalizeReferralCode('7d5f7ed7fe83')).toEqual({ code: '7d5f7ed7fe83', sanitized: false })
    })

    it('normaliza mayúsculas y espacios sobrantes (copiar/pegar de un móvil)', () => {
      expect(normalizeReferralCode('  7D5F7ED7FE83 ')).toEqual({ code: '7d5f7ed7fe83', sanitized: false })
    })

    it('el código generado mide 12 caracteres hex', () => {
      expect(REFERRAL_CODE_LENGTH).toBe(12)
    })
  })

  describe('casos REALES que se perdían (21 clicks, 27/07/2026)', () => {
    it('recupera el código cuando lleva puntos y texto pegado detrás', () => {
      expect(normalizeReferralCode('7d5f7ed7fe83..................esto')).toEqual({
        code: '7d5f7ed7fe83', sanitized: true,
      })
    })

    it('recupera el mensaje entero pegado al código', () => {
      const raw = '7d5f7ed7fe83..................esto es una plataforma de estudio con temario y test..... VENCE\n'
      expect(normalizeReferralCode(raw)).toEqual({ code: '7d5f7ed7fe83', sanitized: true })
    })

    it('recupera aunque el cliente haya percent-encodeado la basura', () => {
      expect(normalizeReferralCode('7d5f7ed7fe83%20esto%20es%20una%20plataforma')).toEqual({
        code: '7d5f7ed7fe83', sanitized: true,
      })
    })

    it('recupera con separadores típicos de mensajería', () => {
      for (const sep of ['-', '_', '/', '?', ')', ',', ':']) {
        expect(normalizeReferralCode(`7d5f7ed7fe83${sep}mira esto`).code).toBe('7d5f7ed7fe83')
      }
    })
  })

  describe('texto pegado que EMPIEZA por un carácter hex (el patrón más común al escribir sin espacio)', () => {
    // Los códigos son de longitud FIJA (12): un código de 13+ no existe, así que el prefijo de 12
    // es el único candidato posible y la BD hace de árbitro final. Rescatarlo es seguro.
    it('recupera "…fe83entra aquí" (la e es hex y antes lo descartábamos)', () => {
      expect(normalizeReferralCode('7d5f7ed7fe83entra aqui')).toEqual({ code: '7d5f7ed7fe83', sanitized: true })
    })

    it('recupera aunque el texto pegado sea TODO hexadecimal', () => {
      expect(normalizeReferralCode('7d5f7ed7fe83abcdef')).toEqual({ code: '7d5f7ed7fe83', sanitized: true })
    })

    it('un prefijo que no sea un código activo lo rechaza la BD, no esta función', () => {
      // Devuelve candidato; resolveActiveReferralCode consulta y devuelve null si no existe.
      expect(normalizeReferralCode('000000000000despues').code).toBe('000000000000')
    })
  })

  describe('lo que sigue sin ser rescatable', () => {
    it('devuelve null si el código viene incompleto', () => {
      expect(normalizeReferralCode('7d5f7ed7fe8')).toEqual({ code: null, sanitized: false })
      expect(normalizeReferralCode('7d5f7ed7fe8...texto')).toEqual({ code: null, sanitized: false })
    })
  })

  describe('entradas vacías o sin nada aprovechable', () => {
    it.each([null, undefined, '', '   '])('devuelve null para %p', (raw) => {
      expect(normalizeReferralCode(raw as string | null | undefined)).toEqual({ code: null, sanitized: false })
    })

    it('devuelve null si no empieza por hex (no rebusca en medio del texto)', () => {
      expect(normalizeReferralCode('mira-esto-7d5f7ed7fe83')).toEqual({ code: null, sanitized: false })
    })

    it('no revienta con una secuencia percent inválida', () => {
      expect(() => normalizeReferralCode('7d5f7ed7fe83%zz')).not.toThrow()
      expect(normalizeReferralCode('7d5f7ed7fe83%zz').code).toBe('7d5f7ed7fe83')
    })
  })
})
