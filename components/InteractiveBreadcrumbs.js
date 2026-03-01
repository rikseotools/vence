// components/InteractiveBreadcrumbs.js
'use client'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { getSupabaseClient } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { OPOSICIONES, getBlockForTopic } from '@/lib/config/oposiciones'
import CcaaFlag, { hasCcaaFlag } from './CcaaFlag'

const supabase = getSupabaseClient()

export default function InteractiveBreadcrumbs({ customLabels = {}, className = "" }) {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [openDropdown, setOpenDropdown] = useState(null)
  const [dropdownSearch, setDropdownSearch] = useState('')
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

  // Detectar la sección actual (test, temario, info, etc.)
  const getCurrentSection = () => {
    if (pathname.includes('/test')) return '/test'
    if (pathname.includes('/temario')) return '/temario'
    if (pathname.includes('/simulacros')) return '/simulacros'
    // Si estamos en página principal de oposición (información), mantener vacío
    if (pathname === '/auxiliar-administrativo-estado' || pathname === '/administrativo-estado' || pathname === '/tramitacion-procesal' || pathname === '/auxilio-judicial' || pathname === '/auxiliar-administrativo-carm' || pathname === '/auxiliar-administrativo-cyl' || pathname === '/auxiliar-administrativo-madrid' || pathname === '/auxiliar-administrativo-canarias' || pathname === '/auxiliar-administrativo-clm' || pathname === '/auxiliar-administrativo-extremadura') return ''
    return '/test' // Por defecto ir a tests (para otras páginas como /leyes)
  }

  // Opciones disponibles para cambiar de oposición/sección
  // Generado dinámicamente desde config central
  const currentSection = getCurrentSection()
  const oppositionOptions = [
    ...OPOSICIONES.map(o => ({
      key: o.slug,
      label: `${o.emoji} ${o.name}`,
      name: o.name,
      emoji: o.emoji,
      hasFlag: hasCcaaFlag(o.id),
      path: `/${o.slug}${currentSection}`,
      oposicionId: o.id,
    })),
    { key: 'leyes', label: '📚 Leyes', name: 'Leyes', emoji: '📚', hasFlag: false, path: '/leyes', oposicionId: null },
    { key: 'por-leyes', label: '📖 Test Por Leyes', name: 'Test Por Leyes', emoji: '📖', hasFlag: false, path: '/test/por-leyes', oposicionId: null },
    { key: 'psicotecnicos', label: '🧩 Psicotécnicos', name: 'Psicotécnicos', emoji: '🧩', hasFlag: false, path: '/psicotecnicos', oposicionId: null },
    { key: 'teoria', label: '📖 Teoría', name: 'Teoría', emoji: '📖', hasFlag: false, path: '/teoria', oposicionId: null }
  ]

  const filteredOptions = useMemo(() => {
    if (!dropdownSearch.trim()) return oppositionOptions
    const term = dropdownSearch.toLowerCase()
    return oppositionOptions.filter(opt => opt.label.toLowerCase().includes(term))
  }, [dropdownSearch, oppositionOptions])

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
    } else if (isTramitacionProcesal) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isAuxilioJudicial) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isCarm) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isCyl) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isAndalucia) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isMadrid) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isCanarias) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isClm) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
      ]
    } else if (isExtremadura) {
      return [
        { key: 'info', label: 'ℹ️ Información', path: '' },
        { key: 'test', label: '🎯 Tests', path: '/test' },
        { key: 'temario', label: '📚 Temario', path: '/temario' }
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
  const isAdministrativo = pathname.includes('/administrativo-estado')
  const isTramitacionProcesal = pathname.includes('/tramitacion-procesal')
  const isAuxilioJudicial = pathname.includes('/auxilio-judicial')
  const isCarm = pathname.includes('/auxiliar-administrativo-carm')
  const isCyl = pathname.includes('/auxiliar-administrativo-cyl')
  const isAndalucia = pathname.includes('/auxiliar-administrativo-andalucia')
  const isMadrid = pathname.includes('/auxiliar-administrativo-madrid')
  const isCanarias = pathname.includes('/auxiliar-administrativo-canarias')
  const isClm = pathname.includes('/auxiliar-administrativo-clm')
  const isExtremadura = pathname.includes('/auxiliar-administrativo-extremadura')
  const isLeyes = pathname.includes('/leyes')
  const isTeoria = pathname.includes('/teoria')
  const isInTests = pathname.includes('/test')
  const isPsicotecnicos = pathname.includes('/psicotecnicos')
  const isInTemario = pathname.includes('/temario')
  const isPorLeyes = pathname === '/test/por-leyes' || pathname === '/test/multi-ley'

  // Tests independientes bajo /test/ que no pertenecen a ninguna oposición
  const isStandaloneTest = pathname.startsWith('/test/') && !isAuxiliarAdmin && !isAdministrativo && !isTramitacionProcesal && !isAuxilioJudicial && !isCarm && !isCyl && !isAndalucia && !isMadrid && !isCanarias && !isClm && !isExtremadura

  // Detectar si estamos en página de información (página principal de oposición)
  const isInInfo = (pathname === '/auxiliar-administrativo-estado' || pathname === '/administrativo-estado' || pathname === '/tramitacion-procesal' || pathname === '/auxilio-judicial' || pathname === '/auxiliar-administrativo-carm' || pathname === '/auxiliar-administrativo-cyl' || pathname === '/auxiliar-administrativo-andalucia' || pathname === '/auxiliar-administrativo-madrid' || pathname === '/auxiliar-administrativo-canarias' || pathname === '/auxiliar-administrativo-clm' || pathname === '/auxiliar-administrativo-extremadura')
  
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

  // Nombres legibles para las oposiciones - generado desde config central
  const OPOSICION_NAMES = Object.fromEntries(
    OPOSICIONES.map(o => [o.id, o.name])
  )

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
          window.dispatchEvent(new CustomEvent('profileUpdated'))

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
      const currentOpo = OPOSICIONES.find(o => pathname.includes(`/${o.slug}`))
      let basePath = currentOpo ? `/${currentOpo.slug}` : (isLeyes ? '/leyes' : '')
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
          {(isAuxiliarAdmin || isAdministrativo || isTramitacionProcesal || isAuxilioJudicial || isCarm || isCyl || isAndalucia || isMadrid || isCanarias || isClm || isExtremadura || isLeyes || isTeoria || isPsicotecnicos || isStandaloneTest) && (
            <li className="flex items-center relative">
              <div className="flex items-center">
                {/* Texto clickeable para ir a la página principal (solo si no estamos ya ahí) */}
                {(() => {
                  // Determinar si mostrar link (no estamos en la página principal)
                  const showAsLink =
                    (isAuxiliarAdmin && pathname !== '/auxiliar-administrativo-estado') ||
                    (isAdministrativo && pathname !== '/administrativo-estado') ||
                    (isTramitacionProcesal && pathname !== '/tramitacion-procesal') ||
                    (isAuxilioJudicial && pathname !== '/auxilio-judicial') ||
                    (isCarm && pathname !== '/auxiliar-administrativo-carm') ||
                    (isCyl && pathname !== '/auxiliar-administrativo-cyl') ||
                    (isAndalucia && pathname !== '/auxiliar-administrativo-andalucia') ||
                    (isMadrid && pathname !== '/auxiliar-administrativo-madrid') ||
                    (isCanarias && pathname !== '/auxiliar-administrativo-canarias') ||
                    (isClm && pathname !== '/auxiliar-administrativo-clm') ||
                    (isExtremadura && pathname !== '/auxiliar-administrativo-extremadura') ||
                    (isLeyes && pathname !== '/leyes') ||
                    (isTeoria && pathname !== '/teoria') ||
                    (isPsicotecnicos && pathname !== '/psicotecnicos') ||
                    (isStandaloneTest && !isPorLeyes) || // Siempre link en tests standalone (menos por-leyes cuando estamos en él)
                    (isPorLeyes && pathname !== '/test/por-leyes')

                  // Determinar href
                  const linkHref =
                    isAuxiliarAdmin ? '/auxiliar-administrativo-estado' :
                    isAdministrativo ? '/administrativo-estado' :
                    isTramitacionProcesal ? '/tramitacion-procesal' :
                    isAuxilioJudicial ? '/auxilio-judicial' :
                    isCarm ? '/auxiliar-administrativo-carm' :
                    isCyl ? '/auxiliar-administrativo-cyl' :
                    isAndalucia ? '/auxiliar-administrativo-andalucia' :
                    isMadrid ? '/auxiliar-administrativo-madrid' :
                    isCanarias ? '/auxiliar-administrativo-canarias' :
                    isClm ? '/auxiliar-administrativo-clm' :
                    isExtremadura ? '/auxiliar-administrativo-extremadura' :
                    isLeyes ? '/leyes' :
                    isTeoria ? '/teoria' :
                    isPsicotecnicos ? '/psicotecnicos' :
                    isPorLeyes ? '/test/por-leyes' :
                    isStandaloneTest ? '/test/por-leyes' : '#'

                  // Determinar texto (JSX para CCAA con banderas SVG)
                  const labelContent =
                    isCarm ? <><CcaaFlag oposicionId="auxiliar_administrativo_carm" /> Aux. Admin. CARM</> :
                    isCyl ? <><CcaaFlag oposicionId="auxiliar_administrativo_cyl" /> Aux. Admin. CyL</> :
                    isAndalucia ? <><CcaaFlag oposicionId="auxiliar_administrativo_andalucia" /> Aux. Admin. Andalucía</> :
                    isMadrid ? <><CcaaFlag oposicionId="auxiliar_administrativo_madrid" /> Aux. Admin. Madrid</> :
                    isCanarias ? <><CcaaFlag oposicionId="auxiliar_administrativo_canarias" /> Aux. Admin. Canarias</> :
                    isClm ? <><CcaaFlag oposicionId="auxiliar_administrativo_clm" /> Aux. Admin. CLM</> :
                    isExtremadura ? <><CcaaFlag oposicionId="auxiliar_administrativo_extremadura" /> Aux. Admin. Extremadura</> :
                    isAuxiliarAdmin ? '👤 Auxiliar Administrativo Estado' :
                    isAdministrativo ? '👨‍💼 Administrativo del Estado' :
                    isTramitacionProcesal ? '⚖️ Tramitación Procesal' :
                    isAuxilioJudicial ? '⚖️ Auxilio Judicial' :
                    isLeyes ? '📚 Leyes' :
                    isTeoria ? '📖 Teoría' :
                    isPsicotecnicos ? '🧩 Psicotécnicos' :
                    isStandaloneTest ? '🎯 Tests' : ''

                  if (showAsLink) {
                    return (
                      <Link href={linkHref} className="text-blue-600 hover:text-blue-800 transition-colors inline-flex items-center gap-1">
                        {labelContent}
                      </Link>
                    )
                  }
                  return <span className="text-gray-700 font-semibold inline-flex items-center gap-1">{labelContent}</span>
                })()}
                
                {/* Flecha para dropdown */}
                <button
                  onClick={() => { setDropdownSearch(''); setOpenDropdown(openDropdown === 'opposition' ? null : 'opposition') }}
                  className="ml-1 p-1 text-blue-600 hover:text-blue-800 transition-colors focus:outline-none"
                >
                  <ChevronDownIcon className="h-4 w-4" />
                </button>
              </div>

              {/* Dropdown de oposiciones */}
              {openDropdown === 'opposition' && (
                <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2">
                    <div className="text-xs text-gray-500 mb-2 px-2">Cambiar a:</div>
                    <input
                      type="text"
                      value={dropdownSearch}
                      onChange={(e) => setDropdownSearch(e.target.value)}
                      placeholder="Buscar oposición..."
                      autoFocus
                      className="w-full px-3 py-1.5 mb-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    <div className="max-h-64 overflow-y-auto">
                      {filteredOptions.length > 0 ? filteredOptions.map((option) => (
                        <button
                          key={option.key}
                          onClick={() => changeOpposition(option)}
                          className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-md transition-colors text-sm flex items-center gap-1.5"
                        >
                          {option.hasFlag ? (
                            <><CcaaFlag oposicionId={option.oposicionId} /> {option.name}</>
                          ) : (
                            option.label
                          )}
                          {option.oposicionId && (
                            <span className="text-xs text-gray-400 ml-auto">(objetivo)</span>
                          )}
                        </button>
                      )) : (
                        <div className="px-3 py-2 text-sm text-gray-400">Sin resultados</div>
                      )}
                    </div>
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

          {/* Separador para tests standalone (excepto por-leyes que es raíz) */}
          {isStandaloneTest && pathname !== '/test/por-leyes' && (
            <span className="text-gray-400 mx-2">/</span>
          )}

          {/* Breadcrumb segundo nivel para tests standalone */}
          {isStandaloneTest && pathname !== '/test/por-leyes' && (
            <li className="flex items-center">
              <span className="text-gray-700 font-semibold">
                {pathname === '/test/multi-ley' && '🎯 Test Multi-Ley'}
                {pathname === '/test/rapido' && '⚡ Test Rápido'}
                {pathname === '/test/personalizado' && '⚙️ Test Personalizado'}
                {pathname === '/test/repaso-fallos' && '🔄 Repaso de Fallos'}
                {pathname === '/test/repaso-fallos-v2' && '🔄 Repaso de Fallos'}
                {pathname === '/test/aleatorio-examen' && '📝 Test Aleatorio Examen'}
                {pathname === '/test/articulo' && '📄 Test por Artículo'}
                {pathname === '/test/desde-chat' && '💬 Test desde Chat'}
                {pathname === '/test/explorar' && '🔍 Explorar Tests'}
                {pathname === '/test/mantener-racha' && '🔥 Mantener Racha'}
                {!pathname.match(/\/(multi-ley|rapido|personalizado|repaso-fallos(-v2)?|aleatorio-examen|articulo|desde-chat|explorar|mantener-racha)$/) && '🎯 Test'}
              </span>
            </li>
          )}

          {/* Separador */}
          {(isAuxiliarAdmin || isAdministrativo || isTramitacionProcesal || isAuxilioJudicial || isCarm || isCyl || isAndalucia || isMadrid || isCanarias || isClm || isExtremadura || isLeyes || isTeoria || isPsicotecnicos) && (isInTests || isInTemario || isInInfo) && (
            <span className="text-gray-400 mx-2">/</span>
          )}

          {/* Breadcrumb para Sección (Tests/Temario/Información) - NO duplicar Psicotécnicos ya que está en el nivel superior */}
          {(isInTests || isInTemario || isInInfo) && !isStandaloneTest && (
            <li className="flex items-center relative">
              <div className="flex items-center">
                {/* Si estamos en una página específica dentro de la sección, hacer clickeable para volver al índice */}
                {(() => {
                  const basePath = isAuxiliarAdmin ? '/auxiliar-administrativo-estado' :
                                   isAdministrativo ? '/administrativo-estado' :
                                   isTramitacionProcesal ? '/tramitacion-procesal' :
                                   isAuxilioJudicial ? '/auxilio-judicial' :
                                   isCarm ? '/auxiliar-administrativo-carm' :
                                   isCyl ? '/auxiliar-administrativo-cyl' :
                                   isAndalucia ? '/auxiliar-administrativo-andalucia' :
                                   isMadrid ? '/auxiliar-administrativo-madrid' :
                                   isCanarias ? '/auxiliar-administrativo-canarias' :
                                   isClm ? '/auxiliar-administrativo-clm' :
                                   isExtremadura ? '/auxiliar-administrativo-extremadura' : ''
                  const isInSpecificPage = pathname.includes('/tema-') || pathname.includes('/test/')

                  if (isInSpecificPage && basePath) {
                    return (
                      <Link
                        href={`${basePath}${isInTemario ? '/temario' : isInTests ? '/test' : ''}`}
                        className="text-blue-600 hover:text-blue-800 transition-colors"
                      >
                        {isInInfo && 'ℹ️ Información'}
                        {isInTests && '🎯 Tests'}
                        {isInTemario && '📚 Temario'}
                      </Link>
                    )
                  }

                  return (
                    <span className="text-gray-700 font-semibold">
                      {isInInfo && 'ℹ️ Información'}
                      {isInTests && '🎯 Tests'}
                      {isInTemario && '📚 Temario'}
                    </span>
                  )
                })()}
                
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
            // Mostrar tema específico con bloque
            const temaMatch = pathname.match(/tema[/-](\d+)/)
            const categoriaMatch = pathname.match(/psicotecnicos\/(.+)/)

            if (temaMatch) {
              const temaNum = parseInt(temaMatch[1])

              // Detectar oposición actual desde el pathname y buscar bloque en config central
              const currentOpo = OPOSICIONES.find(o => pathname.includes(`/${o.slug}`))
              const blockInfo = currentOpo ? getBlockForTopic(currentOpo.slug, temaNum) : null
              const basePath = currentOpo ? `/${currentOpo.slug}/test` : ''

              return (
                <>
                  {blockInfo && (
                    <>
                      <span className="text-gray-400 mx-2">/</span>
                      <li>
                        <Link
                          href={`${basePath}#${blockInfo.blockId}`}
                          className="text-blue-600 hover:text-blue-800 transition-colors"
                        >
                          📦 {blockInfo.blockTitle}
                        </Link>
                      </li>
                    </>
                  )}
                  <span className="text-gray-400 mx-2">/</span>
                  <li>
                    <span className="text-gray-700 font-semibold">
                      📋 Tema {blockInfo ? blockInfo.displayNum : temaNum}
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
          onClick={() => { setDropdownSearch(''); setOpenDropdown(null) }}
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