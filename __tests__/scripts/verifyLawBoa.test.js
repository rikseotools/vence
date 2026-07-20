// Fija el parseo del extractor del BOA (scripts/verify-law-boa.cjs).
//
// Cada bloque de aquí corresponde a un fallo REAL destapado verificando las 9 leyes
// ancladas al BOA. Sin estos casos el extractor "funciona" pero miente: da falsos
// positivos de mismatch (ruido que enmascara los defectos de verdad) o se come el
// articulado entero y reporta 0 artículos.
const {
  htmlToParagraphs, pdfToParagraphs, splitArticles, titleBody, similarity, dispKey, stripHeaderLine,
} = require('../../scripts/verify-law-boa.cjs')

const arts = (paras) => splitArticles(paras)

describe('splitArticles — cabeceras', () => {
  test('separa artículos con el formato moderno "Artículo N. Título."', () => {
    const a = arts(['Artículo 1. Objeto.', 'Texto del uno.', 'Artículo 2. Ámbito.', 'Texto del dos.'])
    expect([...a.keys()]).toEqual(['1', '2'])
    expect(a.get('1').title).toBe('Objeto.')
    expect(a.get('1').content).toContain('Texto del uno.')
  })

  test('separa el formato antiguo "Artículo N.-Título." sin dejar el guion en el título', () => {
    // Antes: el título salía como "-Objeto." → 62 de 62 títulos reportados como distintos.
    const a = arts(['Artículo 1.-Objeto.', 'Texto.'])
    expect(titleBody(a.get('1').title)).toBe('Objeto')
  })

  test('NO confunde una remisión en prosa con una cabecera', () => {
    // Antes: "artículo 2 del Estatuto…" abría un artículo falso que se comía el real.
    const a = arts(['Artículo 1. Objeto.', 'artículo 2 del Estatuto de los Trabajadores, los puestos…', 'Más texto.'])
    expect([...a.keys()]).toEqual(['1'])
    expect(a.get('1').content).toContain('Estatuto de los Trabajadores')
  })

  test('sí acepta un enunciado que empieza por palabra capitalizada ("De la…")', () => {
    // La guarda anti-prosa no puede tumbar "Artículo 41. De la Dirección General…"
    const a = arts(['Artículo 41. De la Dirección General de Salud.', 'Texto.'])
    expect(a.has('41')).toBe(true)
  })

  test('acepta la cabecera en MINÚSCULA ("artículo 27.-") — BOJA — sin tragarse la prosa', () => {
    // El BOJA (Junta de Andalucía) escribe "artículo 27.- Hojas de sugerencias" en minúscula;
    // pero "artículo 2 del Estatuto…" sigue siendo una remisión, no una cabecera.
    const a = arts(['artículo 27.- Hojas de sugerencias y reclamaciones.', 'Por razones de privacidad…',
      'artículo 2 del Estatuto de los Trabajadores, los puestos…'])
    expect(a.has('27')).toBe(true)
    expect(a.get('27').content).toContain('Por razones de privacidad')
    // la remisión "artículo 2 del Estatuto…" NO abre un artículo falso (queda como cuerpo)
    expect(a.has('2')).toBe(false)
  })
})

describe('splitArticles — límites de bloque', () => {
  test('un encabezado de capítulo cierra el artículo y no se cuela en su texto', () => {
    // Antes: el art. 18 absorbía "Capítulo V …" y salía como contenido≠ (falso positivo).
    const a = arts(['Artículo 18. Servicio.', 'Competencias.', 'CAPÍTULO V Dirección General', 'Preámbulo del capítulo.'])
    expect(a.get('18').content).not.toContain('CAPÍTULO V')
    expect(a.get('18').content).not.toContain('Preámbulo del capítulo.')
  })

  test('la firma cierra el bloque pero NO termina el documento (articulado en el anexo)', () => {
    // Caso Decreto 174/2010: los 62 artículos del reglamento van DESPUÉS de la firma.
    const a = arts([
      'Artículo único.-Aprobación del Reglamento',
      'Zaragoza, 21 de septiembre de 2010.',
      'El Presidente del Gobierno de Aragón, Marcelino Iglesias Ricou',
      'ANEXO',
      'Artículo 1.-Objeto.',
      'El presente Reglamento tiene por objeto…',
    ])
    expect(a.has('1')).toBe(true)
    expect(a.get('1').content).toContain('por objeto')
  })

  test('el pie del portal corta el documento, pero solo una vez empezado el articulado', () => {
    // Doble fallo real: (a) sin cortar, "Aviso Legal/Mapa web" acabó DENTRO del texto
    // legal en BD; (b) cortando a lo bruto, "Descargar Registros" aparece ANTES del
    // articulado y dejaba el documento en 0 artículos.
    const a = arts([
      'Descargar Registros',
      'Artículo 1.-Objeto.',
      'Texto legal.',
      'Aviso Legal',
      'Mapa web',
    ])
    expect(a.has('1')).toBe(true)
    expect(a.get('1').content).toContain('Texto legal.')
    expect(a.get('1').content).not.toMatch(/Aviso Legal|Mapa web/)
  })
})

