// components/FeedbackButton.js - Botón flotante de soporte profesional
'use client'
import { useState } from 'react'
import FeedbackModal from './FeedbackModal'
import QuestionDispute from './QuestionDispute'
import { useAuth } from '../contexts/AuthContext'

export default function FeedbackButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showQuestionDispute, setShowQuestionDispute] = useState(false)
  const [detectedQuestionId, setDetectedQuestionId] = useState(null)
  const { user, supabase } = useAuth()

  // Detectar questionId cuando se abre el dispute modal
  const handleOpenQuestionDispute = () => {
    console.log('🎯 [FEEDBACK-BUTTON] Abriendo QuestionDispute modal...')
    
    // Detectar questionId automáticamente
    let questionId = null
    
    // Método 1: DOM attribute
    const questionElement = document.querySelector('[data-question-id]')
    if (questionElement) {
      questionId = questionElement.getAttribute('data-question-id')
    }
    
    // Método 2: localStorage
    if (!questionId) {
      try {
        questionId = localStorage.getItem('currentQuestionId')
      } catch (e) {
        console.warn('No se pudo leer localStorage')
      }
    }
    
    console.log('🔍 [FEEDBACK-BUTTON] QuestionId detectado:', questionId)
    setDetectedQuestionId(questionId)
    setShowQuestionDispute(true)
  }

  return (
    <>
      {/* 🎧 BOTÓN FLOTANTE PROFESIONAL */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          onClick={() => setIsModalOpen(true)}
          className="group bg-gray-600 hover:bg-gray-700 text-white p-3 md:p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-600"
          aria-label="Contactar soporte"
          title="¿Necesitas ayuda?"
        >
          <div className="flex items-center">
            <span className="text-lg md:text-xl">🎧</span>
            <span className="hidden md:inline ml-2 font-medium text-sm">Soporte</span>
          </div>
          
        </button>
      </div>

      {/* Modal de feedback */}
      <FeedbackModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        onOpenQuestionDispute={handleOpenQuestionDispute}
      />
      
      {/* Modal de QuestionDispute */}
      <QuestionDispute 
        questionId={detectedQuestionId} // Usar questionId detectado automáticamente
        user={user}
        supabase={supabase}
        isOpen={showQuestionDispute}
        onClose={() => {
          console.log('🔄 [FEEDBACK-BUTTON] Cerrando QuestionDispute modal...')
          setShowQuestionDispute(false)
          setDetectedQuestionId(null) // Limpiar al cerrar
        }}
      />
      
      {/* Debug info */}
      {showQuestionDispute && console.log('🐛 [DEBUG] QuestionDispute debe estar visible, isOpen:', showQuestionDispute)}
    </>
  )
}