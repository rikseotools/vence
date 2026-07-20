import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CANARY_REGISTRY,
  assertRegistryBounding,
  canariesMissingAlertRule,
} from './canary-registry';
import { canaryEventType } from './canary-probe';

const alertRulesSrc = readFileSync(join(__dirname, '..', 'alerts', 'alert-rules.ts'), 'utf-8');

describe('CANARY_REGISTRY — guardarraíl', () => {
  it('INVARIANTE DE COTA: ningún write-canary sin acotar (anti-incidente 11/07)', () => {
    // Un write-canary que no declare bounding ≠ 'read-only' lanza aquí → build rojo.
    expect(() => assertRegistryBounding()).not.toThrow();
  });

  it('los writers son exactamente los 3 conocidos, con su molde de cota', () => {
    const writers = CANARY_REGISTRY.filter((c) => c.writesToProd).map((c) => `${c.name}:${c.bounding}`).sort();
    expect(writers).toEqual([
      'answer-save:unique-constraint',
      'save-contract:per-run-cleanup',
      'stats-pipeline:cap-prune',
    ]);
  });

  it('sin duplicados de name ni eventBase', () => {
    const names = CANARY_REGISTRY.map((c) => c.name);
    const bases = CANARY_REGISTRY.map((c) => c.eventBase);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(bases).size).toBe(bases.length);
  });

  it('eventBase en snake_case (deriva el event-type de observabilidad)', () => {
    for (const c of CANARY_REGISTRY) {
      expect(c.eventBase).toMatch(/^[a-z][a-z0-9_]*$/);
    }
  });

  it('el flag alertRule NO miente: coincide con la presencia real en alert-rules.ts', () => {
    // Mantiene el registro sincronizado con la realidad: si alguien añade/quita una
    // RULE_CANARY_*_FAILED sin actualizar el registro, esto lo caza.
    const drift = CANARY_REGISTRY.filter((c) => {
      const present = alertRulesSrc.includes(canaryEventType(c.eventBase, 'failed'));
      return present !== c.alertRule;
    }).map((c) => `${c.name} (declara alertRule=${c.alertRule}, en alert-rules.ts=${!c.alertRule})`);
    expect(drift).toEqual([]);
  });

  it('TRINQUETE de cobertura de alertas: los canaries SIN regla son exactamente los 5 conocidos (deuda P3)', () => {
    // Al añadir una RULE_CANARY_*_FAILED en P3, poner alertRule:true en el registro
    // y quitarlo de esta lista → el trinquete baja. Impide reintroducir un canary
    // que emite _failed sin alguien mirándolo.
    const missing = canariesMissingAlertRule().map((c) => c.name).sort();
    expect(missing).toEqual([
      'ai-model',
      'answer-premium',
      'competitor-mention',
      'por-leyes-scope',
      'psychometric-integrity',
    ]);
  });
});
