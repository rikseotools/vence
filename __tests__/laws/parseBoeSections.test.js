const { parseBoeSections, haySolape, numDeLabel, validarSecciones } = require('@/lib/laws/parseBoeSections')

// Cada caso viene de un fallo REAL medido con --sweep sobre leyes del temario (T-012).
describe('parseBoeSections — estructura de leyes del BOE', () => {
  it('ley plana con títulos: agrupa artículos por título con su rango', () => {
    const { tipo, secciones } = parseBoeSections([
      { id: 'ti', label: 'TÍTULO I' },
      { id: 'a1', label: 'Artículo 1' },
      { id: 'a2', label: 'Artículo 2' },
      { id: 'tii', label: 'TÍTULO II' },
      { id: 'a3', label: 'Artículo 3' },
    ])
    expect(tipo).toBe('titulo')
    expect(secciones).toEqual([
      { num: 'I', blockId: 'ti', from: 1, to: 2 },
      { num: 'II', blockId: 'tii', from: 3, to: 3 },
    ])
  })

  it('sin títulos → usa CAPÍTULOS (LPRL, Ley 55/2003)', () => {
    const { tipo, secciones } = parseBoeSections([
      { id: 'ci', label: 'CAPÍTULO I' },
      { id: 'a1', label: 'Artículo 1' },
      { id: 'cii', label: 'CAPÍTULO II' },
      { id: 'a2', label: 'Artículo 2' },
    ])
    expect(tipo).toBe('capitulo')
    expect(secciones.map((s) => s.num)).toEqual(['I', 'II'])
  })

  it('BUG a1-2: el nº sale del LABEL, no del id (BOE desambigua ids repetidos)', () => {
    // En el TR Concursal el artículo 10 tiene id "a1-2", el 11 "a1-3"...
    const { secciones } = parseBoeSections([
      { id: 'ti', label: 'TÍTULO I' },
      { id: 'a9', label: 'Artículo 9' },
      { id: 'a1-2', label: 'Artículo 10' },
      { id: 'a1-3', label: 'Artículo 11' },
    ])
    // el rango debe llegar a 11 (del label), no quedarse en 9 (si mirase el id daría 1..9)
    expect(secciones[0]).toEqual({ num: 'I', blockId: 'ti', from: 9, to: 11 })
  })

  it('ids de sección textuales (tpreliminar, tprimero) y romanos (ti)', () => {
    const { secciones } = parseBoeSections([
      { id: 'tpreliminar', label: 'TÍTULO PRELIMINAR' },
      { id: 'a1', label: 'Artículo 1' },
      { id: 'tprimero', label: 'TÍTULO PRIMERO' },
      { id: 'a2', label: 'Artículo 2' },
    ])
    expect(secciones.map((s) => s.num)).toEqual(['Preliminar', 'I'])
  })

  it('anidamiento título>capítulo: el artículo va al capítulo, y como hay títulos usa TÍTULOS', () => {
    // cuando hay títulos, el nivel es título; los capítulos internos no son sección propia
    // pero SUS artículos cuentan para el rango del título que los contiene
    const { tipo, secciones } = parseBoeSections([
      { id: 'ti', label: 'TÍTULO I' },
      { id: 'ci', label: 'CAPÍTULO I' },
      { id: 'a1', label: 'Artículo 1' },
      { id: 'cii', label: 'CAPÍTULO II' },
      { id: 'a2', label: 'Artículo 2' },
      { id: 'tii', label: 'TÍTULO II' },
      { id: 'a3', label: 'Artículo 3' },
    ])
    expect(tipo).toBe('titulo')
    expect(secciones).toEqual([
      { num: 'I', blockId: 'ti', from: 1, to: 2 },
      { num: 'II', blockId: 'tii', from: 3, to: 3 },
    ])
  })

  it('disposiciones y bloques contenedor no cuentan como artículos', () => {
    const { secciones } = parseBoeSections([
      { id: 'aunico', label: 'Artículo único' },
      { id: 'daprimera', label: 'Disposición adicional primera' },
      { id: 'reglamentopenitenciario', label: 'REGLAMENTO PENITENCIARIO' },
      { id: 'ti', label: 'TÍTULO I' },
      { id: 'a1', label: 'Artículo 1' },
    ])
    // aunico/daprimera van antes del primer título → no rompen; el título I capta el art 1
    expect(secciones).toEqual([{ num: 'I', blockId: 'ti', from: 1, to: 1 }])
  })

  it('ley sin ninguna sección estructural → lista vacía', () => {
    expect(parseBoeSections([{ id: 'a1', label: 'Artículo 1' }]).secciones).toEqual([])
  })

  it('haySolape detecta rangos que se pisan', () => {
    expect(haySolape([{ from: 1, to: 5 }, { from: 4, to: 8 }])).toBe(true)
    expect(haySolape([{ from: 1, to: 5 }, { from: 6, to: 8 }])).toBe(false)
  })

  it('BUG "Art N" abreviado: el BOE usa "Art 2" (no "Artículo 2") en muchas leyes', () => {
    // El Reglamento del Congreso trae <titulo>Art 2</titulo> abreviado → antes solo se
    // capturaba el a1 ("Artículo 1") y el resto se perdía (la ley quedaba con 1 sección).
    const { secciones } = parseBoeSections([
      { id: 'tpreliminar', label: 'TÍTULO PRELIMINAR' },
      { id: 'a1', label: 'Artículo 1' },
      { id: 'art2', label: 'Art 2' },
      { id: 'art3', label: 'Art 3' },
    ])
    expect(secciones[0]).toEqual({ num: 'Preliminar', blockId: 'tpreliminar', from: 1, to: 3 })
  })

  it('numDeLabel: solo dígitos tras "Artículo", null si no aplica', () => {
    expect(numDeLabel('Artículo 10')).toBe(10)
    expect(numDeLabel('Art 10')).toBe(10)
    expect(numDeLabel('Artículo único')).toBeNull()
    expect(numDeLabel('CAPÍTULO I')).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// validarSecciones — T-064 (26/07/2026).
//
// El criterio original rechazaba la ley ENTERA si UNA sección no tenía artículos. La causa
// habitual no es un parser desalineado: son artículos DEROGADOS. El Código Civil se caía
// por `rango_vacio(XI:314-324)` —suprimidos por la Ley 8/2021, reforma de la discapacidad—
// y con esa única sección se perdían las otras 45, dejando la ley más navegada del corpus
// (1.911 artículos) como lista plana en /leyes.
describe('validarSecciones — una sección derogada no debe tumbar la ley', () => {
  const sec = (num, from, to, arts) => ({ num, from, to, arts })

  it('descarta la sección vacía y acepta el resto (caso Código Civil)', () => {
    const r = validarSecciones([
      sec('Preliminar', 1, 16, 16),
      sec('I', 17, 28, 12),
      sec('XI', 314, 324, 0), // derogados por la Ley 8/2021
      sec('XII', 325, 332, 8),
    ])
    expect(r.ok).toBe(true)
    expect(r.secs.map((s) => s.num)).toEqual(['Preliminar', 'I', 'XII'])
    expect(r.vacias.map((s) => s.num)).toEqual(['XI'])
  })

  it('pero SÍ rechaza si demasiadas salen vacías (eso es desalineación, no derogación)', () => {
    const r = validarSecciones([
      sec('I', 1, 10, 5),
      sec('II', 11, 20, 0),
      sec('III', 21, 30, 0),
      sec('IV', 31, 40, 0),
    ])
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/demasiadas_vacias/)
  })

  it('rechaza si NINGUNA sección tiene artículos', () => {
    const r = validarSecciones([sec('I', 1, 10, 0), sec('II', 11, 20, 0)])
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('ninguna_seccion_con_articulos')
  })

  it('sigue rechazando el solape, que es el fallo que de verdad mete basura', () => {
    const r = validarSecciones([sec('I', 1, 20, 20), sec('II', 15, 30, 16)])
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('solape')
  })

  it('el solape se mide solo entre las secciones que se van a insertar', () => {
    // La vacía (X) PISA a las vivas, pero se descarta ANTES de medir solapes, así que no
    // puede provocar un rechazo falso. Se usan 4 secciones a propósito: con 3 el ratio de
    // vacías (1/3) superaría el umbral del 30 % y el test mediría otra cosa.
    const r = validarSecciones([
      sec('I', 1, 20, 20),
      sec('X', 10, 25, 0),
      sec('II', 21, 30, 10),
      sec('III', 31, 40, 10),
    ])
    expect(r.ok).toBe(true)
    expect(r.secs.map((x) => x.num)).toEqual(['I', 'II', 'III'])
  })

  it('sin secciones → sin_secciones', () => {
    expect(validarSecciones([]).motivo).toBe('sin_secciones')
  })
})
