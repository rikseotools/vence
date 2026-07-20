// T-048 — cablear la captura de vigencia en el extractor COMPARTIDO (lib/boe-extractor.ts), que es
// el que usa la sincronización de artículos. Antes borraba `nota_pie` y `blockquote` y ahí se
// perdía la información: importábamos el inciso anulado por el TC como texto plano válido.
//
// Lo que se fija aquí es el CONTRATO: `content` sale exactamente igual que antes (limpio, sin
// notas) y la vigencia viaja aparte. Si alguien vuelve a meter las notas dentro del articulado,
// estos tests fallan.
import { extractArticlesFromBOE } from '@/lib/boe-extractor'

// Estructura real de la web del BOE consolidado (misma forma que el bloque a58 de la LO 4/2000).
const HTML = `
<div>
  <h5 class="articulo">Artículo 58. Efectos de la devolución.</h5>
  <p class="parrafo">6. La devoluci&oacute;n acordada conllevar&aacute; la reiniciaci&oacute;n del c&oacute;mputo del plazo. <strong>Asimismo, toda devoluci&oacute;n acordada en aplicaci&oacute;n del p&aacute;rrafo b) llevar&aacute; consigo la prohibici&oacute;n de entrada por un plazo m&aacute;ximo de tres a&ntilde;os.</strong></p>
  <blockquote>
    <p class="nota_pie">Se modifica el apartado 5 por el art. 1.31 de la Ley Org&aacute;nica 14/2003. <a>Ref. BOE-A-2003-21187</a>.</p>
    <p class="nota_pie">Se declara inconstitucional y nulo el inciso destacado del apartado 6 por Sentencia del TC 17/2013. <a>Ref. BOE-A-2013-2167</a>.</p>
  </blockquote>
  <h5 class="articulo">Artículo 59. Otro artículo sin notas.</h5>
  <p class="parrafo">Contenido normal y corriente.</p>
</div>`

describe('extractArticlesFromBOE — la vigencia deja de perderse', () => {
  const arts = extractArticlesFromBOE(HTML)
  const a58 = arts.find((a) => a.article_number === '58')

  it('extrae el artículo (no se rompe nada de lo que ya hacía)', () => {
    expect(a58).toBeDefined()
    expect(a58!.content).toContain('acordada conllevar')
  })

  it('⚠️ BUG PREEXISTENTE documentado: el camino de reserva NO decodifica entidades', () => {
    // `extractArticlesFromBOE` tiene dos caminos. El principal llama a decodeHtmlEntities;
    // el de reserva (por posiciones de <h5>), que es el que ejercita este fixture, NO.
    // Resultado: esos artículos guardan "&oacute;" en el content y el opositor lo ve así.
    // NO se arregla aquí a propósito: cambiar el texto cambia el content_hash de miles de
    // artículos y dispararía una re-sincronización masiva. Se anota como hallazgo aparte.
    // Este test existe para que el día que se arregle, salte y se decida conscientemente.
    expect(a58!.content).toContain('&oacute;')

    // La vigencia SÍ sale decodificada (la extraigo yo con decodeHtmlEntities), así que de
    // momento content y vigencia no van a la par en este camino.
    expect(a58!.vigencia!.annulledFragments[0]).toContain('devolución')
  })

  it('CONTRATO: el content sigue SIN las notas al pie', () => {
    // Si esto falla, las notas se han colado en el articulado y romperían las citas literales
    // de las explicaciones (que citan el artículo verbatim).
    expect(a58!.content).not.toContain('Se declara inconstitucional')
    expect(a58!.content).not.toContain('Ref. BOE-A-2013-2167')
    expect(a58!.content).not.toContain('Se modifica el apartado 5')
  })

  it('captura la nota del TC que antes se tiraba', () => {
    const anul = a58!.vigencia?.notes.filter((n) => n.esAnulacion) ?? []
    expect(anul).toHaveLength(1)
    expect(anul[0].texto).toContain('inconstitucional y nulo el inciso destacado')
    expect(anul[0].ref).toBe('BOE-A-2013-2167')
  })

  it('distingue la nota de modificación de la de anulación', () => {
    const mod = a58!.vigencia?.notes.filter((n) => !n.esAnulacion) ?? []
    expect(mod).toHaveLength(1)
    expect(mod[0].ref).toBe('BOE-A-2003-21187')
  })

  it('aísla el inciso anulado exacto (el <strong> del articulado)', () => {
    expect(a58!.vigencia?.annulledFragments).toHaveLength(1)
    expect(a58!.vigencia!.annulledFragments[0]).toMatch(/^Asimismo, toda devolución/)
    expect(a58!.vigencia!.annulledFragments[0]).toMatch(/tres años\.$/)
  })

  it('un artículo SIN notas no arrastra vigencia (no se inventa nada)', () => {
    const a59 = arts.find((a) => a.article_number === '59')
    expect(a59).toBeDefined()
    expect(a59!.vigencia).toBeUndefined()
  })
})

describe('extractArticlesFromBOE — no marcar de más', () => {
  it('un <strong> sin nota de anulación NO produce fragmentos anulados', () => {
    // El BOE resalta por otros motivos; marcar por el mero <strong> daría falsos positivos
    // y el gate de promoción (capa 3) empezaría a bloquear preguntas buenas.
    const html = `
      <div>
        <h5 class="articulo">Artículo 1. Plazos.</h5>
        <p class="parrafo">El plazo ser&aacute; de <strong>diez d&iacute;as</strong>.</p>
        <blockquote><p class="nota_pie">Se modifica por la Ley 1/2020.</p></blockquote>
      </div>`
    const a = extractArticlesFromBOE(html).find((x) => x.article_number === '1')
    expect(a!.vigencia?.notes).toHaveLength(1)
    expect(a!.vigencia?.annulledFragments).toEqual([])
  })
})
