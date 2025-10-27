// app/test-oposiciones/constitucion-titulos/page.js
import Link from 'next/link'
import { loadConstitucionData } from '../../../lib/constitucionSSR'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

// 🎯 METADATA SEO OPTIMIZADO
export async function generateMetadata() {
  return {
    title: 'Test Constitución Española 1978 por Títulos | Oposiciones | Vence',
    description: 'Tests específicos de la Constitución Española de 1978 organizados por títulos. Preguntas oficiales para oposiciones: Auxiliar Administrativo, AGE, Justicia. Preparación especializada por artículos.',
    keywords: [
      'test constitución española 1978',
      'test constitución por títulos', 
      'oposiciones constitución',
      'auxiliar administrativo constitución',
      'test oficial constitución',
      'preparación oposiciones constitución',
      'artículos constitución española',
      'derechos fundamentales test',
      'corona españa test',
      'cortes generales test',
      'vence'
    ].join(', '),
    
    // ✅ Canonical hacia URL corta optimizada para SEO
    alternates: {
      canonical: '/test-oposiciones/constitucion-titulos'
    },
    
    openGraph: {
      title: 'Test Constitución Española 1978 por Títulos | Oposiciones | Vence',
      description: 'Tests específicos por títulos constitucionales. Preparación para oposiciones con preguntas oficiales organizadas por artículos.',
      type: 'website',
      url: `${SITE_URL}/test-oposiciones/constitucion-titulos`,
      siteName: 'Vence'
    },
    
    robots: {
      index: true,  // Sí indexar (contenido diferente)
      follow: true
    },
    
    // Información adicional
    authors: [{ name: 'Vence' }],
    creator: 'Vence',
    publisher: 'Vence'
  }
}

// 🎯 GENERACIÓN ESTÁTICA
export async function generateStaticParams() {
  return [
    { }, // Para la página principal
  ]
}

