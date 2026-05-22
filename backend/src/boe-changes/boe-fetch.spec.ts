import { extractLastUpdateFromBOE } from './boe-fetch';
import { createInitialStats, formatBytes } from './boe-changes.types';

describe('extractLastUpdateFromBOE', () => {
  it('extrae la fecha del patrón estándar del BOE', () => {
    const html = '<p>Última actualización publicada el 20/05/2026</p>';
    expect(extractLastUpdateFromBOE(html)).toBe('20/05/2026');
  });

  it('extrae la fecha con entidades HTML en el texto', () => {
    const html = '...Texto consolidado. &Uacute;ltima actualizaci&oacute;n publicada el 14/07/2025...';
    expect(extractLastUpdateFromBOE(html)).toBe('14/07/2025');
  });

  it('devuelve null si no hay fecha de actualización', () => {
    expect(extractLastUpdateFromBOE('<html>sin fecha aquí</html>')).toBeNull();
  });

  it('devuelve null con HTML vacío', () => {
    expect(extractLastUpdateFromBOE('')).toBeNull();
  });
});

describe('formatBytes', () => {
  it('formatea KB por debajo de 1 MB', () => {
    expect(formatBytes(2048)).toBe('2.0 KB');
  });

  it('formatea MB a partir de 1 MB', () => {
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
  });
});

describe('createInitialStats', () => {
  it('inicializa todos los contadores a cero salvo el total', () => {
    const stats = createInitialStats(475);
    expect(stats.total).toBe(475);
    expect(stats.checked).toBe(0);
    expect(stats.changesDetected).toBe(0);
    expect(stats.errors).toBe(0);
  });
});
