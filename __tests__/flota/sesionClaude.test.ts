/**
 * @jest-environment node
 */
// LA CONVERSACIÓN SOBREVIVE AL TURNO (T-486, 06/08)
//
// Pregunta de Manuel: «un `claude -p` no tiene prompts ¿por qué usamos eso? ¿no sería mejor con
// prompt, y el supervisor revisa las conversaciones y hace de filtro hacia mí?».
//
// El modo de un solo tiro venía de un hecho REAL y medido (05/08): el TUI ignora
// `CLAUDE_CODE_OAUTH_TOKEN` y se queda en la pantalla de login. Cierto — pero de ahí se concluyó
// de más: se descartó también la CONVERSACIÓN PERSISTENTE, que en modo `-p` funciona.
// Comprobado EJECUTÁNDOLO en w3 el 06/08: turno 1 `--session-id X` «recuerda 4417» → OK; turno 2
// `--resume X`, proceso distinto, «¿qué número?» → 4417. Y el transcript queda en disco, legible.
//
// eslint-disable-next-line @typescript-eslint/no-var-requires
const SES = require('@/lib/flota/sesionClaude.cjs')

describe('un turno nuevo CONTINÚA la conversación anterior', () => {
  it('con sesión previa, resume', () => {
    const r = SES.banderasSesion({ sesionPrevia: 'abc-123', nuevoId: 'nuevo-999' })
    expect(r.flags).toEqual(['--resume', 'abc-123'])
    expect(r.continua).toBe(true)
    expect(r.id).toBe('abc-123')
  })

  it('sin sesión previa, estrena una y la fija (para poder reanudarla luego)', () => {
    const r = SES.banderasSesion({ sesionPrevia: null, nuevoId: 'nuevo-999' })
    expect(r.flags).toEqual(['--session-id', 'nuevo-999'])
    expect(r.continua).toBe(false)
  })

  it('--fresco descarta la anterior a propósito', () => {
    const r = SES.banderasSesion({ sesionPrevia: 'abc-123', fresco: true, nuevoId: 'nuevo-999' })
    expect(r.flags).toEqual(['--session-id', 'nuevo-999'])
    expect(r.continua).toBe(false)
  })

  it('el id de la conversación vive junto al resto del estado del trabajador', () => {
    expect(SES.ficheroSesion('/etc/vence-flota/w3.env')).toBe('/etc/vence-flota/w3.session')
  })
})

describe('el transcript se puede encontrar (es lo que permite leerles la conversación)', () => {
  it('usa la convención real de Claude Code, verificada en w3', () => {
    // Medido: /home/flota/vence-sessions/w3 → -home-flota-vence-sessions-w3
    expect(SES.rutaTranscript({ home: '/home/flota', arbol: '/home/flota/vence-sessions/w3', id: 'uuid-1' }))
      .toBe('/home/flota/.claude/projects/-home-flota-vence-sessions-w3/uuid-1.jsonl')
  })

  it('una barra final sobrante no cambia el proyecto', () => {
    expect(SES.rutaTranscript({ home: '/home/flota', arbol: '/home/flota/vence-sessions/w3/', id: 'x' }))
      .toContain('-home-flota-vence-sessions-w3')
  })
})

describe('se VE si arranca de cero o no', () => {
  it('lo dice, con el peso de la conversación para poder calibrar el reinicio con datos', () => {
    const l = SES.lineaSesion({ continua: true, id: 'd2d1f2ad-17b0', tamanoBytes: 15632 })
    expect(l).toMatch(/sigue su conversación/)
    expect(l).toMatch(/15 KB/)
    expect(l).toMatch(/no arranca de cero/)
  })

  it('y cuando empieza de cero, también', () => {
    expect(SES.lineaSesion({ continua: false, id: 'nuevo-999' })).toMatch(/conversación nueva/)
  })
})
