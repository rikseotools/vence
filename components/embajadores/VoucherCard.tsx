'use client'
// components/embajadores/VoucherCard.tsx
// LA tarjeta de un vale (gift card de Amazon.es). Única implementación: la usan tanto el panel del
// embajador (`MisVales`, en /embajadores) como la vista de admin "ver como el usuario"
// (`EmbajadorPanelView`, en /admin/referidos/[userId]).
//
// POR QUÉ EXISTE (27/07/2026). Había DOS implementaciones de esta misma tarjeta y habían divergido:
// la de admin ocultaba PIN/serial tras "Revelar" y exponía el enlace de la tarjeta original; la del
// usuario los mostraba de entrada y no tenía ese enlace. El runbook vende la vista de admin como
// «el panel del embajador tal cual lo ve él» — y con dos componentes distintos eso era mentira.
// Se notó al añadir el enlace de canje: se puso en una vista y no en la otra, así que desde la
// vista de admin seguía sin verse dónde canjear.
//
// EL ENLACE DE CANJE VA SIEMPRE, en todas las tarjetas. Bitrefill es un agregador y sirve cada vale
// del lote de un distribuidor distinto: unos traen `pin`+`serial`, otros un enlace de
// revealyourgift, y la mayoría **solo el código** (3 de los 5 primeros vales comprados). Lo único
// constante es el código, así que el «dónde se canjea» lo tiene que poner la app — antes el
// embajador veía un código suelto y ningún sitio donde meterlo.

import { useState } from 'react'
import CopyCode from './CopyCode'

/** Lo que devuelven `/api/referrals/vouchers` y `/api/admin/embajadores/[userId]/panel`. */
export interface Voucher {
  amount: number
  code: string
  pin?: string | null
  serial?: string | null
  /** Enlace de revealyourgift.com; SOLO lo traen algunos lotes de Bitrefill. */
  fallbackLink?: string | null
  via?: string | null
  date: string | null
}

/** Página donde Amazon.es canjea cualquier tarjeta regalo, venga en el formato que venga. */
export const AMAZON_REDEEM_URL = 'https://www.amazon.es/gc/redeem'

export function formatVoucherDate(d: string | null): string {
  if (!d) return ''
  const t = new Date(d)
  return Number.isNaN(t.getTime())
    ? ''
    : t.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function VoucherCard({ voucher }: { voucher: Voucher }) {
  const v = voucher
  const [revealed, setRevealed] = useState(false)
  const hasSecret = !!(v.pin || v.serial)

  return (
    <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg px-4 py-3">
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <div className="font-semibold text-gray-800 dark:text-gray-100">{v.amount} € · Amazon.es</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">{formatVoucherDate(v.date)}</div>
      </div>

      <div className="flex flex-col gap-2">
        {/* El código va siempre visible: es lo que se necesita para canjear y lo único que traen
            todos los vales. PIN/serial, en cambio, se revelan a petición (pantallas compartidas). */}
        <CopyCode label="Código" value={v.code} />

        {revealed && hasSecret ? (
          <>
            {v.pin ? <CopyCode label="PIN" value={v.pin} /> : null}
            {v.serial ? <CopyCode label="Serial" value={v.serial} /> : null}
          </>
        ) : hasSecret ? (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="text-left text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            🔓 Revelar tarjeta completa (código, PIN si lo trae) →
          </button>
        ) : v.fallbackLink ? (
          <a
            href={v.fallbackLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            🔓 Revelar tarjeta completa (código, PIN si lo trae) →
          </a>
        ) : (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Esta tarjeta se canjea solo con el código (no lleva PIN).
          </p>
        )}
      </div>

      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 flex flex-wrap items-center gap-x-3 gap-y-1">
        <a
          href={AMAZON_REDEEM_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          Canjear en Amazon →
        </a>
        <span className="text-xs text-gray-500 dark:text-gray-400">
          pega el código en «Canjear tarjeta regalo»
        </span>
      </div>
    </div>
  )
}
