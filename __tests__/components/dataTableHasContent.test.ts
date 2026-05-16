// __tests__/components/dataTableHasContent.test.ts
//
// Cubre la INVARIANTE clave de renderizado de psicotécnicas data_tables:
//
//   hasRenderableContentData(cd) === true  →  el componente produce JSX,
//   ChartQuestion lo renderiza y NO muestra la imagen.
//
//   hasRenderableContentData(cd) === false →  el componente devuelve null,
//   ChartQuestion cae a ContentDataRenderer con image_url.
//
// Si alguien añade un nuevo formato de content_data (ej. matrix_table) y
// olvida añadirlo al predicado, las preguntas que lo usen se renderizarán
// como imagen aunque tengan datos. Esto detecta esa regresión.
//
// Contexto: las 14 preguntas spot-the-difference del catálogo psico-madrid
// (auditadas 16/05/2026) usan `content_data.tables`. Sin este predicado
// funcionando, todas pasan a renderizarse como JPG y se pierde la mejora
// de accesibilidad/legibilidad.

import { hasRenderableContentData } from '@/components/dataTableHasContent'

describe('hasRenderableContentData', () => {
  describe('debe ser false cuando NO hay datos renderizables', () => {
    it('null', () => expect(hasRenderableContentData(null)).toBe(false))
    it('undefined', () => expect(hasRenderableContentData(undefined)).toBe(false))
    it('objeto vacío {}', () => expect(hasRenderableContentData({})).toBe(false))
    it('objeto con campos irrelevantes', () => {
      expect(hasRenderableContentData({ foo: 'bar', baz: 123 })).toBe(false)
    })
  })

  describe('debe ser true para CADA formato soportado', () => {
    it('formato "tables" (múltiples tablas — usado por las 14 preguntas)', () => {
      const cd = { tables: [{ title: 'ORIGINAL', headers: ['a'], rows: [['x']] }] }
      expect(hasRenderableContentData(cd)).toBe(true)
    })

    it('formato "table_data" (legacy con headers + rows)', () => {
      const cd = { table_data: { headers: ['a'], rows: [['x']] } }
      expect(hasRenderableContentData(cd)).toBe(true)
    })

    it('formato "table_data.tabla1+tabla2" (flores)', () => {
      const cd = { table_data: { tabla1: { rows: [] }, tabla2: { rows: [] } } }
      expect(hasRenderableContentData(cd)).toBe(true)
    })

    it('formato directo "example_row" (seguros)', () => {
      expect(hasRenderableContentData({ example_row: { cantidad: 1 } })).toBe(true)
    })

    it('formato directo "criteria"', () => {
      expect(hasRenderableContentData({ criteria: ['a', 'b'] })).toBe(true)
    })

    it('formato directo "classification_table"', () => {
      expect(hasRenderableContentData({ classification_table: { headers: [], rows: [] } })).toBe(true)
    })

    it('"instruction" (bloque de reglas)', () => {
      expect(hasRenderableContentData({ instruction: 'Lee atentamente' })).toBe(true)
    })

    it('"instructions" (array de reglas)', () => {
      expect(hasRenderableContentData({ instructions: ['paso 1', 'paso 2'] })).toBe(true)
    })

    it('"text_passage" (pasaje textual)', () => {
      expect(hasRenderableContentData({ text_passage: 'Era una vez...' })).toBe(true)
    })
  })

  describe('caso real — las 14 preguntas spot-the-difference psico-madrid', () => {
    // Estructura exacta que se aplicó a q_672308...q_672328 el 16/05/2026
    const realContentData = {
      tables: [
        {
          title: 'ORIGINAL',
          headers: ['Especialidades', 'Planta y puerta'],
          rows: [
            ['Alergología', '2ª 235 - 267'],
            ['Anatomía Patológica', '3ª 356 - 367'],
            // ...
          ],
        },
        {
          title: 'COPIA',
          headers: ['Especialidades', 'Planta y puerta'],
          rows: [
            ['Alergologia', '2ª 235 - 267'],
            ['Anatomía Patológica', '3ª 356 - 357'],
          ],
        },
      ],
    }

    it('se considera renderizable → tabla HTML, no imagen JPG', () => {
      expect(hasRenderableContentData(realContentData)).toBe(true)
    })
  })

  describe('robustez frente a entradas raras', () => {
    it('"tables" con array vacío también es renderizable (el componente decide qué pintar)', () => {
      // Decisión deliberada: si hay clave "tables" presente — aunque sea array
      // vacío — se asume intención de mostrar tablas y NO caer a imagen.
      expect(hasRenderableContentData({ tables: [] })).toBe(true)
    })

    it('"table_data" como string (malformado) — sigue siendo "presente"', () => {
      // El predicado solo decide si hay intención de mostrar tabla; el
      // componente puede manejar el caso malformado.
      expect(hasRenderableContentData({ table_data: 'broken' as unknown as object })).toBe(true)
    })

    it('no es objeto (string) → false', () => {
      expect(hasRenderableContentData('not an object' as unknown as Record<string, unknown>)).toBe(false)
    })
  })
})
