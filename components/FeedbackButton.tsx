// components/FeedbackButton.tsx - Botón flotante de soporte
'use client'
import SupportButton from './SupportButton'

export default function FeedbackButton() {
  // Mismo comportamiento híbrido que el botón del header (ver SupportButton): dentro de un test
  // abre el modal aquí (no pierde el test, detecta la pregunta); fuera navega a /soporte.
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <SupportButton
        className="group bg-gray-600 hover:bg-gray-700 text-white p-3 md:p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-4 focus:ring-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 dark:focus:ring-gray-600 flex items-center"
        aria-label="Contactar soporte"
        title="¿Necesitas ayuda?"
      >
        <span className="text-lg md:text-xl">💬</span>
        <span className="hidden md:inline ml-2 font-medium text-sm">Soporte</span>
      </SupportButton>
    </div>
  )
}
