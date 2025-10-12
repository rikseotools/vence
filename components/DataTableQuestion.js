'use client'
import { useState, useEffect } from 'react'
import ChartQuestion from './ChartQuestion'

export default function DataTableQuestion({ 
  question, 
  onAnswer, 
  selectedAnswer, 
  showResult, 
  isAnswering,
  attemptCount = 0
}) {
  const [tableComponent, setTableComponent] = useState('')

  useEffect(() => {
    generateTableComponent()
  }, [question])

  const generateTableComponent = () => {
    if (!question.content_data?.table_data) return

    const tableData = question.content_data.table_data

    setTableComponent(
      <div className="w-full">
        {/* Datos del Seguro */}
        {tableData?.example_row && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">📋 Datos del Seguro:</h3>
            <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-200 dark:border-orange-700 rounded-lg p-4">
              <div className="flex justify-center">
                <table className="border-collapse">
                  <tbody>
                    <tr className="border border-orange-300 dark:border-orange-600">
                      <td className="border border-orange-300 dark:border-orange-600 px-4 py-2 bg-orange-100 dark:bg-orange-800/30 font-semibold text-center">
                        {tableData.example_row.cantidad}
                      </td>
                      <td className="border border-orange-300 dark:border-orange-600 px-4 py-2 bg-orange-100 dark:bg-orange-800/30 font-semibold text-center">
                        {tableData.example_row.tipo}
                      </td>
                      <td className="border border-orange-300 dark:border-orange-600 px-4 py-2 bg-orange-100 dark:bg-orange-800/30 font-semibold text-center">
                        {tableData.example_row.fecha}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Criterios */}
        {tableData?.criteria && (
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">📝 Criterios:</h3>
            <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {tableData.criteria.map((criterion, index) => (
                  <div key={index} className="bg-white dark:bg-gray-800 p-3 rounded-lg border border-blue-300 dark:border-blue-600">
                    <div className="font-bold text-blue-800 dark:text-blue-300 mb-1">
                      {criterion.column}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {criterion.rule}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tabla de Clasificación */}
        {tableData?.classification_table && (
          <div className="mb-4">
            <h3 className="font-bold text-gray-900 dark:text-white mb-3">🏷️ Tabla de Clasificación:</h3>
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg p-4">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-green-400 dark:border-green-600">
                  <thead>
                    <tr className="bg-green-100 dark:bg-green-800/40">
                      {tableData.classification_table.headers.map((header, index) => (
                        <th key={index} className="border border-green-400 dark:border-green-600 px-4 py-2 text-green-800 dark:text-green-300 font-semibold">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.classification_table.rows.map((row, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-green-25 dark:hover:bg-green-900/10">
                        {row.map((cell, cellIndex) => (
                          <td key={cellIndex} className="border border-green-400 dark:border-green-600 px-4 py-2 text-center text-gray-700 dark:text-gray-300">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Instrucciones adicionales */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
          <div className="text-center">
            <h4 className="font-bold text-yellow-800 dark:text-yellow-300 mb-2">
              📌 Instrucciones:
            </h4>
            <p className="text-yellow-700 dark:text-yellow-200 text-sm">
              Analiza la información del seguro y marca las columnas correspondientes según los criterios dados.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // Usar las explicaciones de la base de datos
  const explanationSections = question.content_data?.explanation_sections ? (
    <>
      {question.content_data.explanation_sections.map((section, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-blue-500 mb-4">
          <h5 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">{section.title}</h5>
          <div className="text-gray-700 dark:text-gray-300 text-sm whitespace-pre-line">
            {section.content.replace(/\\n/g, '\n')}
          </div>
        </div>
      ))}
    </>
  ) : (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border-l-4 border-gray-500">
      <h5 className="font-semibold text-gray-800 dark:text-gray-300 mb-2">📊 Análisis de Datos Tabulares</h5>
      <p className="text-gray-700 dark:text-gray-300 text-sm">
        Aplica los criterios dados a los datos de la tabla para determinar la clasificación correcta.
      </p>
    </div>
  )

  return (
    <ChartQuestion
      question={question}
      onAnswer={onAnswer}
      selectedAnswer={selectedAnswer}
      showResult={showResult}
      isAnswering={isAnswering}
      chartComponent={tableComponent}
      explanationSections={explanationSections}
      attemptCount={attemptCount}
    />
  )
}