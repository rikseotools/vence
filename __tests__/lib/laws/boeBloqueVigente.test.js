const { bloqueVigente, comparaConBd, mapaBloquesPorArticulo, articuloDeDocumento } = require('../../../lib/laws/boeBloqueVigente')

// Réplica reducida de la respuesta REAL del art. 2 de la Ley 7/1985: el BOE
// devuelve las versiones 1985 → 2013 → 1990, en ese orden. Quedarse con la
// última daría la redacción de 1990 (derogada). Este es el caso que motiva el
// módulo (campaña T-115, 26/07/2026).
const XML_DESORDENADO = `<?xml version="1.0" encoding="utf-8"?>
<response><status><code>200</code></status><data>
  <bloque id="a2" tipo="precepto" titulo="Art&iacute;culo 2">
    <version id_norma="BOE-A-1985-5392" fecha_publicacion="19850403" fecha_vigencia="19850423">
      <p class="articulo">Art&iacute;culo 2.</p>
      <p class="parrafo">Redacci&oacute;n de 1985.</p>
    </version>
    <version id_norma="BOE-A-2013-13756" fecha_publicacion="20131230" fecha_vigencia="20131231">
      <p class="articulo">Art&iacute;culo 2.</p>
      <p class="parrafo">Redacci&oacute;n VIGENTE de 2013.</p>
      <blockquote>
        <p class="nota_pie">Se modifica por el art. 1.1 de la Ley 27/2013. <a class="refPost">Ref. BOE-A-2013-13756</a>.</p>
      </blockquote>
    </version>
    <version id_norma="BOE-A-1990-624" fecha_publicacion="19900111" fecha_vigencia="19900111">
      <p class="articulo">Art&iacute;culo 2.</p>
      <p class="parrafo">Redacci&oacute;n de 1990.</p>
    </version>
  </bloque>
</data></response>`

describe('bloqueVigente (BOE consolidado)', () => {
  it('elige la versión por fecha_vigencia, NO la última del documento', () => {
    const b = bloqueVigente(XML_DESORDENADO)
    expect(b.vigencia).toBe('20131231')
    expect(b.texto).toBe('Redacción VIGENTE de 2013.')
    expect(b.nVersiones).toBe(3)
  })

  it('poda las notas de modificación (nota_pie) del texto del artículo', () => {
    expect(bloqueVigente(XML_DESORDENADO).texto).not.toMatch(/Se modifica por/)
  })

  it('separa la rúbrica del cuerpo y decodifica las entidades', () => {
    expect(bloqueVigente(XML_DESORDENADO).rubrica).toBe('Artículo 2.')
  })

  // Caso real: art. 72 de la Ley 9/2017. El BOE mete la nota de vigencia como un
  // párrafo MÁS del cuerpo (no en el blockquote), así que sin separarla el texto
  // "oficial" arrastra una cola que no es del artículo y todo diverge.
  it('separa la nota de vigencia del texto del artículo', () => {
    const xml = `<response><data><bloque id="a7-4"><version fecha_vigencia="20210423">
      <p class="articulo">Artículo 72.</p>
      <p class="parrafo">4. La competencia para la declaración corresponder&aacute; al titular del departamento.</p>
      <p class="parrafo">T&eacute;ngase en cuenta que se declara que el apartado 4 no es conforme con el orden constitucional de competencias, por la Sentencia del TC 68/2021, de 18 de marzo.</p>
      <p class="parrafo">5. Cuando sea necesaria una declaraci&oacute;n previa.</p>
    </version></bloque></data></response>`
    const b = bloqueVigente(xml)
    expect(b.texto).not.toMatch(/Téngase en cuenta/)
    expect(b.texto).toMatch(/5\. Cuando sea necesaria/) // lo que va DESPUÉS de la nota se conserva
    expect(b.notaVigencia).toMatch(/TC 68\/2021/)
  })

  it('notaVigencia es null cuando el bloque no trae ninguna', () => {
    expect(bloqueVigente(XML_DESORDENADO).notaVigencia).toBeNull()
  })

  it('devuelve null si el bloque no trae ninguna versión', () => {
    expect(bloqueVigente('<response><data/></response>')).toBeNull()
  })

  it('tolera entradas vacías', () => {
    expect(bloqueVigente('')).toBeNull()
    expect(bloqueVigente(undefined)).toBeNull()
  })
})

