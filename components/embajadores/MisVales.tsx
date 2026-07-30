'use client'
// components/embajadores/MisVales.tsx
// "Mis vales": las gift cards de Amazon.es que el usuario ha conseguido (código, importe, fecha).
// Datos de /api/referrals/vouchers (identidad del token → solo los suyos). Si no tiene, no pinta nada.
//
// La TARJETA la pinta `VoucherCard`, compartida con la vista de admin "ver como el usuario"
// (`EmbajadorPanelView`). Aquí solo va el encabezado de la sección. **No reimplementes la tarjeta**:
// las dos vistas ya divergieron una vez y el panel de admin dejó de enseñar lo que ve el usuario
// (27/07/2026). Lo vigila `__tests__/guardrails/voucherCard.guardrail.test.ts`.

import { useEffect, useState } from 'react'
import { getAuthHeaders } from '@/lib/api/authHeaders'
import VoucherCard, { type Voucher } from './VoucherCard'

/**
 * Cuántos vales se ven de entrada.
 *
 * Quien lleva tiempo acumula muchos y la sección crecía sin límite, empujando hacia abajo
 * todo lo demás. El que importa es el último —el que aún no has canjeado—, así que se
 * enseñan los dos más recientes y el resto se pide.
 */
const VISIBLES_POR_DEFECTO = 2

export default function MisVales() {
  const [vouchers, setVouchers] = useState<Voucher[] | null>(null)
  const [todos, setTodos] = useState(false)

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

  return (
    <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 sm:p-8 mb-8 border border-blue-100 dark:border-gray-700">
      <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-1">Mis vales 🎁</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Tarjetas regalo de Amazon.es que has conseguido. Copia el código y canjéalo en Amazon.
      </p>
      <div className="space-y-2">
        {(todos ? vouchers : vouchers.slice(0, VISIBLES_POR_DEFECTO)).map((v, i) => (
          <VoucherCard key={i} voucher={v} />
        ))}
      </div>
      {vouchers.length > VISIBLES_POR_DEFECTO && (
        <button
          onClick={() => setTodos((v) => !v)}
          className="mt-3 text-sm font-semibold text-blue-700 dark:text-blue-300 hover:underline"
        >
          {todos
            ? 'Mostrar solo los últimos'
            : `Mostrar todos (${vouchers.length})`}
        </button>
      )}
    </section>
  )
}
