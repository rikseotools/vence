const { construirArbol, seccionDeLabel, etiquetaArticulo, articulosDe, resumenArbol } = require('@/lib/laws/arbolLeyBoe')

// Atajo: bloque del índice del BOE.
const b = (id, label) => ({ id, label })

describe('seccionDeLabel — clasifica por LABEL, nunca por id', () => {
  test.each([
    ['LIBRO II', 'libro', 'II'],
    ['LIBRO PRIMERO', 'libro', 'I'],
    ['TÍTULO PRELIMINAR', 'titulo', 'Preliminar'],
    ['TÍTULO PRIMERO', 'titulo', 'I'],
    ['TÍTULO XIV', 'titulo', 'XIV'],
    ['CAPÍTULO II BIS', 'capitulo', 'II bis'],
    ['SECCIÓN I', 'seccion', 'I'],
  ])('«%s» → %s %s', (label, tipo, num) => {
    expect(seccionDeLabel(label)).toEqual({ tipo, num })
  })

  test('no confunde texto normal con una sección', () => {
    expect(seccionDeLabel('Artículo 10')).toBeNull()
    expect(seccionDeLabel('TÍTULO del contrato')).toBeNull()
    expect(seccionDeLabel('')).toBeNull()
  })
})

describe('etiquetaArticulo — conserva bis/ter y la letra final', () => {
  test.each([
    ['Artículo 10', '10'],
    ['Artículo 367 bis', '367 bis'],
    ['Artículo 367 quáter', '367 quater'],
    ['Artículo 588 septies a', '588 septies a'],
    ['Artículo primero', '1'],          // leyes antiguas numeradas en letra (T-140)
  ])('«%s» → «%s»', (label, et) => {
    expect(etiquetaArticulo(label)).toBe(et)
  })
})

describe('construirArbol — casos REALES que costaron caros', () => {
  test('los ids del BOE mienten: el artículo 1 de la LECrim tiene id `co`', () => {
    // Si se clasificara por id (`^a\d`), el artículo 1 se perdería y con él el primer título.
    const arbol = construirArbol([
      b('lprimero', 'LIBRO PRIMERO'), b('tprimero', 'TÍTULO PRIMERO'),
      b('co', 'Artículo 1'), b('a2-2', 'Artículo 2'),
    ])
    expect(articulosDe(arbol[0].titulos[0]).map((a) => a.et)).toEqual(['1', '2'])
  })

  test('los ids del BOE mienten (2): el id `tx-3` es el TÍTULO XIV', () => {
    const arbol = construirArbol([
      b('li', 'LIBRO I'), b('tx-3', 'TÍTULO XIV'), b('a258bis', 'Artículo 258 bis'),
    ])
    expect(arbol[0].titulos[0].num).toBe('XIV')
  })

  test('los títulos REINICIAN por libro y no se mezclan', () => {
    // Es exactamente lo que hace que parseBoeSections rechace estas leyes.
    const arbol = construirArbol([
      b('li', 'LIBRO I'), b('ti', 'TÍTULO I'), b('a1', 'Artículo 1'),
      b('lii', 'LIBRO II'), b('ti-2', 'TÍTULO I'), b('a259', 'Artículo 259'),
    ])
    expect(arbol.map((L) => L.num)).toEqual(['I', 'II'])
    expect(articulosDe(arbol[0].titulos[0]).map((a) => a.et)).toEqual(['1'])
    expect(articulosDe(arbol[1].titulos[0]).map((a) => a.et)).toEqual(['259'])
  })

  test('FUSIONA secciones repetidas (caso Ley 42/2007: el Título II sale dos veces)', () => {
    // Sin fusionar, los artículos de un mismo título quedan repartidos entre nodos y el mapeo
    // epígrafe→artículos sale corto: se recortaría de más.
    const arbol = construirArbol([
      b('tii', 'TÍTULO II'), b('a24', 'Artículo 24'),
      b('tii-2', 'TÍTULO II'), b('a25', 'Artículo 25'), b('a26', 'Artículo 26'),
    ])
    expect(arbol[0].titulos).toHaveLength(1)
    expect(articulosDe(arbol[0].titulos[0]).map((a) => a.et)).toEqual(['24', '25', '26'])
  })

  test('fusiona también los capítulos repetidos dentro de un título', () => {
    const arbol = construirArbol([
      b('tii', 'TÍTULO II'), b('ci', 'CAPÍTULO I'), b('a25', 'Artículo 25'),
      b('ci-2', 'CAPÍTULO I'), b('a26', 'Artículo 26'),
    ])
    expect(arbol[0].titulos[0].caps).toHaveLength(1)
    expect(arbol[0].titulos[0].caps[0].arts.map((a) => a.et)).toEqual(['25', '26'])
  })

  test('ley con capítulos y SIN títulos (RD 806/2014) → título sintético «—»', () => {
    const arbol = construirArbol([
      b('ci', 'CAPÍTULO I'), b('a1', 'Artículo 1'), b('cii', 'CAPÍTULO II'), b('a3', 'Artículo 3'),
    ])
    expect(arbol[0].num).toBe('—')
    expect(arbol[0].titulos[0].num).toBe('—')
    expect(arbol[0].titulos[0].caps.map((c) => c.num)).toEqual(['I', 'II'])
  })

  test('los artículos ANTES del primer libro/título no se cuelgan de nadie', () => {
    // El preámbulo y las notas no deben contaminar el primer título real.
    const arbol = construirArbol([b('preambulo', 'Preámbulo'), b('ti', 'TÍTULO I'), b('a1', 'Artículo 1')])
    expect(articulosDe(arbol[0].titulos[0]).map((a) => a.et)).toEqual(['1'])
  })

  test('una SECCIÓN no cambia el contenedor de los artículos que la siguen', () => {
    const arbol = construirArbol([
      b('ti', 'TÍTULO I'), b('ci', 'CAPÍTULO I'), b('s1', 'SECCIÓN I'), b('a5', 'Artículo 5'),
    ])
    expect(arbol[0].titulos[0].caps[0].arts.map((a) => a.et)).toEqual(['5'])
  })
})

describe('resumenArbol — un árbol vacío NO es "ley sin estructura"', () => {
  test('sin bloques → no utilizable', () => {
    expect(resumenArbol(construirArbol([])).ok).toBe(false)
    expect(resumenArbol(construirArbol([])).motivo).toBe('sin_bloques')
  })

  test('con secciones pero SIN artículos → no utilizable (índice medio descargado o parseo roto)', () => {
    const r = resumenArbol(construirArbol([b('li', 'LIBRO I'), b('ti', 'TÍTULO I')]))
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('ninguna_seccion_con_articulos')
  })

  test('árbol con artículos → utilizable, y cuenta lo que hay', () => {
    const r = resumenArbol(construirArbol([b('li', 'LIBRO I'), b('ti', 'TÍTULO I'), b('a1', 'Artículo 1')]))
    expect(r).toMatchObject({ ok: true, libros: 1, titulos: 1, articulos: 1 })
  })
})
