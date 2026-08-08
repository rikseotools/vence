/**
 * [T-714] El CÓDIGO del rechazo se guarda; el texto libre, no.
 *
 * Por qué existe: el 08/08/2026 hubo **7.000 rechazos 401 en 24 h** y no constaba el motivo de
 * ninguno. `verifyAuth` distingue `no_bearer_token` (el cliente no lo mandó) de
 * `remote_verify_failed` / `local_*` (lo mandó y no vale) — dos fallos que se arreglan en sitios
 * DISTINTOS, uno en el navegador y otro en el servidor. Ese dato viajaba al usuario en el JSON y
 * se tiraba. Distinguirlos costó media jornada de rodeos para acabar sabiendo lo que ahora
 * contesta una consulta.
 *
 * Y la otra mitad, que es la que impide que esto se vuelva un problema: `reason` lo escribe cada
 * guard, y mañana alguien puede meter ahí una frase con el correo de una persona. Por eso solo
 * pasa lo que tiene FORMA DE CÓDIGO. Guardar de menos se arregla; publicar un dato personal en
 * la telemetría, no.
 */
import { extractRejectionReason } from '@/lib/api/withErrorLogging'

describe('extractRejectionReason (T-714)', () => {
  describe('los motivos REALES de verifyAuth pasan', () => {
    it.each([
      'no_bearer_token',
      'remote_verify_failed',
      'local_token_expired',
      'impersonacion_caducada',
      'impersonacion_solo_lectura',
    ])('%s', (r) => {
      expect(extractRejectionReason({ error: 'No autorizado', reason: r })).toBe(r)
    })
  })

  it('sin `reason` en el cuerpo devuelve null (no inventa)', () => {
    expect(extractRejectionReason({ error: 'No autorizado' })).toBeNull()
    expect(extractRejectionReason({})).toBeNull()
    expect(extractRejectionReason(null)).toBeNull()
    expect(extractRejectionReason(undefined)).toBeNull()
  })

  it('recorta los espacios de sobra', () => {
    expect(extractRejectionReason({ reason: '  no_bearer_token  ' })).toBe('no_bearer_token')
  })

  describe('lo que NO tiene forma de código se descarta', () => {
    // El riesgo real: un guard futuro que escriba prosa ahí. La telemetría la lee mucha gente
    // y se retiene mucho tiempo; un correo colado ahí no se puede "desguardar".
    it.each([
      ['una frase con el correo de alguien', 'el usuario ana@example.com no tiene permiso'],
      ['texto con espacios', 'token invalido'],
      ['acentos y prosa', 'sesión caducada'],
      ['cadena vacía', ''],
      ['solo espacios', '   '],
      ['comillas y llaves', '{"email":"x@y.z"}'],
    ])('%s → null', (_caso, valor) => {
      expect(extractRejectionReason({ reason: valor })).toBeNull()
    })

    it('un valor larguísimo se descarta aunque parezca código', () => {
      expect(extractRejectionReason({ reason: 'a'.repeat(65) })).toBeNull()
      // Justo en el límite sí pasa: el corte es 64, no "más o menos 64".
      expect(extractRejectionReason({ reason: 'a'.repeat(64) })).toBe('a'.repeat(64))
    })

    it('un `reason` que no es texto se descarta', () => {
      expect(extractRejectionReason({ reason: 42 as unknown as string })).toBeNull()
      expect(extractRejectionReason({ reason: { a: 1 } as unknown as string })).toBeNull()
    })
  })
})
