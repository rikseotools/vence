// __tests__/guardrails/schemaDumpFresco.guardrail.test.ts
// [T-644] El dump de esquema que restaura la BD efímera de CI (decisión de Manuel, #123: pg_dump
// --schema-only periódico, NO replay de las 282 migraciones) tiene que estar VIVO, no solo
// presente. "Un dump viejo no da error, da un verde que no significa nada — que es como estas 10
// suites llegaron a llevar años mudas." Este test corre en el job `unit` (rápido, sin BD:
// __tests__/guardrails NO está en los testPathIgnorePatterns de test:unit) y FALLA si el dump
// falta o si lleva más de UMBRAL_DIAS_DEFECTO sin refrescarse — antes de que el job de
// integración efímera llegue siquiera a restaurarlo.
import * as fs from 'fs'
import * as path from 'path'
import { veredictoFrescura, UMBRAL_DIAS_DEFECTO } from '../../lib/ci/schemaDumpFreshness'

const RUTA_DUMP = path.resolve(__dirname, '../../supabase/schema-ci/schema.sql')

describe('Guardarraíl — el dump de esquema de la BD efímera de CI no está viejo', () => {
  it(`existe supabase/schema-ci/schema.sql y no lleva más de ${UMBRAL_DIAS_DEFECTO} días sin regenerarse`, () => {
    let contenido: string
    try {
      contenido = fs.readFileSync(RUTA_DUMP, 'utf8')
    } catch {
      throw new Error(
        `No existe ${RUTA_DUMP}. Generarlo con: node scripts/ci/generar-dump-esquema.cjs ` +
          '(necesita una URL de lectura del esquema de RDS; ver el propio script).',
      )
    }
    const v = veredictoFrescura(contenido, new Date())
    if (!v.fresco) {
      throw new Error(
        `El dump de esquema de la BD efímera no está fresco: ${v.motivo}. ` +
          'Regenerarlo con: node scripts/ci/generar-dump-esquema.cjs',
      )
    }
    expect(v.fresco).toBe(true)
  })
})
