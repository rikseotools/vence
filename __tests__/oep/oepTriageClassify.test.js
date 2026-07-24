// Guardarraíl de la Capa 1 del triaje de señales OEP. Codifica los casos REALES
// de la revisión del 24/07/2026 (frase-gatillo "revisa señales oeps") para que
// ninguna sesión futura repita el fallo de comparar una señal contra la fila
// EQUIVOCADA y perder un enriquecimiento (caso Inspector PM Valladolid).
const {
  estadoRank,
  discSet,
  entityTokens,
  findBetterHome,
  fieldDelta,
  classifySignal,
  CATEGORIES,
} = require('../../scripts/lib/oep-triage-classify.cjs')

describe('estadoRank — orden del proceso selectivo (manual §3c)', () => {
  it('ordena sin_oep < ... < nombramientos', () => {
    expect(estadoRank('sin_oep')).toBeLessThan(estadoRank('inscripcion_cerrada'))
    expect(estadoRank('inscripcion_cerrada')).toBeLessThan(estadoRank('examen_realizado'))
    expect(estadoRank('examen_realizado')).toBeLessThan(estadoRank('resultados'))
    expect(estadoRank('resultados')).toBeLessThan(estadoRank('nombramientos'))
  })
  it('estado desconocido/nulo → null (no rankeable)', () => {
    expect(estadoRank('inventado')).toBeNull()
    expect(estadoRank(null)).toBeNull()
  })
})

describe('tokens: discriminadores vs entidad', () => {
  it('separa el rango/cuerpo (discriminador) de organismo/lugar (entidad)', () => {
    const n = 'Inspector de la Policía Municipal de Valladolid'
    expect([...discSet(n)]).toEqual(['inspector'])
    expect([...entityTokens(n)].sort()).toEqual(['municipal', 'policia', 'valladolid'])
  })
  it('"cuerpo/gobierno/ayuntamiento" son stopwords, no identifican', () => {
    expect(discSet('Cuerpo de Auxiliar del Ayuntamiento').has('auxiliar')).toBe(true)
    expect([...entityTokens('Cuerpo de Auxiliar del Ayuntamiento')]).toEqual([])
  })
  // Regresión del bug 24/07: el sufijo de género "/a" hacía discSet vacío → mis-link falso.
  it('el sufijo de género "/a" NO rompe el discriminador (Inspector/a → inspector)', () => {
    expect(discSet('Inspector/a de la Policía Municipal').has('inspector')).toBe(true)
    expect(discSet('Subinspector/a de la Policía Municipal').has('subinspector')).toBe(true)
    expect(discSet('Auxiliar Administrativo/a').has('administrativo')).toBe(true)
  })
})

describe('findBetterHome — NO-FP del bug de género 24/07', () => {
  // Estos son los mis-links FALSOS que el smoke test destapó: señales de
  // Inspector/Subinspector correctamente enlazadas que, por el bug "/a",
  // proponían "bombero-valladolid" (misma entidad, cuerpo distinto).
  it('Inspector/a bien enlazado NO propone bombero de la misma ciudad', () => {
    const best = findBetterHome(
      'Inspector/a de la Policía Municipal',
      { slug: 'inspector-policia-municipal-valladolid', nombre: 'Inspector de la Policía Municipal de Valladolid' },
      [{ slug: 'bombero-valladolid', nombre: 'Bombero Ayuntamiento de Valladolid' }],
    )
    expect(best).toBeNull()
  })
  it('Subinspector/a bien enlazado NO propone bombero de la misma ciudad', () => {
    const best = findBetterHome(
      'Subinspector/a de la Policía Municipal',
      { slug: 'subinspector-policia-municipal-valladolid', nombre: 'Subinspector de la Policía Municipal de Valladolid' },
      [{ slug: 'bombero-valladolid', nombre: 'Bombero Ayuntamiento de Valladolid' }],
    )
    expect(best).toBeNull()
  })
})

