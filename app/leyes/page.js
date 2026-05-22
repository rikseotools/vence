// app/leyes/page.js - PÁGINA COMPLETA DE LEYES
import { Suspense } from 'react'
import Link from 'next/link'
import Script from 'next/script'
import LeyesServerComponent from '@/components/LeyesServerComponent'
import ClientBreadcrumbsWrapper from '@/components/ClientBreadcrumbsWrapper'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

// JSON-LD Schemas para SEO
const jsonLdWebPage = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: 'Test de Leyes España Online Gratis 2026',
  description: 'Tests gratuitos de las leyes más importantes de España: Constitución Española, Ley 39/2015, Código Civil, Código Penal y más. +3000 preguntas actualizadas.',
  url: `${SITE_URL}/leyes`,
  inLanguage: 'es',
  isPartOf: {
    '@type': 'WebSite',
    name: 'Vence',
    url: SITE_URL
  },
  about: {
    '@type': 'Thing',
    name: 'Legislación española'
  },
  provider: {
    '@type': 'Organization',
    name: 'Vence',
    url: SITE_URL
  }
}

const jsonLdBreadcrumb = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Inicio',
      item: SITE_URL
    },
    {
      '@type': 'ListItem',
      position: 2,
      name: 'Test de Leyes',
      item: `${SITE_URL}/leyes`
    }
  ]
}

const jsonLdFAQ = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: '¿Cuáles son las leyes más importantes para estudiar?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Las leyes más consultadas son: Constitución Española, Ley 39/2015 (LPAC), Ley 40/2015 (LRJSP), Código Civil, Código Penal y Ley 19/2013 de Transparencia.'
      }
    },
    {
      '@type': 'Question',
      name: '¿Los test de leyes están actualizados?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Sí, todos nuestros test de leyes en Vence se actualizan constantemente con las últimas modificaciones legislativas y jurisprudencia relevante.'
      }
    },
    {
      '@type': 'Question',
      name: '¿Son útiles para oposiciones?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Absolutamente. Nuestros test de leyes están diseñados específicamente para la preparación de oposiciones del sector público español.'
      }
    },
    {
      '@type': 'Question',
      name: '¿Hay límite de uso en los test de leyes?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'No, el acceso a todos los test de leyes en Vence es completamente gratuito y sin límites. Puedes practicar tantas veces como necesites.'
      }
    }
  ]
}

// 🚀 ISR: CACHE DE 30 DÍAS - Un usuario regenera para todos
export const revalidate = 2592000 // 30 días

