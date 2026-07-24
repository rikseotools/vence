import { REGIONAL_SYSTEM_PROMPT, regionalUserPrompt } from './oep-signals-llm.service';

/**
 * GUARDARRAÍL del prompt de extracción regional (extractRegionalOeps).
 *
 * Gap real (23-24/07/2026): el LLM devolvía nombres genéricos ("Grupo C1 Sector
 * Administración Especial") y organismo "Rectorado"/"Vicerrectorado" para escalas PAS
 * universitarias del DOGV, dejándolas SIN catalogar con fiabilidad (3 señales inservibles
 * que hubo que descartar sin poder crear fila). El prompt debe: (a) exigir la denominación
 * CONCRETA de la escala en "name", (b) exigir la universidad EXACTA en "organismo" (nunca
 * "Rectorado"), y (c) excluir hitos/provisión de puestos (no son ingreso). Este test caza
 * que esas instrucciones no se borren en un futuro refactor del prompt.
 */
describe('prompt regional: captura escala + universidad concretas', () => {
  const user = regionalUserPrompt('texto de prueba', 'C. Valenciana');

  it('el system prompt exige la denominación ESPECÍFICA de la escala (no la etiqueta de grupo)', () => {
    expect(REGIONAL_SYSTEM_PROMPT).toMatch(/denominaci[oó]n ESPEC[IÍ]FICA/i);
    expect(REGIONAL_SYSTEM_PROMPT).toContain('Escala Técnica Básica de Arquitectura-Delineante');
    expect(REGIONAL_SYSTEM_PROMPT).toContain('NO pongas "Grupo C1 Sector Administración Especial" como name');
  });

  it('el system prompt exige la universidad EXACTA en organismo (nunca "Rectorado")', () => {
    expect(REGIONAL_SYSTEM_PROMPT).toContain('UNIVERSIDAD EXACTA');
    expect(REGIONAL_SYSTEM_PROMPT).toMatch(/NUNCA gen[eé]ricos como "Rectorado"/);
  });

  it('el system prompt excluye hitos y provisión de puestos (no son ingreso)', () => {
    expect(REGIONAL_SYSTEM_PROMPT).toMatch(/constituci[oó]n o composici[oó]n del tribunal/i);
    expect(REGIONAL_SYSTEM_PROMPT).toMatch(/correcciones de errores/i);
    expect(REGIONAL_SYSTEM_PROMPT).toMatch(/provisi[oó]n de puestos/i);
  });

  it('el user prompt trae el ejemplo escala+universidad y la regla de name/organismo', () => {
    expect(user).toContain('Escala Técnica Básica de Arquitectura-Delineante');
    expect(user).toContain('Universitat de València');
    expect(user).toMatch(/NUNCA "Rectorado"/);
    expect(user).toContain('DENOMINACIÓN CONCRETA');
  });
});