describe('findBetterHome — detección COMPARATIVA de mis-link (alta precisión)', () => {
  // Caso raíz 24/07: la señal de "Inspector PM Valladolid" (PI) enganchada a la
  // fila libre "Policía Municipal de Valladolid". La fila correcta EXISTE.
  it('#6 Inspector→libre: propone la fila Inspector correcta', () => {
    const best = findBetterHome(
      'Inspector de la Policía Municipal de Valladolid',
      { slug: 'policia-local-valladolid', nombre: 'Policía Municipal de Valladolid' },
      [
        { slug: 'inspector-policia-municipal-valladolid', nombre: 'Inspector de la Policía Municipal de Valladolid' },
        { slug: 'subinspector-policia-municipal-valladolid', nombre: 'Subinspector de la Policía Municipal de Valladolid' },
        { slug: 'bombero-valladolid', nombre: 'Bombero Ayuntamiento de Valladolid' },
      ],
    )
    expect(best && best.slug).toBe('inspector-policia-municipal-valladolid')
  })

  // Positivo real (smoke 24/07): señal "Veterinario" en la fila genérica
  // "Cuerpo Facultativo Superior Admin Especial - La Rioja"; existe la fila
  // "...Veterinario..." de la MISMA entidad que SÍ identifica el cuerpo.
  it('Veterinario→genérica: propone la fila Veterinario de la misma entidad', () => {
    const best = findBetterHome(
      'Cuerpo Facultativo Superior de Administración Especial Veterinario Gobierno de La Rioja',
      { slug: 'generica', nombre: 'Cuerpo Facultativo Superior de Administración Especial Gobierno de La Rioja' },
      [
        { slug: 'veterinario', nombre: 'Cuerpo Facultativo Superior de Administración Especial Veterinario Gobierno de La Rioja' },
        { slug: 'otra-rioja', nombre: 'Cuerpo Facultativo Superior de Administración Especial Economista Gobierno de La Rioja' },
      ],
    )
    expect(best && best.slug).toBe('veterinario')
  })

  // CONSERVADOR (smoke 24/07): un cuerpo específico (Subinspector Sanitario) SIN
  // hermano que lo identifique → NO se fuerza a un genérico/hermano ("empleo").
  // Se deja null → cae en enriquecimiento/catalogar (humano). Antes esto era el FP
  // educador→empleo.
  it('Subinspector Sanitario sin hermano específico → null (no fuerza a "empleo")', () => {
    const best = findBetterHome(
      'Cuerpo Facultativo Grado Medio de Administración Especial Subinspector/a Sanitario/a La Rioja',
      { slug: 'educador', nombre: 'Cuerpo Facultativo de Grado Medio de Administración Especial Educador Gobierno de La Rioja' },
      [
        { slug: 'empleo', nombre: 'Cuerpo Facultativo de Grado Medio de Administración Especial Empleo Gobierno de La Rioja' },
        { slug: 'generico', nombre: 'Cuerpo Facultativo de Grado Medio de Administración Especial Gobierno de La Rioja' },
      ],
    )
    expect(best).toBeNull()
  })

  // El par Auxiliar↔Administrativo NO lo caza esta capa (sin evidencia positiva:
  // ambos comparten "administrativo"); lo cubre el guardarraíl estrecho existente
  // `senal_cuerpo_no_cuadra`. Aquí, conservador → null.
  it('Auxiliar↔Administrativo → null (lo cubre senal_cuerpo_no_cuadra)', () => {
    const best = findBetterHome(
      'Administrativo por Promoción Interna Ayuntamiento de Valladolid',
      { slug: 'aux', nombre: 'Auxiliar Administrativo del Ayuntamiento de Valladolid' },
      [{ slug: 'admin', nombre: 'Administrativo del Ayuntamiento de Valladolid' }],
    )
    expect(best).toBeNull()
  })

  // NO-FP: señal correctamente enlazada (mismos discriminadores) → null.
  it('#5 Subinspector bien enlazado → NO dispara (null)', () => {
    const best = findBetterHome(
      'Subinspector de la Policía Municipal',
      { slug: 'subinspector-policia-municipal-valladolid', nombre: 'Subinspector de la Policía Municipal de Valladolid' },
      [
        { slug: 'inspector-policia-municipal-valladolid', nombre: 'Inspector de la Policía Municipal de Valladolid' },
        { slug: 'policia-local-valladolid', nombre: 'Policía Municipal de Valladolid' },
      ],
    )
    expect(best).toBeNull()
  })

  // NO-FP: discrepa en discriminador pero NO existe mejor hogar → null (conservador).
  it('discrepancia sin candidata mejor → null (no inventa mis-link)', () => {
    const best = findBetterHome(
      'Inspector de la Policía Municipal de Cuenca',
      { slug: 'policia-cuenca', nombre: 'Policía Municipal de Cuenca' },
      [{ slug: 'bombero-cuenca', nombre: 'Bombero de Cuenca' }],
    )
    expect(best).toBeNull()
  })
})

