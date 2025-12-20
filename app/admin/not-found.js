// app/admin/not-found.js
export const metadata = {
  title: 'Admin - Página no encontrada',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false
    }
  }
}

export default function AdminNotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
          Página no encontrada
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Esta página no existe o no tienes permisos para acceder.
        </p>
        <a
          href="/admin"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
        >
          Volver al admin
        </a>
      </div>
    </div>
  )
}