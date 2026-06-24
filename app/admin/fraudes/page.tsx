'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { isAdminEmail } from '@/lib/auth/adminEmails'
import { adminFetch } from '@/lib/api/adminFetch'
import { getAuthHeaders } from '@/lib/api/authHeaders'

type Tab = 'premium' | 'multicuenta' | 'bots' | 'bloqueados'

interface PremiumSharing {
  user_id: string
  email: string
  full_name: string
  cities: string[]
  devices: string[]
  session_count: number
  last_session: string
}

interface MultiAccount {
  device_id: string
  device_label: string
  accounts: { user_id: string; email: string; full_name: string; plan_type: string; questions_today: number }[]
  first_seen: string
  last_seen: string
}

interface BotSuspect {
  user_id: string
  email: string
  full_name: string
  avg_seconds: number
  total_answers: number
  last_answer: string
}

interface ScriptSuspect {
  user_id: string
  email: string
  full_name: string
  plan_type: string
  questions_total: number
  last_usage: string
}

interface DeviceBlocked {
  user_id: string
  email: string
  full_name: string
  plan_type: string
  existing_devices: string
  block_count: number
  last_blocked: string
}

export default function FraudesPage() {
  const { user } = useAuth() as any
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('premium')

  const [premiumData, setPremiumData] = useState<PremiumSharing[]>([])
  const [multiData, setMultiData] = useState<MultiAccount[]>([])
  const [botData, setBotData] = useState<BotSuspect[]>([])
  const [scriptData, setScriptData] = useState<ScriptSuspect[]>([])
  const [blockedData, setBlockedData] = useState<DeviceBlocked[]>([])

  useEffect(() => {
    if (!user) return
    ;(async () => {
      // Admin vía allowlist de email (agnóstico). Solo UI; el gate real es server-side
      // (los endpoints /api/v2/admin/fraud/* exigen requireAdmin).
      const admin = isAdminEmail(user.email)
      setIsAdmin(admin)
      if (admin) loadAll()
      setLoading(false)
    })()
  }, [user])

  async function loadAll() {
    await Promise.all([loadPremium(), loadMulti(), loadBots(), loadScripts(), loadBlocked()])
  }

  // AGNÓSTICO (Fase C1): cada análisis de fraude se ejecuta server-side en su
  // endpoint requireAdmin (queries Drizzle + la MISMA lógica de agregación, portada
  // verbatim). El cliente solo hace fetch del resultado final.
  async function fraudFetch<T>(path: string, key: string): Promise<T[]> {
    try {
      const headers = await getAuthHeaders()
      const res = await adminFetch(path, { headers })
      if (!res.ok) return []
      return ((await res.json())[key] || []) as T[]
    } catch (e) {
      console.error('Error en', path, e)
      return []
    }
  }

  async function loadPremium() {
    setPremiumData(await fraudFetch<PremiumSharing>('/api/v2/admin/fraud/premium', 'premium'))
  }

  async function loadMulti() {
    setMultiData(await fraudFetch<MultiAccount>('/api/v2/admin/fraud/multi', 'multi'))
  }

  async function loadBots() {
    setBotData(await fraudFetch<BotSuspect>('/api/v2/admin/fraud/bots', 'bots'))
  }

  async function loadScripts() {
    setScriptData(await fraudFetch<ScriptSuspect>('/api/v2/admin/fraud/scripts', 'scripts'))
  }

  async function loadBlocked() {
    setBlockedData(await fraudFetch<DeviceBlocked>('/api/v2/admin/fraud/blocked', 'blocked'))
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>
  if (!user || !isAdmin) return <div className="p-8 text-center text-red-500">No autorizado</div>

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'premium', label: 'Premium compartido', count: premiumData.length },
    { id: 'multicuenta', label: 'Multicuentas free', count: multiData.length },
    { id: 'bots', label: 'Bots detectados', count: botData.length + scriptData.length },
    { id: 'bloqueados', label: 'Device limit', count: blockedData.length },
  ]

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <h1 className="text-2xl font-bold mb-6 dark:text-white">Fraudes</h1>

      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {t.label}
            {t.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === 'premium' && <PremiumTab data={premiumData} />}
      {tab === 'multicuenta' && <MultiTab data={multiData} />}
      {tab === 'bots' && <BotTab data={botData} scriptData={scriptData} />}
      {tab === 'bloqueados' && <BlockedTab data={blockedData} />}
    </div>
  )
}

function PremiumTab({ data }: { data: PremiumSharing[] }) {
  if (!data.length) return <Empty msg="No se detectan cuentas premium con 3+ dispositivos en los ultimos 7 dias" />

  return (
    <Table
      headers={['Email', 'Nombre', 'Dispositivos', 'Ciudades', 'Sesiones', 'Ultima']}
      rows={data.map(d => [
        d.email,
        d.full_name,
        <span key="d" className="flex flex-wrap gap-1 items-center">
          <span className={`font-bold text-sm ${d.devices.length >= 4 ? 'text-red-600' : d.devices.length >= 3 ? 'text-orange-500' : 'text-gray-500'}`}>
            {d.devices.length}
          </span>
          {d.devices.map(dev => <Badge key={dev} text={dev} color={d.devices.length >= 4 ? 'red' : 'gray'} />)}
        </span>,
        d.cities.length > 0
          ? <span key="c" className="flex flex-wrap gap-1">{d.cities.map(c => <Badge key={c} text={c} color="gray" />)}</span>
          : <span key="c" className="text-gray-400 text-xs">-</span>,
        String(d.session_count),
        formatDate(d.last_session),
      ])}
    />
  )
}

