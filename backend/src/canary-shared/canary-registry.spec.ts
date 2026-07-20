import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import {
  CANARY_REGISTRY,
  assertRegistryBounding,
  canariesMissingAlertRule,
} from './canary-registry';
import { canaryEventType } from './canary-probe';

const alertRulesSrc = readFileSync(join(__dirname, '..', 'alerts', 'alert-rules.ts'), 'utf-8');

// Directorios canary-* reales (fuente de verdad del sistema de ficheros), excluyendo
// la infraestructura (runner/shared). Cruzar contra el registro cierra el punto ciego:
// un canary nuevo sin entrada, o una entrada sin canary, rompe el build.
const INFRA = new Set(['runner', 'shared']);
const canaryDirs = readdirSync(join(__dirname, '..'))
  .filter((d) => d.startsWith('canary-') && statSync(join(__dirname, '..', d)).isDirectory())
  .map((d) => d.replace(/^canary-/, ''))
  .filter((n) => !INFRA.has(n))
  .sort();

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

  it('COMPLETITUD: el registro cubre TODOS los canary-*/ (ni huérfanos ni fantasmas)', () => {
    // Si alguien añade backend/src/canary-<x>/ sin registrarlo (o borra un canary
    // dejando la entrada), esto falla. Es lo que hace que "imposible meter un
    // write-canary sin cota ni alerta" sea VERDAD: el registro no puede quedarse corto.
    const registered = CANARY_REGISTRY.map((c) => c.name).sort();
    const orphanDirs = canaryDirs.filter((d) => !registered.includes(d));
    const phantomEntries = registered.filter((r) => !canaryDirs.includes(r));
    expect({ orphanDirs, phantomEntries }).toEqual({ orphanDirs: [], phantomEntries: [] });
  });
});
