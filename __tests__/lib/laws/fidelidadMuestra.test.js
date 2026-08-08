/**
 * @jest-environment node
 */
// fidelidadMuestra — punto ciego de `lib/laws/completeness.ts`: contar artículos no dice si el
// TEXTO es el oficial. Caso real (T-193): RGPD daba 99/99 (is_ok) con 72 de esos 99 reescritos en
// paráfrasis. Estas fixtures reproducen ese caso y el negativo (leyes limpias del barrido del
// 28/07: 51/52 artículos muestreados idénticos al BOE actual).

const { elegirMuestra, resolverFuente, clasificarFidelidadLey } = require('@/lib/laws/fidelidadMuestra')

describe('elegirMuestra', () => {
  it('devuelve todo si hay menos elementos que el tamaño pedido', () => {
    expect(elegirMuestra(['1', '2', '3'], 5)).toEqual(['1', '2', '3'])
  })

  it('reparte de forma uniforme en vez de coger los primeros N', () => {
    const arts = Array.from({ length: 100 }, (_, i) => String(i + 1))
    const muestra = elegirMuestra(arts, 5)
    expect(muestra).toEqual(['1', '26', '51', '75', '100'])
  })

  it('n=1 coge el elemento central, no el primero', () => {
    const arts = ['1', '2', '3', '4', '5']
    expect(elegirMuestra(arts, 1)).toEqual(['3'])
  })

  it('es determinista: misma entrada, misma muestra', () => {
    const arts = Array.from({ length: 37 }, (_, i) => String(i + 1))
    expect(elegirMuestra(arts, 5)).toEqual(elegirMuestra(arts, 5))
  })

  it('sin elementos o n<=0 → vacío', () => {
    expect(elegirMuestra([], 5)).toEqual([])
    expect(elegirMuestra(['1', '2'], 0)).toEqual([])
  })
})

describe('resolverFuente', () => {
  it('sin boe_url → sin_fuente', () => {
    expect(resolverFuente(null)).toEqual({ tipo: null, motivo: 'sin_fuente' })
    expect(resolverFuente('')).toEqual({ tipo: null, motivo: 'sin_fuente' })
  })

  it('BOE consolidado → tipo boe con el id extraído', () => {
    expect(resolverFuente('https://boe.es/buscar/act.php?id=BOE-A-1995-24292')).toEqual({
      tipo: 'boe',
      id: 'BOE-A-1995-24292',
    })
  })

  it('EUR-Lex consolidado (CELEX que empieza por 0) → tipo eurlex', () => {
    expect(resolverFuente('https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:02016R0679-20160504')).toEqual({
      tipo: 'eurlex',
      id: 'CELEX:02016R0679-20160504',
    })
  })

  it('acepta el CELEX URL-encoded (%3A en vez de :)', () => {
    expect(resolverFuente('https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX%3A02014R0910')).toEqual({
      tipo: 'eurlex',
      id: 'CELEX:02014R0910',
    })
  })

  // Caso real T-184: comparar contra el CELEX del acto original (sector 3) "divergía" en 80 de
  // 99 artículos del RGPD porque ese texto reproduce las erratas que el consolidado corrige.
  it('CELEX del acto original (empieza por 3) → rechazado, no comparable a ciegas', () => {
    expect(resolverFuente('https://eur-lex.europa.eu/legal-content/ES/TXT/HTML/?uri=CELEX:32013D0336')).toEqual({
      tipo: null,
      motivo: 'celex_no_consolidado',
      detalle: '32013D0336',
    })
  })

  it('espejo del BOE de un DOUE (RGPD real en BD) → no reconocida, no se usa como fuente', () => {
    expect(resolverFuente('https://www.boe.es/buscar/doc.php?id=DOUE-L-2016-80807')).toEqual({
      tipo: null,
      motivo: 'fuente_no_reconocida',
    })
  })

  it('URL de portal de entidad sin patrón reconocible → no reconocida', () => {
    expect(resolverFuente('https://www.europarl.europa.eu/doceo/document/RULES-9-2023-01-18-TOC_ES.html')).toEqual({
      tipo: null,
      motivo: 'fuente_no_reconocida',
    })
  })
})

