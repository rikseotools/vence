/**
 * @jest-environment node
 */
// T-609: «Manuel ya dijo que NO, y el cierre no lo mira».
//
// El texto de `esVeto`/`mencionaDispute` en `#34` es el VERBATIM de la respuesta real de Manuel
// (`session_questions` id 34, 06/08/2026 06:16:35 UTC) — reproduce el incidente contra el dato
// real, no un texto inventado.

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { esVeto, mencionaDispute, respuestasQueVetan } = require('@/lib/impugnaciones/embudoVeto.cjs')

const RESPUESTA_REAL_MANUEL =
  'NO ENVIAR TAL CUAL. Causa raiz encontrada y ARREGLADA esta noche (T-596, cerrada y verificada ' +
  'en produccion): el temario servia los articulos SIN TEXTO cuando articles.title era NULL — en ' +
  'el tema 2 de Dip. Cordoba, 48 de 62 mudos y el tramo 109-117 entero en blanco. Manolo impugno ' +
  'estos articulos del Titulo V porque su temario se los ensenaba VACIOS: acierta en lo que ve y ' +
  'se equivoca en la causa.'

const PREGUNTA_REAL =
  'Borrador RECHAZO para 066a3d65 (Manolo, Dip. Córdoba, art.108 CE) — ¿lo apruebo y se envía?'

describe('esVeto — reconoce el texto REAL que causó el incidente', () => {
  it('la respuesta real de Manuel (id 34) se reconoce como veto', () => {
    expect(esVeto(RESPUESTA_REAL_MANUEL)).toBe(true)
  })

  it.each([
    'no enviar tal cual',
    'NO ENVIAR esto todavía',
    'no mandarlo así',
    'no se envía hasta que esté corregido',
    'no se manda, falta verificar',
    'queda VETADO hasta nueva orden',
    'hay que parar el envío',
    'detener el envio de este lote',
  ])('reconoce el veto en: %s', (texto) => {
    expect(esVeto(texto)).toBe(true)
  })

  it.each([
    'Resuelta y enviada. Verificado contra fuente oficial.',
    'PROCEDE: la cita era del 27.3 y el texto está en el 27.1, verificado contra el BOE.',
    'RECHAZAR. Verificado literal contra BOE.',
    '',
    null,
    undefined,
  ])('NO marca como veto una respuesta normal de cierre: %s', (texto) => {
    expect(esVeto(texto as any)).toBe(false)
  })
})

describe('mencionaDispute — el id vive en la PROSA de `question`, no en `draft_target`', () => {
  // Hallazgo del 06/08: las filas reales del incidente eran kind='pregunta' con draft_target
  // NULL. Si el detector solo mirara draft_target, no habría visto nada.
  it('encuentra el id dentro de `question` cuando `draft_target` es null', () => {
    const fila = { question: PREGUNTA_REAL, context: 'algo más', draft_target: null }
    expect(mencionaDispute(fila, '066a3d65-1111-2222-3333-444455556666')).toBe(true)
  })

  it('encuentra el id completo también', () => {
    const fila = { question: 'sobre la impugnación 066a3d65-1111-2222-3333-444455556666, ¿procede?' }
    expect(mencionaDispute(fila, '066a3d65-1111-2222-3333-444455556666')).toBe(true)
  })

  it('NO casa un id de OTRA impugnación (frontera de palabra)', () => {
    const fila = { question: PREGUNTA_REAL }
    expect(mencionaDispute(fila, 'ea65996b-aaaa-bbbb-cccc-dddddddddddd')).toBe(false)
  })

  it('NO casa un prefijo dentro de un hash más largo no relacionado', () => {
    const fila = { question: 'algo sobre 066a3d65ffffffff-no-es-el-mismo-caso' }
    expect(mencionaDispute(fila, '066a3d65-1111-2222-3333-444455556666')).toBe(false)
  })
})

describe('respuestasQueVetan — el caso completo del incidente', () => {
  const DISPUTE_108 = '066a3d65-1111-2222-3333-444455556666'

  it('reproduce el incidente: la fila #34 real vetaría el cierre de 066a3d65', () => {
    const filas = [
      {
        id: 34,
        kind: 'pregunta',
        question: PREGUNTA_REAL,
        context: 'contexto del borrador…',
        draft_target: null,
        answer: RESPUESTA_REAL_MANUEL,
        answered_at: '2026-08-06T06:16:35.854Z',
      },
    ]
    const r = respuestasQueVetan(filas, DISPUTE_108)
    expect(r).toHaveLength(1)
    expect(r[0].id).toBe(34)
  })

  it('una fila que menciona el id pero SIN responder (answered_at null) no cuenta', () => {
    const filas = [
      { id: 1, question: PREGUNTA_REAL, answer: null, answered_at: null },
    ]
    expect(respuestasQueVetan(filas, DISPUTE_108)).toHaveLength(0)
  })

  it('una fila que menciona el id y está respondida pero NO es un veto no cuenta', () => {
    const filas = [
      { id: 2, question: PREGUNTA_REAL, answer: 'Resuelta y enviada.', answered_at: '2026-08-06T07:00:00Z' },
    ]
    expect(respuestasQueVetan(filas, DISPUTE_108)).toHaveLength(0)
  })

  it('una fila de OTRA impugnación (no menciona el id) no cuenta aunque sea un veto', () => {
    const filas = [
      { id: 3, question: 'Borrador para ea65996b — ¿lo envío?', answer: 'NO ENVIAR', answered_at: '2026-08-06T06:16:00Z' },
    ]
    expect(respuestasQueVetan(filas, DISPUTE_108)).toHaveLength(0)
  })

  it('varias filas vetadas: devuelve la más RECIENTE primero', () => {
    const filas = [
      { id: 10, question: PREGUNTA_REAL, answer: 'no enviar, versión vieja', answered_at: '2026-08-05T10:00:00Z' },
      { id: 11, question: PREGUNTA_REAL, answer: 'no enviar, versión nueva', answered_at: '2026-08-06T06:16:35Z' },
    ]
    const r = respuestasQueVetan(filas, DISPUTE_108)
    expect(r.map((f: any) => f.id)).toEqual([11, 10])
  })

  it('filas nulas/incompletas no rompen el filtro', () => {
    expect(respuestasQueVetan([null, undefined, {}], DISPUTE_108)).toEqual([])
    expect(respuestasQueVetan(null as any, DISPUTE_108)).toEqual([])
  })
})
