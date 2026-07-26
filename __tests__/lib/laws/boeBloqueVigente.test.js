const { bloqueVigente, comparaConBd, mapaBloquesPorArticulo } = require('../../../lib/laws/boeBloqueVigente')

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

  it('ignora títulos/capítulos y los artículos bis', () => {
    const m = mapaBloquesPorArticulo(XML_INDICE)
    expect(Object.values(m)).not.toContain('ti')
    expect(Object.values(m)).not.toContain('a28-2')
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
