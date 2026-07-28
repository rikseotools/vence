/**
 * Qué se puede aceptar como PRUEBA de la fecha de un hito (T-256).
 *
 * El riesgo que fija esta suite no es escribir de más, es escribir algo que PAREZCA verificado:
 * una url a la portada del boletín y una cita genérica cierran el hallazgo del detector y dejan
 * la fecha inventada en la landing, ahora con sello de oficial. Por eso la regla dura es que la
 * cita NOMBRE la fecha.
 */
const {
  validarAcreditacion,
  citaMencionaFecha,
  urlEsDocumento,
} = require('../../../lib/convocatoria/hitoAcreditacion.js')

const hito = {
  titulo: 'Examen (primer ejercicio)',
  fecha: '2026-11-07',
}
// La frase real del BOJG serie C núm. 116 que estrenó la herramienta.
const CITA_REAL =
  'Segundo. Señalar y convocar a los aspirantes admitidos para la realización del primer ejercicio ' +
  'del proceso selectivo para el sábado 7 de noviembre de 2026, a las 10:00 horas, en las Facultades ' +
  'de Economía y Empresa y de Derecho de Oviedo.'
const URL_REAL = 'https://agoranet.jgpa.es/documentos/Boletines/PDF/12C-116.pdf'

describe('validarAcreditacion — la cita tiene que sostener la fecha', () => {
  it('acepta la cita literal del boletín que fija esa fecha', () => {
    const r = validarAcreditacion({ hito, url: URL_REAL, cita: CITA_REAL })
    expect(r.ok).toBe(true)
  })

  it('RECHAZA una cita larga y creíble que no nombra la fecha (el fallo que importa)', () => {
    const cita =
      'Resolución del Presidente por la que se aprueba la lista definitiva de aspirantes admitidos ' +
      'y excluidos del proceso selectivo para el acceso a once plazas del Cuerpo Administrativo.'
    const r = validarAcreditacion({ hito, url: URL_REAL, cita })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/no menciona la fecha/i)
  })

  it('RECHAZA la portada del boletín aunque la cita sea correcta', () => {
    const r = validarAcreditacion({ hito, url: 'https://www.jgpa.es/procesos-selectivos', cita: CITA_REAL })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/no apunta a un documento/i)
  })

  it('RECHAZA una cita demasiado corta para ser una cita', () => {
    const r = validarAcreditacion({ hito, url: URL_REAL, cita: '7 de noviembre de 2026' })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/demasiado corta/i)
  })

  it('un hito que se confiesa PREVISIÓN no se acredita: se degrada', () => {
    const previsto = { titulo: 'Examen (previsión, pendiente de fecha oficial)', fecha: '2026-11-07' }
    const r = validarAcreditacion({ hito: previsto, url: URL_REAL, cita: CITA_REAL })
    expect(r.ok).toBe(false)
    expect(r.motivo).toMatch(/degrada/i)
  })
})

describe('citaMencionaFecha — las formas en que un boletín escribe una fecha', () => {
  it.each([
    ['7 de noviembre de 2026', true],
    ['07 de noviembre de 2026', true],
    ['el sábado 7 de noviembre, a las 10:00', true],
    ['07/11/2026', true],
    ['7-11-2026', true],
    ['2026-11-07', true],
    ['el 8 de noviembre de 2026', false],
    ['noviembre de 2026', false], // el mes solo NO fija el día: es justo el caso de Madrid
  ])('%s → %s', (cita, esperado) => {
    expect(citaMencionaFecha(cita, '2026-11-07')).toBe(esperado)
  })

  it('acepta el mes en gallego y en catalán (boletines en lengua propia)', () => {
    expect(citaMencionaFecha('o 20 de setembro de 2026', '2026-09-20')).toBe(true)
    expect(citaMencionaFecha('el 20 de setembre de 2026', '2026-09-20')).toBe(true)
  })

  it('sin fecha válida no inventa una coincidencia', () => {
    expect(citaMencionaFecha('7 de noviembre de 2026', 'no-es-fecha')).toBe(false)
    expect(citaMencionaFecha('', '2026-11-07')).toBe(false)
  })
})

describe('urlEsDocumento — una portada no acredita', () => {
  it.each([
    ['https://agoranet.jgpa.es/documentos/Boletines/PDF/12C-116.pdf', true],
    ['https://www.xunta.gal/dog/Publicados/2025/20251125/AnuncioG0597-191125-0003_es.html', true],
    ['https://www.bocm.es/boletin/CM_Orden_BOCM/2026/07/13/BOCM-20260713-2.PDF', true],
    ['https://www.jgpa.es/procesos-selectivos', false],
    ['https://www.boe.es/', false],
    ['no-es-una-url', false],
    ['', false],
  ])('%s → %s', (url, esperado) => {
    expect(urlEsDocumento(url)).toBe(esperado)
  })
})
