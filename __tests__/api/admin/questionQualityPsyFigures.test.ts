/**
 * Check `psy_figures` de /api/admin/question-quality: psicotécnicas que dependen de un apoyo
 * visual (tabla o gráfico) y no tienen NADA que mostrar.
 *
 * Qué defiende: el check existía pero filtraba por FRASES del enunciado ("serie de figuras",
 * "observe la figura", "sustituya a la interrogación"…), una lista pensada para figuras y
 * series. Una tabla de datos que pregunta "¿qué departamento tiene la media mayor de duración
 * en días?" no contiene ninguna de esas frases → quedaba fuera del check.
 *
 * Consecuencia real (16/07/2026): 12 preguntas del examen oficial del 23/05 (un import escribió
 * la tabla como rows/headers en la raíz de content_data en vez de content_data.tables[], que es
 * lo que documenta importar-examen-oficial-completo.md §7.2) estuvieron ~2 meses SIN mostrar la
 * tabla. El panel de calidad no las veía. Las cazaron dos usuarias el mismo día.
 *
 * El criterio pasa a ser el SUBTIPO. Y el test fija el límite por los dos lados: debe cazar la
 * tabla muda, y NO debe cazar 'calculation' (2.055 activas sin content_data ni imagen, correctas:
 * el cálculo va en el enunciado). Un detector que las marcara sería peor que no tenerlo.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

const src = readFileSync(join(process.cwd(), 'app/api/admin/question-quality/route.ts'), 'utf8')

// Aislamos el bloque del contador psy_figures
const psyFigures = src.slice(
  src.indexOf('question_subtype IN (\'data_tables\''),
  src.indexOf('as psy_figures')
)

describe('psy_figures — decide por SUBTIPO, no por frases del enunciado', () => {
  test('filtra por los subtipos que dependen de tabla o gráfico', () => {
    expect(psyFigures).toContain("'data_tables'")
    expect(psyFigures).toContain("'bar_chart'")
    expect(psyFigures).toContain("'line_chart'")
    expect(psyFigures).toContain("'pie_chart'")
    expect(psyFigures).toContain("'mixed_chart'")
  })

  test('NO vuelve a filtrar por frases del enunciado (la regresión de 2 meses)', () => {
    // Si alguien reintroduce el filtro léxico, las tablas mudas vuelven a ser invisibles.
    for (const frase of [
      'serie de figuras',
      'observe la figura',
      'sustituya a la interrogaci',
      'estructura lógica de la serie',
      'siguiente imagen',
    ]) {
      expect(psyFigures).not.toContain(frase)
    }
  })

  test('exige que NO haya imagen de rescate (image_url) para contarla', () => {
    // El fallback a imagen es legítimo: si hay imagen, la pregunta se ve y no es un hallazgo.
    expect(psyFigures).toContain('image_url IS NULL')
  })

  test('reconoce todos los formatos renderables de content_data', () => {
    // Si falta uno, las preguntas que lo usen se contarían como rotas estando bien.
    for (const formato of [
      'table_data', 'tables', 'chart_data', 'categories', 'age_groups',
      'instructions', 'sequence', 'pairs', 'image_base64',
      'text_passage', 'criteria', 'example_row', 'classification_table',
    ]) {
      expect(psyFigures).toContain(`content_data->'${formato}' IS NULL`)
    }
  })

  test('NO alcanza a los subtipos que se responden con el enunciado (anti falsos positivos)', () => {
    // 'calculation' (2.055 activas) y 'analogy' (978) no llevan content_data ni imagen y están
    // BIEN. Si entraran en el filtro, el panel daría miles de hallazgos falsos y se ignoraría.
    expect(psyFigures).not.toContain("'calculation'")
    expect(psyFigures).not.toContain("'analogy'")
    expect(psyFigures).not.toContain("'text_question'")
  })
})