// ✅ MANTENER TODO TU METADATA ACTUAL
export const metadata = {
  title: 'Test de Leyes España Online Gratis 2026 | Vence',
  description: 'Tests gratuitos de las leyes más importantes de España: Constitución Española, Ley 39/2015, Código Civil, Código Penal y más. +3000 preguntas actualizadas en Vence.',
  keywords: [
    'test de leyes', 'test de leyes españa', 'test constitución española',
    'test ley 39/2015', 'test código civil', 'test código penal',
    'test estatuto trabajadores', 'tests jurídicos online', 'test de leyes gratis',
    'examen leyes españa', 'preparar oposiciones leyes', 'legislación española test', 'vence'
  ].join(', '),
  authors: [{ name: 'Vence' }],
  creator: 'Vence',
  publisher: 'Vence',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Test de Leyes España Online Gratis | Vence',
    description: 'Practica con tests gratuitos de las leyes más importantes de España. Constitución, Ley 39/2015, Códigos Civil y Penal. +3000 preguntas actualizadas.',
    url: `${SITE_URL}/leyes`,
    siteName: 'Vence',
    locale: 'es_ES',
    type: 'website',
    images: [
      {
        url: '/og-image-es.jpg',
        width: 1200,
        height: 630,
        alt: 'Vence - Test de Leyes España',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Test de Leyes España Online Gratis | Vence',
    description: 'Tests actualizados de Constitución Española, Ley 39/2015, Códigos Civil y Penal. ¡Practica gratis!',
    images: ['/twitter-image-es.jpg'],
  },
  alternates: {
    canonical: `${SITE_URL}/leyes`,
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
}

// 🎨 COMPONENTE: Loading Spinner Profesional
function LeyesLoadingSpinner() {
  return (
    <div className="text-center py-16">
      {/* Spinner principal */}
      <div className="relative mb-6">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-2xl">📚</span>
        </div>
      </div>
      
      {/* Mensaje principal */}
      <h3 className="text-xl font-bold text-gray-800 mb-3">
        🔄 Cargando Tests de Leyes
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Obteniendo las leyes disponibles y sus estadísticas desde la base de datos...
      </p>
      
      {/* Estadísticas animadas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto mb-8">
        {[
          { label: 'Leyes', icon: '📋', color: 'text-blue-600' },
          { label: 'Preguntas', icon: '❓', color: 'text-green-600' },
          { label: 'Categorías', icon: '📂', color: 'text-purple-600' },
          { label: 'Tests', icon: '🎯', color: 'text-red-600' }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-lg p-4 shadow-sm">
            <div className="text-2xl mb-2">{stat.icon}</div>
            <div className="h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className={`text-xs ${stat.color} font-medium`}>{stat.label}</div>
          </div>
        ))}
      </div>
      
      {/* Progreso visual */}
      <div className="max-w-md mx-auto">
        <div className="bg-gray-200 rounded-full h-2 mb-4">
          <div className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full animate-pulse" style={{width: '60%'}}></div>
        </div>
        <p className="text-sm text-gray-500">
          📊 Procesando estadísticas de leyes...
        </p>
      </div>
      
      {/* Tips mientras carga */}
      <div className="mt-8 bg-blue-50 rounded-lg p-4 max-w-lg mx-auto">
        <p className="text-sm text-blue-700">
          <span className="font-semibold">💡 Tip:</span> Una vez cargada, esta página será ultrarrápida durante 30 días gracias al cache inteligente.
        </p>
      </div>
      
      {/* Solo en desarrollo: información técnica */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-6 bg-yellow-50 rounded-lg p-4 max-w-lg mx-auto">
          <p className="text-xs text-yellow-700">
            <span className="font-semibold">🔧 Desarrollo:</span> En producción esta carga será instantánea gracias a ISR de 30 días.
          </p>
        </div>
      )}
    </div>
  )
}

export default function TestLeyesEspana() {
  const beneficiosTestLeyes = [
    {
      titulo: 'Preparación Completa',
      descripcion: 'Tests actualizados con las últimas modificaciones legislativas',
      icon: '📚'
    },
    {
      titulo: 'Preguntas Reales',
      descripcion: 'Basadas en exámenes oficiales y casos prácticos reales',
      icon: '✅'
    },
    {
      titulo: 'Explicaciones Detalladas',
      descripcion: 'Con artículos específicos y jurisprudencia relevante',
      icon: '💡'
    },
    {
      titulo: '100% Gratuito',
      descripcion: 'Acceso completo sin coste ni registros obligatorios',
      icon: '🆓'
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50">
      {/* JSON-LD Structured Data */}
      <Script
        id="json-ld-webpage"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdWebPage) }}
      />
      <Script
        id="json-ld-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }}
      />
      <Script
        id="json-ld-faq"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFAQ) }}
      />
      <ClientBreadcrumbsWrapper />
      <div className="container mx-auto px-4 py-12">
        
        {/* Hero Section */}
        <section className="text-center mb-16">
          <div className="mb-6">
            <span className="bg-blue-100 text-blue-800 px-4 py-2 rounded-full text-sm font-semibold">
              📚 TEST DE LEYES ESPAÑA
            </span>
          </div>
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            Test de Leyes España<br/>
            <span className="text-blue-600">en Vence 2026</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto leading-relaxed">
            Practica con los <strong>tests de leyes</strong> más completos de España en <strong>Vence</strong>. 
            Prepárate para oposiciones o estudia legislación española con nuestros
            <strong> tests gratuitos actualizados</strong> de todas las leyes disponibles en nuestra base de datos.
          </p>
        </section>

        {/* 🎯 SUSPENSE CON LOADING PROFESIONAL */}
        <Suspense fallback={<LeyesLoadingSpinner />}>
          <LeyesServerComponent />
        </Suspense>

        {/* Beneficios */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              ✨ ¿Por qué elegir nuestros Test de Leyes?
            </h2>
            <p className="text-xl text-gray-600">
              La forma más efectiva de estudiar legislación española online
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {beneficiosTestLeyes.map((beneficio, index) => (
              <div key={index} className="bg-white rounded-xl p-6 shadow-lg text-center">
                <div className="text-4xl mb-4">{beneficio.icon}</div>
                <h3 className="text-xl font-bold text-gray-800 mb-3">
                  {beneficio.titulo}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {beneficio.descripcion}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Información SEO */}
        <section className="bg-white rounded-xl shadow-lg p-8 mb-16">
          <h2 className="text-3xl font-bold text-gray-800 mb-6">
            📖 Todo sobre los Test de Leyes en España
          </h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">¿Qué son los Test de Leyes?</h3>
              <p className="text-gray-600 mb-4 leading-relaxed">
                Los <strong>test de leyes</strong> son cuestionarios especializados que evalúan el conocimiento 
                de la legislación española. Son fundamentales para la preparación de oposiciones, 
                estudios de derecho y actualización profesional.
              </p>
              <p className="text-gray-600 mb-4 leading-relaxed">
                En <strong>Vence</strong> encontrarás tests de las leyes más importantes de España, 
                desde la Constitución hasta códigos especializados, todos actualizados y gratuitos.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">Ventajas de Practicar Online</h3>
              <ul className="text-gray-600 space-y-2">
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Acceso 24/7</strong> desde cualquier dispositivo
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Contenido actualizado</strong> con las últimas reformas
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Explicaciones detalladas</strong> de cada respuesta
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Seguimiento del progreso</strong> y estadísticas
                </li>
                <li className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <strong>Totalmente gratuito</strong> sin restricciones
                </li>
              </ul>
            </div>
          </div>
          
        </section>

        {/* FAQ */}
        <section className="bg-gray-50 rounded-xl p-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
            ❓ Preguntas Frecuentes sobre Test de Leyes
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">¿Cuáles son las leyes más importantes para estudiar?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Las leyes más consultadas son: Constitución Española, Ley 39/2015 (LPAC), 
                Ley 40/2015 (LRJSP), Código Civil, Código Penal y Ley 19/2013 de Transparencia.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">¿Los test están actualizados?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Sí, todos nuestros test de leyes en Vence se actualizan constantemente con las últimas 
                modificaciones legislativas y jurisprudencia relevante.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">¿Son útiles para oposiciones?</h3>
              <p className="text-gray-600 text-sm mb-4">
                Absolutamente. Nuestros test de leyes están diseñados específicamente para 
                la preparación de oposiciones del sector público español.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">¿Hay límite de uso?</h3>
              <p className="text-gray-600 text-sm mb-4">
                No, el acceso a todos los test de leyes en Vence es completamente gratuito y sin límites. 
                Puedes practicar tantas veces como necesites.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}