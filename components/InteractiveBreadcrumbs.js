// components/InteractiveBreadcrumbs.js
'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'

export default function InteractiveBreadcrumbs({ customLabels = {}, className = "" }) {
  const pathname = usePathname()
  const router = useRouter()
  const [openDropdown, setOpenDropdown] = useState(null)
  
  // Mapeo de rutas a etiquetas legibles
  const defaultLabels = {
    'es': '🇪🇸 España',
    'auxiliar-administrativo-estado': '👨‍💼 Auxiliar Administrativo Estado',
    'administrativo': '👨‍💼 Administrativo',
    'leyes': '📚 Leyes',
    'temario': '📚 Temarios',
    'test': '🎯 Tests',
    'psicotecnicos': '🧩 Psicotécnicos',
    'guardia-civil': '🚔 Guardia Civil',
    'policia-nacional': '👮‍♂️ Policía Nacional'
  }

  // Combinar etiquetas por defecto con personalizadas
  const labels = { ...defaultLabels, ...customLabels }

  // Opciones disponibles para cambiar de oposición/sección
  const oppositionOptions = [
    { key: 'auxiliar-administrativo-estado', label: '👤 Auxiliar Administrativo Estado', path: '/auxiliar-administrativo-estado' },
    { key: 'administrativo', label: '👨‍💼 Administrativo del Estado', path: '/administrativo-estado' },
    { key: 'leyes', label: '⚖️ Leyes', path: '/leyes' },
    { key: 'teoria', label: '📖 Teoría', path: '/teoria' }
  ]

  // Opciones de sección específicas según contexto
  const getSectionOptions = () => {
    if (isAuxiliarAdmin) {
      return [
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' },
        { key: 'psicotecnicos', label: '🧩 Psicotécnicos', path: '/psicotecnicos' }
      ]
    } else if (isLeyes) {
      return [
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'psicotecnicos', label: '🧩 Psicotécnicos', path: '/psicotecnicos' }
      ]
    } else if (isTeoria) {
      return [
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'psicotecnicos', label: '🧩 Psicotécnicos', path: '/psicotecnicos' }
      ]
    } else {
      // Para psicotécnicos - solo cambiar entre tipos de test
      return [
        { key: 'test', label: '🎯 Tests de Leyes', path: '/leyes/test' },
        { key: 'psicotecnicos', label: '🧩 Tests Psicotécnicos', path: '/psicotecnicos' }
      ]
    }
  }

  // Dividir la ruta en segmentos
  const pathSegments = pathname.split('/').filter(segment => segment !== '')
  
  // Si estamos en la página raíz, no mostrar breadcrumbs
  if (pathSegments.length === 0) return null

  // Detectar el contexto actual
  const isAuxiliarAdmin = pathname.includes('auxiliar-administrativo-estado')
  const isAdministrativo = pathname.includes('/administrativo')
  const isLeyes = pathname.includes('/leyes')
  const isTeoria = pathname.includes('/teoria')
  const isInTests = pathname.includes('/test')
  const isPsicotecnicos = pathname.includes('/psicotecnicos')
  const isInTemario = pathname.includes('/temario')
  
  // Detectar si estamos en una ley específica
  const isInSpecificLaw = pathname.startsWith('/leyes/') && pathname !== '/leyes' && !pathname.includes('/test')
  const isInSpecificTheory = pathname.startsWith('/teoria/') && pathname !== '/teoria'
  
  // Obtener nombre de la ley desde el pathname
  const getLawName = () => {
    if (isInSpecificLaw) {
      const lawSlug = pathname.split('/leyes/')[1]?.split('/')[0]
      // Mapear algunos slugs comunes a nombres legibles
      const lawNames = {
        'constitucion-espanola': 'Constitución Española',
        'rdl-5-2015': 'Real Decreto-Ley 5/2015',
        'ley-39-2015': 'Ley 39/2015',
        'ley-40-2015': 'Ley 40/2015',
        'ley-19-2013': 'Ley 19/2013',
        'ley-7-1985': 'Ley 7/1985',
        'codigo-civil': 'Código Civil',
        'codigo-penal': 'Código Penal',
        'lo-6-1985': 'LO 6/1985',
        'lo-3-2018': 'LO 3/2018',
        'tue': 'TUE',
        'tfue': 'TFUE',
        'agenda-2030': 'Agenda 2030',
        'gobierno-abierto': 'Gobierno Abierto',
        // Agregar más mapeos según sea necesario
      }
      return lawNames[lawSlug] || lawSlug?.replace(/-/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase())
    }
    if (isInSpecificTheory) {
      const theorySlug = pathname.split('/teoria/')[1]?.split('/')[0]
      const lawNames = {
        'constitucion-espanola': 'Constitución Española',
        'rdl-5-2015': 'Real Decreto-Ley 5/2015',
        'ley-39-2015': 'Ley 39/2015',
        'ley-40-2015': 'Ley 40/2015',
        'ley-19-2013': 'Ley 19/2013',
        'ley-7-1985': 'Ley 7/1985',
        'codigo-civil': 'Código Civil',
        'codigo-penal': 'Código Penal',
        'lo-6-1985': 'LO 6/1985',
        'lo-3-2018': 'LO 3/2018',
        'tue': 'TUE',
        'tfue': 'TFUE',
        'agenda-2030': 'Agenda 2030',
        'gobierno-abierto': 'Gobierno Abierto',
      }
      return lawNames[theorySlug] || theorySlug?.replace(/-/g, ' ')?.replace(/\b\w/g, l => l.toUpperCase())
    }
    return null
  }

  // Función para cambiar de oposición (va a la página principal de la nueva oposición)
  const changeOpposition = (newOppositionPath) => {
    // Ir directamente a la página principal de la nueva oposición
    // No intentar mantener la sección actual porque no todas las oposiciones tienen las mismas secciones
    router.push(newOppositionPath)
    setOpenDropdown(null)
  }

  // Función para cambiar de sección manteniendo la oposición actual
  const changeSection = (newSectionPath) => {
    let finalPath = ''
    
    // Si la ruta ya incluye una base completa (como /leyes/test), usarla directamente
    if (newSectionPath.includes('/') && !newSectionPath.startsWith('/test') && !newSectionPath.startsWith('/temario') && !newSectionPath.startsWith('/psicotecnicos')) {
      finalPath = newSectionPath
    } else {
      // Determinar la ruta base según la oposición actual
      let basePath = ''
      if (isAuxiliarAdmin) {
        basePath = '/auxiliar-administrativo-estado'
      } else if (isAdministrativo) {
        basePath = '/administrativo'  
      } else if (isLeyes) {
        basePath = '/leyes'
      }
      finalPath = basePath + newSectionPath
    }
    
    router.push(finalPath)
    setOpenDropdown(null)
  }

  return (
    <nav 
      className={`bg-gray-50 border-b border-gray-200 py-3 ${className}`}
      aria-label="Breadcrumb"
    >
      <div className="container mx-auto px-4">
        <ol className="flex items-center space-x-2 text-sm">
          {/* Breadcrumb para Oposición */}
          {(isAuxiliarAdmin || isAdministrativo || isLeyes || isTeoria) && (
            <li className="flex items-center relative">
              <div className="flex items-center">
                {/* Texto clickeable para ir a la página principal (solo si no estamos ya ahí) */}
                {((isAuxiliarAdmin && pathname !== '/auxiliar-administrativo-estado') ||
                  (isAdministrativo && pathname !== '/administrativo-estado') ||
                  (isLeyes && pathname !== '/leyes') ||
                  (isTeoria && pathname !== '/teoria')) ? (
                  <Link
                    href={
                      isAuxiliarAdmin ? '/auxiliar-administrativo-estado' :
                      isAdministrativo ? '/administrativo-estado' :
                      isLeyes ? '/leyes' :
                      isTeoria ? '/teoria' : '#'
                    }
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {isAuxiliarAdmin && '👤 Auxiliar Administrativo Estado'}
                    {isAdministrativo && '👨‍💼 Administrativo del Estado'}
                    {isLeyes && '⚖️ Leyes'}
                    {isTeoria && '📖 Teoría'}
                  </Link>
                ) : (
                  <span className="text-gray-700 font-semibold">
                    {isAuxiliarAdmin && '👤 Auxiliar Administrativo Estado'}
                    {isAdministrativo && '👨‍💼 Administrativo del Estado'}
                    {isLeyes && '⚖️ Leyes'}
                    {isTeoria && '📖 Teoría'}
                  </span>
                )}
                
                {/* Flecha para dropdown */}
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'opposition' ? null : 'opposition')}
                  className="ml-1 p-1 text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
              </div>
              
              {/* Dropdown de oposiciones */}
              {openDropdown === 'opposition' && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2 px-2">Cambiar a:</div>
                    {oppositionOptions.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => changeOpposition(option.path)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors text-sm"
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          )}

          {/* Separador para ley específica */}
          {(isInSpecificLaw || isInSpecificTheory) && (
            <span className="text-gray-400 mx-2">/</span>
          )}

          {/* Breadcrumb para Ley Específica */}
          {(isInSpecificLaw || isInSpecificTheory) && (
            <li className="flex items-center">
              <span className="text-gray-700 font-semibold">
                {getLawName()}
              </span>
            </li>
          )}

          {/* Separador */}
          {(isAuxiliarAdmin || isAdministrativo || isLeyes || isTeoria) && (isInTests || isPsicotecnicos || isInTemario) && (
            <span className="text-gray-400 mx-2">/</span>
          )}

          {/* Breadcrumb para Sección (Tests/Psicotécnicos/Temario) */}
          {(isInTests || isPsicotecnicos || isInTemario) && (
            <li className="flex items-center relative">
              <div className="flex items-center">
                {/* Texto clickeable - no navega porque ya estamos en la sección actual */}
                <span className="text-gray-700 font-semibold">
                  {isInTests && '🎯 Tests'}
                  {isPsicotecnicos && '🧩 Psicotécnicos'}
                  {isInTemario && '📚 Temario'}
                </span>
                
                {/* Flecha para dropdown */}
                <button
                  onClick={() => setOpenDropdown(openDropdown === 'section' ? null : 'section')}
                  className="ml-1 p-1 text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
              </div>
              
              {/* Dropdown de secciones */}
              {openDropdown === 'section' && (
                <div className="absolute top-full left-0 mt-1 w-52 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2 px-2">Cambiar a:</div>
                    {getSectionOptions().map((option) => (
                      <button
                        key={option.key}
                        onClick={() => changeSection(option.path)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors text-sm"
                        disabled={
                          (option.key === 'test' && isInTests && !isPsicotecnicos) || 
                          (option.key === 'psicotecnicos' && isPsicotecnicos) ||
                          (option.key === 'temario' && pathname.includes('/temario'))
                        }
                      >
                        {option.label}
                        {((option.key === 'test' && isInTests && !isPsicotecnicos) || 
                          (option.key === 'psicotecnicos' && isPsicotecnicos) ||
                          (option.key === 'temario' && pathname.includes('/temario'))) && (
                          <span className="text-gray-400 ml-2">(actual)</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </li>
          )}

          {/* Detectar y mostrar sección específica si existe */}
          {(() => {
            // Mostrar tema específico, test específico, etc.
            const temaMatch = pathname.match(/tema-(\d+)/)
            const categoriaMatch = pathname.match(/psicotecnicos\/(.+)/)
            
            if (temaMatch) {
              const temaNum = temaMatch[1]
              return (
                <>
                  <span className="text-gray-400 mx-2">/</span>
                  <li>
                    <span className="text-gray-700 font-semibold">
                      📋 Tema {temaNum}
                    </span>
                  </li>
                </>
              )
            }
            
            if (categoriaMatch) {
              const categoria = categoriaMatch[1]
              const categoriaLabels = {
                'capacidad-administrativa': '📊 Capacidad Administrativa',
                'razonamiento-numerico': '🔢 Razonamiento Numérico',
                'razonamiento-verbal': '📝 Razonamiento Verbal'
              }
              
              return (
                <>
                  <span className="text-gray-400 mx-2">/</span>
                  <li>
                    <span className="text-gray-700 font-semibold">
                      {categoriaLabels[categoria] || categoria}
                    </span>
                  </li>
                </>
              )
            }
            
            return null
          })()}
        </ol>

      </div>

      {/* Overlay para cerrar dropdowns */}
      {openDropdown && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setOpenDropdown(null)}
        />
      )}
    </nav>
  )
}