// __tests__/lib/health/visualDeixis.test.ts
// Calibración del núcleo `visual_deixis_no_image` (T-113).
//
// Los fixtures son preguntas REALES del banco (ids en cada caso), no inventadas: son las
// que motivaron cada guarda. Si alguien toca los patrones, este fichero le dice
// exactamente qué preguntas reales cambian de veredicto — que es la única forma de saber
// si un "afinado" mejora la precisión o abre un agujero.
//
// La detección autoritativa la hace Postgres (`~*` sobre los mismos patrones); este
// predicado es su espejo en JS, derivado de LA MISMA cadena vía `toJsRegex`.

const {
  VISUAL_NOUNS,
  VD_STRONG,
  VD_SQL,
  classifyVisualDeixis,
  hasSelfContainedSql,
} = require('@/lib/health/visualDeixis.cjs')

const SIN_IMAGEN = { imageUrl: null, contentData: null }

describe('visualDeixis — positivos VERDADEROS (deben seguir marcándose)', () => {
  it('icono de ofimática sin imagen almacenada (el caso raíz: Outlook, impugnación de Concha)', () => {
    const r = classifyVisualDeixis({
      questionText: 'En Outlook 365, ¿qué significado tiene el siguiente icono?',
      ...SIN_IMAGEN,
    })
    expect(r).toEqual({ flagged: true, reason: 'deixis_sin_imagen' })
  })

  it('"observa la siguiente figura"', () => {
    expect(
      classifyVisualDeixis({ questionText: 'Observa la siguiente figura y señala la opción correcta.', ...SIN_IMAGEN })
        .flagged,
    ).toBe(true)
  })

  it('"según la imagen"', () => {
    expect(
      classifyVisualDeixis({ questionText: 'Según la imagen, ¿cuántas secciones hay?', ...SIN_IMAGEN }).flagged,
    ).toBe(true)
  })

  it('una pregunta de tabla/celda que remite a la imagen sigue marcándose si NO trae SQL', () => {
    expect(
      classifyVisualDeixis({
        questionText: 'Indica el resultado de las restas de la imagen.',
        options: ['12', '13', '14', '15'],
        ...SIN_IMAGEN,
      }).flagged,
    ).toBe(true)
  })
})

describe('visualDeixis — guarda 1: `esquema` no es un sustantivo visual', () => {
  it('metadato ENI con el esquema INLINE en el enunciado (4bb52a88)', () => {
    const r = classifyVisualDeixis({
      questionText: '¿A qué metadato del documento electrónico corresponde el siguiente esquema: ES_órgano>_ _> ID_ específico>?',
      options: ['Identificador del órgano productor', 'Identificador del registro bibliográfico', 'Identificador del documento', 'Identificador del asiento registral'],
      ...SIN_IMAGEN,
    })
    expect(r).toEqual({ flagged: false, reason: 'sin_deixis_visual' })
  })

  it('clasificación URO de Correos, con el esquema desplegado en las OPCIONES (26eeb4d8)', () => {
    const r = classifyVisualDeixis({
      questionText: 'Con carácter general, en URO la clasificación general a sección se realizará en el lugar que se indica en el siguiente esquema. Indica la opción INCORRECTA:',
      options: [
        'Correspondencia ordinaria normalizada (hasta 24 secciones en mesa casillero, a partir de 25 secciones en casillero CN50).',
        'Correspondencia ordinaria no normalizada (hasta 14 secciones en mesa casillero, a partir de 15 secciones en casillero CNN50).',
        'Correspondencia IPC (hasta 14 secciones en mesa casillero diferenciada, a partir de 15 secciones en casillero CNN50).',
        'Correspondencia registrada (hasta 14 secciones en mesa casillero diferenciada, a partir de 15 secciones en casillero CNN50)',
      ],
      ...SIN_IMAGEN,
    })
    expect(r).toEqual({ flagged: false, reason: 'sin_deixis_visual' })
  })

  it('`esquema` NO está en la lista de sustantivos visuales', () => {
    expect(VISUAL_NOUNS).not.toContain('esquema')
  })

  it('pero los sustantivos genuinamente visuales SIGUEN estando', () => {
    for (const n of ['icono', 'imagen', 'figura', 'diagrama', 'pictograma']) {
      expect(VISUAL_NOUNS).toContain(n)
    }
  })
})