// Índice reducido con los ids REALES de la Ley 9/2017: "Artículo 10" NO es el
// bloque `a10` sino `a1-2`, y "Artículo 28" es `a2-10`. Pedir `a<N>` da 404 (o,
// en otra norma, el artículo equivocado con apariencia de éxito).
const XML_INDICE = `<?xml version="1.0" encoding="utf-8"?>
<response><data><texto>
  <bloque><id>a4</id><titulo>Art&iacute;culo 4</titulo></bloque>
  <bloque><id>a1-2</id><titulo>Art&iacute;culo 10</titulo></bloque>
  <bloque><id>a2-10</id><titulo>Art&iacute;culo 28.</titulo></bloque>
  <bloque><id>a28-2</id><titulo>Art&iacute;culo 28 bis</titulo></bloque>
  <bloque><id>ti</id><titulo>T&iacute;TULO I. Disposiciones generales</titulo></bloque>
</texto></data></response>`

describe('mapaBloquesPorArticulo', () => {
  it('resuelve el id de bloque real, que no tiene por qué ser a<N>', () => {
    const m = mapaBloquesPorArticulo(XML_INDICE)
    expect(m['10']).toBe('a1-2')
    expect(m['28']).toBe('a2-10')
    expect(m['4']).toBe('a4')
  })

  it('ignora títulos y capítulos', () => {
    expect(Object.values(mapaBloquesPorArticulo(XML_INDICE))).not.toContain('ti')
  })

  // ANTES este test exigía que los "bis" NO se mapearan. Era comportamiento INCIDENTAL,
  // no intencionado: el regex original (`^Artículo (\d+)$`) sencillamente no los casaba, y
  // el test fijó el efecto secundario como si fuera la regla. Pero `articles.article_number`
  // SÍ guarda "32 bis" (LPRL, LO 3/2018), así que no mapearlos deja esos artículos fuera de
  // toda auditoría contra el BOE. Lo que de verdad importaba —y se conserva— es que el bis
  // NO desplace al artículo simple: van en claves distintas (T-133, 26/07/2026).
  it('mapea los "bis" en su propia clave, sin pisar al artículo simple', () => {
    const m = mapaBloquesPorArticulo(XML_INDICE)
    expect(m['28 bis']).toBe('a28-2')
    expect(m['28']).toBe('a2-10')
  })

  it('devuelve mapa vacío si el índice no trae bloques', () => {
    expect(mapaBloquesPorArticulo('<response><data/></response>')).toEqual({})
  })
})

describe('comparaConBd', () => {
  it('acepta el texto de BD que solo difiere en espaciado', () => {
    const r = comparaConBd(XML_DESORDENADO, '  Redacción VIGENTE   de 2013.  ')
    expect(r.coincide).toBe(true)
    expect(r.vigencia).toBe('20131231')
  })

  it('marca divergencia y señala el carácter donde empieza', () => {
    const r = comparaConBd(XML_DESORDENADO, 'Redacción de 1990.')
    expect(r.coincide).toBe(false)
    expect(r.divergeEn).toBe(10)
  })

  it('no da por bueno el texto de BD si el bloque no existe en el BOE', () => {
    expect(comparaConBd('<response><data/></response>', 'lo que sea').coincide).toBe(false)
  })
})

