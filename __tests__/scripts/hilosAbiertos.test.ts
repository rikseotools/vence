// Cada hilo de feedback se responde en SU hilo. Este es el detector que lo recuerda.
//
// ## Por qué (30/07/2026, caso Chema)
//
// Chema abrió tres feedbacks: uno pidiendo el Parque Móvil del Estado y DOS IDÉNTICOS, con
// tres minutos de diferencia, sobre los temas incompletos de Policía Municipal de Madrid.
// Como en el hilo del Parque Móvil mencionó de pasada la Policía Municipal, el borrador
// contestaba las dos cosas allí y dejaba los otros dos hilos sin tocar, esperando desde el
// día anterior. Para quien escribe, eso es recibir la respuesta donde no preguntó.
//
// El dossier ya volcaba el historial, pero en una línea plana, sin ids y sin decir cuáles
// seguían sin respuesta: estaba delante y no se vio. Por eso ahora lo decide un núcleo puro.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { analizarHilos, esperaRespuesta, mismoAsunto, normalizar } = require('../../scripts/lib/hilos-abiertos.cjs')

const CHEMA = [
  {
    id: 'e5151a19-0000-0000-0000-000000000000',
    type: 'suggestion',
    message: '[SOLICITUD OPOSICIÓN] Busco la oposición para parque movil del estado',
    created_at: '2026-07-28T14:52:00Z',
    convStatus: 'closed', // contestado y cerrado
  },
  {
    id: '5f053647-0000-0000-0000-000000000000',
    type: 'bug',
    message:
      'no está el temario completo para policia municipal de madrid, muchos temas pone que se estan actualizando, cuanto tardará?',
    created_at: '2026-07-29T09:46:00Z',
    convStatus: 'waiting_admin',
  },
  {
    id: '43b7b6a5-0000-0000-0000-000000000000',
    type: 'bug',
    message:
      'no está el temario completo para policia municipal de madrid, muchos temas pone que se estan actualizando, cuanto tardará?',
    created_at: '2026-07-29T09:49:00Z',
    convStatus: 'waiting_admin',
  },
]

describe('otros hilos abiertos de la misma persona', () => {
  it('atendiendo el del Parque Móvil, avisa de los DOS de Policía Municipal', () => {
    const r = analizarHilos(CHEMA, 'e5151a19')
    expect(r.sinResponder.map((f: { id: string }) => f.id.slice(0, 8)).sort()).toEqual([
      '43b7b6a5',
      '5f053647',
    ])
    expect(r.aviso).toContain('sin responder')
  })

  it('marca el duplicado y dice a cuál responder (el primero) y cuál cerrar', () => {
    const r = analizarHilos(CHEMA, 'e5151a19')
    expect(r.duplicados).toHaveLength(1)
    const [grupo] = r.duplicados
    expect(grupo[0].id.slice(0, 8)).toBe('5f053647') // el de las 09:46, tres minutos antes
    expect(grupo[1].id.slice(0, 8)).toBe('43b7b6a5')
    expect(r.aviso).toContain('cerrar')
  })

  it('el hilo que se está atendiendo no se lista como "otro"', () => {
    const r = analizarHilos(CHEMA, '5f053647')
    expect(r.otros.map((f: { id: string }) => f.id.slice(0, 8))).not.toContain('5f053647')
  })

  it('«sin responder» = la conversación espera (waiting_admin), no «cuántos mensajes pusimos»', () => {
    // La regla vieja miraba solo si había mensajes nuestros DENTRO del hilo. Aquí el hilo
    // cerrado no tiene ninguno y aun así NO espera: se contestó en otro hilo de la persona.
    const r = analizarHilos(
      [
        { id: 'aaaaaaaa', message: 'uno', status: 'pending', convStatus: 'waiting_admin', created_at: '2026-07-01' },
        { id: 'bbbbbbbb', message: 'dos', status: 'resolved', convStatus: 'closed', created_at: '2026-07-02' },
        { id: 'cccccccc', message: 'tres', status: 'pending', convStatus: 'waiting_admin', created_at: '2026-07-03' },
      ],
      'aaaaaaaa',
    )
    expect(r.sinResponder.map((f: { id: string }) => f.id)).toEqual(['cccccccc'])
  })

  it('una sola conversación abierta no genera ruido', () => {
    const r = analizarHilos([{ id: 'aaaaaaaa', message: 'hola', convStatus: 'waiting_admin' }], 'aaaaaaaa')
    expect(r.aviso).toBeNull()
  })

  it('dos dudas del mismo tema NO son duplicado (cerrar una dejaría una pregunta sin responder)', () => {
    const r = analizarHilos(
      [
        { id: 'aaaaaaaa', message: 'falta el tema 5 de policia municipal', convStatus: 'waiting_admin', created_at: '2026-07-01' },
        { id: 'bbbbbbbb', message: 'falta el tema 9 de policia municipal', convStatus: 'waiting_admin', created_at: '2026-07-02' },
      ],
      'aaaaaaaa',
    )
    expect(r.duplicados).toHaveLength(0)
    expect(r.sinResponder).toHaveLength(1) // el otro, que sigue esperando
  })

  it('el duplicado se detecta pese a mayúsculas, acentos y espacios de más', () => {
    expect(mismoAsunto('No está el TEMARIO  completo', 'no esta el temario completo')).toBe(true)
    expect(normalizar('  ¿Cuánto   tardará? ')).toBe('cuanto tardara')
  })

  it('un mensaje vacío no empareja con otro vacío (no son el mismo asunto)', () => {
    expect(mismoAsunto('', '')).toBe(false)
    expect(mismoAsunto(null, undefined)).toBe(false)
  })
})

