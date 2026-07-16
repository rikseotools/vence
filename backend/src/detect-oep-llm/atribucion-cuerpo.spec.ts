import { classifyFamily } from '../oep-signals/oep-match';

/**
 * Guardarraíl de ATRIBUCIÓN: una señal no puede colgarse de una oposición de otra familia.
 *
 * Casos REALES del 16/07/2026. El sensor recorre oposiciones y atribuye lo que extrae a aquella
 * cuyo seguimiento_url estaba leyendo; muchos de esos URL son el TABLÓN GENERAL de la entidad y
 * listan varios cuerpos. `cuerpoDetectado` se usaba como decoración en el resumen y no se comparaba
 * con nada, así que la señal acababa en la fila equivocada.
 */
// Réplica EXACTA de la condición del servicio (misma función real, sin copiar lógica nueva).
const seAtribuye = (cuerpo: string | null, slug: string): boolean => {
  if (!cuerpo) return true;
  const f = classifyFamily(cuerpo);
  const g = classifyFamily(slug.replace(/-/g, ' '));
  return !(f && g && f !== g);
};

describe('atribución de señal ↔ oposición (familia)', () => {
  test('REGRESIÓN: "Administrativo/a por Promoción Interna" (C1) NO se atribuye a la fila de Auxiliar (C2)', () => {
    expect(seAtribuye('Administrativo/a por Promoción Interna', 'auxiliar-administrativo-ayuntamiento-valladolid')).toBe(false);
  });

  test('REGRESIÓN: el caso URV que SÍ se aplicó el 25/06 y corrompió una fila', () => {
    expect(seAtribuye('Administratiu/va - Escala Administrativa, subgrup C1', 'auxiliar-administrativo-universidad-rovira-virgili')).toBe(false);
  });

  test('las atribuciones CORRECTAS no se rompen (sin falsos negativos)', () => {
    expect(seAtribuye('Auxiliar Administrativo de Función Administrativa del Servicio Madrileño de Salud (SERMAS)', 'auxiliar-administrativo-sermas')).toBe(true);
    expect(seAtribuye('Administrativo/a del Gobierno de Navarra', 'administrativo-navarra')).toBe(true);
    expect(seAtribuye('Subinspector/a de la Policía Municipal', 'subinspector-policia-municipal-valladolid')).toBe(true);
  });

  test('sin cuerpo detectado no se puede comprobar → se mantiene el comportamiento actual', () => {
    expect(seAtribuye(null, 'auxiliar-administrativo-sermas')).toBe(true);
  });

  test('REGLA ESTRECHA a propósito: familia desconocida NO bloquea (rechazaría 56 de 129 señales legítimas)', () => {
    // "Cuerpo Facultativo Superior … Veterinario/a" no es ninguna de nuestras 12 familias → null.
    // Bloquear por null convertiría en descubrimientos a ujier, veterinario, bombero… (43% medido).
    expect(seAtribuye('Cuerpo Facultativo Superior de Administración Especial - Veterinario/a',
      'cuerpo-facultativo-superior-de-administracion-especial-gobierno-de-la-rioja')).toBe(true);
  });

  test('LÍMITE CONOCIDO: misma familia y otra escala se escapa (Inspector vs agente) → lo cubre el guardarraíl', () => {
    // Ambos son policia_local. Esto NO lo caza la familia; lo caza senal_cuerpo_no_cuadra + criterio.
    expect(seAtribuye('Inspector/a de la Policía Municipal', 'policia-local-valladolid')).toBe(true);
  });
});
