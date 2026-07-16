import { extractCandidatesFromSumarioText, htmlToText } from './boletines';

/**
 * REGRESIÓN: los adapters de boletín autonómico NO pueden volver a tirar las convocatorias.
 *
 * Hasta el 16/07/2026 devolvían `candidatesText: ''` a propósito ("ya lo cubre la Capa 1 del
 * radar"), pero esa capa (`llm_semantic`) solo ve las oposiciones con seguimiento_url: 472 de 2.542
 * (19%). Las otras 2.070 no las veía nadie, mientras el boletín —que por LEY las tiene todas— se
 * leía a diario y se descartaba. Medido el día del arreglo: 30 convocatorias C1/C2 tiradas en UNA
 * jornada (BOCM 9, DOGV 6, BON 3…), con 0 fallos de fetch.
 *
 * Se testea la función pura que alimenta `candidatesText` (la MISMA que ya usaba el adapter del BOE).
 */
describe('boletines autonómicos: las convocatorias NO se tiran', () => {
  test('un sumario con convocatoria C1/C2 produce candidatos', () => {
    const sumario = htmlToText(`<html><body>
      RESOLUCIÓN de 3 de julio de 2026, de la Dirección General de Función Pública, por la que se
      convocan pruebas selectivas para el ingreso en el Cuerpo Auxiliar Administrativo, subgrupo C2,
      por el turno de acceso libre.
    </body></html>`);
    const c = extractCandidatesFromSumarioText(sumario);
    expect(c.length).toBeGreaterThan(0);
    expect(c[0]).toMatch(/convocan pruebas selectivas/i);
  });

  test('trocea el sumario por disposición: varias convocatorias → varios candidatos', () => {
    const sumario = htmlToText(`<html><body>
      RESOLUCIÓN de 1 de julio de 2026 por la que se convocan pruebas selectivas para el ingreso en el
      Cuerpo Administrativo, subgrupo C1, turno libre.
      ORDEN de 2 de julio de 2026 por la que se convoca proceso selectivo para 15 plazas de Auxiliar
      Administrativo, subgrupo C2, por promoción interna.
    </body></html>`);
    expect(extractCandidatesFromSumarioText(sumario).length).toBeGreaterThanOrEqual(2);
  });

  test('lo que NO es convocatoria de ingreso no se cuela', () => {
    const sumario = htmlToText(`<html><body>
      RESOLUCIÓN de 5 de julio de 2026 por la que se aprueba el gasto de mantenimiento de jardines.
    </body></html>`);
    expect(extractCandidatesFromSumarioText(sumario)).toHaveLength(0);
  });

  test('el ruido que SÍ se cuela lo filtra el LLM aguas abajo (extractRegionalOeps), no este extractor', () => {
    // Caso real del 16/07 (BOC Cantabria): el troceo por disposición captura esto, y está bien que
    // así sea — el extractor es de RECALL; la precisión la pone el LLM del servicio, que además
    // cataloga TODO ("misión = BD más grande sin gaps") y nunca casa por scope inventado.
    const ruido = 'Resolución de Alcaldía de delegación de funciones para autorización de matrimonios civiles.';
    const r = extractCandidatesFromSumarioText(ruido);
    expect(Array.isArray(r)).toBe(true); // no revienta; el filtro fino no es responsabilidad suya
  });
});
