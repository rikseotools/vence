// __tests__/backlog/plazo.test.js
//
// La fecha límite del backlog. Núcleo puro, sin BD y sin reloj propio (el instante se inyecta).
//
// Lo que se está protegiendo: que un plazo no pueda escribirse sin motivo externo, que las
// bandas se calculen por DÍAS y no por horas, y que un título con palabra relativa («hoy es el
// último día») quede marcado — porque envejece solo y acaba mintiendo, que es justo lo que
// pasó con T-330.

const {
  clasificarPlazo, validarPlazo, tareasConPlazo, tituloDependeDeFecha,
} = require('../../lib/backlog/plazo.cjs')

const AHORA = new Date('2026-07-31T00:03:00')

describe('clasificarPlazo — bandas por días naturales', () => {
  test.each([
    ['2026-07-29T23:59:00', 'vencida', -2],
    ['2026-07-30T23:59:00', 'vencida', -1],
    ['2026-07-31T23:59:00', 'hoy', 0],
    ['2026-07-31T00:01:00', 'hoy', 0],
    ['2026-08-01T09:00:00', 'manana', 1],
    ['2026-08-05T12:00:00', 'semana', 5],
    ['2026-08-07T12:00:00', 'semana', 7],
    ['2026-08-20T12:00:00', 'lejos', 20],
  ])('%s → %s (%i días)', (due, banda, dias) => {
    const r = clasificarPlazo(due, AHORA)
    expect(`${r.banda}/${r.dias}`).toBe(`${banda}/${dias}`)
  })

  test('«vence hoy» sigue diciendo lo mismo a las 9:00 que a las 22:00', () => {
    const due = '2026-07-31T23:59:00'
    expect(clasificarPlazo(due, new Date('2026-07-31T09:00:00')).banda).toBe('hoy')
    expect(clasificarPlazo(due, new Date('2026-07-31T22:00:00')).banda).toBe('hoy')
  })

  test('sin plazo o con fecha ilegible → null (no revienta la lista)', () => {
    expect(clasificarPlazo(null, AHORA)).toBeNull()
    expect(clasificarPlazo('', AHORA)).toBeNull()
    expect(clasificarPlazo('el viernes que viene', AHORA)).toBeNull()
  })
})

describe('validarPlazo — sin motivo externo no hay plazo', () => {
  test('rechaza un plazo sin motivo: sería una preferencia disfrazada', () => {
    const r = validarPlazo('2026-08-02', '')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/preferencia/)
  })

  test('rechaza un motivo de relleno («urgente», «para ya»)', () => {
    expect(validarPlazo('2026-08-02', 'urgente').ok).toBe(false)
    expect(validarPlazo('2026-08-02', 'para ya').ok).toBe(false)
  })

  test('acepta el motivo que nombra a quien lo espera', () => {
    const r = validarPlazo('2026-08-02', 'prometido por escrito a María Luisa en el hilo 917b1b29')
    expect(r.ok).toBe(true)
  })

  test('acepta el motivo que nombra la fecha externa que lo fija', () => {
    const r = validarPlazo('2026-07-31T23:59', 'cierre del plazo de solicitudes de la UJA, verificado en su sede')
    expect(r.ok).toBe(true)
  })

  test('rechaza una fecha ilegible antes que nada', () => {
    expect(validarPlazo('el jueves', 'motivo perfectamente válido y largo').ok).toBe(false)
  })
})