// ── Regresión T-512 (03/08/2026, caso Laura García) ──────────────────────────────────
//
// El panel marcaba 5 hilos suyos «sin responder» y los CINCO estaban cerrados: tres
// idénticos de junio (`dismissed`) y dos `resolved`. A los cinco se le contestó en su día,
// pero en OTRO hilo suyo, porque ella hace la misma pregunta en varios a la vez. Medido en
// el banco entero ese día: 94 hilos marcados en falso (29 personas) contra 5 reales.
//
// Importa porque el aviso no es informativo: manda escribir. Y escribirle a alguien sobre
// un hilo cerrado hace mes y medio, de un examen que ya hizo, es peor que no escribir.
const LAURA = [
  { id: 'ffffffff-0000-0000-0000-000000000000', message: 'como canjeo el vale', status: 'pending', convStatus: 'waiting_admin', created_at: '2026-08-03T11:33:00Z' },
  { id: '231e430b-0000-0000-0000-000000000000', message: 'necesito que este activa esa funcion', status: 'dismissed', convStatus: 'closed', created_at: '2026-06-16T07:45:00Z' },
  { id: '0e2ced30-0000-0000-0000-000000000000', message: 'necesito que este activa esa funcion', status: 'dismissed', convStatus: 'closed', created_at: '2026-06-16T07:46:00Z' },
  { id: 'f94c0a1c-0000-0000-0000-000000000000', message: 'necesito que este activa esa funcion', status: 'dismissed', convStatus: 'closed', created_at: '2026-06-16T07:46:30Z' },
  { id: '05bc572e-0000-0000-0000-000000000000', message: 'elijo 25 preguntas y salen 9', status: 'resolved', convStatus: 'closed', created_at: '2026-06-18T11:30:00Z' },
  { id: '867ed45a-0000-0000-0000-000000000000', message: 'teneis universidad de murcia', status: 'resolved', convStatus: 'closed', created_at: '2026-07-04T20:24:00Z' },
]

describe('T-512 — un hilo CERRADO no espera respuesta aunque no tenga mensajes nuestros', () => {
  it('atendiendo el vale, NO manda escribir a los cinco hilos cerrados', () => {
    const r = analizarHilos(LAURA, 'ffffffff')
    expect(r.sinResponder).toHaveLength(0)
    expect(r.aviso).toBeNull()
  })

  it('los tres idénticos y CERRADOS no se anuncian como duplicados por cerrar', () => {
    // Cerrar lo que lleva mes y medio cerrado no es una acción: es ruido que tapa lo real.
    const r = analizarHilos(LAURA, 'ffffffff')
    expect(r.duplicados).toHaveLength(0)
  })

  it('pero si DOS idénticos siguen esperando, sigue diciendo a cuál responder', () => {
    const abiertos = LAURA.map((f) =>
      f.id.startsWith('231e430b') || f.id.startsWith('0e2ced30')
        ? { ...f, status: 'pending', convStatus: 'waiting_admin' }
        : f,
    )
    const r = analizarHilos(abiertos, 'ffffffff')
    expect(r.duplicados).toHaveLength(1)
    expect(r.duplicados[0][0].id.slice(0, 8)).toBe('231e430b') // el primero por fecha
    expect(r.sinResponder.map((f: { id: string }) => f.id.slice(0, 8)).sort()).toEqual(['0e2ced30', '231e430b'])
  })

  it('sin conversación: espera si el feedback sigue vivo, y no si ya se cerró', () => {
    // Sin conversación no se le PUEDE contestar (hallazgo `feedback_sin_conversacion`), así
    // que un feedback vivo así SÍ hay que verlo; uno ya cerrado, no.
    const r = analizarHilos(
      [
        { id: 'aaaaaaaa', message: 'el actual', status: 'pending', convStatus: 'waiting_admin', created_at: '2026-08-01' },
        { id: 'bbbbbbbb', message: 'vivo y sin conversación', status: 'pending', created_at: '2026-08-01' },
        { id: 'cccccccc', message: 'cerrado y sin conversación', status: 'dismissed', created_at: '2026-06-01' },
      ],
      'aaaaaaaa',
    )
    expect(r.sinResponder.map((f: { id: string }) => f.id)).toEqual(['bbbbbbbb'])
  })

  it('la señal es la MISMA que cuenta el panel de admin (waiting_admin), no una propia', () => {
    expect(esperaRespuesta({ convStatus: 'waiting_admin', status: 'resolved' })).toBe(true)
    expect(esperaRespuesta({ convStatus: 'closed', status: 'pending' })).toBe(false)
    expect(esperaRespuesta({ convStatus: 'waiting_user', status: 'pending' })).toBe(false)
  })
})
