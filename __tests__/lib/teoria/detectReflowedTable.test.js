// __tests__/lib/teoria/detectReflowedTable.test.js
//
// Los casos son REALES: salen de medir el núcleo contra los 54.674 artículos activos (T-505).
// Los dos «no-casos» de abajo son los falsos positivos que tenía la primera versión, y por los
// que la lista de cabeceras se podó: sin ellos, el hallazgo de más impacto era prosa con énfasis.

const { detectReflowedTable, mayusculas } = require('../../../lib/teoria/detectReflowedTable.cjs')

const TABLA_REFLUIDA = [
  '2. Requisitos mínimos de las zonas. Los requisitos mínimos de cada una de las zonas serán las siguientes:',
  '',
  'ZONAS OBLIGATORIAS Y REQUISITOS MÍNIMOS ZONA DE ADMINISTRACIÓN ESTANCIA ESPECIFICACIONES Zona de Recepción y espera Preferentemente a la entrada del edificio. ZONA DE SERVICIOS GENERALES EXCEPCIONES PARA CENTROS SUPERFICIE AUTORIZADOS ESTANCIA ESPECIFICACIONES MÍNIMA Y ACREDITADOS PREVIOS A ESTA ORDEN 15 m² por cada Cocina 50 personas mayores.',
].join('\n')

describe('detectReflowedTable — el punto ciego de las tablas re-fluidas', () => {
  test('caza la tabla del boletín pegada en un párrafo, por la cabecera repetida', () => {
    const r = detectReflowedTable(TABLA_REFLUIDA)
    expect(r.detected).toBe(true)
    expect(r.motivo).toMatch(/se repite/)
    expect(r.cabeceras).toEqual(expect.arrayContaining(['ESTANCIA', 'ESPECIFICACIONES']))
  })

  test('una vez reconstruida con rejilla markdown, deja de marcarse', () => {
    const reconstruida = [
      '| ESTANCIA | SUPERFICIE MÍNIMA | ESPECIFICACIONES |',
      '| --- | --- | --- |',
      '| Cocina | 15 m² por cada 50 personas mayores. | Dispondrán de almacén. |',
    ].join('\n')
    expect(detectReflowedTable(reconstruida).detected).toBe(false)
  })

  test('prosa normativa larga, aunque cite artículos y cifras, no se marca', () => {
    const prosa =
      'a) Cartera de servicios. Los centros tendrán definida una Cartera de Servicios que contemplará los servicios básicos que prestan, adecuándolos a las necesidades de las personas atendidas en los mismos. Una copia de dicha Cartera se facilitará a la persona mayor usuaria y en su caso a quien ostente su representación, conforme al artículo 10 y a lo previsto en el apartado 3.'
    expect(detectReflowedTable(prosa).detected).toBe(false)
  })
})

describe('los falsos positivos que aparecieron al medir contra el banco (03/08)', () => {
  test('ÉNFASIS en mayúsculas no es una cabecera de columna', () => {
    // Caso real: el texto de la central de esterilización (78 preguntas servidas) escribe
    // «ZONA SUCIA», «ZONA LIMPIA» y «ZONA ESTÉRIL» en mayúsculas para destacarlas.
    const enfasis =
      '6) ZONAS DE LA CENTRAL DE ESTERILIZACIÓN. La central se organiza por ZONAS separadas con circulación en un único sentido: ZONA SUCIA, donde llega el material contaminado y se lava; ZONA LIMPIA, donde se prepara y empaqueta el material ya limpio; y ZONA ESTÉRIL, de máxima restricción, donde se almacena y distribuye el material esterilizado.'
    expect(detectReflowedTable(enfasis).detected).toBe(false)
  })

  test('una sola cabecera repetida no basta: hacen falta dos columnas distintas', () => {
    const unaSola =
      'La DENOMINACIÓN de cada puesto figura en el anexo correspondiente, y la DENOMINACIÓN se mantendrá mientras no se apruebe una nueva relación de puestos de trabajo por el órgano competente en la materia, conforme a la normativa vigente y a lo dispuesto en el convenio colectivo de aplicación en cada momento.'
    expect(detectReflowedTable(unaSola).detected).toBe(false)
  })
})

describe('mayusculas — qué cuenta como token en mayúsculas', () => {
  test('ignora las siglas cortas y las rúbricas de estructura', () => {
    const t = mayusculas('El BOE publica el TÍTULO III y el CAPÍTULO IV con las ESPECIFICACIONES')
    expect(t).toContain('ESPECIFICACIONES')
    expect(t).not.toContain('BOE')
    expect(t).not.toContain('TÍTULO')
  })
})