describe('tareasConPlazo — qué sube arriba y en qué orden', () => {
  const tareas = [
    { id: 'T-lejos', status: 'open', due_at: '2026-08-20T12:00:00' },
    { id: 'T-vencida', status: 'open', due_at: '2026-07-28T23:59:00' },
    { id: 'T-hoy', status: 'open', due_at: '2026-07-31T23:59:00' },
    { id: 'T-cerrada', status: 'done', due_at: '2026-07-01T23:59:00' },
    { id: 'T-sinplazo', status: 'open', due_at: null },
    { id: 'T-manana', status: 'open', due_at: '2026-08-01T10:00:00' },
  ]

  test('ordena por urgencia: vencida → hoy → mañana → lejos', () => {
    expect(tareasConPlazo(tareas, AHORA).map((t) => t.id))
      .toEqual(['T-vencida', 'T-hoy', 'T-manana', 'T-lejos'])
  })

  test('una tarea CERRADA con el plazo pasado no es un incendio, es historia', () => {
    expect(tareasConPlazo(tareas, AHORA).map((t) => t.id)).not.toContain('T-cerrada')
  })

  test('las que no tienen plazo no aparecen (el bloque perdería sentido)', () => {
    expect(tareasConPlazo(tareas, AHORA).map((t) => t.id)).not.toContain('T-sinplazo')
  })

  test('con dos vencidas, primero la que lleva más tiempo vencida', () => {
    const dos = [
      { id: 'T-ayer', status: 'open', due_at: '2026-07-30T23:59:00' },
      { id: 'T-hace-un-mes', status: 'open', due_at: '2026-06-30T23:59:00' },
    ]
    expect(tareasConPlazo(dos, AHORA).map((t) => t.id)).toEqual(['T-hace-un-mes', 'T-ayer'])
  })

  test('lista vacía o nula no revienta', () => {
    expect(tareasConPlazo([], AHORA)).toEqual([])
    expect(tareasConPlazo(null, AHORA)).toEqual([])
  })
})

describe('tituloDependeDeFecha — palabras que envejecen solas', () => {
  test('caza el caso real de T-330', () => {
    expect(tituloDependeDeFecha('Newsletter: hoy es el ÚLTIMO día de plazo de Conserjería de la UJA')).toBe(true)
  })

  test.each([
    'Mandar el aviso mañana',
    'Revisar esta semana los epígrafes',
    'Quedan 3 días para el cierre',
    'Publicarlo antes del 5',
  ])('caza «%s»', (t) => expect(tituloDependeDeFecha(t)).toBe(true))

  test.each([
    'Newsletter del último día de plazo de Conserjería de la UJA',
    'El detector de frontera de scope solo entiende TÍTULOS',
  ])('NO marca «%s»', (t) => expect(tituloDependeDeFecha(t)).toBe(false))

  // «hoy» en castellano vale para dos cosas y solo una es un plazo. Estos dos son títulos
  // REALES del backlog que la primera versión del detector marcaba mal: ahí «hoy» significa
  // «actualmente», y el título no caduca por eso.
  test.each([
    'SMS Tema 21: generar preguntas del RD 203/2021 arts 50 y 52 (hoy sirven CERO)',
    'Las 191 normas autonómicas y de la UE que no tiene delimitadas nadie (ni puede, hoy)',
    'La cobertura que hoy no mide nadie',
  ])('NO marca el «hoy» descriptivo de «%s»', (t) => expect(tituloDependeDeFecha(t)).toBe(false))

  test('sí marca el «hoy» que SÍ es un plazo', () => {
    expect(tituloDependeDeFecha('Newsletter: hoy es el último día')).toBe(true)
    expect(tituloDependeDeFecha('Hay que enviarlo para hoy')).toBe(true)
  })

  test('«último día» que AFIRMA envejece; el que DESCRIBE la campaña, no', () => {
    expect(tituloDependeDeFecha('Último día para enviar la newsletter')).toBe(true)
    expect(tituloDependeDeFecha('Newsletter del último día de plazo de Conserjería de la UJA')).toBe(false)
  })

  test('«mañana» sustantivo (la mañana del 31) no es un plazo; «mañana» adverbio sí', () => {
    expect(tituloDependeDeFecha('Programada para la mañana del 31')).toBe(false)
    expect(tituloDependeDeFecha('Mandar el aviso mañana')).toBe(true)
  })
})
