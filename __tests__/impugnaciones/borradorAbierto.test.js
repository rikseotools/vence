// __tests__/impugnaciones/borradorAbierto.test.js — [T-588]
//
// Que repartir/analizar una impugnación avise si ya hay un borrador esperando OK en el embudo.
// Puro: recibe las filas de session_questions ya leídas, no toca la BD.
//
// Nace del 05/08: la impugnación 2477d39d (Outlook, Ctrl+Mayús+K vs Ctrl+T) la analizaron CUATRO
// sesiones distintas en 2h26min porque nada avisaba de que ya había borrador(es) abiertos.

const { borradoresQueCitan, lineasBorradorAbierto } = require('../../lib/impugnaciones/borradorAbierto.cjs')

const FILAS = [
  { id: 21, sid: 'l3-fedora-2b213d', status: 'open', draft_target: 'impugnación 2477d39d-6353-4389-8a0c-0c9a5d5b27c3 (respuesta_incorrecta, atajo Ctrl+Mayús+K)', asked_at: new Date(Date.now() - 3600_000).toISOString() },
  { id: 39, sid: 'l2-fedora-1d5f83', status: 'open', draft_target: 'impugnación 2477d39d (respuesta_incorrecta: atajo Ctrl+Mayús+K vs T)', asked_at: new Date(Date.now() - 1800_000).toISOString() },
  { id: 62, sid: 'w1-vence-flota-w1', status: 'withdrawn', draft_target: 'impugnación 2477d39d (usuario dice que Ctrl+Mayús+K...)', asked_at: new Date().toISOString() },
  { id: 99, sid: 'l1-otro', status: 'open', draft_target: 'impugnación 744f0db0 (otro caso totalmente distinto)', asked_at: new Date().toISOString() },
]

describe('borradoresQueCitan', () => {
  it('encuentra los borradores ABIERTOS que citan el id completo o el corto', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    expect(r.map((x) => x.id).sort()).toEqual([21, 39])
  })

  it('NO cuenta los retirados (withdrawn): ya no son trabajo pendiente', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    expect(r.find((x) => x.id === 62)).toBeUndefined()
  })

  it('no arrastra borradores de otro caso', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    expect(r.find((x) => x.id === 99)).toBeUndefined()
  })

  it('exige frontera: un id corto dentro de otro hash NO cuenta', () => {
    const filas = [{ id: 1, sid: 's', status: 'open', draft_target: 'algo 2477d39daa11bb22 sin relación', asked_at: new Date().toISOString() }]
    expect(borradoresQueCitan(filas, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')).toEqual([])
  })

  it('sin id o filas vacías, no revienta', () => {
    expect(borradoresQueCitan([], '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')).toEqual([])
    expect(borradoresQueCitan(FILAS, '')).toEqual([])
    expect(borradoresQueCitan(null, null)).toEqual([])
  })
})

