'use client'

import { useState, useEffect, useMemo } from 'react'
// No necesita supabase client - todo via API route
import { OFFICIAL_OPOSICIONES } from '@/components/OnboardingModal'

// Tipos
interface OposicionBD {
  id: string
  slug: string | null
  short_name: string | null
  nombre: string | null
  is_active: boolean
  plazas_libres: number | null
  exam_date: string | null
}

interface OposicionConfig {
  id: string
  name: string
  shortName: string
  hasBlocks: boolean
  themesCount: number
}

interface UserOposicion {
  target_oposicion: string
  nombre: string | null
  categoria: string | null
  administracion: string | null
  tipo: string | null
  count: number
}

interface CrossReference {
  id: string
  nombre: string
  inOnboarding: boolean
  inConfig: boolean
  inBD: boolean
  bdSlug: string | null
  bdActive: boolean | null
  configThemes: number | null
  userCount: number
  isUUID: boolean
  customNombre: string | null
  categoria: string | null
  administracion: string | null
}

type TabId = 'cruzada' | 'custom' | 'onboarding' | 'config' | 'bd'

const TABS: { id: TabId; label: string }[] = [
  { id: 'cruzada', label: 'Vista cruzada' },
  { id: 'custom', label: 'Custom (usuarios)' },
  { id: 'onboarding', label: 'Onboarding (72)' },
  { id: 'config', label: 'Config (temario)' },
  { id: 'bd', label: 'BD (convocatoria)' },
]