// Pre-renderizar datos en el servidor
export default async function TestConstitucionPage() {
  const { sections, stats } = await loadConstitucionData()

  // 🎯 STRUCTURED DATA PARA SEO
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "name": "Test Constitución Española 1978 por Títulos",
    "description": "Tests especializados por títulos constitucionales para preparación de oposiciones",
    "provider": {
      "@type": "Organization",
      "name": "Vence"
    },
    "educationalLevel": "Professional",
    "teaches": "Constitución Española de 1978",
    "audience": {
      "@type": "Audience",
      "audienceType": "Opositores y estudiantes de derecho público"
    }
  }

  // 🎯 BREADCRUMB STRUCTURED DATA
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Tests de Oposiciones",
        "item": `${SITE_URL}/test-oposiciones`
      },
      {
        "@type": "ListItem", 
        "position": 2,
        "name": "Constitución Española 1978",
        "item": `${SITE_URL}/test-oposiciones/constitucion-titulos`
      }
    ]
  }

  return (
    <>
      {/* 🎯 STRUCTURED DATA */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      
      <div className="bg-gray-50">
      {/* Breadcrumb */}
      <div className="bg-white border-b border-gray-200 py-4">
        <div className="max-w-6xl mx-auto px-4">
          <nav className="flex text-sm text-gray-600">
            <Link href="/test-oposiciones" className="hover:text-blue-600">
              Tests de Oposiciones
            </Link>
            <span className="mx-2">›</span>
            <span className="font-medium text-gray-900">
              Tests Constitución Española 1978
            </span>
          </nav>
        </div>
      </div>

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-10 md:py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <div className="text-5xl md:text-7xl mb-4 md:mb-6">🏛️</div>
          <h1 className="text-2xl md:text-4xl font-bold mb-3 md:mb-4">
            Tests Constitución Española 1978 por Títulos
          </h1>
          <p className="text-blue-100 text-base md:text-xl mb-6 md:mb-8 max-w-3xl mx-auto">
            Preparación especializada para oposiciones organizizada por títulos constitucionales: Auxiliar Administrativo, AGE, Justicia, Correos, Sanidad y más. Tests específicos por artículos.
          </p>
          
          <div className="flex justify-center gap-4 md:gap-8 mb-6 md:mb-8">
            <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
              <div className="text-xl md:text-3xl font-bold">{stats.totalSections}</div>
              <div className="text-xs md:text-sm text-blue-100">Secciones</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
              <div className="text-xl md:text-3xl font-bold">{stats.totalQuestions}</div>
              <div className="text-xs md:text-sm text-blue-100">Preguntas</div>
            </div>
            <div className="bg-white/10 rounded-lg p-3 md:p-6 min-w-0">
              <div className="text-xl md:text-3xl font-bold">{stats.totalArticles}</div>
              <div className="text-xs md:text-sm text-blue-100">Artículos</div>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={`/test-oposiciones/constitucion-titulos/${section.slug}`}
              className="group bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-200 hover:border-blue-300"
            >
              <div className="p-6">
                <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">
                  {section.image}
                </div>
                <h3 className="font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors">
                  {section.title}
                </h3>
                <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                  {section.description}
                </p>
                {section.articles && (
                  <div className="text-xs text-blue-600 font-medium">
                    Artículos {section.articles.start}-{section.articles.end}
                  </div>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* 🎯 ENLACES INTERNOS ESTRATÉGICOS */}
        <div className="mt-12 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
            📚 Recursos Relacionados
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/leyes/constitucion-espanola"
              className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-2">📖</div>
              <h3 className="font-semibold text-gray-900 mb-1">Teoría Completa</h3>
              <p className="text-sm text-gray-600">Ver todos los artículos con explicaciones detalladas</p>
            </Link>
            <Link
              href="/test-oposiciones"
              className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-2">🎯</div>
              <h3 className="font-semibold text-gray-900 mb-1">Otros Tests</h3>
              <p className="text-sm text-gray-600">Más tests de oposiciones por materias</p>
            </Link>
            <Link
              href="/test/rapido"
              className="bg-white rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="text-2xl mb-2">⚡</div>
              <h3 className="font-semibold text-gray-900 mb-1">Test Rápido</h3>
              <p className="text-sm text-gray-600">10 preguntas aleatorias de constitución</p>
            </Link>
          </div>
        </div>

        {/* Información adicional */}
        <div className="mt-8 bg-white rounded-xl shadow-md p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Tests de Constitución Española por Títulos - Preparación Específica
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">🏛️ Estructura de Tests por Títulos</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• <strong>Preámbulo y Título Preliminar:</strong> Fundamentos del Estado Español</li>
                <li>• <strong>Título I:</strong> Derechos fundamentales y libertades públicas</li>
                <li>• <strong>Título II:</strong> La Corona - Jefe del Estado</li>
                <li>• <strong>Título III:</strong> Las Cortes Generales - Poder Legislativo</li>
                <li>• <strong>Título IV:</strong> Gobierno y Administración - Poder Ejecutivo</li>
                <li>• <strong>Título V:</strong> Relaciones entre Gobierno y Cortes</li>
                <li>• <strong>Título VI:</strong> Poder Judicial - Organización judicial</li>
                <li>• <strong>Título VII:</strong> Economía y Hacienda Pública</li>
                <li>• <strong>Título VIII:</strong> Organización territorial del Estado</li>
                <li>• <strong>Título IX:</strong> Tribunal Constitucional</li>
                <li>• <strong>Título X:</strong> Reforma constitucional</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-3">🎯 Especialización por Oposiciones</h3>
              <ul className="text-gray-600 text-sm space-y-1">
                <li>• <strong>Auxiliar Administrativo del Estado:</strong> Todos los títulos esenciales</li>
                <li>• <strong>Administrativo del Estado (AGE):</strong> Organización del Estado</li>
                <li>• <strong>Administración de Justicia:</strong> Poder Judicial y Tribunal Constitucional</li>
                <li>• <strong>Correos y Telégrafos:</strong> Derechos fundamentales y organización</li>
                <li>• <strong>Sanidad:</strong> Competencias sanitarias y organización territorial</li>
                <li>• <strong>Administración Local:</strong> Título VIII - Organización territorial</li>
                <li>• <strong>Educación:</strong> Derechos fundamentales educativos</li>
                <li>• <strong>Seguridad Social:</strong> Principios rectores de política social</li>
              </ul>
            </div>
          </div>
          
          {/* 🎯 SECTION CON KEYWORDS LONG-TAIL */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-3">✨ Ventajas de estudiar por títulos constitucionales</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-600">
              <div>
                <h4 className="font-medium text-gray-800 mb-2">📊 Preparación Estructurada</h4>
                <p>Cada título constitutional aborda materias específicas, permitiendo un estudio organizado y progresivo de los 169 artículos de la Constitución Española de 1978.</p>
              </div>
              <div>
                <h4 className="font-medium text-gray-800 mb-2">🎯 Enfoque por Materias</h4>
                <p>Ideal para repasar temas específicos como derechos fundamentales, organización del Estado, poder judicial o competencias autonómicas según tu oposición.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}