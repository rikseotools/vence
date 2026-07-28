import { sql, type SQL } from 'drizzle-orm';

/**
 * Helpers para pasar arrays JS a Postgres dentro de plantillas `sql``` de Drizzle.
 *
 * 🚨 POR QUÉ EXISTE: Drizzle interpola un array JS como parámetros SUELTOS (spread),
 * NO como un array de Postgres. `sql`... = ANY(${arr})`` genera `ANY(($1,$2,$3))` y
 * Postgres responde **"op ANY/ALL (array) requires array on right side"**. Al
 * insertar en una columna `uuid[]` el error es otro pero igual de fatal: **"column
 * is of type uuid[] but expression is of type record"**.
 *
 * ⚠️ ESTO ES UN ESPEJO de `lib/api/sqlArrays.ts` (raíz del repo). El backend compila
 * con `rootDir: src` y no puede importar de la raíz. El frontend aprendió esta
 * lección hace tiempo y construyó el helper; **el backend nunca lo recibió**, y por
 * eso el barrido antifraude llevaba desde el 21/07/2026 fallando TODAS las noches
 * (7 de 7, cero éxitos) — moría en su primer detector, así que ninguno de los cinco
 * llegó a ejecutarse jamás.
 *
 * LO QUE NO LO CAZA, y conviene recordarlo antes de confiar en un test verde:
 * cualquier prueba que MOCKEE `execute`. La forma del SQL solo se ve ejecutándolo
 * contra Postgres de verdad — por eso existe `scripts/canary-fraud-sweep.cjs`.
 *
 * SOLUCIÓN: construir un literal `ARRAY[$1::uuid, ...]::uuid[]` real. Sirve para
 * `= ANY(...)`, `@>`, `&&`, `unnest(...)`, y para asignar a columnas array. Seguro
 * con array vacío (`ARRAY[]::uuid[]`).
 */
export function pgUuidArray(values: readonly string[]): SQL {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}::uuid`),
    sql`, `,
  )}]::uuid[]`;
}

export function pgTextArray(values: readonly (string | number)[]): SQL {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${String(v)}::text`),
    sql`, `,
  )}]::text[]`;
}

export function pgIntArray(values: readonly number[]): SQL {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}::int`),
    sql`, `,
  )}]::int[]`;
}
