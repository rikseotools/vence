/**
 * Calibración del detector `explicacion_estructura_rota` (lib/health/explicacionEstructuraRota.cjs).
 *
 * Los casos POSITIVOS son textos REALES sacados de la BD el 29/07/2026, no inventados: es la única
 * forma de que el detector siga cazando lo que motivó escribirlo. Los NEGATIVOS son las trampas que
 * ya me tumbaron una medición (la cita con `bloque`) o que tumbarían una regla ingenua.
 */
const {
  negritaDesbalanceada,
  camposDeTexto,
  classifyEstructura,
  explicacionesRotas,
  REF_LARGA,
} = require('@/lib/health/explicacionEstructuraRota.cjs')

describe('negritaDesbalanceada', () => {
  it('marca el `**` de cierre sin apertura — el defecto real de la transcripción', () => {
    // Real, pregunta 5969256b: la transcripción partió «**A) Insertar**» y dejó el cierre suelto.
    expect(negritaDesbalanceada('Insertar** — El menú Insertar permite añadir celdas.')).toBe(true)
  })

  it('no marca la negrita bien cerrada', () => {
    expect(negritaDesbalanceada('El **artículo 15.1** enumera los principios.')).toBe(false)
  })

  it('no marca texto sin negrita ninguna', () => {
    expect(negritaDesbalanceada('Una razón corriente, sin marcado.')).toBe(false)
  })

  it('tolera nulo y vacío sin reventar', () => {
    expect(negritaDesbalanceada(null)).toBe(false)
    expect(negritaDesbalanceada(undefined)).toBe(false)
    expect(negritaDesbalanceada('')).toBe(false)
  })

  it('cuenta pares, no asteriscos: `****` cierra', () => {
    expect(negritaDesbalanceada('a ** b ** c ** d **')).toBe(false)
    expect(negritaDesbalanceada('a ** b ** c **')).toBe(true)
  })
})

describe('camposDeTexto', () => {
  it('recorre intro, outro, razones, bloques y la cita — si se deja uno fuera, ahí se esconde el defecto', () => {
    const campos = camposDeTexto({
      intro: 'i', outro: 'o',
      options: { '0': 'r0', '1': 'r1' },
      blocks: [{ intro: 'bi', texto: 'bt' }],
      cita: { ref: 'Art. 1', texto: 'ct', bloque: 'cb' },
    })
    expect(campos).toEqual(expect.arrayContaining(['i', 'o', 'r0', 'r1', 'bi', 'bt', 'ct', 'cb']))
  })

  it('NO incluye `cita.ref`: una referencia no es prosa y no se le exige negrita balanceada', () => {
    expect(camposDeTexto({ cita: { ref: '**Art. 1' } })).not.toContain('**Art. 1')
  })
})

describe('classifyEstructura — negrita', () => {
  it('caza el asterisco huérfano en una razón', () => {
    const v = classifyEstructura({ explanation_data: { options: { '0': 'Fila** — La fila es horizontal.' } } })
    expect(v.roto).toBe(true)
    expect(v.averias).toContain('negrita_impar')
  })

  it('caza el asterisco huérfano dentro de un bloque', () => {
    const v = classifyEstructura({ explanation_data: { blocks: [{ texto: 'algo** roto' }] } })
    expect(v.averias).toContain('negrita_impar')
  })

  it('da sana una estructura correcta', () => {
    const v = classifyEstructura({
      explanation_data: { intro: 'El **art. 49.1** lo dice.', options: { '0': 'Razón limpia.' } },
    })
    expect(v.roto).toBe(false)
    expect(v.averias).toEqual([])
  })
})

describe('classifyEstructura — cita', () => {
  it('marca la cita que declara artículo y no trae texto: el recuadro anuncia y no enseña nada', () => {
    const v = classifyEstructura({ explanation_data: { cita: { ref: 'Art. 35.3 Ley 12/2009' } } })
    expect(v.averias).toContain('cita_sin_texto')
    expect(v.averias).not.toContain('cita_ref_es_el_texto')
  })

  it('distingue cuando la `ref` lleva DENTRO la prosa del artículo', () => {
    // Real, pregunta 6a9e8117: el texto de la ley acabó en el campo de la referencia.
    const ref = 'graves consecuencias que puedan poner en peligro la vida, la libertad o la integridad física de una persona'
    expect(ref.length).toBeGreaterThan(REF_LARGA)
    const v = classifyEstructura({ explanation_data: { cita: { ref } } })
    expect(v.averias).toEqual(expect.arrayContaining(['cita_sin_texto', 'cita_ref_es_el_texto']))
  })

  it('NO marca la cita con `bloque` relleno — es el campo que MANDA en el render', () => {
    // Esta guarda es la que separa 163 hallazgos reales de 1.412 falsos positivos. Si alguien la
    // quita "para simplificar", el detector se vuelve ruido y deja de mirarse.
    const v = classifyEstructura({
      explanation_data: { cita: { ref: 'Ley 12/2009 art. 35', bloque: '**Ley 12/2009 art. 35:** «En los casos…»' } },
    })
    expect(v.roto).toBe(false)
  })

  it('NO marca la cita completa', () => {
    const v = classifyEstructura({ explanation_data: { cita: { ref: 'Art. 766.5 LECrim', texto: 'Si en el auto recurrido…' } } })
    expect(v.roto).toBe(false)
  })

  it('NO marca una referencia larga pero legítima si trae su texto', () => {
    const v = classifyEstructura({
      explanation_data: { cita: { ref: 'Artículo 27.4 del Reglamento de la Asamblea de Madrid', texto: 'La agenda parlamentaria…' } },
    })
    expect(v.roto).toBe(false)
  })
})

describe('classifyEstructura — entradas raras', () => {
  it('la pregunta sin estructura no es un defecto (la mayoría del banco no la tiene aún)', () => {
    expect(classifyEstructura({ explanation_data: null }).roto).toBe(false)
    expect(classifyEstructura({}).roto).toBe(false)
    expect(classifyEstructura().roto).toBe(false)
  })

  it('no revienta con una estructura a medio hacer', () => {
    expect(() => classifyEstructura({ explanation_data: { options: null, blocks: null, cita: 'no es objeto' } })).not.toThrow()
  })
})

describe('explicacionesRotas', () => {
  it('devuelve solo las rotas y las ordena por EXPOSICIÓN — se repara antes lo que más gente ve', () => {
    const out = explicacionesRotas([
      { id: 'a', explanation_data: { options: { '0': 'roto**' } }, servidas: 5 },
      { id: 'b', explanation_data: { options: { '0': 'sana' } }, servidas: 999 },
      { id: 'c', explanation_data: { options: { '0': 'roto**' } }, servidas: 500 },
    ])
    expect(out.map((x: any) => x.id)).toEqual(['c', 'a'])
  })

  it('aguanta lote vacío o nulo', () => {
    expect(explicacionesRotas([])).toEqual([])
    expect(explicacionesRotas(null)).toEqual([])
  })
})
