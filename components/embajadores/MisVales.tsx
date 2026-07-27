'use client'
// components/embajadores/MisVales.tsx
// "Mis vales": las gift cards de Amazon.es que el usuario ha conseguido (código, importe, fecha).
// Datos de /api/referrals/vouchers (identidad del token → solo los suyos). Si no tiene, no pinta nada.

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import CopyCode from './CopyCode'

interface Voucher { amount: number; code: string; pin?: string | null; serial?: string | null; fallbackLink?: string | null; via: string | null; date: string | null }

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
          <div key={i} className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 mb-3">
              <div className="font-semibold text-gray-800 dark:text-gray-100">{v.amount} € · Amazon.es</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{fmtDate(v.date)}</div>
            </div>
            <div className="flex flex-col gap-2">
              <CopyCode label="Código" value={v.code} />
              {v.pin ? <CopyCode label="PIN" value={v.pin} /> : null}
              {v.serial ? <CopyCode label="Serial" value={v.serial} /> : null}
            </div>
            {/* CÓMO CANJEARLO. Va SIEMPRE, no solo cuando el vale trae extras: Bitrefill sirve las
                tarjetas desde lotes de distintos distribuidores y el formato cambia de un vale a
                otro (unos traen pin+serial, otros un enlace, tres de cinco solo el código). Lo
                único constante es el código, así que el "dónde se canjea" tiene que ser nuestro:
                antes el usuario veía un código suelto y ningún sitio donde meterlo. */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <a
                href="https://www.amazon.es/gc/redeem"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Canjear en Amazon →
              </a>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                pega el código en «Canjear tarjeta regalo»
              </span>
              {v.fallbackLink ? (
                <a
                  href={v.fallbackLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-500 dark:text-gray-400 hover:underline"
                >
                  · ver la tarjeta original
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
