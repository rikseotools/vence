// lib/api/sqlArrays.ts
// Helpers para pasar arrays JS a Postgres dentro de plantillas `sql``` de Drizzle.
//
// 🚨 POR QUÉ EXISTE ESTO: Drizzle interpola un array JS como params SUELTOS (spread),
// NO como un array Postgres. Por eso `sql`... = ANY(${arr}::uuid[])`` genera
// `($1)::uuid[]` (o `($1,$2)::uuid[]`) → casteo/sintaxis inválida → 500 en runtime.
// (No lo cazan los tests que mockean execute ni `sql.unsafe`, que bindea distinto.)
//
// SOLUCIÓN: construir un literal de array Postgres real `ARRAY[$1::uuid, ...]::uuid[]`
// con sql.join. Sirve para `= ANY(...)`, `@>`, `&&`, `unnest(...)` y es SEGURO con
// array vacío (`ARRAY[]::uuid[]`). Uso:
//   sql`... WHERE id = ANY(${pgUuidArray(ids)})`
//   sql`... FROM unnest(${pgUuidArray(ids)}) AS t(id)`
//   sql`... WHERE col @> ${pgUuidArray(ids)}`
import { sql, type SQL } from 'drizzle-orm'

export function pgUuidArray(values: readonly string[]): SQL {
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}::uuid`), sql`, `)}]::uuid[]`
}

export function pgTextArray(values: readonly (string | number)[]): SQL {
  return sql`ARRAY[${sql.join(values.map((v) => sql`${String(v)}::text`), sql`, `)}]::text[]`
}

export function pgIntArray(values: readonly number[]): SQL {
  return sql`ARRAY[${sql.join(values.map((v) => sql`${v}::int`), sql`, `)}]::int[]`
}
