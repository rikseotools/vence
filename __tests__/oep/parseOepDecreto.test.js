// __tests__/oep/parseOepDecreto.test.js
// Parser PURO del texto libre `oep_decreto` → OEP estructuradas (F1 de T-108).
// Nace de que el 60% de las filas con OEP son multi-OEP concatenadas.

const { parseOepDecreto, ambitoDe } = require('../../scripts/oep/backfill-oep-entidad.cjs');

describe('parseOepDecreto — texto libre → OEP estructuradas', () => {
  test('multi-OEP estatal separada por comas e "y"', () => {
    const r = parseOepDecreto('RD 625/2023, RD 656/2024 y RD 651/2025');
    expect(r.map((x) => x.año)).toEqual([2023, 2024, 2025]);
    expect(r.every((x) => x.ambito === 'estatal')).toBe(true);
  });

  test('rango "YYYY-YYYY" se expande', () => {
    const r = parseOepDecreto('OEP 2023-2025');
    expect(r.map((x) => x.año)).toEqual([2023, 2024, 2025]);
  });

  test('separador "+" con decretos autonómicos y estatales mezclados', () => {
    const r = parseOepDecreto('Decreto 12/2026 (OEP 2026) + OEP 2025 + Decreto 23/2024');
    expect(r.map((x) => x.año)).toEqual([2026, 2025, 2024]);
    expect(r[0].ambito).toBe('autonomico');
  });

  test('OEP simple (una sola)', () => {
    const r = parseOepDecreto('RD 387/2026');
    expect(r).toHaveLength(1);
    expect(r[0].año).toBe(2026);
    expect(r[0].ambito).toBe('estatal');
  });

  test('"OEP 2022 y 2023" → dos años', () => {
    expect(parseOepDecreto('OEP 2022 y 2023').map((x) => x.año)).toEqual([2022, 2023]);
  });

  test('dedup: el mismo año+decreto no se repite', () => {
    const r = parseOepDecreto('OEP 2024 + OEP 2024');
    expect(r).toHaveLength(1);
  });

  test('vacío / sin años → []', () => {
    expect(parseOepDecreto('')).toEqual([]);
    expect(parseOepDecreto(null)).toEqual([]);
    expect(parseOepDecreto('pendiente de publicación')).toEqual([]);
  });

  test('ambitoDe: RD/RDL=estatal, Decreto=autonomico, resto null', () => {
    expect(ambitoDe('RD 625/2023')).toBe('estatal');
    expect(ambitoDe('Real Decreto 651/2025')).toBe('estatal');
    expect(ambitoDe('Decreto 12/2026')).toBe('autonomico');
    expect(ambitoDe('OEP 2024')).toBe(null);
  });
});