export default function AdminOposicionesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('cruzada')
  const [loading, setLoading] = useState(true)
  const [oposicionesBD, setOposicionesBD] = useState<OposicionBD[]>([])
  const [oposicionesConfig, setOposicionesConfig] = useState<OposicionConfig[]>([])
  const [userOposiciones, setUserOposiciones] = useState<UserOposicion[]>([])
  const [userCounts, setUserCounts] = useState<Record<string, number>>({})
  const [totalUsers, setTotalUsers] = useState(0)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      // 1. Todo via API route (bypass RLS)
      const res = await fetch('/api/admin/oposiciones-stats')
      const json = await res.json()

      // Oposiciones de BD
      const bdData = (json.oposicionesBD || []).map((o: any) => ({
        id: o.id,
        slug: o.slug,
        short_name: o.shortName,
        nombre: o.nombre,
        is_active: o.isActive,
        plazas_libres: o.plazasLibres,
        exam_date: o.examDate,
      }))
      setOposicionesBD(bdData)

      // 2. Config (import dinamico)
      const configModule = await import('@/lib/config/oposiciones')
      const configs: OposicionConfig[] = configModule.OPOSICIONES.map((o: any) => ({
        id: o.id,
        name: o.name,
        shortName: o.shortName,
        hasBlocks: (o.blocks?.length || 0) > 0,
        themesCount: o.blocks?.reduce((acc: number, b: any) => acc + (b.themes?.length || 0), 0) || 0,
      }))
      setOposicionesConfig(configs)

      // 3. Perfiles de usuarios
      const profiles = json.profiles || []

      if (profiles.length > 0) {
        setTotalUsers(profiles.length)

        // Contar usuarios por target_oposicion
        const counts: Record<string, number> = {}
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

        // Custom oposiciones (UUID)
        const customMap = new Map<string, UserOposicion>()

        profiles.forEach((p: any) => {
          const key = p.targetOposicion || p.target_oposicion
          if (!key) return
          counts[key] = (counts[key] || 0) + 1

          const data = p.targetOposicionData || p.target_oposicion_data
          if (uuidPattern.test(key) && !customMap.has(key)) {
            customMap.set(key, {
              target_oposicion: key,
              nombre: data?.nombre || null,
              categoria: data?.categoria || null,
              administracion: data?.administracion || null,
              tipo: data?.tipo || null,
              count: 0,
            })
          }
        })

        // Actualizar counts en custom
        customMap.forEach((v, k) => {
          v.count = counts[k] || 0
        })

        setUserCounts(counts)
        setUserOposiciones(
          Array.from(customMap.values()).sort((a, b) => b.count - a.count)
        )
      }
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Vista cruzada
  const crossData = useMemo(() => {
    const map = new Map<string, CrossReference>()

    // 1. Onboarding
    OFFICIAL_OPOSICIONES.forEach(o => {
      map.set(o.id, {
        id: o.id,
        nombre: o.nombre,
        inOnboarding: true,
        inConfig: false,
        inBD: false,
        bdSlug: null,
        bdActive: null,
        configThemes: null,
        userCount: userCounts[o.id] || 0,
        isUUID: false,
        customNombre: null,
        categoria: o.categoria,
        administracion: o.administracion,
      })
    })

    // 2. Config
    oposicionesConfig.forEach(o => {
      const existing = map.get(o.id)
      if (existing) {
        existing.inConfig = true
        existing.configThemes = o.themesCount
      } else {
        map.set(o.id, {
          id: o.id,
          nombre: o.name,
          inOnboarding: false,
          inConfig: true,
          inBD: false,
          bdSlug: null,
          bdActive: null,
          configThemes: o.themesCount,
          userCount: userCounts[o.id] || 0,
          isUUID: false,
          customNombre: null,
          categoria: null,
          administracion: null,
        })
      }
    })

    // 3. BD - mapear slug (con guiones) a id (con underscores)
    oposicionesBD.forEach(o => {
      const idFromSlug = o.slug?.replace(/-/g, '_') || null
      if (idFromSlug) {
        const existing = map.get(idFromSlug)
        if (existing) {
          existing.inBD = true
          existing.bdSlug = o.slug
          existing.bdActive = o.is_active
        } else {
          map.set(idFromSlug, {
            id: idFromSlug,
            nombre: o.short_name || o.nombre || o.slug || 'Sin nombre',
            inOnboarding: false,
            inConfig: false,
            inBD: true,
            bdSlug: o.slug,
            bdActive: o.is_active,
            configThemes: null,
            userCount: userCounts[idFromSlug] || 0,
            isUUID: false,
            customNombre: null,
            categoria: null,
            administracion: null,
          })
        }
      }
    })

    return Array.from(map.values()).sort((a, b) => b.userCount - a.userCount)
  }, [oposicionesBD, oposicionesConfig, userCounts])

  // Stats
  const stats = useMemo(() => {
    const onlyOnboarding = crossData.filter(o => o.inOnboarding && !o.inConfig && !o.inBD)
    const withConfig = crossData.filter(o => o.inConfig)
    const withBD = crossData.filter(o => o.inBD)
    const inAllThree = crossData.filter(o => o.inOnboarding && o.inConfig && o.inBD)
    const customCount = userOposiciones.length
    const customUsers = userOposiciones.reduce((acc, o) => acc + o.count, 0)

    return { onlyOnboarding, withConfig, withBD, inAllThree, customCount, customUsers }
  }, [crossData, userOposiciones])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Oposiciones</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Cruce de 3 fuentes: Onboarding ({OFFICIAL_OPOSICIONES.length}), Config con temario ({oposicionesConfig.length}), BD convocatoria ({oposicionesBD.length}) + Custom de usuarios ({userOposiciones.length})
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Onboarding" value={OFFICIAL_OPOSICIONES.length} color="blue" />
        <StatCard label="Con temario" value={stats.withConfig.length} color="green" />
        <StatCard label="Con convocatoria" value={stats.withBD.length} color="purple" />
        <StatCard label="En las 3" value={stats.inAllThree.length} color="emerald" />
        <StatCard label="Custom creadas" value={stats.customCount} color="orange" />
        <StatCard label="Usuarios custom" value={stats.customUsers} sublabel={`de ${totalUsers}`} color="red" />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4 overflow-x-auto" aria-label="Tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {activeTab === 'cruzada' && <CrossTab data={crossData} />}
      {activeTab === 'custom' && <CustomTab data={userOposiciones} />}
      {activeTab === 'onboarding' && <OnboardingTab />}
      {activeTab === 'config' && <ConfigTab data={oposicionesConfig} userCounts={userCounts} />}
      {activeTab === 'bd' && <BDTab data={oposicionesBD} userCounts={userCounts} />}
    </div>
  )
}

