/**
 * `filasAfectadas` — el contador que hacía que los drenadores dijeran 0. (T-613)
 *
 * Los casos NO son inventados: cada uno reproduce una forma de resultado real
 * medida contra RDS con `postgres-js` (ver `scratchpad/prueba-count.cjs` en la
 * ficha), que es lo que distingue este test de uno que fija la implementación.
 */
import { filasAfectadas } from './filasAfectadas';

/** Lo que devuelve postgres-js en un DELETE/UPDATE **sin** RETURNING: array vacío + `count`. */
function resultadoPostgresJsSinReturning(count: number): unknown {
  const arr: unknown[] = [];
  Object.assign(arr, { count, command: 'DELETE' });
  return arr;
}

/** Con RETURNING: postgres-js trae las filas Y `count` con el mismo número. */
function resultadoPostgresJsConReturning(filas: number): unknown {
  const arr: unknown[] = Array.from({ length: filas }, (_, i) => ({ id: i }));
  Object.assign(arr, { count: filas, command: 'DELETE' });
  return arr;
}

describe('filasAfectadas (T-613)', () => {
  it('EL CASO DEL DEFECTO: postgres-js sin RETURNING borró 50.000 y el código leía 0', () => {
    const res = resultadoPostgresJsSinReturning(50_000);

    // Lo que hacía el código viejo, para que quede escrito por qué esto existe:
    const viejo =
      (res as { rowCount?: number }).rowCount ?? (res as unknown[]).length ?? 0;
    expect(viejo).toBe(0);

    expect(filasAfectadas(res)).toBe(50_000);
  });

  it('con RETURNING da lo mismo por los dos caminos (por eso el patrón parecía correcto)', () => {
    expect(filasAfectadas(resultadoPostgresJsConReturning(7))).toBe(7);
  });

  it('un DELETE que no tocó nada es 0, no «no se pudo medir»', () => {
    expect(filasAfectadas(resultadoPostgresJsSinReturning(0))).toBe(0);
  });

  it('node-postgres (rowCount) sigue funcionando: la red por si se cambia de driver', () => {
    expect(filasAfectadas({ rowCount: 42, command: 'UPDATE' })).toBe(42);
  });

  it('array pelado sin metadatos: cae a length (resultado envuelto por otra capa)', () => {
    expect(filasAfectadas([{ id: 1 }, { id: 2 }])).toBe(2);
  });

  it('null/undefined/valores raros no explotan ni inventan un número', () => {
    expect(filasAfectadas(null)).toBe(0);
    expect(filasAfectadas(undefined)).toBe(0);
    expect(filasAfectadas({})).toBe(0);
    expect(filasAfectadas({ count: 'muchas' })).toBe(0);
    expect(filasAfectadas({ count: NaN })).toBe(0);
    expect(filasAfectadas({ count: -1 })).toBe(0);
  });

  it('`count` manda sobre `rowCount` si por lo que sea vinieran los dos', () => {
    expect(filasAfectadas({ count: 10, rowCount: 0 })).toBe(10);
  });
});
