// T-048 capa 2 — pintar la vigencia como el BOE: inciso anulado tachado + notas al pie.
// Sin esto, la capa 1 captura el dato pero el opositor sigue leyendo el inciso muerto como
// vigente (el incidente del art. 126.2 LBRL / STC 103/2013).
import { annotateVigencia, tieneIncisoAnulado } from '@/lib/teoria/annotateVigencia'

// Datos reales capturados de la LO 4/2000 art. 58 (STC 17/2013), recortados.
const FRAGMENTO =
  'Asimismo, toda devolución acordada en aplicación del párrafo b) del mismo apartado de este artículo llevará consigo la prohibición de entrada en territorio español por un plazo máximo de tres años.'
const TEXTO = `6. La devolución acordada en el párrafo a) del apartado 2 de este artículo conllevará la reiniciación del cómputo del plazo. ${FRAGMENTO}`
const VIGENCIA = {
  notes: [
    {
      texto:
        'Se declara inconstitucional y nulo el inciso destacado del apartado 6 por Sentencia del TC 17/2013, de 31 de enero.',
      ref: 'BOE-A-2013-2167',
      esAnulacion: true,
    },
    {
      texto: 'Se modifica el apartado 5 por el art. 1.31 de la Ley Orgánica 14/2003.',
      ref: 'BOE-A-2003-21187',
      esAnulacion: false,
    },
  ],
  annulledFragments: [FRAGMENTO],
}

describe('annotateVigencia — el opositor tiene que VER que está anulado', () => {
  const out = annotateVigencia(TEXTO, VIGENCIA)

  it('tacha el inciso anulado y lo avisa en texto (no solo con formato)', () => {
    // El tachado solo no basta: quien lea rápido o use lector de pantalla necesita el aviso.
    expect(out).toContain(`~~${FRAGMENTO}~~`)
    expect(out).toContain('inconstitucional y nulo')
    expect(out).toContain('sin vigencia')
  })

  it('conserva el resto del articulado intacto', () => {
    expect(out).toContain('6. La devolución acordada en el párrafo a) del apartado 2')
  })

  it('muestra las notas del BOE con su referencia, la de anulación primero', () => {
    const iAnul = out.indexOf('Sentencia del TC 17/2013')
    const iMod = out.indexOf('Se modifica el apartado 5')
    expect(iAnul).toBeGreaterThan(-1)
    expect(iMod).toBeGreaterThan(iAnul) // la que cambia la respuesta, arriba
    expect(out).toContain('BOE-A-2013-2167')
  })

  it('tieneIncisoAnulado avisa para poder marcarlo en la UI', () => {
    expect(tieneIncisoAnulado(VIGENCIA)).toBe(true)
    expect(tieneIncisoAnulado({ notes: [{ texto: 'Se modifica', esAnulacion: false }] })).toBe(false)
    expect(tieneIncisoAnulado(null)).toBe(false)
  })
})

describe('annotateVigencia — no romper ni inventar', () => {
  it('sin datos de vigencia devuelve el texto TAL CUAL (el 99% de los artículos)', () => {
    expect(annotateVigencia(TEXTO, null)).toBe(TEXTO)
    expect(annotateVigencia(TEXTO, {})).toBe(TEXTO)
    expect(annotateVigencia(TEXTO, { notes: [], annulledFragments: [] })).toBe(TEXTO)
  })

  it('si el fragmento NO aparece en el texto, no tacha nada pero SÍ avisa con la nota', () => {
    // Puede pasar: el import reflowea el texto o la redacción guardada es otra.
    // Tachar el trozo equivocado sería peor que no tachar.
    const out = annotateVigencia('Un texto que no contiene el inciso.', VIGENCIA)
    expect(out).not.toContain('~~')
    expect(out).toContain('Sentencia del TC 17/2013')
  })

  it('encuentra el fragmento aunque cambien los espacios y saltos de línea', () => {
    // El importador reflowea: el fragmento capturado del BOE viene en una línea y el
    // guardado puede estar partido.
    const partido = TEXTO.replace('llevará consigo', 'llevará\n  consigo')
    const out = annotateVigencia(partido, VIGENCIA)
    expect(out).toContain('~~')
    expect(out).toContain('sin vigencia')
  })

  it('no se cae con texto vacío o nulo', () => {
    expect(() => annotateVigencia(null, VIGENCIA)).not.toThrow()
    expect(() => annotateVigencia('', VIGENCIA)).not.toThrow()
    expect(annotateVigencia(undefined, null)).toBe('')
  })

  it('el tachado usa sintaxis GFM, que es la que el renderer tiene activada', () => {
    // components/MarkdownContent.tsx monta ReactMarkdown con remarkGfm → ~~x~~ se pinta.
    expect(annotateVigencia(TEXTO, VIGENCIA)).toMatch(/~~.+~~/s)
  })
})
