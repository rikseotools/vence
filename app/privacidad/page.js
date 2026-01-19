export const metadata = {
  title: 'Política de Privacidad | Vence',
  description: 'Política de privacidad de Vence - Preparación de oposiciones',
}

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">
          Política de Privacidad
        </h1>

        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            <strong>Última actualización:</strong> Enero 2026
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            1. Responsable del Tratamiento
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            El responsable del tratamiento de tus datos personales es:
          </p>
          <div className="mb-4">
            <img
              src="/images/contact-info.png"
              alt="Datos de contacto"
              className="dark:invert dark:brightness-200"
              width={500}
              height={120}
            />
          </div>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            2. Datos que Recopilamos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Recopilamos los siguientes datos:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4">
            <li>Datos de registro: nombre, email (a través de Google OAuth)</li>
            <li>Datos de uso: respuestas a tests, progreso, estadísticas de estudio</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            3. Finalidad del Tratamiento
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Utilizamos tus datos para:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4">
            <li>Proporcionar y mejorar nuestros servicios de preparación de oposiciones</li>
            <li>Personalizar tu experiencia de aprendizaje</li>
            <li>Guardar tu progreso y estadísticas</li>
            <li>Enviarte comunicaciones relacionadas con el servicio</li>
            <li>Cumplir con obligaciones legales</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            4. Base Legal
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            El tratamiento de tus datos se basa en:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4">
            <li>Tu consentimiento al registrarte</li>
            <li>La ejecución del contrato de servicio</li>
            <li>Nuestro interés legítimo en mejorar el servicio</li>
          </ul>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            5. Conservación de Datos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Conservamos tus datos mientras mantengas tu cuenta activa. Si solicitas la eliminación
            de tu cuenta, eliminaremos tus datos en un plazo máximo de 30 días, salvo que debamos
            conservarlos por obligación legal.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            6. Tus Derechos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Tienes derecho a:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4">
            <li>Acceder a tus datos personales</li>
            <li>Rectificar datos inexactos</li>
            <li>Solicitar la eliminación de tus datos</li>
            <li>Oponerte al tratamiento</li>
            <li>Portabilidad de tus datos</li>
            <li>Retirar tu consentimiento en cualquier momento</li>
          </ul>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Para ejercer estos derechos, contacta con nosotros en{' '}
            <a href="mailto:info@vence.es" className="text-blue-600 dark:text-blue-400">info@vence.es</a>
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            7. Seguridad
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Implementamos medidas de seguridad técnicas y organizativas para proteger tus datos,
            incluyendo cifrado SSL/TLS, almacenamiento seguro en servidores de la UE (Supabase),
            y acceso restringido a datos personales.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            8. Cookies
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Utilizamos diferentes tipos de cookies:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4">
            <li><strong>Cookies esenciales:</strong> Necesarias para el funcionamiento básico (autenticación, seguridad, preferencias). Se activan siempre.</li>
            <li><strong>Cookies analíticas:</strong> Nos ayudan a entender cómo usas la plataforma para mejorarla (Google Analytics). Requieren tu consentimiento.</li>
            <li><strong>Cookies de marketing:</strong> Permiten medir la efectividad de nuestras campañas (Meta Pixel, Google Ads). Requieren tu consentimiento.</li>
          </ul>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Al visitar nuestra web por primera vez, te mostraremos un banner para que elijas qué cookies aceptas.
            Puedes cambiar tus preferencias en cualquier momento haciendo clic en &quot;Cookies&quot; en el pie de página.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            9. Pagos y Procesador de Datos
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Para procesar los pagos de suscripciones Premium, utilizamos{' '}
            <a href="https://stripe.com" className="text-blue-600 dark:text-blue-400" target="_blank" rel="noopener noreferrer">Stripe</a>{' '}
            como procesador de pagos.
          </p>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            <strong>Vence no almacena datos de tarjetas de crédito.</strong> Stripe gestiona
            de forma segura toda la información de pago y cumple con los estándares PCI-DSS.
          </p>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Los datos que Vence almacena relacionados con pagos son únicamente:
          </p>
          <ul className="list-disc pl-6 text-gray-600 dark:text-gray-300 mb-4">
            <li>Identificador de cliente en Stripe</li>
            <li>Estado de la suscripción (activa, cancelada, etc.)</li>
            <li>Fechas de inicio y renovación</li>
          </ul>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            10. Cambios en esta Política
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Podemos actualizar esta política ocasionalmente. Te notificaremos de cambios
            significativos por email o mediante un aviso en la plataforma.
          </p>

          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-4">
            11. Contacto
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Si tienes preguntas sobre esta política de privacidad, puedes contactarnos en:{' '}
            <a href="mailto:info@vence.es" className="text-blue-600 dark:text-blue-400">info@vence.es</a>
          </p>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
          <a
            href="/"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            ← Volver al inicio
          </a>
        </div>
      </div>
    </div>
  )
}
