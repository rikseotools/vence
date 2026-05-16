// components/dataTableHasContent.ts
//
// Predicado puro que decide si una pregunta data_tables tiene `content_data`
// suficiente para renderizarse como tabla estructurada, o si debe caer al
// fallback de imagen (image_url).
//
// **Invariante del sistema** (verificada por tests):
// - hasRenderableContentData(cd) === true  → DataTableQuestion produce JSX,
//   ChartQuestion lo renderiza y OMITE la imagen.
// - hasRenderableContentData(cd) === false → DataTableQuestion devuelve null,
//   ChartQuestion cae a ContentDataRenderer con image_url (si existe).
//
// Si alguien rompe la condición (ej. añade un nuevo formato de content_data
// y olvida añadirlo aquí), las preguntas que lo usen pasan a renderizarse
// como imagen aunque tengan datos estructurados. Los tests cubren los formatos
// conocidos para detectar regresiones.

export function hasRenderableContentData(
  contentData: Record<string, unknown> | null | undefined,
): boolean {
  if (!contentData || typeof contentData !== 'object') return false

  // Formatos soportados por DataTableQuestion:
  //   - table_data (formato legacy con headers+rows o tabla1+tabla2 anidados)
  //   - tables (formato múltiples tablas)
  //   - example_row / criteria / classification_table (formatos directos: seguros)
  //   - instruction / instructions (bloques de reglas)
  //   - text_passage (pasaje textual)
  return !!(
    contentData.table_data ||
    contentData.tables ||
    contentData.example_row ||
    contentData.criteria ||
    contentData.classification_table ||
    contentData.instruction ||
    contentData.instructions ||
    contentData.text_passage
  )
}
