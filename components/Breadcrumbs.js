// components/Breadcrumbs.js
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Breadcrumbs({ customLabels = {}, className = "" }) {
  const pathname = usePathname()
  
  // Mapeo de rutas a etiquetas legibles
  const defaultLabels = {
    'es': '🇪🇸 España',
    'auxiliar-administrativo-estado': '👨‍💼 Auxiliar Administrativo Estado',
    'temario': '📚 Temarios',
    'test': '🎯 Tests',
    'tema-1': '📜 Tema 1: Constitución Española',
    'tema-4': '⚖️ Tema 4: El Poder Judicial',
    'tema-7': '📋 Tema 7: Ley 19/2013 Transparencia',
    'tema-11': '📋 Tema 11: Ley 39/2015 Procedimiento',
    'tema-16': '👥 Tema 16: Personal AAPP',
    'test-1': '📝 Test 1',
    'test-2': '📝 Test 2',
    'test-3': '📝 Test 3',
    'test-4': '📝 Test 4',
    'test-5': '📝 Test 5',
    'constitucion-espanola': 'Constitución Española',
    'titulo-preliminar': 'Título Preliminar',
    'leyes': '📚 Leyes',
    'guardia-civil': '🚔 Guardia Civil',
    'policia-nacional': '👮‍♂️ Policía Nacional'
  }

  // Combinar etiquetas por defecto con personalizadas
  const labels = { ...defaultLabels, ...customLabels }

  // Dividir la ruta en segmentos
  const pathSegments = pathname.split('/').filter(segment => segment !== '')
  
  // Si estamos en la página raíz o solo en /es, no mostrar breadcrumbs
  if (pathSegments.length <= 1) return null

  // 🆕 Filtrar segmentos para evitar duplicados
  const filteredSegments = pathSegments.filter((segment, index) => {
    // Si es 'es' y hay más segmentos después, mantenerlo
    if (segment === 'es' && pathSegments.length > 1) {
      return true
    }
    // Filtrar otros casos duplicados si los hay
    return segment !== 'inicio'
  })

  // Construir las migas de pan
  const breadcrumbs = filteredSegments.map((segment, index) => {
    const href = '/' + filteredSegments.slice(0, index + 1).join('/')
    const isLast = index === filteredSegments.length - 1
    const label = labels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')

    return {
      href,
      label,
      isLast,
      segment
    }
  })

  return (
    <nav 
      className={`bg-gray-50 border-b border-gray-200 py-3 ${className}`}
      aria-label="Breadcrumb"
    >
      <div className="container mx-auto px-4">
        <ol className="flex items-center space-x-2 text-sm">
          {/* 🆕 Mostrar ruta de estudio, no estructura web */}
          {(() => {
            // Detectar si estamos en una oposición específica
            const isAuxiliarAdmin = pathname.includes('auxiliar-administrativo-estado')
            const isGuardiaCivil = pathname.includes('guardia-civil')
            const isPolicia = pathname.includes('policia-nacional')
            
            if (isAuxiliarAdmin || isGuardiaCivil || isPolicia) {
              // Construir breadcrumbs específicos para oposiciones
              const oppositionBreadcrumbs = []
              
              // Inicio de la oposición
              if (isAuxiliarAdmin) {
                oppositionBreadcrumbs.push({
                  href: '/auxiliar-administrativo-estado',
                  label: '👨‍💼 Auxiliar Administrativo Estado',
                  isLast: false
                })
              } else if (isGuardiaCivil) {
                oppositionBreadcrumbs.push({
                  href: '/guardia-civil',
                  label: '🚔 Guardia Civil',
                  isLast: false
                })
              } else if (isPolicia) {
                oppositionBreadcrumbs.push({
                  href: '/policia-nacional',
                  label: '👮‍♂️ Policía Nacional',
                  isLast: false
                })
              }
              
              // Detectar sección (tests, temario, etc.)
              if (pathname.includes('/test')) {
                oppositionBreadcrumbs.push({
                  href: oppositionBreadcrumbs[0].href + '/test',
                  label: '🎯 Tests',
                  isLast: false
                })
                
                // Detectar tema específico
                const temaMatch = pathname.match(/tema-(\d+)/)
                if (temaMatch) {
                  const temaNum = temaMatch[1]
                  const temaLabels = {
                    '1': '📜 Tema 1: Constitución Española',
                    '4': '⚖️ Tema 4: El Poder Judicial', 
                    '7': '📋 Tema 7: Ley 19/2013 Transparencia',
                    '11': '📋 Tema 11: Ley 39/2015',
                    '16': '👥 Tema 16: Personal AAPP'
                  }
                  
                  oppositionBreadcrumbs.push({
                    href: oppositionBreadcrumbs[0].href + `/test/tema-${temaNum}`,
                    label: temaLabels[temaNum] || `📋 Tema ${temaNum}`,
                    isLast: false
                  })
                  
                  // Detectar test específico
                  const testMatch = pathname.match(/test-(\d+)/)
                  if (testMatch) {
                    const testNum = testMatch[1]
                    oppositionBreadcrumbs.push({
                      href: pathname,
                      label: `📝 Test ${testNum}`,
                      isLast: true
                    })
                  } else {
                    oppositionBreadcrumbs[oppositionBreadcrumbs.length - 1].isLast = true
                  }
                } else {
                  oppositionBreadcrumbs[oppositionBreadcrumbs.length - 1].isLast = true
                }
              } else if (pathname.includes('/temario')) {
                oppositionBreadcrumbs.push({
                  href: oppositionBreadcrumbs[0].href + '/temario',
                  label: '📚 Temarios',
                  isLast: true
                })
              } else {
                oppositionBreadcrumbs[oppositionBreadcrumbs.length - 1].isLast = true
              }
              
              return oppositionBreadcrumbs.map((crumb, index) => (
                <li key={index} className="flex items-center">
                  {index > 0 && <span className="text-gray-400 mx-2">/</span>}
                  {crumb.isLast ? (
                    <span className="text-gray-700 font-semibold">
                      {crumb.label}
                    </span>
                  ) : (
                    <Link 
                      href={crumb.href}
                      className="text-blue-600 hover:text-blue-800 transition-colors"
                    >
                      {crumb.label}
                    </Link>
                  )}
                </li>
              ))
            }
            
            // Si no es una oposición, usar breadcrumbs normales (excluyendo 'es')
            const normalBreadcrumbs = breadcrumbs.filter(b => b.segment !== 'es')
            return normalBreadcrumbs.map((breadcrumb, index) => (
              <li key={index} className="flex items-center">
                {index > 0 && <span className="text-gray-400 mx-2">/</span>}
                {breadcrumb.isLast ? (
                  <span className="text-gray-700 font-semibold">
                    {breadcrumb.label}
                  </span>
                ) : (
                  <Link 
                    href={breadcrumb.href}
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {breadcrumb.label}
                  </Link>
                )}
              </li>
            ))
          })()}
        </ol>

        {/* Versión móvil simplificada */}
        <div className="md:hidden mt-2">
          <div className="flex items-center text-xs text-gray-500">
            <span>📍 Estás en: </span>
            <span className="font-semibold text-gray-700 ml-1">
              {breadcrumbs[breadcrumbs.length - 1]?.label}
            </span>
          </div>
        </div>
      </div>
    </nav>
  )
}

