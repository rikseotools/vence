'use client'

import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import PsychometricTestLayout from '@/components/PsychometricTestLayout'

export default function PsychometricTestPage() {
  const { categoria } = useParams()
  const searchParams = useSearchParams()
  const { user, supabase } = useAuth()
  const [questions, setQuestions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    async function loadPsychometricQuestions() {
      try {
        const sectionsParam = searchParams.get('sections')
        const selectedSections = sectionsParam ? sectionsParam.split(',') : null
        
        console.log('🔍 Loading psychometric questions for category:', categoria)
        console.log('🎯 Selected sections:', selectedSections)
        
        // Build query with section filtering if specified
        let query = supabase
          .from('psychometric_questions')
          .select(`
            *,
            psychometric_categories!inner(category_key, display_name),
            psychometric_sections!inner(section_key, display_name)
          `)
          .eq('psychometric_categories.category_key', categoria)
          .eq('is_active', true)
        
        // Add section filter if specific sections are selected
        if (selectedSections && selectedSections.length > 0) {
          query = query.in('psychometric_sections.section_key', selectedSections)
        }
        
        const { data, error } = await query.order('created_at', { ascending: false })

        if (error) {
          console.error('❌ Error loading psychometric questions:', error)
          setError('Error al cargar las preguntas psicotécnicas')
          return
        }

        if (!data || data.length === 0) {
          console.log('⚠️ No questions found for category:', categoria)
          setError('No hay preguntas disponibles para esta categoría')
          return
        }

        console.log('✅ Loaded psychometric questions:', data.length)
        setQuestions(data)

      } catch (err) {
        console.error('❌ Unexpected error loading questions:', err)
        setError('Error inesperado al cargar las preguntas')
      } finally {
        setLoading(false)
      }
    }

    if (supabase && categoria) {
      loadPsychometricQuestions()
    }
  }, [categoria, supabase, searchParams])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando preguntas psicotécnicas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
          <button
            onClick={() => window.history.back()}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Volver
          </button>
        </div>
      </div>
    )
  }

  const config = {
    categoria: categoria,
    tipo: 'psicotecnico'
  }

  return (
    <PsychometricTestLayout
      categoria={categoria}
      config={config}
      questions={questions}
    />
  )
}