describe('visualDeixis — guarda 2: SQL autocontenido', () => {
  const SQL_OPCIONES = [
    'Select count(d.idProducto) as numeroVentas, c.nombreCategoria from Detalle_Factura d, Producto p, Categorias c where p.idProducto=d.idProducto group by nombreCategoria having numeroVentas>10000 order by numeroVentas desc',
    'Select count(d.idProducto) as numeroVentas, c.nombreCategoria from Detalle_Factura d, Producto p, Categorias c where p.idProducto=d.idProducto having numeroVentas>10000 group by nombreCategoria',
    'Select count(d.idProducto) from Detalle_Factura d group by nombreCategoria',
    'Select count(d.idProducto) from Detalle_Factura d order by numeroVentas desc',
  ]

  it('query en el ENUNCIADO, aunque cite el diagrama de la imagen (dda3fbe0)', () => {
    const r = classifyVisualDeixis({
      questionText:
        'Si ejecutamos la siguiente query "SELECT U.PROVINCIA,U.UBICACION,COUNT(T.NOMBRE) FROM TRABAJADORES as T, UBICACIONES as U WHERE T.UBICACION=U.UBICACION GROUP BY U.PROVINCIA,U.UBICACION HAVING COUNT(T.NOMBRE)<4" en una base de datos mysql con el diagrama relacional de la imagen, ¿qué información estaríamos obteniendo?',
      options: ['Las ubicaciones con su provincia y su número de empleados.', 'Las provincias y su número de empleados.', 'Las provincias con 4 o menos empleados.', 'La consulta daría error de sintaxis.'],
      ...SIN_IMAGEN,
    })
    expect(r).toEqual({ flagged: false, reason: 'sql_autocontenido' })
  })

  it('query en las OPCIONES — el enunciado solo dice "la base de datos de la imagen" (5136375b)', () => {
    const r = classifyVisualDeixis({
      questionText:
        'En la base de datos de la imagen, si pretendemos obtener una lista ordenada de manera descendente con las categorías de productos mas vendidas cuyo valor de ventas supere las 10000, ¿cuál sería la consulta?',
      options: SQL_OPCIONES,
      ...SIN_IMAGEN,
    })
    expect(r).toEqual({ flagged: false, reason: 'sql_autocontenido' })
  })

  it('query en las OPCIONES — "el diagrama de la base de datos de la imagen" (d98a66fe)', () => {
    const r = classifyVisualDeixis({
      questionText:
        'Si disponemos de una base de datos con el diagrama de la base de datos de la imagen, ¿cuál sería la consulta correcta para obtener el número de empleados que tiene a su cargo cada director?',
      options: SQL_OPCIONES,
      ...SIN_IMAGEN,
    })
    expect(r).toEqual({ flagged: false, reason: 'sql_autocontenido' })
  })

  it('sin la guarda de OPCIONES esos dos volverían a marcarse (por eso se miran)', () => {
    const enunciado = 'En la base de datos de la imagen, ¿cuál sería la consulta correcta?'
    expect(hasSelfContainedSql(enunciado, [])).toBe(false)
    expect(hasSelfContainedSql(enunciado, SQL_OPCIONES)).toBe(true)
  })

  it('mencionar "select" sin una consulta real NO activa la guarda', () => {
    expect(hasSelfContainedSql('¿Qué hace la sentencia SELECT en SQL?', ['Selecciona filas'])).toBe(false)
  })
})

describe('visualDeixis — homonimias de "imagen" (no son deixis visual)', () => {
  for (const txt of [
    'El derecho a la propia imagen está recogido en el artículo 18 CE.',
    'La ley regula la imagen y el sonido en los medios públicos.',
    'La imagen corporal de las personas usuarias debe respetarse.',
  ]) {
    it(`no marca: "${txt.slice(0, 45)}…"`, () => {
      expect(classifyVisualDeixis({ questionText: txt, ...SIN_IMAGEN }).flagged).toBe(false)
    })
  }

  it('la deixis PLURAL ("de las siguientes opciones") no cuenta', () => {
    expect(
      classifyVisualDeixis({ questionText: 'Señale cuál de las siguientes figuras jurídicas procede.', ...SIN_IMAGEN })
        .flagged,
    ).toBe(false)
  })
})

describe('visualDeixis — la pregunta SÍ tiene la imagen guardada', () => {
  it('imagen embebida en content_data.image_base64 (caso real 130ff03a, LibreOffice/Outlook)', () => {
    const r = classifyVisualDeixis({
      questionText: 'En Outlook 365, ¿qué significado tiene el siguiente icono?',
      imageUrl: null,
      contentData: { image_base64: 'data:image/png;base64,iVBORw0KGgo=' },
    })
    expect(r).toEqual({ flagged: false, reason: 'tiene_imagen' })
  })

  it('image_url presente', () => {
    expect(
      classifyVisualDeixis({
        questionText: 'Observa la siguiente figura.',
        imageUrl: 'https://cdn.vence.es/q/1.png',
        contentData: null,
      }),
    ).toEqual({ flagged: false, reason: 'tiene_imagen' })
  })

  it('content_data vacío NO cuenta como imagen', () => {
    expect(
      classifyVisualDeixis({
        questionText: 'En Outlook 365, ¿qué significado tiene el siguiente icono?',
        imageUrl: null,
        contentData: {},
      }).flagged,
    ).toBe(true)
  })
})

describe('visualDeixis — los patrones son de Postgres (ARE), no de JS', () => {
  it('usan \\y (frontera de palabra de Postgres), que el espejo JS traduce a \\b', () => {
    expect(VD_STRONG).toContain('\\y')
    expect(VD_SQL).toContain('\\y')
  })
})