// Componente específico para rutas de oposiciones
export function OppositionBreadcrumbs({ 
  opposition = "auxiliar-administrativo-estado",
  tema = null, 
  test = null,
  section = null 
}) {
  const customLabels = {
    'auxiliar-administrativo-estado': '👨‍💼 Auxiliar Administrativo Estado',
    'constitucion-espanola': '📜 Constitución Española 1978',
    'temario': '📚 Temarios',
    'test': '🎯 Tests',
    [`tema-${tema}`]: tema ? `📋 Tema ${tema}: ${getTopicName(tema)}` : '',
    [`test-${test}`]: test ? `📝 Test ${test}` : '',
  }

  return <Breadcrumbs customLabels={customLabels} />
}

// Función auxiliar para obtener nombres de temas
function getTopicName(temaNumber) {
  const topicNames = {
    '1': 'Constitución Española 1978',
    '4': 'El Poder Judicial',
    '7': 'Ley 19/2013 Transparencia',
    '8': 'Procedimiento Administrativo',
    '11': 'Ley 39/2015',
    '16': 'Personal AAPP',
    '25': 'Windows 10',
    '28': 'Bases de Datos'
  }
  return topicNames[temaNumber] || 'Tema'
}

// Versión con esquemas estructurados para SEO
export function StructuredBreadcrumbs() {
  const pathname = usePathname()
  
  const breadcrumbsSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": []
  }

  const pathSegments = pathname.split('/').filter(segment => segment !== '')
  
  // Añadir inicio si no estamos en español
  if (!pathname.startsWith('/es')) {
    breadcrumbsSchema.itemListElement.push({
      "@type": "ListItem",
      "position": 1,
      "name": "Inicio",
      "item": process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es'
    })
  }
  
  pathSegments.forEach((segment, index) => {
    const position = pathname.startsWith('/es') ? index + 1 : index + 2
    const href = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.vence.es') + '/' + pathSegments.slice(0, index + 1).join('/')
    
    breadcrumbsSchema.itemListElement.push({
      "@type": "ListItem",
      "position": position,
      "name": segment,
      "item": href
    })
  })

  return (
    <>
      <Breadcrumbs />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbsSchema) }}
      />
    </>
  )
}