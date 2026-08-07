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

  // 30/07/2026 — el umbral relativo es demasiado sensible en leyes con pocas secciones.
  it('con 3 secciones, UNA vacía ya no tumba la ley (caso RD 208/1996)', () => {
    // Su capítulo III (Libro de Quejas y Sugerencias) está derogado entero. Antes se
    // perdían también los capítulos I y II, que están perfectos, y la norma —presente en
    // 12 oposiciones— se servía como lista plana.
    const r = validarSecciones([
      sec('I', 1, 4, 4),
      sec('II', 5, 14, 10),
      sec('III', 15, 24, 0), // derogado por el RD 951/2005
    ])
    expect(r.ok).toBe(true)
    expect(r.secs.map((s) => s.num)).toEqual(['I', 'II'])
    expect(r.vacias.map((s) => s.num)).toEqual(['III'])
  })

  it('dos vacías por encima del umbral siguen rechazando (eso ya no es derogación)', () => {
    const r = validarSecciones([sec('I', 1, 10, 5), sec('II', 11, 20, 0), sec('III', 21, 30, 0)])
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/demasiadas_vacias\(2\/3\)/)
  })

  it('una sola sección viva no se inserta: el filtro por títulos necesita al menos dos', () => {
    const r = validarSecciones([sec('I', 1, 10, 10), sec('II', 11, 20, 0)])
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('menos_de_2_secciones_vivas')
  })

  it('tolerar una vacía NO relaja el solape (lo que de verdad mete basura)', () => {
    const r = validarSecciones([sec('I', 1, 20, 20), sec('II', 15, 30, 16), sec('III', 31, 40, 0)])
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe('solape')
  })
})