function MultiTab({ data }: { data: MultiAccount[] }) {
  if (!data.length) return <Empty msg="No se detectan dispositivos compartidos entre 2+ cuentas free" />

  return (
    <div className="space-y-4">
      {data.map(d => (
        <div key={d.device_id} className="border rounded-lg p-4 dark:border-gray-700">
          <div className="flex items-center gap-2 mb-3">
            <span className="font-mono text-xs text-gray-400">{d.device_id.substring(0, 8)}...</span>
            {d.device_label && <Badge text={d.device_label} />}
            <span className="text-xs text-gray-500">Visto: {formatDate(d.first_seen)} - {formatDate(d.last_seen)}</span>
          </div>
          <Table
            headers={['Email', 'Nombre', 'Plan', 'Preguntas hoy']}
            rows={d.accounts.map(a => [
              a.email,
              a.full_name,
              <Badge key="p" text={a.plan_type} color={a.plan_type === 'free' ? 'gray' : 'green'} />,
              String(a.questions_today),
            ])}
          />
        </div>
      ))}
    </div>
  )
}

function BotTab({ data, scriptData }: { data: BotSuspect[]; scriptData: ScriptSuspect[] }) {
  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
          Respuestas demasiado rapidas (media &lt; 3s)
        </h3>
        {!data.length ? (
          <Empty msg="No se detectan bots por velocidad en los ultimos 7 dias" />
        ) : (
          <Table
            headers={['Email', 'Nombre', 'Media (s)', 'Respuestas', 'Ultima']}
            rows={data.map(d => [
              d.email,
              d.full_name,
              <span key="a" className={d.avg_seconds < 1.5 ? 'text-red-600 font-bold' : 'text-orange-500'}>{d.avg_seconds}s</span>,
              String(d.total_answers),
              formatDate(d.last_answer),
            ])}
          />
        )}
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wide">
          Sin dispositivo registrado (posible script/curl)
        </h3>
        {!scriptData.length ? (
          <Empty msg="No se detectan usuarios sin dispositivo en los ultimos 7 dias" />
        ) : (
          <Table
            headers={['Email', 'Nombre', 'Plan', 'Preguntas (7d)', 'Ultimo uso']}
            rows={scriptData.map(d => [
              d.email,
              d.full_name,
              <Badge key="p" text={d.plan_type} color={d.plan_type === 'free' ? 'gray' : 'green'} />,
              <span key="q" className={d.questions_total > 25 ? 'text-red-600 font-bold' : ''}>{d.questions_total}</span>,
              formatDate(d.last_usage),
            ])}
          />
        )}
      </div>
    </div>
  )
}

function BlockedTab({ data }: { data: DeviceBlocked[] }) {
  if (!data.length) return <Empty msg="No se detectan bloqueos por device limit en los ultimos 7 dias" />

  return (
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Usuarios que intentaron usar un dispositivo adicional y fueron bloqueados (ultimos 7 dias).
      </p>
      <Table
        headers={['Email', 'Nombre', 'Plan', 'Dispositivos actuales', 'Bloqueos', 'Ultimo']}
        rows={data.map(d => [
          d.email,
          d.full_name,
          <Badge key="p" text={d.plan_type} color={d.plan_type === 'free' ? 'gray' : 'green'} />,
          d.existing_devices
            ? <span key="d" className="flex flex-wrap gap-1">{d.existing_devices.split(', ').map(dev => <Badge key={dev} text={dev} color="gray" />)}</span>
            : <span key="d" className="text-gray-400 text-xs">-</span>,
          <span key="c" className={`font-bold ${d.block_count >= 10 ? 'text-red-600' : d.block_count >= 5 ? 'text-orange-500' : 'text-gray-600 dark:text-gray-400'}`}>
            {d.block_count}
          </span>,
          formatDate(d.last_blocked),
        ])}
      />
    </div>
  )
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b dark:border-gray-700">
            {headers.map(h => <th key={h} className="text-left py-2 px-3 font-medium text-gray-500 dark:text-gray-400">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
              {row.map((cell, j) => <td key={j} className="py-2 px-3 dark:text-gray-300">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Badge({ text, color = 'blue' }: { text: string; color?: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
    gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    green: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
    orange: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300',
    red: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  }
  return <span className={`px-2 py-0.5 text-xs rounded-full ${colors[color] || colors.blue}`}>{text}</span>
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-center py-12 text-gray-400 dark:text-gray-500">{msg}</div>
}

function formatDate(iso: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
