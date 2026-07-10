'use client'
// components/embajadores/MisVales.tsx
// "Mis vales": las gift cards de Amazon.es que el usuario ha conseguido (código, importe, fecha).
// Datos de /api/referrals/vouchers (identidad del token → solo los suyos). Si no tiene, no pinta nada.

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'

interface Voucher { amount: number; code: string; via: string | null; date: string | null }

export default function MisVales() {
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null)

  useEffect(() => {
    let alive = true
    getAuthHeaders()
      .then((h) => fetch('/api/referrals/vouchers', { headers: h }))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d) => { if (alive) setVouchers(Array.isArray(d?.vouchers) ? d.vouchers : []) })
      .catch(() => { if (alive) setVouchers([]) })
    return () => { alive = false }
  }, [])

  if (!vouchers || vouchers.length === 0) return null

  const fmtDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-8 border border-blue-100 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Mis vales 🎁</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Tarjetas regalo de Amazon.es que has conseguido. Copia el código y canjéalo en Amazon.
      </p>
      <div className="space-y-2">
        {vouchers.map((v, i) => (
          <div key={i} className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
            <div className="min-w-0">
              <div className="font-semibold text-gray-800 dark:text-gray-100">{v.amount} € · Amazon.es</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(v.date)}</div>
            </div>
            <code className="text-sm font-mono bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-1.5 select-all break-all">
              {v.code}
            </code>
          </div>
        ))}
      </div>
    </section>
  )
}