// ── Concordancias del BOE (26/07/2026) ──────────────────────────────────────
// Párrafos que son SOLO una remisión editorial al precepto constitucional
// relacionado. El BOE los sirve con la misma clase `parrafo` que el texto real,
// así que no se pueden filtrar por clase. Sin este filtro, 3 de los 4 artículos
// de la LOTC verificados daban falso DIVERGE.
describe('bloqueVigente — concordancias constitucionales', () => {
  const conConcordancia = (ref) => `<response><data><bloque id="a75"><version fecha_vigencia="19791025">
    <p class="articulo">Art&iacute;culo setenta y cinco</p>
    <p class="parrafo">Uno. El Tribunal podr&aacute; solicitar de las partes cuantas informaciones estime necesarias.</p>
    <p class="parrafo">${ref}</p>
  </version></bloque></data></response>`

  it('excluye la concordancia del texto del artículo', () => {
    const b = bloqueVigente(conConcordancia('Art&iacute;culo 164 de la Constituci&oacute;n Espa&ntilde;ola.'))
    expect(b.texto).toMatch(/El Tribunal podrá solicitar/)
    expect(b.texto).not.toMatch(/Constitución/)
  })

  it('excluye también las variantes con apartado y sin "Española"', () => {
    expect(bloqueVigente(conConcordancia('Art&iacute;culo 53.2 de la Constituci&oacute;n espa&ntilde;ola.')).texto).not.toMatch(/Constitución/)
    expect(bloqueVigente(conConcordancia('Art&iacute;culo 161 de la Constituci&oacute;n.')).texto).not.toMatch(/Constitución/)
    expect(bloqueVigente(conConcordancia('Art&iacute;culos 159 y 160 de la Constituci&oacute;n Espa&ntilde;ola.')).texto).not.toMatch(/Constitución/)
  })

  it('NO confunde un párrafo real que MENCIONA la Constitución con una concordancia', () => {
    const real = bloqueVigente(conConcordancia('Dos. El recurso protege frente a las violaciones de los derechos del art&iacute;culo 14 de la Constituci&oacute;n Espa&ntilde;ola cuando concurran los requisitos legales.'))
    expect(real.texto).toMatch(/El recurso protege/)
  })
})

// Nota de REDACCIÓN: dice de dónde viene la redacción vigente. También llega con
// clase `parrafo`. Caso real: art. 41 de la LOTC, que trae concordancia Y esta nota.
describe('bloqueVigente — nota de redacción', () => {
  const conNota = (nota) => `<response><data><bloque id="a41"><version fecha_vigencia="20070526">
    <p class="articulo">Art&iacute;culo cuarenta y uno</p>
    <p class="parrafo">Dos. El amparo protege frente a las violaciones de los derechos y libertades.</p>
    <p class="parrafo">${nota}</p>
    <p class="parrafo">Tres. En el amparo no pueden hacerse valer otras pretensiones.</p>
  </version></bloque></data></response>`

  it('excluye la nota de redacción y conserva el apartado siguiente', () => {
    const b = bloqueVigente(conNota('Apartado redactado conforme a la Ley Org&aacute;nica 6/2007, de 24 de mayo (Ref. BOE-A-2007-10483).'))
    expect(b.texto).not.toMatch(/redactado conforme/)
    expect(b.texto).toMatch(/Tres\. En el amparo/)
  })

  it('reconoce las variantes por/según y otros sujetos', () => {
    for (const n of [
      'Art&iacute;culo redactado por la Ley Org&aacute;nica 1/2010.',
      'N&uacute;mero 3 redactado seg&uacute;n la Ley Org&aacute;nica 6/2007.',
      'Letra b) redactada conforme a la disposici&oacute;n final primera.',
    ]) expect(bloqueVigente(conNota(n)).texto).not.toMatch(/redactad/)
  })

  it('NO se lleva texto real que empiece por "Artículo" o "Apartado"', () => {
    const real = bloqueVigente(conNota('Apartado que ser&aacute; de aplicaci&oacute;n a los recursos interpuestos con posterioridad.'))
    expect(real.texto).toMatch(/ser[áa] de aplicaci[óo]n/)
  })
})

// El BOE usa el SINGULAR y el PLURAL para estas notas ("Téngase en cuenta que…" /
// "Ténganse en cuenta los artículos 127 y 159.4 de la Constitución y la Ley
// Orgánica 1/1985…"). Con solo el singular, el art. 3 de la LOTC daba DIVERGE.
it('reconoce la nota en plural: "Ténganse en cuenta…"', () => {
  const xml = `<response><data><bloque id="a3"><version fecha_vigencia="19791025">
    <p class="articulo">Art&iacute;culo tercero</p>
    <p class="parrafo">La condici&oacute;n de Magistrado del Tribunal Constitucional es incompatible.</p>
    <p class="parrafo">T&eacute;nganse en cuenta los art&iacute;culos 127 y 159.4 de la Constituci&oacute;n y la Ley Org&aacute;nica 1/1985.</p>
  </version></bloque></data></response>`
  const b = bloqueVigente(xml)
  expect(b.texto).not.toMatch(/Ténganse/)
  expect(b.notaVigencia).toMatch(/159\.4/)
})

