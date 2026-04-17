'use client'
import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

type Tab = 'premium' | 'multicuenta' | 'bots'

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

export default function FraudesPage() {
  const { supabase, user } = useAuth() as any
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('premium')

  const [premiumData, setPremiumData] = useState<PremiumSharing[]>([])
  const [multiData, setMultiData] = useState<MultiAccount[]>([])
  const [botData, setBotData] = useState<BotSuspect[]>([])

  useEffect(() => {
    if (!supabase || !user) return
    ;(async () => {
      const { data } = await supabase.rpc('is_current_user_admin')
      setIsAdmin(data === true)
      if (data === true) loadAll()
      setLoading(false)
    })()
  }, [supabase, user])

  async function loadAll() {
    await Promise.all([loadPremium(), loadMulti(), loadBots()])
  }

  async function loadPremium() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: sessions } = await supabase
      .from('user_sessions')
      .select('user_id, city, session_start, device_fingerprint')
      .not('city', 'is', null)
      .gte('session_start', sevenDaysAgo)

    if (!sessions?.length) return

    const { data: premiumProfiles } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, plan_type')
      .in('plan_type', ['premium', 'premium_semester', 'trial'])

    if (!premiumProfiles?.length) return

    const premiumIds = new Set<string>(premiumProfiles.map((p: any) => p.id))
    const profileMap: Map<string, any> = new Map(premiumProfiles.map((p: any) => [p.id, p]))

    // Also get device labels from user_devices
    const { data: userDevices } = await supabase
      .from('user_devices')
      .select('user_id, device_id, device_label')
      .in('user_id', premiumProfiles.map((p: any) => p.id))

    const deviceLabelMap: Map<string, string> = new Map(
      (userDevices || []).map((d: any) => [d.device_id, d.device_label || d.device_id?.substring(0, 8)])
    )

    const byUser = new Map<string, { cities: Set<string>; devices: Set<string>; count: number; last: string }>()
    for (const s of sessions) {
      if (!premiumIds.has(s.user_id) || !s.city) continue
      const entry = byUser.get(s.user_id) || { cities: new Set(), devices: new Set(), count: 0, last: '' }
      entry.cities.add(s.city)
      if (s.device_fingerprint) {
        const label = deviceLabelMap.get(s.device_fingerprint) || s.device_fingerprint.substring(0, 8) + '...'
        entry.devices.add(label)
      }
      entry.count++
      if (s.session_start > entry.last) entry.last = s.session_start
      byUser.set(s.user_id, entry)
    }

    // Also check user_devices for premium users who may not have city data
    const premiumUserIds = premiumProfiles.map((p: any) => p.id)
    const { data: allPremiumDevices } = await supabase
      .from('user_devices')
      .select('user_id, device_id, device_label')
      .in('user_id', premiumUserIds)

    const devicesByUser = new Map<string, Set<string>>()
    for (const d of (allPremiumDevices || []) as any[]) {
      const set = devicesByUser.get(d.user_id) || new Set()
      set.add(d.device_label || d.device_id?.substring(0, 8))
      devicesByUser.set(d.user_id, set)
    }

    const results: PremiumSharing[] = []
    for (const [uid, entry] of byUser) {
      // Merge devices from user_devices table
      const extraDevices = devicesByUser.get(uid)
      if (extraDevices) extraDevices.forEach(d => entry.devices.add(d))

      // Show if 3+ devices (suspicious sharing) OR 2+ devices with 3+ cities
      if (entry.devices.size < 3 && !(entry.devices.size >= 2 && entry.cities.size >= 3)) continue
      const profile = profileMap.get(uid)
      if (!profile) continue
      results.push({
        user_id: uid,
        email: profile.email,
        full_name: profile.full_name || '',
        cities: [...entry.cities],
        devices: [...entry.devices],
        session_count: entry.count,
        last_session: entry.last,
      })
    }

    // Also add premium users with 3+ devices who had no city data in sessions
    for (const [uid, devSet] of devicesByUser) {
      if (devSet.size < 3 || byUser.has(uid)) continue
      const profile = profileMap.get(uid)
      if (!profile) continue
      results.push({
        user_id: uid,
        email: profile.email,
        full_name: profile.full_name || '',
        cities: [],
        devices: [...devSet],
        session_count: 0,
        last_session: '',
      })
    }

    results.sort((a, b) => b.devices.length - a.devices.length)
    setPremiumData(results)
  }

  async function loadMulti() {
    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('device_id, device_label, user_id, first_seen_at, last_seen_at')
      .gte('last_seen_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())

    if (error || !devices?.length) return

    const byDevice = new Map<string, { label: string; users: Set<string>; first: string; last: string }>()
    for (const d of devices) {
      const entry = byDevice.get(d.device_id) || { label: d.device_label || '', users: new Set(), first: d.first_seen_at, last: d.last_seen_at }
      entry.users.add(d.user_id)
      if (d.first_seen_at < entry.first) entry.first = d.first_seen_at
      if (d.last_seen_at > entry.last) entry.last = d.last_seen_at
      byDevice.set(d.device_id, entry)
    }

    const sharedDevices = [...byDevice.entries()].filter(([, e]) => e.users.size >= 2)
    if (!sharedDevices.length) { setMultiData([]); return }

    const allUserIds = [...new Set(sharedDevices.flatMap(([, e]) => [...e.users]))]
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, plan_type')
      .in('id', allUserIds)

    const profileMap: Map<string, any> = new Map((profiles || []).map((p: any) => [p.id, p]))

    const today = new Date().toISOString().split('T')[0]
    const { data: usage } = await supabase
      .from('daily_question_usage')
      .select('user_id, questions_answered')
      .in('user_id', allUserIds)
      .eq('usage_date', today)

    const usageMap: Map<string, number> = new Map((usage || []).map((u: any) => [u.user_id, u.questions_answered]))

    const results: MultiAccount[] = sharedDevices.map(([deviceId, entry]) => ({
      device_id: deviceId,
      device_label: entry.label,
      first_seen: entry.first,
      last_seen: entry.last,
      accounts: [...entry.users].map(uid => {
        const p = profileMap.get(uid)
        return {
          user_id: uid,
          email: p?.email || '?',
          full_name: p?.full_name || '',
          plan_type: p?.plan_type || 'free',
          questions_today: usageMap.get(uid) || 0,
        }
      }),
    }))
    results.sort((a, b) => b.accounts.length - a.accounts.length)
    setMultiData(results)
  }

  async function loadBots() {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    const { data: fast, error } = await supabase
      .from('test_questions')
      .select('user_id, time_spent_seconds, answered_at')
      .gt('time_spent_seconds', 0)
      .gte('answered_at', sevenDaysAgo)

    if (error || !fast?.length) return

    const byUser = new Map<string, { total: number; count: number; last: string }>()
    for (const r of fast) {
      if (!r.user_id) continue
      const entry = byUser.get(r.user_id) || { total: 0, count: 0, last: '' }
      entry.total += r.time_spent_seconds
      entry.count++
      if (r.answered_at > entry.last) entry.last = r.answered_at
      byUser.set(r.user_id, entry)
    }

    const suspects = [...byUser.entries()]
      .map(([uid, e]) => ({ uid, avg: e.total / e.count, count: e.count, last: e.last }))
      .filter(s => s.avg < 3 && s.count >= 10)
      .sort((a, b) => a.avg - b.avg)

    if (!suspects.length) { setBotData([]); return }

    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, full_name')
      .in('id', suspects.map(s => s.uid))

    const profileMap: Map<string, any> = new Map((profiles || []).map((p: any) => [p.id, p]))

    setBotData(suspects.map(s => {
      const p = profileMap.get(s.uid)
      return {
        user_id: s.uid,
        email: p?.email || '?',
        full_name: p?.full_name || '',
        avg_seconds: Math.round(s.avg * 10) / 10,
        total_answers: s.count,
        last_answer: s.last,
      }
    }))
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando...</div>
  if (!user || !isAdmin) return <div className="p-8 text-center text-red-500">No autorizado</div>

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'premium', label: 'Premium compartido', count: premiumData.length },
    { id: 'multicuenta', label: 'Multicuentas free', count: multiData.length },
    { id: 'bots', label: 'Bots detectados', count: botData.length },
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
      {tab === 'bots' && <BotTab data={botData} />}
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

function BotTab({ data }: { data: BotSuspect[] }) {
  if (!data.length) return <Empty msg="No se detectan bots (media < 3s/pregunta y 10+ respuestas en 7 dias)" />

  return (
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
