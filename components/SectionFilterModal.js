// components/SectionFilterModal.js
'use client'

import { useState, useEffect } from 'react'
import { fetchLawSections } from '@/lib/teoriaFetchers'

export default function SectionFilterModal({ isOpen, onClose, lawSlug, onSectionSelect }) {
  const [sections, setSections] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (isOpen && lawSlug) {
      loadSections()
    }
  }, [isOpen, lawSlug])

  const loadSections = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const data = await fetchLawSections(lawSlug)
      setSections(data.sections || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSectionClick = (section) => {
    onSectionSelect(section)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/30" onClick={onClose} />
      
      <div className="relative mx-auto max-w-2xl w-full bg-white rounded-lg shadow-xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            📚 Filtrar por Títulos
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
          
          {!loading && !error && sections.length === 0 && (
            <div className="text-center py-8">
              <p className="text-gray-600">No hay títulos disponibles para esta ley.</p>
            </div>
          )}
          
          {!loading && !error && sections.length > 0 && (
            <div className="space-y-3">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => handleSectionClick(section)}
                  className="w-full text-left p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all group"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900 group-hover:text-blue-600 mb-2">
                        {section.title}
                      </div>
                      <div className="text-sm text-gray-600 mb-3">
                        {section.description}
                      </div>
                      {section.articleRange && (
                        <div className="text-xs text-blue-600">
                          Artículos {section.articleRange.start}-{section.articleRange.end}
                        </div>
                      )}
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