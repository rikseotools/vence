import { useState } from 'react';

function SaveErrorModal({
  isOpen,
  onRetry,
  onSkip,
  onAbort,
  attempts = 0,
  questionNumber = null
}) {
  const [isRetrying, setIsRetrying] = useState(false);

  if (!isOpen) return null;

  const handleRetry = async () => {
    setIsRetrying(true);
    await onRetry();
    setIsRetrying(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-md w-full">
        <div className="flex items-start mb-4">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <div className="ml-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Error al guardar respuesta
            </h2>
            {questionNumber && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Pregunta #{questionNumber}
              </p>
            )}
          </div>
        </div>

        <div className="mb-4">
          <p className="text-gray-700 dark:text-gray-300">
            No se pudo guardar tu respuesta en el servidor.
          </p>
          {attempts > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Intentos realizados: {attempts}
            </p>
          )}
        </div>

        {/* Mensaje tranquilizador */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 p-3 rounded mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Tu respuesta está guardada localmente</strong> y no se perderá.
                Intentaremos sincronizarla cuando sea posible.
              </p>
            </div>
          </div>
        </div>

        {/* Posibles causas */}
        <div className="mb-6 text-sm text-gray-600 dark:text-gray-400">
          <p className="font-semibold mb-1">Posibles causas:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Conexión a internet inestable</li>
            <li>El servidor está temporalmente no disponible</li>
            <li>Tu sesión ha expirado</li>
          </ul>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center justify-center"
          >
            {isRetrying ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Reintentando...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reintentar
              </>
            )}
          </button>

          <button
            onClick={onSkip}
            disabled={isRetrying}
            className="flex-1 bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
            Continuar sin sincronizar
          </button>

          <button
            onClick={onAbort}
            disabled={isRetrying}
            className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700
                     disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                     flex items-center justify-center"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                d="M6 18L18 6M6 6l12 12" />
            </svg>
            Terminar test
          </button>
        </div>

        {/* Nota adicional */}
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-4">
          Si el problema persiste, puedes completar el test y las respuestas
          se sincronizarán automáticamente más tarde.
        </p>
      </div>
    </div>
  );
}

export default SaveErrorModal;