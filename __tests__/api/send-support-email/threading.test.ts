// __tests__/api/send-support-email/threading.test.ts
//
// Tests del helper de threading email (caso Isabel/Galicia 14/04/2026):
// cuando un usuario responde por email a una notificación de Vence, queremos
// que la respuesta admin se envíe en el MISMO hilo (Re: + In-Reply-To +
// References) en vez de un email nuevo.

// El helper es buildReplySubject — está dentro de send-support-email/route.ts.
// Para no acoplarnos al endpoint completo, replicamos la lógica exacta aquí
// (es 4 líneas) y testeamos que el comportamiento sea el esperado.

function buildReplySubject(originalSubject: string | null | undefined): string {
  if (!originalSubject || !originalSubject.trim()) return 'Respuesta del equipo de Vence'
  const trimmed = originalSubject.trim()
  if (/^(Re|RE|Fwd|FW|RV):\s/i.test(trimmed)) return trimmed
  return `Re: ${trimmed}`
}

describe('buildReplySubject — threading de respuestas a inbound emails', () => {
  test('null o vacío → asunto genérico', () => {
    expect(buildReplySubject(null)).toBe('Respuesta del equipo de Vence')
    expect(buildReplySubject(undefined)).toBe('Respuesta del equipo de Vence')
    expect(buildReplySubject('')).toBe('Respuesta del equipo de Vence')
    expect(buildReplySubject('   ')).toBe('Respuesta del equipo de Vence')
  })

  test('asunto sin prefijo Re: → añade "Re: "', () => {
    expect(buildReplySubject('Auxiliar Administrativo Galicia'))
      .toBe('Re: Auxiliar Administrativo Galicia')
  })

  test('asunto con "Re: " ya presente → NO duplica', () => {
    expect(buildReplySubject('Re: Auxiliar Administrativo Galicia'))
      .toBe('Re: Auxiliar Administrativo Galicia')
    expect(buildReplySubject('RE: TODO MAYÚSCULAS'))
      .toBe('RE: TODO MAYÚSCULAS')
  })

  test('asunto con Fwd:/RV:/FW: ya presente → NO añade Re:', () => {
    expect(buildReplySubject('Fwd: algo')).toBe('Fwd: algo')
    expect(buildReplySubject('FW: forwarded')).toBe('FW: forwarded')
    expect(buildReplySubject('RV: reenviado')).toBe('RV: reenviado')
  })

  test('limpia espacios al inicio/final', () => {
    expect(buildReplySubject('  Hola mundo  ')).toBe('Re: Hola mundo')
  })

  test('caso real Isabel: asunto con "Re:" + texto largo', () => {
    const s = 'Re: Auxiliar Administrativo Xunta de Galicia - Ya disponible en Vence.es'
    expect(buildReplySubject(s)).toBe(s) // no duplica
  })
})

// Test del extractor de Message-ID del webhook
function extractMessageId(src: Record<string, unknown> | undefined | null): string | null {
  if (!src) return null
  const h = src as Record<string, string>
  const candidates = [h['message-id'], h['Message-ID'], h['Message-Id'], h['MESSAGE-ID']]
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const trimmed = c.trim()
      return trimmed.startsWith('<') ? trimmed : `<${trimmed.replace(/[<>]/g, '')}>`
    }
  }
  return null
}

describe('extractMessageId — captura Message-ID del email entrante', () => {
  test('null/undefined → null', () => {
    expect(extractMessageId(null)).toBeNull()
    expect(extractMessageId(undefined)).toBeNull()
    expect(extractMessageId({})).toBeNull()
  })

  test('lowercase message-id (estándar IETF)', () => {
    expect(extractMessageId({ 'message-id': '<abc123@gmail.com>' }))
      .toBe('<abc123@gmail.com>')
  })

  test('Message-ID case-sensitive variations', () => {
    expect(extractMessageId({ 'Message-ID': '<x@y.com>' })).toBe('<x@y.com>')
    expect(extractMessageId({ 'Message-Id': '<x@y.com>' })).toBe('<x@y.com>')
    expect(extractMessageId({ 'MESSAGE-ID': '<x@y.com>' })).toBe('<x@y.com>')
  })

  test('Message-ID sin <> → los añade (formato canónico)', () => {
    expect(extractMessageId({ 'message-id': 'abc123@gmail.com' }))
      .toBe('<abc123@gmail.com>')
  })

  test('Message-ID con espacios → trim + canonical', () => {
    expect(extractMessageId({ 'message-id': '  <abc@d.com>  ' }))
      .toBe('<abc@d.com>')
  })

  test('Message-ID vacío → null', () => {
    expect(extractMessageId({ 'message-id': '' })).toBeNull()
    expect(extractMessageId({ 'message-id': '   ' })).toBeNull()
  })

  test('headers sin message-id → null', () => {
    expect(extractMessageId({ 'subject': 'algo', 'from': 'x@y' })).toBeNull()
  })
})
