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
const { analizarHilos, mismoAsunto, normalizar } = require('../../scripts/lib/hilos-abiertos.cjs')

const CHEMA = [
  {
    id: 'e5151a19-0000-0000-0000-000000000000',
    type: 'suggestion',
    message: '[SOLICITUD OPOSICIÓN] Busco la oposición para parque movil del estado',
    created_at: '2026-07-28T14:52:00Z',
    adminMsgs: 3,
  },
  {
    id: '5f053647-0000-0000-0000-000000000000',
    type: 'bug',
    message:
      'no está el temario completo para policia municipal de madrid, muchos temas pone que se estan actualizando, cuanto tardará?',
    created_at: '2026-07-29T09:46:00Z',
    adminMsgs: 0,
  },
  {
    id: '43b7b6a5-0000-0000-0000-000000000000',
    type: 'bug',
    message:
      'no está el temario completo para policia municipal de madrid, muchos temas pone que se estan actualizando, cuanto tardará?',
    created_at: '2026-07-29T09:49:00Z',
    adminMsgs: 0,
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

  it('«sin responder» se mide por mensajes nuestros, no por status', () => {
    // Un feedback `pending` puede estar respondido y sin cerrar; lo dice el propio manual.
    const r = analizarHilos(
      [
        { id: 'aaaaaaaa', message: 'uno', status: 'pending', adminMsgs: 2, created_at: '2026-07-01' },
        { id: 'bbbbbbbb', message: 'dos', status: 'resolved', adminMsgs: 0, created_at: '2026-07-02' },
      ],
      'aaaaaaaa',
    )
    expect(r.sinResponder.map((f: { id: string }) => f.id)).toEqual(['bbbbbbbb'])
  })

  it('una sola conversación abierta no genera ruido', () => {
    const r = analizarHilos([{ id: 'aaaaaaaa', message: 'hola', adminMsgs: 0 }], 'aaaaaaaa')
    expect(r.aviso).toBeNull()
  })

  it('dos dudas del mismo tema NO son duplicado (cerrar una dejaría una pregunta sin responder)', () => {
    const r = analizarHilos(
      [
        { id: 'aaaaaaaa', message: 'falta el tema 5 de policia municipal', adminMsgs: 0, created_at: '2026-07-01' },
        { id: 'bbbbbbbb', message: 'falta el tema 9 de policia municipal', adminMsgs: 0, created_at: '2026-07-02' },
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