describe('fieldDelta — dirección de estado y campos comparables', () => {
  it('estado más avanzado en señal → forward', () => {
    const d = fieldDelta({ estado: 'pendiente_examen' }, { estado: 'inscripcion_cerrada' })
    expect(d[0]).toMatchObject({ field: 'estado_proceso', direction: 'forward' })
  })
  it('estado anterior en señal → backward', () => {
    const d = fieldDelta({ estado: 'inscripcion_abierta' }, { estado: 'inscripcion_cerrada' })
    expect(d[0]).toMatchObject({ field: 'estado_proceso', direction: 'backward' })
  })
  it('todo igual → delta vacío', () => {
    const d = fieldDelta(
      { estado: 'inscripcion_cerrada', plazas: 2, examDate: null, inscFin: '2026-07-20' },
      { estado: 'inscripcion_cerrada', plazas: 2, examDate: null, inscFin: '2026-07-20' },
    )
    expect(d).toEqual([])
  })
})

describe('classifySignal — clasificación de las 10 señales reales del 24/07', () => {
  it('sin fila → novel', () => {
    expect(classifySignal({ detected: {}, bd: null, betterHome: null }).category).toBe(CATEGORIES.NOVEL)
  })

  it('#6 con betterHome → mismatch (prioridad máxima)', () => {
    const r = classifySignal({
      detected: { estado: 'resultados' },
      bd: { slug: 'policia-local-valladolid', estado: 'nombramientos' },
      betterHome: { slug: 'inspector-policia-municipal-valladolid' },
    })
    expect(r.category).toBe(CATEGORIES.MISMATCH)
  })

  it('#2 La Rioja: inscripcion_abierta vs BD cerrada, sin más → regression', () => {
    const r = classifySignal({
      detected: { estado: 'inscripcion_abierta', plazas: 3, inscFin: '2026-07-15' },
      bd: { slug: 'grado-medio', estado: 'inscripcion_cerrada', plazas: 3, inscFin: '2026-07-15' },
      betterHome: null,
    })
    expect(r.category).toBe(CATEGORIES.REGRESSION)
  })

  it('#8 Bombero Huesca: pendiente_examen vs BD nombramientos → regression', () => {
    const r = classifySignal({
      detected: { estado: 'pendiente_examen', plazas: 24 },
      bd: { slug: 'bombero-dph-huesca', estado: 'nombramientos', plazas: 24 },
      betterHome: null,
    })
    expect(r.category).toBe(CATEGORIES.REGRESSION)
  })

  it('#4 UPV Ayudantes: todo idéntico → duplicate', () => {
    const r = classifySignal({
      detected: { estado: 'inscripcion_cerrada', plazas: 2, inscFin: '2026-07-20' },
      bd: { slug: 'upv', estado: 'inscripcion_cerrada', plazas: 2, inscFin: '2026-07-20' },
      betterHome: null,
    })
    expect(r.category).toBe(CATEGORIES.DUPLICATE)
  })

  it('#7 Enfermero ICS: pendiente_examen vs BD cerrada → enrichment (avanza)', () => {
    const r = classifySignal({
      detected: { estado: 'pendiente_examen', plazas: 1371 },
      bd: { slug: 'enfermero-ics', estado: 'inscripcion_cerrada', plazas: 1371 },
      betterHome: null,
    })
    expect(r.category).toBe(CATEGORIES.ENRICHMENT)
  })

  it('#1 Valencia: mismo estado pero plazas difieren → enrichment (revisión humana)', () => {
    const r = classifySignal({
      detected: { estado: 'inscripcion_cerrada', plazas: 176 },
      bd: { slug: 'aux-valencia', estado: 'inscripcion_cerrada', plazas: 274 },
      betterHome: null,
    })
    expect(r.category).toBe(CATEGORIES.ENRICHMENT)
    expect(r.delta.some((d) => d.field === 'plazas_libres')).toBe(true)
  })

  it('#10 UGR: estado "avanza" pero año señal < año BD → enrichment con aviso de ciclo viejo', () => {
    const r = classifySignal({
      detected: { estado: 'resultados', plazas: 1, year: 2025 },
      bd: { slug: 'ugr', estado: 'inscripcion_abierta', plazas: 4, year: 2026 },
      betterHome: null,
    })
    expect(r.category).toBe(CATEGORIES.ENRICHMENT)
    expect(r.reasons.some((x) => /ciclo/.test(x))).toBe(true)
  })
})
