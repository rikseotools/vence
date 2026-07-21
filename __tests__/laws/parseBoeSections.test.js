const { parseBoeSections, haySolape, numDeLabel } = require('@/lib/laws/parseBoeSections')

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
