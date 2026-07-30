// Estructura de una norma EUROPEA a partir del documento espejo del BOE.
//
// ## Por qué (30/07/2026)
//
// El poblador de secciones solo sabe leer el índice de la API de legislación consolidada,
// que es derecho español: con un id `DOUE-L-…` responde «Identificador no válido». Por eso
// el RGPD —99 artículos, 222 preguntas, presente en 49 temas de 49 oposiciones— se sirve
// como una lista plana y el botón «Títulos» del configurador ni aparece.
//
// El riesgo de parsear el documento en vez de un índice estructurado es emparejar cada
// capítulo con un artículo que no le toca (estos documentos pueden traer el índice repetido
// antes del cuerpo). Estos tests fijan que, ante esa señal, el parser NO devuelva rangos.
const {
  parseDoueSections,
  lineasDesdeHtml,
  esIdDoue,
} = require('@/lib/laws/parseDoueSections')

describe('capítulos de una norma europea', () => {
  it('el RGPD sale con sus capítulos y los rangos encadenados', () => {
    // Encabezados reales del documento, con la rúbrica entre el capítulo y su artículo.
    const lineas = [
      'CAPÍTULO I', 'Disposiciones generales', 'Artículo 1', 'Objeto', 'Artículo 4',
      'CAPÍTULO II', 'Principios', 'Artículo 5', 'Artículo 11',
      'CAPÍTULO III', 'Derechos del interesado', 'Artículo 12', 'Artículo 23',
      'CAPÍTULO IV', 'Responsable del tratamiento y encargado del tratamiento', 'Artículo 24', 'Artículo 43',
    ]
    const { tipo, secciones } = parseDoueSections(lineas)
    expect(tipo).toBe('capitulo')
    expect(secciones).toEqual([
      { num: 'I', rubrica: 'Disposiciones generales', from: 1, to: 4 },
      { num: 'II', rubrica: 'Principios', from: 5, to: 11 },
      { num: 'III', rubrica: 'Derechos del interesado', from: 12, to: 23 },
      { num: 'IV', rubrica: 'Responsable del tratamiento y encargado del tratamiento', from: 24, to: 43 },
    ])
  })

  it('si se omite un capítulo intermedio, el rango anterior se ESTIRA hasta el siguiente', () => {
    // Documentado a propósito: el cierre lo marca el capítulo siguiente, así que hay que
    // parsear el documento ENTERO. Alimentar una selección de capítulos daría rangos que
    // se comen los del medio, y esos rangos acabarían en la base de datos.
    const { secciones } = parseDoueSections([
      'CAPÍTULO III', 'Derechos', 'Artículo 12',
      'CAPÍTULO XI', 'Finales', 'Artículo 94', 'Artículo 99',
    ])
    expect(secciones[0]).toMatchObject({ num: 'III', from: 12, to: 93 })
  })

  it('el último capítulo cierra en el artículo más alto del texto, sin extrapolar', () => {
    const { secciones } = parseDoueSections(['CAPÍTULO I', 'Uno', 'Artículo 1', 'CAPÍTULO II', 'Dos', 'Artículo 5', 'Artículo 7'])
    expect(secciones[1]).toMatchObject({ from: 5, to: 7 })
  })

  it('un ÍNDICE de cabecera sin artículos no estorba: se queda el cuerpo', () => {
    const conIndice = [
      'CAPÍTULO I', 'Disposiciones generales',
      'CAPÍTULO II', 'Principios',
      'CAPÍTULO I', 'Disposiciones generales', 'Artículo 1',
      'CAPÍTULO II', 'Principios', 'Artículo 5', 'Artículo 9',
    ]
    const { secciones } = parseDoueSections(conIndice)
    expect(secciones).toEqual([
      { num: 'I', rubrica: 'Disposiciones generales', from: 1, to: 4 },
      { num: 'II', rubrica: 'Principios', from: 5, to: 9 },
    ])
  })

  it('los ANEXOS con su propia numeración de capítulos no invalidan la norma', () => {
    // Caso real del Reglamento 852/2004: capítulos I-V en el articulado y otros I-VII en
    // los anexos, que se organizan por apartados y no llevan artículos. Tratar eso como
    // documento duplicado dejaba fuera una norma perfectamente estructurada.
    const { secciones } = parseDoueSections([
      'CAPÍTULO I', 'Disposiciones generales', 'Artículo 1', 'Artículo 2',
      'CAPÍTULO II', 'Obligaciones', 'Artículo 3', 'Artículo 6',
      'ANEXO I', 'PRODUCCIÓN PRIMARIA',
      'CAPÍTULO I', 'Disposiciones generales del anexo',
      'CAPÍTULO II', 'Recomendaciones',
    ])
    expect(secciones).toEqual([
      { num: 'I', rubrica: 'Disposiciones generales', from: 1, to: 2 },
      { num: 'II', rubrica: 'Obligaciones', from: 3, to: 6 },
    ])
  })

  it('pero el MISMO capítulo dos veces CON artículos sí se rechaza', () => {
    // Firma de un documento que junta dos normas (TUE+TFUE) o de un índice que enumera
    // también los artículos: no se puede saber cuál es el bueno.
    const r = parseDoueSections([
      'CAPÍTULO I', 'Uno', 'Artículo 1', 'Artículo 3',
      'CAPÍTULO II', 'Dos', 'Artículo 4',
      'CAPÍTULO I', 'Uno de la otra norma', 'Artículo 1',
    ])
    expect(r.secciones).toEqual([])
    expect(r.motivo).toBe('capitulo_duplicado')
  })

  it('si los artículos iniciales retroceden, se rechaza (emparejamiento desalineado)', () => {
    const r = parseDoueSections(['CAPÍTULO I', 'A', 'Artículo 30', 'CAPÍTULO II', 'B', 'Artículo 5'])
    expect(r.secciones).toEqual([])
    expect(r.motivo).toBe('orden_no_creciente')
  })

  it('un texto sin capítulos no inventa uno solo que abarque todo', () => {
    const r = parseDoueSections(['Artículo 1', 'Artículo 2', 'Artículo 3'])
    expect(r.secciones).toEqual([])
    expect(r.motivo).toBe('sin_capitulos')
  })

  it('«CAPÍTULO» citado dentro de una frase no abre sección', () => {
    const r = parseDoueSections([
      'lo dispuesto en el CAPÍTULO V se aplicará sin perjuicio',
      'CAPÍTULO I', 'Disposiciones', 'Artículo 1', 'Artículo 9',
    ])
    expect(r.secciones).toHaveLength(1)
    expect(r.secciones[0]).toMatchObject({ num: 'I', from: 1, to: 9 })
  })

  it('un capítulo sin artículos detrás se descarta en vez de romper el encadenado', () => {
    const { secciones } = parseDoueSections([
      'CAPÍTULO I', 'Uno', 'Artículo 1',
      'CAPÍTULO II', 'Vacío por derogación',
      'CAPÍTULO III', 'Tres', 'Artículo 10', 'Artículo 12',
    ])
    expect(secciones.map((s) => s.num)).toEqual(['I', 'III'])
    expect(secciones[0]).toMatchObject({ from: 1, to: 9 })
  })

  it('reconoce los ids europeos y no confunde los del BOE', () => {
    expect(esIdDoue('https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807')).toBe('DOUE-L-2016-80807')
    expect(esIdDoue('https://www.boe.es/buscar/act.php?id=BOE-A-2001-21090')).toBeNull()
    expect(esIdDoue(null)).toBeNull()
  })

  it('el HTML se convierte en líneas con los acentos puestos', () => {
    const lineas = lineasDesdeHtml('<p class="tit">CAP&Iacute;TULO I</p><p>Disposiciones generales</p><p>Art&iacute;culo 1</p>')
    expect(lineas).toEqual(['CAPÍTULO I', 'Disposiciones generales', 'Artículo 1'])
  })
})
