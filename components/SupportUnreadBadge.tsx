// components/SupportUnreadBadge.tsx — el número del botón 💬 Soporte del Header.
//
// Qué decide qué: NADA aquí. El estado lo calcula `estadoBadgeSoporte` (núcleo puro en
// `lib/support/badgeSoporte.ts`, con tests); este componente solo lo pinta. Se monta como
// hijo de <SupportButton>, que ya es un <Link> — por eso el padre necesita `relative` en su
// className para que este badge se posicione en su esquina.
'use client'
import type { EstadoBadgeSoporte } from '../lib/support/badgeSoporte'

export function SupportUnreadBadge({ badge }: { badge: EstadoBadgeSoporte }) {
  if (!badge.hayNovedad) return null
  return (
    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-bold">
      {badge.etiqueta}
    </span>
  )
}