describe('clasificarFidelidadLey', () => {
  it('muestra limpia (patrón real: 51/52 idénticos, 1 issue de otra familia) → fiel', () => {
    const clases = ['identico', 'identico', 'identico', 'identico', 'erratas']
    expect(clasificarFidelidadLey(clases)).toEqual({
      muestra: 5, medibles: 5, inconclusos: 0, noFieles: 0, ratioNoFiel: 0, veredicto: 'fiel',
    })
  })

  // Caso RGPD (T-193): la mayoría de la muestra sale contaminado (paráfrasis) → pide auditoría
  // completa, exactamente el umbral que cita la ficha de origen ("si 3 de 5 salen contaminado").
  it('3 de 5 contaminado → auditoria_completa', () => {
    const clases = ['contaminado', 'contaminado', 'contaminado', 'identico', 'identico']
    const r = clasificarFidelidadLey(clases)
    expect(r.veredicto).toBe('auditoria_completa')
    expect(r.ratioNoFiel).toBeCloseTo(0.6)
  })

  it('1 de 5 incompleto → revisar_muestra, no dispara auditoría completa todavía', () => {
    const clases = ['incompleto', 'identico', 'identico', 'identico', 'reordenado']
    expect(clasificarFidelidadLey(clases).veredicto).toBe('revisar_muestra')
  })

  it('reordenado y erratas cuentan como fiables (son defecto de FORMA, no de fidelidad)', () => {
    const clases = ['reordenado', 'erratas', 'identico']
    const r = clasificarFidelidadLey(clases)
    expect(r.noFieles).toBe(0)
    expect(r.veredicto).toBe('fiel')
  })

  it('toda la muestra sin_oficial (no se pudo leer la fuente) → inconcluso, NUNCA auditoria_completa', () => {
    const clases = ['sin_oficial', 'sin_oficial', 'sin_oficial']
    expect(clasificarFidelidadLey(clases)).toMatchObject({ medibles: 0, veredicto: 'inconcluso' })
  })

  it('sin_oficial mezclado no cuenta ni a favor ni en contra del ratio', () => {
    // 2 de 3 MEDIBLES son contaminado (66%) aunque la muestra completa sea de 5.
    const clases = ['contaminado', 'contaminado', 'identico', 'sin_oficial', 'sin_oficial']
    const r = clasificarFidelidadLey(clases)
    expect(r.medibles).toBe(3)
    expect(r.inconclusos).toBe(2)
    expect(r.veredicto).toBe('auditoria_completa')
  })

  it('umbral configurable', () => {
    const clases = ['contaminado', 'identico', 'identico', 'identico', 'identico']
    expect(clasificarFidelidadLey(clases, { umbral: 0.2 }).veredicto).toBe('auditoria_completa')
    expect(clasificarFidelidadLey(clases, { umbral: 0.6 }).veredicto).toBe('revisar_muestra')
  })

  it('muestra vacía → inconcluso', () => {
    expect(clasificarFidelidadLey([])).toMatchObject({ veredicto: 'inconcluso' })
  })

  // Caso real medido construyendo este detector (LECrim, BOE-A-1882-6036): el índice del BOE
  // tiene DOS bloques "Artículo 1" (el del Real Decreto aprobatorio y el del Código) y el mapeo
  // compartido se queda con el primero → comparar el art. 1 de nuestra BD contra ESE bloque da
  // 100% "contaminado" siendo el texto correcto. Con solo 1 medible el ratio es ruido puro.
  it('1 de 1 contaminado (ratio 100%, pero solo 1 observación) → NO dispara auditoria_completa', () => {
    const r = clasificarFidelidadLey(['contaminado', 'sin_oficial'])
    expect(r.medibles).toBe(1)
    expect(r.ratioNoFiel).toBe(1)
    expect(r.veredicto).toBe('revisar_muestra')
  })

  it('minMedibles configurable', () => {
    const clases = ['contaminado', 'contaminado', 'identico']
    expect(clasificarFidelidadLey(clases, { minMedibles: 4 }).veredicto).toBe('revisar_muestra')
    expect(clasificarFidelidadLey(clases, { minMedibles: 4 }).ratioNoFiel).toBeCloseTo(0.667)
    expect(clasificarFidelidadLey(clases, { minMedibles: 2 }).veredicto).toBe('auditoria_completa')
  })
})