// --- TABLAS: el BOE usa DOS codificaciones y las mezcla en la misma norma (26/07/2026) ---
//
// Caso real: art. 40 bis del Decreto-Legislativo 1/2009 de Canarias (Tasa fiscal sobre el
// juego). Sus redacciones 2012-2019 envuelven el contenido de cada celda en
// `<p class="cuerpo_tabla_izq">`; la VIGENTE (fecha_vigencia 20220101) lo pone
// DIRECTAMENTE en `<td class="cuerpo_tabla_izq">…</td>`, sin `<p>` dentro.
//
// Leyendo solo los `<p>` desaparecía el cuerpo entero de la tabla —la escala de tipos de
// gravamen— y `comparaConBd` daba falso DIVERGE contra un `content` correcto. El riesgo no
// es el ruido: el método de revisión manda comparar con el BOE y corregir NUESTRO texto,
// así que un falso DIVERGE aquí invita a borrar los tipos de gravamen.
const XML_TABLA_TD = `<?xml version="1.0" encoding="utf-8"?>
<response><status><code>200</code></status><data>
  <bloque id="a40bis" tipo="precepto" titulo="Art&iacute;culo 40 bis">
    <version id_norma="BOE-A-2012-9282" fecha_publicacion="20120626" fecha_vigencia="20120701">
      <p class="articulo">Art&iacute;culo 40 bis.</p>
      <p class="parrafo">Escala ANTIGUA, celdas en &lt;p&gt;:</p>
      <table class="tabla"><tbody>
        <tr><th><p class="cabeza_tabla">Suma acumulada</p></th><th><p class="cabeza_tabla">Tipo</p></th></tr>
        <tr><td><p class="cuerpo_tabla_izq">De 0 a 3.500.000,00 euros</p></td><td><p class="cuerpo_tabla_centro">16%</p></td></tr>
      </tbody></table>
    </version>
    <version fpub="20220217" id_norma="BOE-A-2022-2544" fecha_publicacion="20211231" fecha_vigencia="20220101">
      <p class="articulo">Art&iacute;culo 40 bis.</p>
      <p class="parrafo">Escala VIGENTE, celdas en &lt;td&gt;:</p>
      <table class="tabla">
        <thead><tr>
          <th class="cabeza_tabla"><p class="cabeza_tabla">Suma acumulada</p></th>
          <th class="cabeza_tabla"><p class="cabeza_tabla">Tipo de gravamen</p></th>
        </tr></thead>
        <tbody>
          <tr><td class="cuerpo_tabla_izq">De 0 a 3.500.000,00.</td><td class="cuerpo_tabla_coma">25,00</td></tr>
          <tr><td class="cuerpo_tabla_izq">M&aacute;s de 3.500.000,00.</td><td class="cuerpo_tabla_coma">40,00</td></tr>
        </tbody>
      </table>
    </version>
  </bloque>
</data></response>`

describe('bloqueVigente — tablas', () => {
  it('recoge las celdas que van DIRECTAMENTE en <td> (redacción nueva)', () => {
    const r = bloqueVigente(XML_TABLA_TD)
    expect(r.vigencia).toBe('20220101')
    // Los datos de la escala son la respuesta a "¿qué tipo se aplica?": no pueden faltar.
    expect(r.texto).toContain('De 0 a 3.500.000,00.')
    expect(r.texto).toContain('25,00')
    expect(r.texto).toContain('Más de 3.500.000,00.')
    expect(r.texto).toContain('40,00')
  })

  it('NO pierde las cabeceras de tabla, que sí van en <p> dentro del <th>', () => {
    // Regresión concreta: al dejar que el <th> casara como celda, el match consumía el
    // <th> entero y sus <p> internos no se volvían a visitar.
    const r = bloqueVigente(XML_TABLA_TD)
    expect(r.texto).toContain('Suma acumulada')
    expect(r.texto).toContain('Tipo de gravamen')
  })

  it('sigue leyendo las celdas envueltas en <p> (redacción antigua)', () => {
    // Se comprueba sobre la versión antigua, forzándola como única del bloque.
    const soloAntigua = XML_TABLA_TD.replace(/<version fpub[\s\S]*?<\/version>/, '')
    const r = bloqueVigente(soloAntigua)
    expect(r.vigencia).toBe('20120701')
    expect(r.texto).toContain('De 0 a 3.500.000,00 euros')
    expect(r.texto).toContain('16%')
  })

  it('no mete un espacio donde el BOE no lo tiene al vaciar tags inline', () => {
    // "<i>Hecho imponible</i>.–Constituye…" del art. tercero del RDL 16/1977: sustituir
    // el tag por un espacio daba "Hecho imponible .–Constituye" → falso DIVERGE.
    const xml = `<response><data><bloque id="atercero"><version fecha_vigencia="20220101">
      <p class="articulo">Artículo tercero.</p>
      <p class="parrafo">Primero. <i>Hecho imponible</i>.–Constituye el hecho imponible la autorización.</p>
    </version></bloque></data></response>`
    expect(bloqueVigente(xml).texto).toContain('Hecho imponible.–Constituye')
  })
})