describe('splitArticles — disposiciones', () => {
  test('la disposición SIN ordinal se registra como única y no se cuela en el bloque anterior', () => {
    // El BOA escribe "Disposición derogatoria." a secas cuando solo hay una.
    const a = arts([
      'Disposición transitoria cuarta. Estructura.',
      'Texto de la transitoria.',
      'Disposición derogatoria. Normativa objeto de derogación.',
      'Quedan derogadas…',
    ])
    expect(a.has('da_derogatoria_unica')).toBe(true)
    expect(a.get('da_transitoria_cuarta').content).not.toContain('Quedan derogadas')
  })

  test('dispKey respeta la convención de la BD (derogatoria sin tilde, resto con ella)', () => {
    expect(dispKey('derogatoria', null)).toBe('da_derogatoria_unica')
    expect(dispKey('transitoria', null)).toBe('da_transitoria_única')
    expect(dispKey('adicional', 'séptima')).toBe('da_adicional_séptima')
    expect(dispKey('adicional', 'septima')).toBe('da_adicional_séptima')
  })
})

describe('titleBody — convención de almacenamiento, no defecto', () => {
  test('quita el prefijo que la BD guarda dentro del título', () => {
    expect(titleBody('Disposición adicional segunda. Adscripción de unidades administrativas.'))
      .toBe('Adscripción de unidades administrativas')
    expect(titleBody('Artículo 3. Competencias.')).toBe('Competencias')
  })

  test('el punto final es maquetación: "Retribuciones" y "Retribuciones." son el mismo título', () => {
    // Antes: 132 de 137 títulos reportados como distintos solo por el punto.
    expect(titleBody('Retribuciones')).toBe(titleBody('Retribuciones.'))
  })
})

describe('stripHeaderLine — comparar cuerpo, no la cabecera', () => {
  // Unos imports guardan la cabecera "Artículo N. Título." dentro del contenido y otros
  // solo el cuerpo. Sin quitarla de ambos lados, su presencia/ausencia hundía la
  // similitud y fabricaba decenas de "contenido≠" falsos en las leyes-PDF.
  test('quita la cabecera de artículo del contenido', () => {
    expect(stripHeaderLine('Artículo 3. Condiciones más beneficiosas.\nLa entrada en vigor…'))
      .toBe('La entrada en vigor…')
  })
  test('quita la cabecera de disposición', () => {
    expect(stripHeaderLine('Disposición final tercera. Entrada en vigor.\nEste Decreto entrará…'))
      .toBe('Este Decreto entrará…')
  })
  test('deja intacto un cuerpo que ya viene sin cabecera', () => {
    expect(stripHeaderLine('La entrada en vigor de este Convenio implica…'))
      .toBe('La entrada en vigor de este Convenio implica…')
  })
  test('un cuerpo con cabecera y otro sin ella comparan igual tras el strip', () => {
    const conHdr = 'Artículo 12. Jornada Laboral.\nrealizarán una jornada de 1.690 horas.'
    const sinHdr = 'realizarán una jornada de 1.690 horas.'
    expect(similarity(stripHeaderLine(conHdr), stripHeaderLine(sinHdr))).toBe(1)
  })
})

describe('similarity', () => {
  test('vale 1 en texto idéntico y baja con el ruido de maquetación, no con la redacción', () => {
    const t = 'El plazo máximo de la concesión será de cincuenta años.'
    expect(similarity(t, t)).toBe(1)
    expect(similarity(t, 'El plazo  máximo de la concesión será de cincuenta años.')).toBe(1)
    expect(similarity(t, 'Los perros ladran en la calle por la noche.')).toBeLessThan(0.2)
  })
})

describe('htmlToParagraphs / pdfToParagraphs', () => {
  test('el HTML del BOA se parte por <P> y decodifica entidades', () => {
    const p = htmlToParagraphs('<P>Art&iacute;culo 1. Objeto.<P>Texto&nbsp;legal.')
    expect(p).toEqual(['Artículo 1. Objeto.', 'Texto legal.'])
  })

  test('el PDF recompone el párrafo partido por salto de línea y tira el membrete', () => {
    const p = pdfToParagraphs([
      'Boletín Oficial de Aragón',
      '19/05/2023',
      'Artículo 8. Retribuciones.',
      'Las retribuciones del personal se ajustarán a lo previsto en',
      'el presente Convenio Colectivo.',
    ].join('\n'))
    expect(p).toEqual([
      'Artículo 8. Retribuciones.',
      'Las retribuciones del personal se ajustarán a lo previsto en el presente Convenio Colectivo.',
    ])
  })
})
