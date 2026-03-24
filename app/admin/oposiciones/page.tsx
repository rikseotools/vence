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
      // 1. Todo via API route (bypass RLS, datos ya agregados en servidor)
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

      // 3. Datos de usuarios (ya agregados en el servidor)
      setTotalUsers(json.totalUsers || 0)
      setUserCounts(json.userCounts || {})
      setUserOposiciones(json.customOposiciones || [])
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
        <StatCard label="En onboarding" value={OFFICIAL_OPOSICIONES.length} sublabel="lista oficial" color="blue" />
        <StatCard label="Con temario" value={stats.withConfig.length} sublabel="tienen preguntas" color="green" />
        <StatCard label="En BD" value={stats.withBD.length} sublabel="con convocatoria" color="purple" />
        <StatCard label="Completas" value={stats.inAllThree.length} sublabel="onboarding+temario+BD" color="emerald" />
        <StatCard label="Inventadas" value={stats.customCount} sublabel="creadas por usuarios" color="orange" />
        <StatCard label="Usuarios sin oficial" value={stats.customUsers} sublabel={`eligieron custom (de ${totalUsers} total)`} color="red" />
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
      {activeTab === 'custom' && <CustomTab data={userOposiciones} onMigrated={loadData} />}
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

function findBestMatch(nombre: string): string | null {
  const norm = nombre.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, ' ').trim()
  const words = norm.split(/\s+/).filter(w => w.length > 2)
  if (words.length === 0) return null

  let bestId: string | null = null
  let bestScore = 0

  OFFICIAL_OPOSICIONES.forEach(official => {
    const officialNorm = official.nombre.toLowerCase().replace(/[^a-záéíóúñ0-9\s]/g, ' ').trim()
    const matchCount = words.filter(w => officialNorm.includes(w)).length
    const score = matchCount / words.length
    if (score > bestScore && score >= 0.5) {
      bestScore = score
      bestId = official.id
    }
  })

  return bestId
}

function CustomTab({ data, onMigrated }: { data: UserOposicion[]; onMigrated: () => void }) {
  const [selections, setSelections] = useState<Record<string, string>>({})
  const [migrating, setMigrating] = useState<string | null>(null)
  const [migratedIds, setMigratedIds] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState<{ uuid: string; text: string; ok: boolean } | null>(null)

  // Preseleccionar matches automaticos
  useEffect(() => {
    const initial: Record<string, string> = {}
    data.forEach(o => {
      if (o.nombre) {
        const match = findBestMatch(o.nombre)
        if (match) initial[o.target_oposicion] = match
      }
    })
    setSelections(initial)
  }, [data])

  const handleMigrate = async (uuid: string, count: number) => {
    const targetSlug = selections[uuid]
    if (!targetSlug) return

    const official = OFFICIAL_OPOSICIONES.find(o => o.id === targetSlug)
    if (!official) return

    const confirmed = window.confirm(
      `Migrar ${count} usuario(s) de "${data.find(d => d.target_oposicion === uuid)?.nombre}" a "${official.nombre}"?`
    )
    if (!confirmed) return

    setMigrating(uuid)
    setMessage(null)

    try {
      const res = await fetch('/api/admin/oposiciones-migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromUUID: uuid,
          toSlug: targetSlug,
          toData: {
            id: official.id,
            nombre: official.nombre,
            categoria: official.categoria,
            administracion: official.administracion,
            tipo: 'oficial',
          },
        }),
      })
      const result = await res.json()

      if (result.success) {
        setMigratedIds(prev => new Set([...prev, uuid]))
        setMessage({ uuid, text: `${result.migratedCount} usuarios migrados`, ok: true })
        onMigrated()
      } else {
        setMessage({ uuid, text: result.error || 'Error', ok: false })
      }
    } catch (err) {
      setMessage({ uuid, text: 'Error de conexion', ok: false })
    } finally {
      setMigrating(null)
    }
  }

  const pending = data.filter(o => !migratedIds.has(o.target_oposicion))

  return (
    <div className="space-y-4">
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-lg p-3">
        <p className="text-sm text-orange-800 dark:text-orange-200">
          <strong>{pending.length}</strong> oposiciones inventadas por usuarios.
          Selecciona a cual oficial corresponde cada una y pulsa "Migrar" para traspasar los usuarios.
          {migratedIds.size > 0 && (
            <span className="ml-2 font-bold text-green-700 dark:text-green-300">
              ({migratedIds.size} migradas)
            </span>
          )}
        </p>
      </div>

      <div className="space-y-3">
        {pending.map(o => {
          const selected = selections[o.target_oposicion] || ''
          const selectedOfficial = OFFICIAL_OPOSICIONES.find(off => off.id === selected)
          const isMigrating = migrating === o.target_oposicion
          const msg = message?.uuid === o.target_oposicion ? message : null

          return (
            <div
              key={o.target_oposicion}
              className={`border rounded-lg p-3 ${
                selected
                  ? 'border-yellow-300 dark:border-yellow-700 bg-yellow-50/50 dark:bg-yellow-900/10'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                {/* Info de la custom */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {o.nombre || 'Sin nombre'}
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 dark:bg-orange-800 text-orange-800 dark:text-orange-200">
                      {o.count} usuario{o.count !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {[o.categoria, o.administracion].filter(Boolean).join(' - ') || 'Sin categoria'}
                    <span className="ml-2 font-mono text-gray-400">{o.target_oposicion.slice(0, 8)}...</span>
                  </div>
                </div>

                {/* Selector de oficial */}
                <div className="flex items-center gap-2">
                  <select
                    value={selected}
                    onChange={e => setSelections({ ...selections, [o.target_oposicion]: e.target.value })}
                    className="text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 max-w-[220px]"
                  >
                    <option value="">-- Mapear a oficial --</option>
                    {OFFICIAL_OPOSICIONES.map(off => (
                      <option key={off.id} value={off.id}>
                        {off.nombre} ({off.categoria})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => handleMigrate(o.target_oposicion, o.count)}
                    disabled={!selected || isMigrating}
                    className="px-3 py-1.5 text-xs font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isMigrating ? 'Migrando...' : 'Migrar'}
                  </button>
                </div>
              </div>

              {/* Match sugerido */}
              {selected && selectedOfficial && (
                <div className="mt-2 text-xs text-yellow-700 dark:text-yellow-300">
                  Destino: <strong>{selectedOfficial.nombre}</strong> ({selectedOfficial.categoria} - {selectedOfficial.administracion})
                </div>
              )}

              {/* Resultado */}
              {msg && (
                <div className={`mt-2 text-xs font-medium ${msg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {msg.text}
                </div>
              )}
            </div>
          )
        })}
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