describe('lineasBorradorAbierto', () => {
  it('sin borradores no imprime nada', () => {
    expect(lineasBorradorAbierto([])).toEqual([])
  })

  it('avisa de cuántos hay y de no rediagnosticar', () => {
    const r = borradoresQueCitan(FILAS, '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    const txt = lineasBorradorAbierto(r).join('\n')
    expect(txt).toMatch(/2 BORRADORES ABIERTOS/)
    expect(txt).toMatch(/#21/)
    expect(txt).toMatch(/#39/)
    expect(txt).toMatch(/T-588/)
  })

  it('con un solo borrador usa singular y no menciona duplicados', () => {
    const r = borradoresQueCitan(FILAS.slice(0, 1), '2477d39d-6353-4389-8a0c-0c9a5d5b27c3')
    const txt = lineasBorradorAbierto(r).join('\n')
    expect(txt).toMatch(/1 BORRADOR ABIERTO EN/)
    expect(txt).not.toMatch(/T-588/)
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════════
// [T-614] La dirección contraria: dada una fila del embudo, ¿el caso que cita sigue vivo?
//
// Nace del 06/08: se le presentó a Manuel el borrador de la réplica de f34b88ad para que lo
// aprobara cuando la impugnación llevaba cerrada desde la tarde anterior, con la MISMA respuesta
// ya enviada. De 16 preguntas abiertas del embudo, 10 apuntaban a casos cerrados y contestados.
// ══════════════════════════════════════════════════════════════════════════════════════════
describe('[T-614] casos citados por una fila del embudo', () => {
  const {
    casosCitadosEn, clavesDeCasos, marcarCasosCerrados, sqlEstadoDeCasos, avisoCasoCerrado, CERRADOS,
  } = require('../../lib/impugnaciones/borradorAbierto.cjs')

  // La fila REAL que provocó el fallo: kind='pregunta', draft_target NULL, id solo en la prosa —
  // que es justo la combinación que `retirarBorrador.cjs` (T-486) no puede ver.
  const FILA_REAL = {
    id: '28',
    draft_target: null,
    question: 'Borrador listo para la réplica f34b88ad (Manolo, aux. admin. Dip. Córdoba) — ¿lo apruebo?',
    context: 'Contexto: réplica (appealed) de una impugnación ya resuelta el 04/08.',
  }

  describe('casosCitadosEn — de dónde se sacan los ids', () => {
    it('los encuentra en la prosa aunque draft_target sea NULL (el caso que costó el fallo)', () => {
      expect(casosCitadosEn(FILA_REAL)).toEqual(['f34b88ad'])
    })

    it('mira los TRES campos, no solo el destinatario estructurado', () => {
      expect(casosCitadosEn({ draft_target: 'impugnación aaaaaaaa' })).toEqual(['aaaaaaaa'])
      expect(casosCitadosEn({ question: 'sobre bbbbbbbb, ¿qué hago?' })).toEqual(['bbbbbbbb'])
      expect(casosCitadosEn({ context: 'medido en cccccccc' })).toEqual(['cccccccc'])
    })

    it('no repite el mismo caso citado varias veces', () => {
      const f = { question: 'f34b88ad y f34b88ad', context: 'otra vez f34b88ad' }
      expect(casosCitadosEn(f)).toEqual(['f34b88ad'])
    })

    it('reconoce el uuid entero por su prefijo, que es como se guarda el estado', () => {
      expect(casosCitadosEn({ question: 'la 2477d39d-6353-4389-8a0c-0c9a5d5b27c3' })).toContain('2477d39d')
    })

    it('no inventa claves donde no hay ninguna', () => {
      expect(casosCitadosEn({ question: '¿subo el límite del cupo diario a 30?' })).toEqual([])
      expect(casosCitadosEn({})).toEqual([])
      expect(casosCitadosEn(null)).toEqual([])
    })

    it('no casa dentro de una cadena hexadecimal más larga (frontera)', () => {
      expect(casosCitadosEn({ question: 'el hash abcdef1234567890abcdef' })).toEqual([])
    })
  })

  describe('clavesDeCasos — lo que hay que ir a preguntarle a la BD', () => {
    it('junta las de todas las filas sin repetir', () => {
      const filas = [FILA_REAL, { question: 'sobre 2477d39d' }, { context: 'y f34b88ad otra vez' }]
      expect(clavesDeCasos(filas).sort()).toEqual(['2477d39d', 'f34b88ad'])
    })

    it('sin filas no manda a consultar nada (no se hace un viaje en balde)', () => {
      expect(clavesDeCasos([])).toEqual([])
    })
  })

  describe('marcarCasosCerrados — solo lo que la BD sostiene', () => {
    it('marca la fila cuyo caso está resuelto', () => {
      const [r] = marcarCasosCerrados([FILA_REAL], [{ clave: 'f34b88ad', status: 'resolved' }])
      expect(r.casosCerrados).toEqual([{ clave: 'f34b88ad', status: 'resolved' }])
    })

    it('NO la marca si el caso sigue abierto — que es el caso normal', () => {
      const [r] = marcarCasosCerrados([FILA_REAL], [{ clave: 'f34b88ad', status: 'pending' }])
      expect(r.casosCerrados).toEqual([])
    })

    it('«appealed» NO es cerrado: hay una réplica esperando respuesta', () => {
      const [r] = marcarCasosCerrados([FILA_REAL], [{ clave: 'f34b88ad', status: 'appealed' }])
      expect(r.casosCerrados).toEqual([])
    })

    it('cuenta rejected igual que resolved: las dos se contestaron', () => {
      const [r] = marcarCasosCerrados([FILA_REAL], [{ clave: 'f34b88ad', status: 'rejected' }])
      expect(r.casosCerrados).toHaveLength(1)
    })

    // FAIL-OPEN: es la propiedad que impide que este aviso haga daño.
    it('sin estados (la BD no contestó) no marca NADA: no se inventa el estado', () => {
      const [r] = marcarCasosCerrados([FILA_REAL], [])
      expect(r.casosCerrados).toEqual([])
    })

    it('conserva la fila entera: anota, no sustituye', () => {
      const [r] = marcarCasosCerrados([FILA_REAL], [{ clave: 'f34b88ad', status: 'resolved' }])
      expect(r.id).toBe('28')
      expect(r.question).toBe(FILA_REAL.question)
    })

    it('una fila que cita DOS casos cerrados los lista los dos', () => {
      const f = { question: 'las dba485dc y 410025b4 del mismo bloqueo' }
      const [r] = marcarCasosCerrados([f], [
        { clave: 'dba485dc', status: 'resolved' },
        { clave: '410025b4', status: 'resolved' },
      ])
      expect(r.casosCerrados.map((c) => c.clave).sort()).toEqual(['410025b4', 'dba485dc'])
    })
  })

  describe('avisoCasoCerrado — anota, no sentencia', () => {
    it('sin casos cerrados no dice nada (null, para que el llamador no compruebe)', () => {
      expect(avisoCasoCerrado([])).toBeNull()
    })

    it('nombra el caso y su estado', () => {
      const t = avisoCasoCerrado([{ clave: 'f34b88ad', status: 'resolved' }])
      expect(t).toContain('f34b88ad')
      expect(t).toContain('resolved')
    })

    // La lección de las tres marcadas que SÍ estaban vivas (#38, #45, #55): citar un caso no es
    // estar trabajando en él, así que el aviso no puede afirmar que la pregunta sobra.
    it('NO afirma que la pregunta ya no haga falta — eso lo decide quien lee', () => {
      const t = avisoCasoCerrado([{ clave: 'f34b88ad', status: 'resolved' }])
      expect(t).toMatch(/comprueba/i)
      expect(t).not.toMatch(/ya no hace falta|no hay nada que enviar|descártala/i)
    })

    it('concuerda en singular y plural', () => {
      expect(avisoCasoCerrado([{ clave: 'aaaaaaaa', status: 'resolved' }])).toMatch(/un caso ya cerrado/)
      expect(avisoCasoCerrado([
        { clave: 'aaaaaaaa', status: 'resolved' }, { clave: 'bbbbbbbb', status: 'rejected' },
      ])).toMatch(/casos ya cerrados/)
    })
  })

  describe('sqlEstadoDeCasos — las tres colas, en un solo sitio', () => {
    it('cubre las MISMAS tres tablas que reparte cola.cjs', () => {
      const sql = sqlEstadoDeCasos()
      expect(sql).toContain('question_disputes')
      expect(sql).toContain('psychometric_question_disputes')
      expect(sql).toContain('user_feedback')
    })

    it('compara por el prefijo de 8, la misma clave que el núcleo', () => {
      expect(sqlEstadoDeCasos()).toContain('left(id::text, 8)')
    })
  })

  describe('CERRADOS — el criterio, para que nadie mantenga una lista paralela', () => {
    it('están los estados con los que un caso deja de esperar respuesta', () => {
      expect(CERRADOS).toEqual(expect.arrayContaining(['resolved', 'rejected']))
    })

    it('NO están los abiertos de cola.cjs (pending/appealed)', () => {
      expect(CERRADOS).not.toContain('pending')
      expect(CERRADOS).not.toContain('appealed')
    })
  })
})
