// T-048 — al importar leyes se perdía la información de VIGENCIA del BOE (el `<strong>` que marca
// el inciso anulado por el TC y su nota al pie), así que servíamos incisos muertos como texto
// válido. Es la raíz del incidente del art. 126.2 LBRL / STC 103/2013.
//
// El fixture NO está inventado: es el bloque `a58` real de la LO 4/2000 (BOE-A-2000-544),
// descargado el 20/07 de …/legislacion-consolidada/id/BOE-A-2000-544/texto/bloque/a58
// con `Accept: application/xml`, recortado a lo relevante.
import {
  parseBoeBlock,
  getAnnulledFragments,
  hasAnnulledContent,
} from '@/lib/laws/boeVigencia'

const BLOQUE_REAL = `
  <data>
    <p class="parrafo">5. Cuando la devoluci&oacute;n no se pudiera ejecutar en el plazo de 72 horas, se solicitar&aacute; de la autoridad judicial la medida de internamiento prevista para los expedientes de expulsi&oacute;n.</p>
    <p class="parrafo">6. La devoluci&oacute;n acordada en el p&aacute;rrafo a) del apartado 2 de este art&iacute;culo conllevar&aacute; la reiniciaci&oacute;n del c&oacute;mputo del plazo de prohibici&oacute;n de entrada que hubiese acordado la resoluci&oacute;n de expulsi&oacute;n quebrantada. <strong>Asimismo, toda devoluci&oacute;n acordada en aplicaci&oacute;n del p&aacute;rrafo b) del mismo apartado de este art&iacute;culo llevar&aacute; consigo la prohibici&oacute;n de entrada en territorio espa&ntilde;ol por un plazo m&aacute;ximo de tres a&ntilde;os.</strong></p>
    <blockquote>
      <p class="nota_pie">Se modifica el apartado 5 y se a&ntilde;ade el apartado 6 por el art. 1.31 de la Ley Org&aacute;nica 14/2003, de 20 de noviembre. <a class="refPost">Ref. BOE-A-2003-21187</a>.</p>
      <p class="nota_pie_2">Se declara inconstitucional y nulo el inciso destacado del apartado 6 por Sentencia del TC 17/2013, de 31 de enero. <a class="refPost">Ref. BOE-A-2013-2167</a>.</p>
    </blockquote>
  </data>`

describe('parseBoeBlock — no perder la vigencia al importar', () => {
  const b = parseBoeBlock(BLOQUE_REAL)

  it('captura la nota del TC que hoy se tiraba a la basura', () => {
    const anul = b.vigenciaNotes.filter((n) => n.esAnulacion)
    expect(anul).toHaveLength(1)
    expect(anul[0].texto).toContain('inconstitucional y nulo el inciso destacado del apartado 6')
    expect(anul[0].texto).toContain('Sentencia del TC 17/2013')
    expect(anul[0].ref).toBe('BOE-A-2013-2167')
  })

  it('captura también las notas que NO son anulación, sin confundirlas', () => {
    const mod = b.vigenciaNotes.filter((n) => !n.esAnulacion)
    expect(mod).toHaveLength(1)
    expect(mod[0].texto).toContain('Se modifica el apartado 5')
    expect(mod[0].ref).toBe('BOE-A-2003-21187')
  })

  it('aísla el inciso anulado EXACTO (lo que delimita el <strong>)', () => {
    const frags = getAnnulledFragments(b)
    expect(frags).toHaveLength(1)
    expect(frags[0]).toMatch(/^Asimismo, toda devolución acordada/)
    expect(frags[0]).toMatch(/plazo máximo de tres años\.$/)
    expect(hasAnnulledContent(b)).toBe(true)
  })

  it('el TEXTO sale igual que antes: articulado limpio y SIN las notas al pie', () => {
    // Contrato clave: los importadores no cambian de comportamiento y las citas literales
    // de las explicaciones siguen encajando con el contenido guardado.
    expect(b.text).toContain('5. Cuando la devolución no se pudiera ejecutar en el plazo de 72 horas')
    expect(b.text).toContain('llevará consigo la prohibición de entrada en territorio español')
    expect(b.text).not.toContain('Se declara inconstitucional')
    expect(b.text).not.toContain('Ref. BOE-A-2013-2167')
    expect(b.text).not.toMatch(/<[^>]+>/)
  })

  it('decodifica las entidades del BOE (antes quedaban &aacute; en el texto)', () => {
    expect(b.text).not.toMatch(/&[a-z]+;/i)
    expect(b.text).toContain('artículo')
    expect(b.text).toContain('español')
  })
})

describe('parseBoeBlock — no marcar de más', () => {
  it('un <strong> SIN nota de anulación no convierte nada en anulado', () => {
    // El BOE resalta por otros motivos; marcar por el mero <strong> daría falsos positivos.
    const b = parseBoeBlock(
      '<data><p class="parrafo">El plazo será de <strong>diez días</strong> hábiles.</p></data>',
    )
    expect(b.highlightedFragments).toEqual(['diez días'])
    expect(getAnnulledFragments(b)).toEqual([])
    expect(hasAnnulledContent(b)).toBe(false)
  })

  it('una nota de simple modificación no marca anulación', () => {
    const b = parseBoeBlock(
      '<data><p class="parrafo">Texto.</p><blockquote><p class="nota_pie">Se modifica por la Ley 1/2020.</p></blockquote></data>',
    )
    expect(b.vigenciaNotes[0].esAnulacion) .toBe(false)
    expect(hasAnnulledContent(b)).toBe(false)
  })

  it('deduplica: el BOE repite el historial de reformas en el mismo bloque', () => {
    // Medido en el caso real (LO 4/2000 art.58): 20 notas y 2 fragmentos, de los que solo
    // 8 y 1 son distintos. Sin dedup, el JSONB guardado es ruido.
    const dup = `<data>
      <p class="parrafo">Texto <strong>inciso muerto</strong>.</p>
      <p class="parrafo">Texto <strong>inciso muerto</strong>.</p>
      <blockquote><p class="nota_pie">Se declara nulo el inciso destacado por STC 1/2020.</p></blockquote>
      <blockquote><p class="nota_pie">Se declara nulo el inciso destacado por STC 1/2020.</p></blockquote>
    </data>`
    const b = parseBoeBlock(dup)
    expect(b.vigenciaNotes).toHaveLength(1)
    expect(b.highlightedFragments).toEqual(['inciso muerto'])
    expect(getAnnulledFragments(b)).toEqual(['inciso muerto'])
  })

  it('no se cae con bloques vacíos o raros (un import no puede romperse por una nota)', () => {
    expect(parseBoeBlock('')).toEqual({ text: '', vigenciaNotes: [], highlightedFragments: [] })
    expect(() => parseBoeBlock('<data><p>suelto')).not.toThrow()
    expect(parseBoeBlock('<data><blockquote><p class="nota_pie"></p></blockquote></data>').vigenciaNotes)
      .toEqual([])
  })
})
