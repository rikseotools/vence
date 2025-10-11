// app/teoria/page.js - PÁGINA PRINCIPAL DE TEORÍA CON SEO
import { fetchLawsList } from '@/lib/teoriaFetchers'
import Link from 'next/link'
import { BookOpenIcon, DocumentTextIcon, ScaleIcon } from '@heroicons/react/24/outline'

export const metadata = {
  title: 'Teoría Legal - Estudia Legislación Española',
  description: 'Accede a todos los artículos de las principales leyes españolas. Constitución, Ley 39/2015, Ley 40/2015 y más. Teoría completa para oposiciones.',
  keywords: 'teoría legal, legislación española, constitución, ley 39/2015, ley 40/2015, artículos, oposiciones, estudio',
  openGraph: {
    title: 'Teoría Legal - Estudia Legislación Española',
    description: 'Accede a todos los artículos de las principales leyes españolas. Constitución, Ley 39/2015, Ley 40/2015 y más. Teoría completa para oposiciones.',
    url: 'https://vence.es/teoria',
    type: 'website',
    siteName: 'Vence - Preparación de Oposiciones'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teoría Legal - Estudia Legislación Española',
    description: 'Accede a todos los artículos de las principales leyes españolas. Teoría completa para oposiciones.'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  alternates: {
    canonical: 'https://vence.es/teoria'
  }
}

export default async function TeoriaMainPage() {
  let laws = []
  let error = null
  
  try {
    laws = await fetchLawsList()
  } catch (err) {
    console.error('Error cargando leyes:', err)
    error = err.message
  }

  const totalArticles = laws.reduce((sum, law) => sum + law.articleCount, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BookOpenIcon className="h-8 w-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Teoría Legal</h1>
              <p className="text-gray-600 mt-1">
                Accede al contenido completo de la legislación española
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <ScaleIcon className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Leyes Disponibles</p>
                <p className="text-2xl font-bold text-gray-900">{laws.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <DocumentTextIcon className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Artículos Totales</p>
                <p className="text-2xl font-bold text-gray-900">{totalArticles}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm p-6 border">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BookOpenIcon className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Contenido Rico</p>
                <p className="text-2xl font-bold text-gray-900">100%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
            <div className="flex items-center">
              <div className="text-red-400">
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error cargando contenido</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Laws Grid */}
        {laws.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {laws.map((law) => (
              <Link 
                key={law.id} 
                href={`/teoria/${law.slug}`}
                className="group"
              >
                <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 border hover:border-blue-200 p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors duration-200">
                        {law.short_name}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {law.name}
                      </p>
                      
                      {law.description && (
                        <p className="text-xs text-gray-500 mt-2 line-clamp-3">
                          {law.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center text-sm text-gray-500">
                      <DocumentTextIcon className="h-4 w-4 mr-1" />
                      <span>{law.articleCount} artículos</span>
                    </div>
                    
                    <div className="text-blue-600 group-hover:text-blue-700">
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : !error && (
          <div className="text-center py-12">
            <BookOpenIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay contenido disponible</h3>
            <p className="text-gray-600">
              No se encontraron leyes con contenido de teoría disponible.
            </p>
          </div>
        )}

        {/* Footer Info */}
        <div className="mt-12 bg-white rounded-xl shadow-sm border p-6">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Sobre el Contenido de Teoría
            </h3>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Accede al contenido completo y oficial de la legislación española. 
              Cada artículo incluye el texto íntegro y la estructura original 
              para facilitar tu estudio y comprensión.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
