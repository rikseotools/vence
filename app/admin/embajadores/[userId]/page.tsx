'use client'
// app/admin/embajadores/[userId]/page.tsx — VISTA ADMIN (solo lectura) del panel de un embajador
// concreto: "verlo como lo vería el usuario". Se abre en pestaña nueva desde el escaparate admin.
// Doble gate: esta página vive tras el guard de admin de app/admin/layout.tsx, y el endpoint
// /api/admin/embajadores/[userId]/panel exige requireAdmin (defensa en profundidad). Read-only.

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { adminFetch } from '@/lib/api/adminFetch'
import EmbajadorPanelView, { type EmbajadorPanelData } from '@/components/embajadores/EmbajadorPanelView'
import AdminBreakdown from '@/components/embajadores/AdminBreakdown'

type PanelResponse = (EmbajadorPanelData & { isAmbassador: boolean }) | { isAmbassador: false; firstName: string | null }

export default function AdminEmbajadorPreviewPage() {
  const params = useParams<{ userId: string }>()
  const userId = params?.userId
  const [data, setData] = useState<PanelResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId) return
    let alive = true
    adminFetch(`/api/admin/embajadores/${userId}/panel`)
      .then(async (res) => {
        if (!res.ok) {
          const b = await res.json().catch(() => ({}))
          throw new Error(b.error || `Error ${res.status}`)
        }
        return res.json()
      })
      .then((d) => { if (alive) setData(d) })
      .catch((err) => { if (alive) setError((err as Error).message) })
    return () => { alive = false }
  }, [userId])

  const firstName = data && 'firstName' in data ? data.firstName : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 pt-6 max-w-5xl">
        <div className="bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 rounded-lg px-4 py-2 text-sm font-semibold text-center mb-6">
          👁️ Vista de administrador (solo lectura) — así ve su panel el usuario{firstName ? ` ${firstName}` : ''}
        </div>
        {userId && <AdminBreakdown userId={userId} />}
      </div>
      {error ? (
        <p className="text-center text-red-600 dark:text-red-400 py-10">{error}</p>
      ) : !data ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-10">Cargando…</p>
      ) : !data.isAmbassador ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-10">Este usuario no es embajador (el programa es solo para premium).</p>
      ) : (
        <EmbajadorPanelView data={data as EmbajadorPanelData} />
      )}
    </div>
  )
}
