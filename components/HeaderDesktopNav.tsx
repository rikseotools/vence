'use client'

/**
 * components/HeaderDesktopNav.tsx — la barra de navegación de escritorio, que ahora **pliega
 * en «Más» lo que no cabe** en vez de empujar el avatar fuera de la pantalla (T-504).
 *
 * ## Dos capas, y la de abajo aguanta sola
 *
 * 1. **CSS (garantía por construcción).** El `<nav>` lleva `min-w-0` — sin eso, un elemento
 *    flexible NO puede encogerse por debajo de su contenido (`min-width: auto`), que es
 *    exactamente por lo que la barra empujaba al bloque derecho fuera del viewport con
 *    `html`/`body` en `overflow-x: hidden`, o sea sin scroll con el que rescatarlo. Y la
 *    píldora lleva `overflow-x-auto`: **si el JavaScript de abajo no llegara a correr, los
 *    enlaces se alcanzan arrastrando**, nunca desaparecen.
 * 2. **Medida + reparto (la buena experiencia).** Se mide lo que ocupa cada enlace y el sitio
 *    real que le queda a la barra, y `repartirNav` decide cuántos entran. El resto va a un
 *    menú «Más». Con esta capa viva la píldora nunca desborda, así que el scroll de (1) no
 *    llega a aparecer.
 *
 * La separación importa: la capa 2 puede fallar (medida rara, JS que no carga) y lo peor que
 * pasa entonces es una barra con scroll. Lo que NO puede volver a pasar es que el perfil y
 * las notificaciones queden inalcanzables, y de eso responde la capa 1, que es CSS.
 *
 * El criterio del reparto vive aparte y PURO en `lib/ui/navOverflow.ts` (18 tests): así se
 * prueba sin navegador y sin React.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { repartirNav } from '@/lib/ui/navOverflow'

export interface HeaderNavLink {
  href: string
  label: string
  icon: string
  title?: string
}

interface Props {
  links: HeaderNavLink[]
  pathname: string
  /** Clases del enlace según esté activo o no. Las decide el Header (fuente única de estilo). */
  getColorClasses: (activo: boolean) => string
  /** Se avisa al abrir el menú «Más» para poder medir su uso. */
  onAbrirMas?: (ocultos: number) => void
}

/** Clases compartidas por el enlace real y por su copia del medidor: medir otra cosa que la
 *  que se pinta es medir mal. `whitespace-nowrap` es parte del arreglo — sin él la etiqueta
 *  parte en dos líneas y el ancho medido deja de predecir el ancho pintado. */
const CLASES_ENLACE = 'flex items-center space-x-2 px-4 py-2 rounded-full font-medium transition-all duration-200 whitespace-nowrap'