// ============================================
// COMPONENTES
// ============================================

function StatCard({ label, value, sublabel, color }: {
  label: string
  value: number
  sublabel?: string
  color: string
}) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300',
    green: 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300',
    orange: 'bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300',
    red: 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300',
  }

  return (
    <div className={`rounded-lg p-3 ${colors[color]}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium">{label}</div>
      {sublabel && <div className="text-xs opacity-70">{sublabel}</div>}
    </div>
  )
}

function Badge({ yes }: { yes: boolean }) {
  return yes
    ? <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">Si</span>
    : <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">No</span>
}

// ============================================
// TAB: Vista cruzada
// ============================================

function CrossTab({ data }: { data: CrossReference[] }) {
  const [filter, setFilter] = useState<'all' | 'missing_config' | 'missing_bd' | 'with_users'>('all')

  const filtered = useMemo(() => {
    switch (filter) {
      case 'missing_config': return data.filter(o => !o.inConfig && o.userCount > 0)
      case 'missing_bd': return data.filter(o => !o.inBD && o.inOnboarding)
      case 'with_users': return data.filter(o => o.userCount > 0)
      default: return data
    }
  }, [data, filter])

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'all' as const, label: 'Todas' },
          { id: 'with_users' as const, label: 'Con usuarios' },
          { id: 'missing_config' as const, label: 'Sin temario (con usuarios)' },
          { id: 'missing_bd' as const, label: 'Sin convocatoria en BD' },
        ].map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              filter === f.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {f.label} ({
              f.id === 'all' ? data.length :
              f.id === 'with_users' ? data.filter(o => o.userCount > 0).length :
              f.id === 'missing_config' ? data.filter(o => !o.inConfig && o.userCount > 0).length :
              data.filter(o => !o.inBD && o.inOnboarding).length
            })
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Oposicion</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuarios</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Onboarding</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temario</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">BD</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temas</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {filtered.map(o => (
              <tr key={o.id} className={`${
                o.inConfig ? 'bg-green-50/50 dark:bg-green-900/10' : ''
              } hover:bg-gray-50 dark:hover:bg-gray-800`}>
                <td className="px-3 py-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{o.nombre}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{o.id}</div>
                  {o.categoria && (
                    <div className="text-xs text-gray-400 dark:text-gray-500">{o.categoria} - {o.administracion}</div>
                  )}
                </td>
                <td className="px-3 py-2 text-center">
                  {o.userCount > 0 ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200">
                      {o.userCount}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">0</span>
                  )}
                </td>
                <td className="px-3 py-2 text-center"><Badge yes={o.inOnboarding} /></td>
                <td className="px-3 py-2 text-center"><Badge yes={o.inConfig} /></td>
                <td className="px-3 py-2 text-center"><Badge yes={o.inBD} /></td>
                <td className="px-3 py-2 text-center text-xs text-gray-600 dark:text-gray-400">
                  {o.configThemes ?? '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// TAB: Custom (usuarios)
// ============================================

function CustomTab({ data }: { data: UserOposicion[] }) {
  // Detectar posibles duplicados con oficiales
  const withDuplicateCheck = useMemo(() => {
    return data.map(o => {
      const nombre = (o.nombre || '').toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, ' ').trim()
      let possibleMatch: string | null = null

      OFFICIAL_OPOSICIONES.forEach(official => {
        const officialNorm = official.nombre.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, ' ').trim()
        const words = nombre.split(/\s+/).filter(w => w.length > 2)
        const matchCount = words.filter(w => officialNorm.includes(w)).length
        if (words.length > 0 && matchCount / words.length >= 0.5) {
          possibleMatch = official.nombre
        }
      })

      return { ...o, possibleMatch }
    })
  }, [data])

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
        <p className="text-sm text-orange-800 dark:text-orange-200">
          <strong>{data.length}</strong> oposiciones creadas por usuarios que no encontraron la suya en el onboarding.
          Las marcadas con "Posible duplicado" podrían mapearse a una oficial existente.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuarios</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cat.</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Admin.</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Posible duplicado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {withDuplicateCheck.map(o => (
              <tr key={o.target_oposicion} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                o.possibleMatch ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''
              }`}>
                <td className="px-3 py-2">
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{o.nombre || 'Sin nombre'}</div>
                  <div className="text-xs text-gray-400 font-mono">{o.target_oposicion.slice(0, 8)}...</div>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200">
                    {o.count}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{o.categoria || '-'}</td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{o.administracion || '-'}</td>
                <td className="px-3 py-2">
                  {o.possibleMatch ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200">
                      ~ {o.possibleMatch}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Nueva</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// TAB: Onboarding
// ============================================

function OnboardingTab() {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-3">
        <p className="text-sm text-blue-800 dark:text-blue-200">
          Las {OFFICIAL_OPOSICIONES.length} oposiciones del <code>OnboardingModal</code>. Son las que los usuarios ven al registrarse.
          Solo se muestran las 10 primeras sin buscar.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">#</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Cat.</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Admin.</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Visible sin buscar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {OFFICIAL_OPOSICIONES.map((o, i) => (
              <tr key={o.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800 ${
                i < 10 ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''
              }`}>
                <td className="px-3 py-2 text-center text-xs text-gray-500">{i + 1}</td>
                <td className="px-3 py-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{o.icon} {o.nombre}</span>
                </td>
                <td className="px-3 py-2 text-xs text-gray-500 font-mono">{o.id}</td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{o.categoria}</td>
                <td className="px-3 py-2 text-xs text-gray-600 dark:text-gray-400">{o.administracion}</td>
                <td className="px-3 py-2 text-center">
                  {i < 10 ? (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">Si</span>
                  ) : (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">Solo buscando</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// TAB: Config (temario)
// ============================================

function ConfigTab({ data, userCounts }: { data: OposicionConfig[]; userCounts: Record<string, number> }) {
  return (
    <div className="space-y-4">
      <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3">
        <p className="text-sm text-green-800 dark:text-green-200">
          Las {data.length} oposiciones con temario configurado en <code>oposiciones.ts</code>. Estas tienen bloques y temas reales.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Temas</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuarios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map(o => (
              <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                <td className="px-3 py-2 text-sm font-medium text-gray-900 dark:text-gray-100">{o.name}</td>
                <td className="px-3 py-2 text-xs text-gray-500 font-mono">{o.id}</td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200">
                    {o.themesCount}
                  </span>
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {userCounts[o.id] || 0}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ============================================
// TAB: BD (convocatoria)
// ============================================

function BDTab({ data, userCounts }: { data: OposicionBD[]; userCounts: Record<string, number> }) {
  return (
    <div className="space-y-4">
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-700 rounded-lg p-3">
        <p className="text-sm text-purple-800 dark:text-purple-200">
          Las {data.length} oposiciones en la tabla <code>oposiciones</code> de Supabase. Tienen datos de convocatoria (plazas, fechas, BOE).
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nombre</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Slug</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Activa</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Plazas</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Examen</th>
              <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuarios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.map(o => {
              const idFromSlug = o.slug?.replace(/-/g, '_') || ''
              return (
                <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-3 py-2">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{o.short_name || o.nombre || 'Sin nombre'}</div>
                    <div className="text-xs text-gray-400 font-mono">{o.id.slice(0, 8)}...</div>
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono">{o.slug || '-'}</td>
                  <td className="px-3 py-2 text-center"><Badge yes={o.is_active} /></td>
                  <td className="px-3 py-2 text-center text-xs text-gray-600 dark:text-gray-400">{o.plazas_libres || '-'}</td>
                  <td className="px-3 py-2 text-center text-xs text-gray-600 dark:text-gray-400">{o.exam_date || '-'}</td>
                  <td className="px-3 py-2 text-center text-sm font-medium text-gray-900 dark:text-gray-100">
                    {userCounts[idFromSlug] || 0}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
