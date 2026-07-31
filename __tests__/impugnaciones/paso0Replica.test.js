const fs = require('fs')
const path = require('path')
const { avisoPaso0 } = require('../../scripts/impugnaciones/lib/paso0.cjs')

// ── PASO 0 del dossier: cerrar en silencio vs. contestar ─────────────────────
//
// Las dos situaciones tienen `admin_response` relleno y el estado sin cerrar, y la consecuencia
// es opuesta: en el desync del 504 volver a responder duplica el email; en una réplica NO
// responder deja a la persona esperando una contestación que ya no aparecerá en ninguna lista
// de pendientes. Hasta el 31/07/2026 el dossier trataba las dos igual (T-402).

describe('avisoPaso0 — RÉPLICA (status appealed)', () => {
  const replica = {
    status: 'appealed',
    admin_response: 'Hola Estela,\n\nHemos revisado la pregunta y la clave es correcta.',
    appeal_text: 'Pero el artículo 9.2 dice literalmente otra cosa,\n¿me podéis pasar la fuente del BOE?',
    updated_at: '2026-07-31T08:00:00.000Z',
  }

  it('la clasifica como réplica aunque haya respuesta previa (que es lo normal aquí)', () => {
    expect(avisoPaso0(replica).tipo).toBe('replica')
  })

  it('manda RESPONDER, y no dice en ningún caso que se cierre en silencio', () => {
    const { texto } = avisoPaso0(replica)
    expect(texto).toMatch(/RESPÓNDELE/)
    expect(texto).not.toMatch(/NO re-respondas/)
    expect(texto).not.toMatch(/silent close/)
  })

  it('vuelca el appeal_text ENTERO: hasta ahora había que sacarlo a mano de la BD', () => {
    const { texto } = avisoPaso0(replica)
    expect(texto).toContain('¿me podéis pasar la fuente del BOE?')
    expect(texto).toContain('Pero el artículo 9.2 dice literalmente otra cosa,')
  })

  it('sigue siendo réplica sin appeal_text guardado (los hay antiguos): el estado manda', () => {
    const r = avisoPaso0({ ...replica, appeal_text: null })
    expect(r.tipo).toBe('replica')
    expect(r.texto).toMatch(/RESPÓNDELE/)
  })
})

describe('avisoPaso0 — desync del 504 (status pending con respuesta ya escrita)', () => {
  it('mantiene el aviso de siempre: no re-responder y cerrar el estado', () => {
    const r = avisoPaso0({
      status: 'pending',
      admin_response: 'Hola Cristina, tenías razón: la explicación ya está corregida.',
      updated_at: '2026-07-24T10:30:00.000Z',
    })
    expect(r.tipo).toBe('ya_respondida')
    expect(r.texto).toMatch(/NO re-respondas/)
    expect(r.texto).toMatch(/silent close/)
  })
})

describe('avisoPaso0 — los casos en los que no hay nada que avisar', () => {
  it.each([
    ['pending sin respuesta (el caso normal)', { status: 'pending', admin_response: null }],
    ['pending con respuesta en blanco', { status: 'pending', admin_response: '   ' }],
    ['ya cerrada', { status: 'resolved', admin_response: 'lo que sea' }],
  ])('%s → sin aviso', (_, fila) => {
    expect(avisoPaso0(fila)).toEqual({ tipo: 'ninguno', texto: '' })
  })
})

describe('el dossier CONSUME el módulo, no lleva su propia copia', () => {
  // El defecto de T-402 nació de una condición enterrada en el script, imposible de testear sin
  // conexión a producción. Si vuelve a inline-arse, este test lo caza.
  const SCRIPT = fs.readFileSync(
    path.join(__dirname, '../../scripts/impugnaciones/revisar-impugnacion.cjs'), 'utf8')

  it('importa lib/paso0.cjs', () => {
    expect(SCRIPT).toContain("require('./lib/paso0.cjs')")
  })

  it('no reconstruye el aviso a mano', () => {
    expect(SCRIPT).not.toContain('🛑 PASO 0 — YA RESPONDIDA')
  })
})
