// components/RewardsIcon.tsx — el icono 🎁 del Header, con sus TRES estados.
//
// Vive fuera del Header (decisión 29/07/2026) por dos razones: el Header pasa de las mil líneas y
// ahí nadie encuentra nada, y sobre todo porque así el icono se puede montar aislado en sus tres
// estados para MIRARLO — que es la única forma de juzgar el diseño sin fabricarse una sesión
// premium. Se validó así antes de entrar: una página de usar y tirar que le pasaba a este mismo
// componente los saldos reales (0 · 1 € · 3 € · 7 € · 18 €) y una captura de los cinco casos.
//
// Qué decide qué: NADA aquí. El estado lo calcula `estadoIconoRecompensas` (núcleo puro en
// `lib/referrals/logic.ts`, con tests); este componente solo lo pinta.
'use client'
import Link from 'next/link'
import { formatearEuros, type IconoRecompensas } from '../lib/referrals/logic'

export function RewardsIcon({ icono, href = '/recompensas?src=header' }: { icono: IconoRecompensas; href?: string }) {
  return (
    <Link
      href={href}
      className="tap-feedback relative flex items-center justify-center p-1.5 text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
      aria-label={icono.titulo}
      title={icono.titulo}
    >
      {/* SIN saldo → gris: no promete nada. CON saldo → a color, sin cifra, porque por debajo del
          mínimo no hay vale que pedir y escribir «1 €» lleva a un clic que acaba en decepción. */}
      <span className={`text-lg transition-all duration-300 ${icono.estado === 'sin_saldo' ? 'grayscale opacity-60' : ''}`}>🎁</span>

      {/* La cifra aparece SOLO cuando ya se puede canjear, y es el SALDO REAL — no la
          denominación del vale. Antes se pintaba el vale y eso escondía dinero del usuario: con
          18 € de saldo el chip decía «10 €». Lo que sí se puede pedir hoy lo cuenta el `title`.
          Cambiado por decisión de Manuel (05/08/2026). */}
      {icono.importeMostrado !== null && (
        <span className="ml-1 text-xs font-bold text-green-600 dark:text-green-400 tabular-nums">
          {formatearEuros(icono.importeMostrado)}€
        </span>
      )}

      {/* El punto es OTRA señal: «hay algo nuevo desde tu última visita», y se apaga al entrar en
          /recompensas. Separarlo del color evita que el icono, encendido para siempre por 3 € de
          saldo, se vuelva papel pintado y deje de avisar de lo nuevo.
          Sin animación a propósito: el rebote permanente cansa, molesta a quien tiene sensibilidad
          al movimiento y hace que el icono se lea como publicidad — justo lo que impide pincharlo. */}
      {icono.hayNovedad && (
        <span className="absolute top-0 right-0 inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
      )}
    </Link>
  )
}