// ── Normas EUROPEAS: documento, no consolidado (T-143, 26/07/2026) ───────────
// El RGPD y los Tratados NO están en legislación consolidada (la API da 400) pero
// sí como documento en /buscar/xml.php. Y llegan en DOS formatos distintos, así
// que el parser tiene que soportar los dos o una familia entera queda sin verificar.
describe('articuloDeDocumento (documentos DOUE)', () => {
  // Formato del RGPD: los artículos van marcados con class="articulo", y el título
  // trae espacio duro y espacio em ("Artículo 38. Posición…").
  const RGPD = `<documento><texto>
    <p class="articulo">Art&iacute;culo&#160;37.&#8195;Designaci&oacute;n del delegado.</p>
    <p class="parrafo">Texto del 37.</p>
    <p class="articulo">Art&iacute;culo&#160;38.&#8195;Posici&oacute;n del delegado de protecci&oacute;n de datos.</p>
    <p class="parrafo">1. El responsable garantizar&aacute; que el delegado participe.</p>
    <p class="parrafo_2">2. Le prestar&aacute;n el apoyo necesario.</p>
    <p class="articulo">Art&iacute;culo&#160;39.&#8195;Funciones.</p>
    <p class="parrafo">Texto del 39.</p>
  </texto></documento>`

  // Formato de los Tratados (DOUE-Z-2010-70002): NO usa class="articulo" en
  // absoluto — todo es `parrafo` y el encabezado "Artículo 244" va suelto.
  const TRATADOS = `<documento><texto>
    <p class="parrafo">SECCI&Oacute;N CUARTA</p>
    <p class="parrafo">Art&iacute;culo 244</p>
    <p class="parrafo">Los miembros de la Comisi&oacute;n ser&aacute;n elegidos mediante un sistema de rotaci&oacute;n.</p>
    <p class="parrafo">Art&iacute;culo 245</p>
    <p class="parrafo">Texto del 245.</p>
  </texto></documento>`

  it('extrae el artículo del formato con class="articulo" y para en el siguiente', () => {
    const a = articuloDeDocumento(RGPD, 38)
    expect(a.rubrica).toMatch(/Posición del delegado/)
    expect(a.texto).toMatch(/El responsable garantizará/)
    expect(a.texto).toMatch(/apoyo necesario/)
    expect(a.texto).not.toMatch(/Texto del 39|Texto del 37/)
  })

  it('extrae el artículo del formato SIN class="articulo" (Tratados)', () => {
    const a = articuloDeDocumento(TRATADOS, 244)
    expect(a.texto).toMatch(/sistema de rotación/)
    expect(a.texto).not.toMatch(/Texto del 245/)
  })

  it('no confunde el 4 con el 44 ni el 244', () => {
    expect(articuloDeDocumento(TRATADOS, 4)).toBeNull()
    expect(articuloDeDocumento(TRATADOS, 245).texto).toMatch(/Texto del 245/)
  })

  it('devuelve null si el artículo no está', () => {
    expect(articuloDeDocumento(RGPD, 99)).toBeNull()
    expect(articuloDeDocumento('', 1)).toBeNull()
  })
})
