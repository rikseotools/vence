// app/admin/tests/page.js - Panel principal de herramientas de testing
'use client'

export default function AdminTestsPage() {
  const testTools = [
    {
      id: 'debug',
      title: '🐛 Debug de Notificaciones',
      description: 'Herramientas para debugging del sistema de notificaciones push. Inyectar notificaciones de prueba, ver estado del sistema y logs.',
      features: [
        'Inyectar notificaciones de test',
        'Ver estado del sistema en tiempo real',
        'Logs de actividad detallados',
        'Inspeccionar detalles de notificaciones'
      ],
      link: '/admin/debug',
      buttonText: 'Abrir Debug',
      color: 'purple'
    },
    {
      id: 'emails',
      title: '📧 Test de Emails Motivacionales',
      description: 'Prueba el sistema de emails motivacionales. Enviar emails de test y verificar templates y analytics.',
      features: [
        'Enviar emails de prueba',
        'Probar todos los tipos de emails',
        'Ver resultados en tiempo real',
        'Analytics de emails enviados'
      ],
      link: '/admin/test-motivational-emails',
      buttonText: 'Abrir Tests Email',
      color: 'blue'
    }
  ]

  const getColorClasses = (color) => {
    const colors = {
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-800',
        text: 'text-purple-700 dark:text-purple-300',
        button: 'bg-purple-600 hover:bg-purple-700',
        accent: 'text-purple-600 dark:text-purple-400'
      },
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
        button: 'bg-blue-600 hover:bg-blue-700',
        accent: 'text-blue-600 dark:text-blue-400'
      }
    }
    return colors[color] || colors.blue
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🧪 Herramientas de Testing
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Suite de herramientas para testing y debugging del sistema
        </p>
        <div className="mt-4 flex items-center space-x-4 text-sm">
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full">
            Admin Tools
          </span>
          <span className="text-gray-500">
            {testTools.length} herramientas disponibles
          </span>
        </div>
      </div>

      {/* Test Tools Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {testTools.map((tool) => {
          const colors = getColorClasses(tool.color)
          
          return (
            <div
              key={tool.id}
              className={`${colors.bg} ${colors.border} border rounded-lg p-6 transition-all hover:shadow-md`}
            >
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {tool.title}
                </h2>
                <span className={`text-2xl ${colors.accent}`}>
                  {tool.title.split(' ')[0]}
                </span>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {tool.description}
              </p>

              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Características:
                </h3>
                <ul className="space-y-1">
                  {tool.features.map((feature, index) => (
                    <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-center">
                      <span className="w-1.5 h-1.5 bg-current rounded-full mr-2"></span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex space-x-3">
                <a
                  href={tool.link}
                  className={`flex-1 ${colors.button} text-white px-4 py-2 rounded-md text-center font-medium transition-colors`}
                >
                  {tool.buttonText}
                </a>
                <button
                  onClick={() => window.open(tool.link, '_blank')}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  title="Abrir en nueva pestaña"
                >
                  🔗
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Access */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          🚀 Acceso Rápido
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <a
            href="/admin/debug"
            className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <div className="text-lg mb-1">🐛</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Debug</div>
          </a>
          
          <a
            href="/admin/test-motivational-emails"
            className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <div className="text-lg mb-1">📧</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Test Emails</div>
          </a>
          
          <a
            href="/debug/notifications"
            className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <div className="text-lg mb-1">🔍</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Debug Original</div>
          </a>
          
          <a
            href="/admin/notificaciones/email"
            className="p-3 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-center"
          >
            <div className="text-lg mb-1">📊</div>
            <div className="text-sm font-medium text-gray-900 dark:text-white">Analytics</div>
          </a>
        </div>
      </div>

      {/* Info */}
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-yellow-800 dark:text-yellow-200 mb-2">
          ℹ️ Información de Testing
        </h3>
        <div className="text-sm text-yellow-700 dark:text-yellow-300 space-y-2">
          <p>
            <strong>Debug de Notificaciones:</strong> Úsalo para probar el sistema de notificaciones push en el navegador.
          </p>
          <p>
            <strong>Test de Emails:</strong> Úsalo para probar los templates de emails motivacionales y verificar la entrega.
          </p>
          <p>
            <strong>Analytics:</strong> Revisa siempre los analytics después de hacer pruebas para verificar que todo se registra correctamente.
          </p>
        </div>
      </div>
    </div>
  )
}