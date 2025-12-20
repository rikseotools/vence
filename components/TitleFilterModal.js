// components/TitleFilterModal.js
'use client'

import { useState, useEffect } from 'react'

// Función para obtener descripciones de títulos constitucionales
const getTitleDescription = (titleNumber) => {
  const descriptions = {
    'Preliminar': 'Principios fundamentales del Estado',
    'I': 'Derechos y deberes fundamentales',
    'II': 'De la Corona',
    'III': 'De las Cortes Generales',
    'IV': 'Del Gobierno y la Administración',
    'V': 'De las relaciones entre el Gobierno y las Cortes Generales',
    'VI': 'Del Poder Judicial',
    'VII': 'Economía y Hacienda',
    'VIII': 'De la Organización Territorial del Estado',
    'IX': 'Del Tribunal Constitucional',
    'X': 'De la reforma constitucional',
    'ESTRUCTURA': 'Estructura de la Constitución'
  }
  
  return descriptions[titleNumber] || 'Título de la ley'
}

export default function TitleFilterModal({ isOpen, onClose, lawShortName, onTitleSelect }) {
  const [titles, setTitles] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && lawShortName) {
      loadTitles()
    }
  }, [isOpen, lawShortName])

  const loadTitles = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/law-titles?law=${lawShortName}`)
      if (!response.ok) {
        throw new Error('Error cargando títulos')
      }
      
      const data = await response.json()
      setTitles(data.titles || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleTitleClick = (title) => {
    onTitleSelect(title)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      
      <div className="relative mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            📚 Filtrar por Títulos - {lawShortName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-xl"
          >
            ✕
          </button>
        </div>
          
          <div className="p-6 overflow-y-auto max-h-[60vh]">
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-600">Cargando títulos...</p>
              </div>
            )}
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                <p className="text-red-600">❌ {error}</p>
              </div>
            )}
            
            {!loading && !error && titles.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-600">No hay títulos disponibles para esta ley.</p>
              </div>
            )}
            
            {!loading && !error && titles.length > 0 && (
              <div className="space-y-3">
                {titles.map((title, index) => (
                  <button
                    key={`${title.title_number}-${index}`}
                    onClick={() => handleTitleClick(title)}
                    className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                          Título {title.title_number}
                        </div>
                        <div className="text-sm text-gray-600 mb-3">
                          {title.section_name || getTitleDescription(title.title_number)}
                        </div>
                        <div className="text-xs text-blue-600">
                          {title.articles_count} artículo{title.articles_count !== 1 ? 's' : ''}: 
                          {title.articles_range && ` Art. ${title.articles_range}`}
                        </div>
                      </div>
                      <div className="text-blue-500 group-hover:text-blue-600 ml-4">
                        →
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
      </div>
    </div>
  )
}