export default function HeaderDesktopNav({ links, pathname, getColorClasses, onAbrirMas }: Props) {
  const navRef = useRef<HTMLElement | null>(null)
  const medidorRef = useRef<HTMLDivElement | null>(null)
  const masRef = useRef<HTMLButtonElement | null>(null)

  const [disponible, setDisponible] = useState(0)
  const [anchos, setAnchos] = useState<number[]>([])
  const [anchoMas, setAnchoMas] = useState(0)
  const [abierto, setAbierto] = useState(false)

  // ── Medir ───────────────────────────────────────────────────────────────────────────────
  // Los anchos salen del MEDIDOR (una copia invisible con la lista COMPLETA), no de los
  // enlaces pintados: si se midieran los pintados, en cuanto uno se pliega desaparece su
  // medida y el cálculo ya no puede saber si volvería a caber al ensanchar la ventana.
  const medir = useCallback(() => {
    const medidor = medidorRef.current
    if (medidor) {
      const hijos = Array.from(medidor.querySelectorAll<HTMLElement>('[data-medida="enlace"]'))
      setAnchos(hijos.map((h) => h.getBoundingClientRect().width))
      const botonMas = medidor.querySelector<HTMLElement>('[data-medida="mas"]')
      if (botonMas) setAnchoMas(botonMas.getBoundingClientRect().width)
    }
    if (navRef.current) setDisponible(navRef.current.clientWidth)
  }, [])

  useEffect(() => {
    medir()
    const nav = navRef.current
    if (!nav || typeof ResizeObserver === 'undefined') {
      // Sin ResizeObserver se sigue reaccionando al `resize` de la ventana: peor, pero no
      // ciego. El caso «ni una cosa ni la otra» ya está cubierto por el CSS.
      window.addEventListener('resize', medir)
      return () => window.removeEventListener('resize', medir)
    }
    const ro = new ResizeObserver(medir)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [medir])

  // Las etiquetas cambian con el idioma/la oposición y el tipo de plan: re-medir cuando cambie
  // la lista, no solo cuando cambie el tamaño.
  useEffect(() => { medir() }, [links, medir])

  const { visibles, ocultos, medido } = repartirNav({
    anchosItems: anchos,
    anchoDisponible: disponible,
    anchoBotonMas: anchoMas,
  })

  // Mientras no haya medida fiable se pintan TODOS (`medido: false`); quien evita el desborde
  // en ese hueco es el CSS.
  const enBarra = medido ? links.slice(0, visibles) : links
  const enMenu = medido ? links.slice(visibles) : []

  // Un menú abierto cuyo contenido se ha vaciado (la ventana se ensanchó) tiene que cerrarse
  // solo: si no, queda un panel vacío flotando.
  useEffect(() => { if (enMenu.length === 0 && abierto) setAbierto(false) }, [enMenu.length, abierto])

  const enlace = (link: HeaderNavLink) => (
    <Link
      key={link.href}
      href={link.href}
      title={link.title}
      className={`${CLASES_ENLACE} ${getColorClasses(pathname === link.href)}`}
    >
      <span className="text-sm">{link.icon}</span>
      <span className="text-sm font-medium">{link.label}</span>
    </Link>
  )

  return (
    <nav ref={navRef} className="hidden xl:flex items-center justify-center flex-1 min-w-0 mx-8 relative">
      {/* MEDIDOR — una copia invisible con la lista COMPLETA, de la que salen los anchos.
          La caja de fuera mide 0×0 con `overflow-hidden` a propósito: estando fuera del flujo
          (absolute) ya no ocupaba sitio, pero **sí contaba en el `scrollWidth` de sus
          ancestros**, y eso hacía que la cabecera pareciera desbordada 379 px cuando no lo
          estaba — un instrumento que falsea justo lo que va a medir. Con `overflow-hidden` el
          desbordamiento muere aquí. Recortar no cambia el layout: los hijos siguen midiendo
          su ancho natural gracias al `w-max` de dentro. */}
      <div className="absolute top-0 left-0 w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div ref={medidorRef} className="flex items-center space-x-1 w-max">
          {links.map((link) => (
            <span key={link.href} data-medida="enlace" className={CLASES_ENLACE}>
              <span className="text-sm">{link.icon}</span>
              <span className="text-sm font-medium">{link.label}</span>
            </span>
          ))}
          <span data-medida="mas" className={CLASES_ENLACE}>
            <span className="text-sm font-medium">Más</span>
            <span className="text-xs">▾</span>
          </span>
        </div>
      </div>

      <div className="flex items-center space-x-1 bg-gray-50 dark:bg-gray-800 rounded-full p-1 max-w-full min-w-0">
        {/* El scroll de reserva vive AQUÍ, envolviendo solo los enlaces, y no en la píldora
            entera: `overflow-x: auto` crea un contexto de recorte, así que con el botón «Más»
            dentro su desplegable se recortaba y **no se veía** aunque estuviera en el DOM. Lo
            cazó un pantallazo, no la simulación (que contaba enlaces, no si se veían). */}
        <div className="flex items-center space-x-1 min-w-0 overflow-x-auto scrollbar-hide">
          {enBarra.map(enlace)}
        </div>

        {enMenu.length > 0 && (
          <div className="relative flex-shrink-0">
            <button
              ref={masRef}
              type="button"
              onClick={() => {
                const abriendo = !abierto
                setAbierto(abriendo)
                if (abriendo) onAbrirMas?.(enMenu.length)
              }}
              aria-haspopup="menu"
              aria-expanded={abierto}
              aria-label={`Más secciones (${enMenu.length})`}
              className={`${CLASES_ENLACE} ${getColorClasses(enMenu.some((l) => l.href === pathname))}`}
            >
              <span className="text-sm font-medium">Más</span>
              <span className="text-xs">▾</span>
            </button>

            {abierto && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setAbierto(false)} />
                <div
                  role="menu"
                  className="absolute top-full right-0 mt-2 z-50 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2"
                >
                  {enMenu.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      title={link.title}
                      role="menuitem"
                      onClick={() => setAbierto(false)}
                      className={`flex items-center space-x-3 px-4 py-2.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                        pathname === link.href
                          ? 'text-blue-600 dark:text-blue-400 font-semibold'
                          : 'text-gray-700 dark:text-gray-200'
                      }`}
                    >
                      <span>{link.icon}</span>
                      <span>{link.label}</span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </nav>
  )
}