describe('rubricaVigente — la rúbrica de un bloque del BOE es la ÚLTIMA, no la primera', () => {
  const { rubricaVigente } = require('@/lib/laws/parseBoeSections')
  // Forma REAL del bloque `tviii-2` de la LECrim (BOE-A-1882-6036), recortado.
  const LECRIM_TVIII = `<?xml version="1.0" encoding="utf-8"?>
<response><data><bloque id="tviii-2" tipo="encabezado" titulo="TÍTULO VIII">
  <version id_norma="BOE-A-1882-6036" fecha_publicacion="19970601" fecha_vigencia="19970601">
    <p class="titulo_num">Título VIII</p>
    <p class="titulo_tit">De la entrada y registro en lugar cerrado, del de libros y papeles y de la detención y apertura de la correspondencia escrita y telegráfica</p>
  </version>
  <version id_norma="BOE-A-2015-13211" fecha_publicacion="20151006" fecha_vigencia="20151206">
    <p class="titulo_num">Título VIII</p>
    <p class="titulo_tit">De las medidas de investigación limitativas de los derechos reconocidos en el artículo 18 de la Constitución</p>
  </version>
</bloque></data></response>`

  test('devuelve la rúbrica VIGENTE, no la derogada de 1997', () => {
    const r = rubricaVigente(LECRIM_TVIII, '20260726')
    expect(r.rubrica).toBe('De las medidas de investigación limitativas de los derechos reconocidos en el artículo 18 de la Constitución')
    expect(r.fechaVigencia).toBe('20151206')
  })

  test('respeta la fecha de corte: antes de la reforma, la rúbrica es la antigua', () => {
    // Sin esto no se puede auditar por qué se adjudicó algo con los datos de entonces.
    expect(rubricaVigente(LECRIM_TVIII, '20100101').rubrica).toMatch(/^De la entrada y registro/)
  })

  test('ignora versiones con vigencia FUTURA (reforma publicada y aún no en vigor)', () => {
    const futuro = LECRIM_TVIII.replace('20151206', '20991231')
    expect(rubricaVigente(futuro, '20260726').rubrica).toMatch(/^De la entrada y registro/)
  })

  test('si la versión vigente no trae rúbrica, cae a la más reciente que sí la tenga', () => {
    const xml = `<response><data><bloque><version fecha_vigencia="19970601"><p class="capitulo_tit">De la detención</p></version>` +
      `<version fecha_vigencia="20200101"><p class="parrafo">Solo se modifica el cuerpo.</p></version></bloque></data></response>`
    expect(rubricaVigente(xml, '20260726').rubrica).toBe('De la detención')
  })

  test('NO se engancha a una cita cruzada dentro del texto de un artículo', () => {
    // El extractor viejo hacía match sobre el cuerpo APLANADO con /TÍTULO [IVX]+\.?\s+(...)/,
    // así que un "conforme al TÍTULO III. De lo que sea" dentro de un artículo lo envenenaba.
    const xml = `<response><data><bloque><version fecha_vigencia="20200101">` +
      `<p class="parrafo">Se aplicará lo dispuesto en el TÍTULO III. De la Policía judicial y demás normas.</p>` +
      `<p class="capitulo_tit">Del registro de libros y papeles</p></version></bloque></data></response>`
    expect(rubricaVigente(xml, '20260726').rubrica).toBe('Del registro de libros y papeles')
  })

  test('sin rúbrica alguna → null (nunca una cadena vacía que parezca rúbrica válida)', () => {
    expect(rubricaVigente('<response><data><bloque/></data></response>', '20260726')).toBeNull()
    expect(rubricaVigente('', '20260726')).toBeNull()
    expect(rubricaVigente(null, '20260726')).toBeNull()
  })

  test('XML sin <version> (atípico) → parsea el bloque entero', () => {
    expect(rubricaVigente('<bloque><p class="titulo_tit">De la denuncia</p></bloque>', '20260726').rubrica).toBe('De la denuncia')
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────
// T-510 — parseBoeSectionsMultinivel: la ley puede tener TÍTULOS Y CAPÍTULOS a la vez
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('parseBoeSectionsMultinivel (T-510)', () => {
  const { parseBoeSectionsMultinivel, parseBoeSections, haySolape, validarSecciones } = require('../../lib/laws/parseBoeSections')

  // Índice al estilo del BOE: dos títulos, y dentro del segundo dos capítulos.
  const INDICE = [
    { id: 'ti', label: 'TÍTULO I. De los interesados' },
    { id: 'a1', label: 'Artículo 1' },
    { id: 'a2', label: 'Artículo 2' },
    { id: 'tii', label: 'TÍTULO II. De la actividad' },
    { id: 'ci', label: 'CAPÍTULO I. Normas generales' },
    { id: 'a3', label: 'Artículo 3' },
    { id: 'a4', label: 'Artículo 4' },
    { id: 'cii', label: 'CAPÍTULO II. Términos y plazos' },
    { id: 'a5', label: 'Artículo 5' },
    { id: 'a6', label: 'Artículo 6' },
  ]

  it('devuelve LOS DOS niveles, de fuera hacia dentro', () => {
    const { niveles } = parseBoeSectionsMultinivel(INDICE)
    expect(niveles.map(n => n.tipo)).toEqual(['titulo', 'capitulo'])
    expect(niveles[0].secciones).toEqual([
      { num: 'I', blockId: 'ti', from: 1, to: 2 },
      { num: 'II', blockId: 'tii', from: 3, to: 6 },
    ])
    expect(niveles[1].secciones).toEqual([
      { num: 'I', blockId: 'ci', from: 3, to: 4 },
      { num: 'II', blockId: 'cii', from: 5, to: 6 },
    ])
  })

  it('el defecto que motiva la tarea: antes SOLO salía el nivel externo', () => {
    // `parseBoeSections` sigue haciendo eso a propósito (back-compat), y por eso los capítulos
    // no llegaban nunca a la BD: 234 leyes con títulos y CERO capítulos.
    const viejo = parseBoeSections(INDICE)
    expect(viejo.tipo).toBe('titulo')
    expect(viejo.secciones).toHaveLength(2)
    // …mientras que la ley SÍ tiene capítulos que se estaban perdiendo:
    expect(parseBoeSectionsMultinivel(INDICE).niveles[1].secciones).toHaveLength(2)
  })

  it('LA TRAMPA: los rangos de capítulo SOLAPAN con los de título, y es correcto', () => {
    const { niveles } = parseBoeSectionsMultinivel(INDICE)
    const todosJuntos = [...niveles[0].secciones, ...niveles[1].secciones]
    // Mezclar niveles haría saltar el guardarraíl de solape en TODAS las leyes…
    expect(haySolape(todosJuntos)).toBe(true)
    // …y por separado cada nivel está limpio, que es como hay que validarlo e insertarlo.
    expect(haySolape(niveles[0].secciones)).toBe(false)
    expect(haySolape(niveles[1].secciones)).toBe(false)
  })

  it('cada nivel pasa `validarSecciones` por su cuenta', () => {
    const { niveles } = parseBoeSectionsMultinivel(INDICE)
    for (const nivel of niveles) {
      const secs = nivel.secciones.map(s => ({ ...s, arts: s.to - s.from + 1 }))
      expect(validarSecciones(secs).ok).toBe(true)
    }
  })

  it('ley con SOLO capítulos → un único nivel (y `parseBoeSections` no cambia)', () => {
    const soloCaps = [
      { id: 'ci', label: 'CAPÍTULO I. Uno' }, { id: 'a1', label: 'Artículo 1' }, { id: 'a2', label: 'Artículo 2' },
      { id: 'cii', label: 'CAPÍTULO II. Dos' }, { id: 'a3', label: 'Artículo 3' },
    ]
    expect(parseBoeSectionsMultinivel(soloCaps).niveles.map(n => n.tipo)).toEqual(['capitulo'])
    expect(parseBoeSections(soloCaps).tipo).toBe('capitulo')
  })

  it('ley sin estructura → sin niveles (y el viejo sigue devolviendo capitulo vacío)', () => {
    const plana = [{ id: 'a1', label: 'Artículo 1' }, { id: 'a2', label: 'Artículo 2' }]
    expect(parseBoeSectionsMultinivel(plana).niveles).toEqual([])
    expect(parseBoeSections(plana)).toEqual({ tipo: 'capitulo', secciones: [] })
  })

  it('una sección sin artículos no entra en ningún nivel', () => {
    const conVacia = [
      { id: 'ti', label: 'TÍTULO I. Con artículos' }, { id: 'a1', label: 'Artículo 1' },
      { id: 'tii', label: 'TÍTULO II. Derogado entero' },
      { id: 'tiii', label: 'TÍTULO III. Con artículos' }, { id: 'a2', label: 'Artículo 2' },
    ]
    expect(parseBoeSectionsMultinivel(conVacia).niveles[0].secciones.map(s => s.num)).toEqual(['I', 'III'])
  })
})

// ─────────────────────────────────────────────────────────────────────────────────────────────
// T-333 (06/08/2026) — SECCIÓN / SUBSECCIÓN, el nivel que el detector de frontera de scope
// no podía ver. Fixtures REALES, no inventados: verificados contra la API BOE datosabiertos
// el 06/08/2026 (BOE-A-2017-12902 Ley 9/2017 y BOE-A-2015-11724 TRLGSS/RDL 8/2015).
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe('rubricaVigente — clase real de Sección/Subsección ("seccion"/"subseccion", SIN "_tit")', () => {
  const { rubricaVigente } = require('@/lib/laws/parseBoeSections')

  test('Sección: la clase real es "seccion", no "seccion_tit" (BOE-A-2017-12902, bloque s1)', () => {
    const xml = `<response><data><bloque id="s1" tipo="encabezado" titulo="Sección 1">
      <version id_norma="BOE-A-2017-12902" fecha_publicacion="20171109" fecha_vigencia="20180309">
        <p class="seccion">Sección 1.ª Objeto y ámbito de aplicación</p>
      </version></bloque></data></response>`
    expect(rubricaVigente(xml, '20260806').rubrica).toBe('Sección 1.ª Objeto y ámbito de aplicación')
  })

  test('Subsección: la clase real es "subseccion" (BOE-A-2015-11724, bloque ss1)', () => {
    const xml = `<response><data><bloque id="ss1" tipo="encabezado" titulo="Subsección 1">
      <version id_norma="BOE-A-2015-11724" fecha_publicacion="20151031" fecha_vigencia="20160102">
        <p class="subseccion">Subsección 1.ª Disposiciones generales</p>
      </version></bloque></data></response>`
    expect(rubricaVigente(xml, '20260806').rubrica).toBe('Subsección 1.ª Disposiciones generales')
  })

  test('antes del fix esto habría dado null — la clase "seccion_tit" no existe en el XML real', () => {
    // Regresión directa: si alguien reintroduce SOLO "seccion_tit" en el regex, este caso
    // (con la clase real "seccion") vuelve a fallar.
    const xml = '<bloque><p class="seccion">Sección 2.ª Negocios y contratos excluidos</p></bloque>'
    expect(rubricaVigente(xml, '20260806').rubrica).toBe('Sección 2.ª Negocios y contratos excluidos')
  })
})

describe('numSeccSubseccDeLabel', () => {
  const { numSeccSubseccDeLabel } = require('@/lib/laws/parseBoeSections')

  test('distingue Sección de Subsección por el LABEL (el id no siempre lo dice)', () => {
    expect(numSeccSubseccDeLabel('Sección 1')).toEqual({ tipo: 'seccion', num: '1' })
    expect(numSeccSubseccDeLabel('Subsección 4')).toEqual({ tipo: 'subseccion', num: '4' })
  })

  test('numeración ARÁBIGA, no romana (a diferencia de título/capítulo)', () => {
    expect(numSeccSubseccDeLabel('Sección 12')).toEqual({ tipo: 'seccion', num: '12' })
  })

  test('no casa con Título/Capítulo ni con texto libre', () => {
    expect(numSeccSubseccDeLabel('TÍTULO I')).toBeNull()
    expect(numSeccSubseccDeLabel('CAPÍTULO II')).toBeNull()
    expect(numSeccSubseccDeLabel('Artículo 5')).toBeNull()
    expect(numSeccSubseccDeLabel('')).toBeNull()
  })
})

describe('parseSeccionesSubsecciones — Ley 9/2017 Título Preliminar (fixture REAL, T22)', () => {
  const { parseSeccionesSubsecciones } = require('@/lib/laws/parseBoeSections')

  // Índice REAL de BOE-A-2017-12902 (verificado 06/08/2026): Título Preliminar › Capítulo I
  // (Sección 1 = arts.1-3, Sección 2 = arts.4-11) › Capítulo II (Sección 1 = 12-18, Sección 2 =
  // 19-23, Sección 3 = 24-27). Nótese que Sección y Subsección de este índice AMBAS usan el
  // prefijo de id "s" (a diferencia del TRLGSS) — la prueba de que esto funciona por LABEL.
  const BLOQUES_T22 = [
    { id: 'tp', label: 'TÍTULO PRELIMINAR' },
    { id: 'ci', label: 'CAPÍTULO I' },
    { id: 's1', label: 'Sección 1' },
    { id: 'a1', label: 'Artículo 1' }, { id: 'a2', label: 'Artículo 2' }, { id: 'a3', label: 'Artículo 3' },
    { id: 's2', label: 'Sección 2' },
    { id: 'a4', label: 'Artículo 4' }, { id: 'a5', label: 'Artículo 5' }, { id: 'a6', label: 'Artículo 6' },
    { id: 'a7', label: 'Artículo 7' }, { id: 'a8', label: 'Artículo 8' }, { id: 'a9', label: 'Artículo 9' },
    { id: 'a1-2', label: 'Artículo 10' }, { id: 'a1-3', label: 'Artículo 11' },
    { id: 'ci-2', label: 'CAPÍTULO II' },
    { id: 's1-2', label: 'Sección 1' },
    { id: 'a1-4', label: 'Artículo 12' }, { id: 'a1-5', label: 'Artículo 13' }, { id: 'a1-6', label: 'Artículo 14' },
    { id: 'a1-7', label: 'Artículo 15' }, { id: 'a1-8', label: 'Artículo 16' }, { id: 'a1-9', label: 'Artículo 17' },
    { id: 'a1-10', label: 'Artículo 18' },
    { id: 's2-2', label: 'Sección 2' },
    { id: 'a1-11', label: 'Artículo 19' }, { id: 'a2-2', label: 'Artículo 20' }, { id: 'a2-3', label: 'Artículo 21' },
    { id: 'a2-4', label: 'Artículo 22' }, { id: 'a2-5', label: 'Artículo 23' },
    { id: 's3', label: 'Sección 3' },
    { id: 'a2-6', label: 'Artículo 24' }, { id: 'a2-7', label: 'Artículo 25' }, { id: 'a2-8', label: 'Artículo 26' },
    { id: 'a2-9', label: 'Artículo 27' },
  ]

  test('extrae las 5 secciones con su rango exacto', () => {
    const { niveles } = parseSeccionesSubsecciones(BLOQUES_T22)
    expect(niveles.map((n) => n.tipo)).toEqual(['seccion']) // sin subsecciones en este tramo
    expect(niveles[0].secciones).toEqual([
      { num: '1', blockId: 's1', from: 1, to: 3 },
      { num: '2', blockId: 's2', from: 4, to: 11 },
      { num: '1', blockId: 's1-2', from: 12, to: 18 },
      { num: '2', blockId: 's2-2', from: 19, to: 23 },
      { num: '3', blockId: 's3', from: 24, to: 27 },
    ])
  })
})

describe('parseSeccionesSubsecciones — TRLGSS (RDL 8/2015), Sección→Subsección anidada + prefijo "ss" (T15/T16)', () => {
  const { parseSeccionesSubsecciones } = require('@/lib/laws/parseBoeSections')

  // Índice REAL de BOE-A-2015-11724 (verificado 06/08/2026): Capítulo I SIN secciones (arts.
  // 1-6) › Capítulo II (Sección 1 = 7-11, Sección 2 = 12-14) › Capítulo III (Sección 1 = 15-17,
  // Sección 2 = 18-20 con el 19 bis, Sección 3 → Subsección 1 = 21-27, Subsección 2 = 28-36,
  // Subsección 3 = 37-41…). Aquí Subsección usa el prefijo de id "ss", DISTINTO de Sección ("s").
  const BLOQUES_TRLGSS = [
    { id: 'ti', label: 'TÍTULO I' },
    { id: 'ci', label: 'CAPÍTULO I' },
    { id: 'a1', label: 'Artículo 1' }, { id: 'a2', label: 'Artículo 2' }, { id: 'a3', label: 'Artículo 3' },
    { id: 'a4', label: 'Artículo 4' }, { id: 'a5', label: 'Artículo 5' }, { id: 'a6', label: 'Artículo 6' },
    { id: 'cii', label: 'CAPÍTULO II' },
    { id: 's1', label: 'Sección 1' },
    { id: 'a7', label: 'Artículo 7' }, { id: 'a8', label: 'Artículo 8' }, { id: 'a9', label: 'Artículo 9' },
    { id: 'a10', label: 'Artículo 10' }, { id: 'a11', label: 'Artículo 11' },
    { id: 's2', label: 'Sección 2' },
    { id: 'a12', label: 'Artículo 12' }, { id: 'a13', label: 'Artículo 13' }, { id: 'a14', label: 'Artículo 14' },
    { id: 'ciii', label: 'CAPÍTULO III' },
    { id: 's1-2', label: 'Sección 1' },
    { id: 'a15', label: 'Artículo 15' }, { id: 'a16', label: 'Artículo 16' }, { id: 'a17', label: 'Artículo 17' },
    { id: 's2-2', label: 'Sección 2' },
    { id: 'a18', label: 'Artículo 18' }, { id: 'a19', label: 'Artículo 19' },
    { id: 'a1-4', label: 'Artículo 19 bis' }, { id: 'a20', label: 'Artículo 20' },
    { id: 's3', label: 'Sección 3' },
    { id: 'ss1', label: 'Subsección 1' },
    { id: 'a21', label: 'Artículo 21' }, { id: 'a22', label: 'Artículo 22' }, { id: 'a23', label: 'Artículo 23' },
    { id: 'a24', label: 'Artículo 24' }, { id: 'a25', label: 'Artículo 25' }, { id: 'a26', label: 'Artículo 26' },
    { id: 'a27', label: 'Artículo 27' },
    { id: 'ss2', label: 'Subsección 2' },
    { id: 'a28', label: 'Artículo 28' }, { id: 'a29', label: 'Artículo 29' }, { id: 'a30', label: 'Artículo 30' },
  ]

  test('Capítulo I (sin secciones) no aporta ninguna sección — arts.1-6 quedan sin cubrir a este nivel', () => {
    const { niveles } = parseSeccionesSubsecciones(BLOQUES_TRLGSS)
    const seccion = niveles.find((n) => n.tipo === 'seccion')
    // La primera sección empieza en el art.7 (Cap.II): el art.1 del Cap.I NUNCA aparece en
    // ningún rango de este nivel — es la prueba de que no se coló en una sección ajena.
    expect(seccion.secciones[0]).toEqual({ num: '1', blockId: 's1', from: 7, to: 11 })
    expect(seccion.secciones.some((s) => s.from <= 1 && 1 <= s.to)).toBe(false)
  })

  test('Sección 3 del Cap.III queda VACÍA (todo su contenido está en subsecciones) y no aparece', () => {
    const { niveles } = parseSeccionesSubsecciones(BLOQUES_TRLGSS)
    const seccion = niveles.find((n) => n.tipo === 'seccion')
    // 4 secciones con artículos propios (7-11, 12-14, 15-17, 18-20); la "Sección 3" (s3) no
    // tiene ninguno directo (todos están bajo sus subsecciones) → se filtra, no aparece un
    // quinto rango fantasma con from=to=undefined.
    expect(seccion.secciones).toEqual([
      { num: '1', blockId: 's1', from: 7, to: 11 },
      { num: '2', blockId: 's2', from: 12, to: 14 },
      { num: '1', blockId: 's1-2', from: 15, to: 17 },
      { num: '2', blockId: 's2-2', from: 18, to: 20 },
    ])
  })

  test('Subsección: prefijo de id DISTINTO ("ss"), y los rangos son correctos', () => {
    const { niveles } = parseSeccionesSubsecciones(BLOQUES_TRLGSS)
    const subseccion = niveles.find((n) => n.tipo === 'subseccion')
    expect(subseccion.secciones).toEqual([
      { num: '1', blockId: 'ss1', from: 21, to: 27 },
      { num: '2', blockId: 'ss2', from: 28, to: 30 },
    ])
  })

  test('subsección es el nivel MÁS FINO: aparece antes que sección en el array de niveles', () => {
    const { niveles } = parseSeccionesSubsecciones(BLOQUES_TRLGSS)
    expect(niveles.map((n) => n.tipo)).toEqual(['subseccion', 'seccion'])
  })

  test('ley sin ninguna sección → array vacío (no revienta, no inventa niveles)', () => {
    const plana = [{ id: 'ti', label: 'TÍTULO I' }, { id: 'a1', label: 'Artículo 1' }]
    expect(parseSeccionesSubsecciones(plana).niveles).toEqual([])
  })
})
