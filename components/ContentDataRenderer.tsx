'use client'

/**
 * ContentDataRenderer — Componente centralizado para renderizar content_data
 *
 * Usado por ChartQuestion, PsychometricTestLayout, ExamLayout, OfficialExamLayout y debug page.
 * Un solo punto de renderizado para todos los tipos de content_data visuales.
 */

interface ContentDataRendererProps {
  contentData: Record<string, unknown> | null | undefined
}

interface TableData {
  title?: string
  headers?: string[]
  rows?: string[][]
}

export default function ContentDataRenderer({ contentData }: ContentDataRendererProps) {
  if (!contentData || Object.keys(contentData).length === 0) return null

  const tdData = contentData.table_data as TableData | undefined
  const instruction = contentData.instruction as string | undefined
  const instructions = contentData.instructions as string[] | undefined
  const textPassage = contentData.text_passage as string | undefined
  const imageBase64 = contentData.image_base64 as string | undefined

  if (!tdData && !instruction && !instructions && !textPassage && !imageBase64) return null

  return (
    <div className="mb-6">
      {/* Bloque de instrucciones (reglas paso a paso) */}
      {instructions && Array.isArray(instructions) && (
        <div className="bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
          <div className="text-gray-800 dark:text-gray-200 text-sm space-y-2">
            {instructions.map((line: string, i: number) => <p key={i}>{line}</p>)}
          </div>
        </div>
      )}

      {/* Pasaje de texto */}
      {textPassage && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
          <p className="text-gray-800 dark:text-gray-200 text-sm">{textPassage}</p>
        </div>
      )}

      {/* Imagen base64 (iconos, capturas pequeñas) */}
      {imageBase64 && (
        <div className="flex justify-center mb-4">
          <img src={imageBase64} alt="Imagen de la pregunta" className="max-h-32 border border-gray-300 dark:border-gray-600 rounded-lg p-2 bg-white" />
        </div>
      )}

      {/* Tabla con headers */}
      {tdData && tdData.headers && tdData.rows && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-4 mb-4">
          {tdData.title && <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-sm">{tdData.title}</h4>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-orange-300 dark:border-orange-600 text-xs">
              <thead>
                <tr className="bg-orange-100 dark:bg-orange-800/40">
                  {tdData.headers.map((h: string, i: number) => (
                    <th key={i} className="border border-orange-300 dark:border-orange-600 px-2 py-1 text-orange-800 dark:text-orange-300 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tdData.rows.map((row: string[], ri: number) => (
                  <tr key={ri}>
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} className="border border-orange-300 dark:border-orange-600 px-2 py-1 text-center text-gray-700 dark:text-gray-300 font-medium">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tabla sin headers (solo rows, ej: sinónimos) */}
      {tdData && !tdData.headers && tdData.rows && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-4 mb-4">
          {tdData.title && <h4 className="font-bold text-gray-900 dark:text-white mb-2">{tdData.title}</h4>}
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-orange-300 dark:border-orange-600">
              <tbody>
                {tdData.rows.map((row: string[], ri: number) => (
                  <tr key={ri}>
                    {row.map((cell: string, ci: number) => (
                      <td key={ci} className="border border-orange-300 dark:border-orange-600 px-4 py-3 text-center text-gray-700 dark:text-gray-300 font-medium">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Instrucción única (ej: "TEA + (mes invernal)") */}
      {instruction && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700 rounded-lg p-4 text-center mb-4">
          <p className="text-indigo-800 dark:text-indigo-300 font-bold text-lg">{instruction}</p>
        </div>
      )}
    </div>
  )
}
