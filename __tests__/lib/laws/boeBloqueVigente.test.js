const { bloqueVigente, comparaConBd } = require('../../../lib/laws/boeBloqueVigente')

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

  it('devuelve null si el bloque no trae ninguna versión', () => {
    expect(bloqueVigente('<response><data/></response>')).toBeNull()
  })

  it('tolera entradas vacías', () => {
    expect(bloqueVigente('')).toBeNull()
    expect(bloqueVigente(undefined)).toBeNull()
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
