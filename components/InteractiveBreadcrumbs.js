// components/InteractiveBreadcrumbs.js
'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { getSupabaseClient } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const supabase = getSupabaseClient()

export default function InteractiveBreadcrumbs({ customLabels = {}, className = "" }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openDropdown, setOpenDropdown] = useState(null)
  const [toast, setToast] = useState(null)
  const { user } = useAuth()

  // Detectar si venimos de un cambio de oposición (query param)
  useEffect(() => {
    const changedTo = searchParams.get('oposicionCambiada')
    if (changedTo) {
      setToast(`🎯 Oposición cambiada a ${changedTo}`)
      // Limpiar el query param de la URL
      const url = new URL(window.location.href)
      url.searchParams.delete('oposicionCambiada')
      window.history.replaceState({}, '', url.pathname)
      // Ocultar después de 3 segundos
      setTimeout(() => setToast(null), 3000)
    }
  }, [searchParams])
  
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

  // Detectar la sección actual (test, temario, etc.)
  const getCurrentSection = () => {
    if (pathname.includes('/test')) return '/test'
    if (pathname.includes('/temario')) return '/temario'
    if (pathname.includes('/simulacros')) return '/simulacros'
    return '/test' // Por defecto ir a tests
  }

  // Opciones disponibles para cambiar de oposición/sección
  // oposicionId corresponde a las claves en OPOSICION_MENUS del contexto
  const currentSection = getCurrentSection()
  const oppositionOptions = [
    { key: 'auxiliar-administrativo-estado', label: '👤 Auxiliar Administrativo Estado', path: `/auxiliar-administrativo-estado${currentSection}`, oposicionId: 'auxiliar_administrativo_estado' },
    { key: 'administrativo', label: '👨‍💼 Administrativo del Estado', path: `/administrativo-estado${currentSection}`, oposicionId: 'administrativo_estado' },
    { key: 'leyes', label: '⚖️ Leyes', path: '/leyes', oposicionId: null },
    { key: 'psicotecnicos', label: '🧩 Psicotécnicos', path: '/psicotecnicos', oposicionId: null },
    { key: 'teoria', label: '📖 Teoría', path: '/teoria', oposicionId: null }
  ]

  // Opciones de sección específicas según contexto
  const getSectionOptions = () => {
    if (isAuxiliarAdmin) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isAdministrativo) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' }
      ]
    } else if (isLeyes) {
      return [
        { key: 'test', label: '🎯 Tests', path: '/test' }
      ]
    } else if (isTeoria) {
      return [
        { key: 'test', label: '🎯 Tests', path: '/test' }
      ]
    } else if (isPsicotecnicos) {
      return [
        { key: 'test', label: '🎯 Tests', path: '/psicotecnicos/test' }
      ]
    } else {
      return []
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

  // Detectar si estamos en página de información (página principal de oposición)
  const isInInfo = (pathname === '/auxiliar-administrativo-estado' || pathname === '/administrativo-estado')
  
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

  // Nombres legibles para las oposiciones
  const OPOSICION_NAMES = {
    'auxiliar_administrativo_estado': 'Auxiliar Administrativo',
    'administrativo_estado': 'Administrativo del Estado',
    'gestion_procesal': 'Gestión Procesal'
  }

  // Función para cambiar de oposición (va a la página principal de la nueva oposición)
  const changeOpposition = async (option) => {
    console.log('🔄 changeOpposition llamado:', option)
    setOpenDropdown(null)

    // Si es una oposición válida (no Leyes/Teoría), actualizar el perfil PRIMERO
    if (option.oposicionId && user) {
      console.log('📝 Actualizando oposición directamente en BD para user:', user.id)

      try {
        const oposicionName = OPOSICION_NAMES[option.oposicionId] || 'Nueva Oposición'
        const newOposicionData = {
          id: option.oposicionId,
          name: oposicionName
        }

        const { data, error } = await supabase
          .from('user_profiles')
          .update({
            target_oposicion: option.oposicionId,
            target_oposicion_data: JSON.stringify(newOposicionData),
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id)
          .select()

        console.log('📊 Resultado update:', { data, error, userId: user.id })

        if (error) {
          console.error('❌ Error actualizando oposición:', error.message || error.code || JSON.stringify(error))
        } else if (!data || data.length === 0) {
          console.warn('⚠️ Update no afectó ninguna fila - verificar user_id:', user.id)
        } else {
          console.log('✅ Oposición actualizada en BD:', option.oposicionId)

          // Disparar evento para que otros componentes recarguen
          window.dispatchEvent(new CustomEvent('oposicionAssigned'))

          // Navegar con query param para mostrar feedback en la nueva página
          router.push(`${option.path}?oposicionCambiada=${encodeURIComponent(oposicionName)}`)
          return
        }
      } catch (err) {
        console.error('❌ Error en changeOpposition:', err)
      }
    }

    // Navegar inmediatamente si no hay usuario, no es oposición, o hubo error
    router.push(option.path)
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
          {(isAuxiliarAdmin || isAdministrativo || isLeyes || isTeoria || isPsicotecnicos) && (
            <li className="flex items-center relative">
              <div className="flex items-center">
                {/* Texto clickeable para ir a la página principal (solo si no estamos ya ahí) */}
                {((isAuxiliarAdmin && pathname !== '/auxiliar-administrativo-estado') ||
                  (isAdministrativo && pathname !== '/administrativo-estado') ||
                  (isLeyes && pathname !== '/leyes') ||
                  (isTeoria && pathname !== '/teoria') ||
                  (isPsicotecnicos && pathname !== '/psicotecnicos')) ? (
                  <Link
                    href={
                      isAuxiliarAdmin ? '/auxiliar-administrativo-estado' :
                      isAdministrativo ? '/administrativo-estado' :
                      isLeyes ? '/leyes' :
                      isTeoria ? '/teoria' :
                      isPsicotecnicos ? '/psicotecnicos' : '#'
                    }
                    className="text-blue-600 hover:text-blue-800 transition-colors"
                  >
                    {isAuxiliarAdmin && '👤 Auxiliar Administrativo Estado'}
                    {isAdministrativo && '👨‍💼 Administrativo del Estado'}
                    {isLeyes && '⚖️ Leyes'}
                    {isTeoria && '📖 Teoría'}
                    {isPsicotecnicos && '🧩 Psicotécnicos'}
                  </Link>
                ) : (
                  <span className="text-gray-700 font-semibold">
                    {isAuxiliarAdmin && '👤 Auxiliar Administrativo Estado'}
                    {isAdministrativo && '👨‍💼 Administrativo del Estado'}
                    {isLeyes && '⚖️ Leyes'}
                    {isTeoria && '📖 Teoría'}
                    {isPsicotecnicos && '🧩 Psicotécnicos'}
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
                        onClick={() => changeOpposition(option)}
                        className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors text-sm"
                      >
                        {option.label}
                        {option.oposicionId && (
                          <span className="text-xs text-gray-400 ml-2">(objetivo)</span>
                        )}
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
          {(isAuxiliarAdmin || isAdministrativo || isLeyes || isTeoria || isPsicotecnicos) && (isInTests || isInTemario || isInInfo) && (
            <span className="text-gray-400 mx-2">/</span>
          )}

          {/* Breadcrumb para Sección (Tests/Temario/Información) - NO duplicar Psicotécnicos ya que está en el nivel superior */}
          {(isInTests || isInTemario || isInInfo) && (
            <li className="flex items-center relative">
              <div className="flex items-center">
                {/* Texto clickeable - no navega porque ya estamos en la sección actual */}
                <span className="text-gray-700 font-semibold">
                  {isInInfo && 'ℹ️ Información'}
                  {isInTests && '🎯 Tests'}
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
                          (option.key === 'info' && isInInfo) ||
                          (option.key === 'test' && isInTests) ||
                          (option.key === 'temario' && pathname.includes('/temario'))
                        }
                      >
                        {option.label}
                        {((option.key === 'info' && isInInfo) ||
                          (option.key === 'test' && isInTests) ||
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

      {/* Toast de confirmación */}
      {toast && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg">
          {toast}
        </div>
      )}

    </nav>
  )
}