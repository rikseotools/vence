'use client'
// app/OpenInscriptionsBanner.tsx
//
// Banner de "inscripción abierta" de la home, PERSONALIZADO por FAMILIA (vertical).
// Problema que resuelve: con 51 convocatorias abiertas, una lista plana taladra. Un
// opositor de Administración no quiere ver Sanidad (aunque compartan subgrupo).
//
// Filtro DURO por familia (decisión producto): si el usuario tiene oposición elegida,
// se muestran SOLO las de su familia; el resto queda tras "ver todas". La familia del
// usuario se deriva con el MISMO clasificador puro que pobló oposiciones.familia
// (classifyFamilia sobre el nombre de su oposición) → consistente por construcción.
//
// Blindaje (nunca vacío / anónimos):
//  · Sin oposición / anónimo / familia 'otros' → teaser general (todas, ordenadas).
//  · 0 coincidencias de su familia → cae al teaser general (no deja el banner vacío).
// Zona (su CCAA) NO filtra en duro (vaciaría demasiado): solo ordena — las de su zona
// primero. La lista se corta a un teaser; "ver todas" lleva a la página completa.

import { useEffect } from 'react'
import Link from 'next/link'
import { useOposicion } from '@/contexts/OposicionContext'
import { emitClientEvent } from '@/lib/observability/client'
import { classifyFamilia, familiaLabel } from '@/lib/oposiciones/familia'
import { oposicionToCcaa } from '@/app/oposiciones/lib/oposiciones-filters'

export interface BannerConvocatoria {
  slug: string
  nombre: string
  inscription_deadline: string | null
  is_active: boolean
  subgrupo: string | null
  familia: string | null
}

const CAP = 10

function formatDeadline(d: string | null): string {
  if (!d) return ''
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
  const [y, m, day] = d.slice(0, 10).split('-').map(Number)
  return `${day} ${months[m - 1]} ${y}`
}

export default function OpenInscriptionsBanner({
  convocatorias,
}: {
  convocatorias: BannerConvocatoria[]
}) {
  const { userOposicion, oposicionId } = useOposicion()

  const userFamilia = userOposicion?.name ? classifyFamilia(userOposicion.name) : null
  const userZone = oposicionId ? oposicionToCcaa(oposicionId) : null
  const total = convocatorias.length

  // Filtro DURO por familia.
  //
  // CAMBIO 20/07 (junto con el mínimo de 10 plazas): si el usuario tiene familia y NO hay
  // ninguna convocatoria suya que cumpla el mínimo, se OCULTA el banner en vez de caer al
  // teaser general. Antes se le enseñaban las de otras familias, y con el mínimo aplicado
  // ese fallback se volvió dañino: 7 de 10 familias se quedan sin convocatorias que lleguen
  // a 10 plazas, así que un opositor de sanidad veía un banner con 11 de 13 de
  // administración general. Cambiábamos "ruido pequeño de lo suyo" por "ruido grande de lo
  // ajeno". Mejor no enseñar nada que enseñar algo que no le sirve.
  //
  // El teaser general se mantiene para quien NO tiene señal de familia (anónimo, sin
  // oposición elegida o familia 'otros'): ahí no hay nada mejor que ofrecer.
  const personalize = !!userFamilia && userFamilia !== 'otros'
  const deFamilia = personalize ? convocatorias.filter((c) => c.familia === userFamilia) : []
  const usingFamilia = personalize && deFamilia.length > 0
  const working = usingFamilia ? deFamilia : convocatorias
  const hideForFamilia = personalize && deFamilia.length === 0

  // Orden: zona del usuario primero (si es regional), luego cierre más próximo.
  const sorted = [...working].sort((a, b) => {
    if (userZone) {
      const az = oposicionToCcaa(a.slug) === userZone ? 0 : 1
      const bz = oposicionToCcaa(b.slug) === userZone ? 0 : 1
      if (az !== bz) return az - bz
    }
    return (a.inscription_deadline ?? '9999').localeCompare(b.inscription_deadline ?? '9999')
  })

  const shown = sorted.slice(0, CAP)
  const rest = working.length - shown.length

  // Observabilidad: sin esto el banner es CIEGO — un filtro que descarta convocatorias en
  // silencio solo se detecta cuando lo reporta un usuario, que es justo lo que el manual de
  // observabilidad prohíbe. Con `hidden_no_familia_match` medimos a cuánta gente le estamos
  // ocultando el banner por el mínimo de plazas: si sube, hay que revisar el umbral o el
  // reparto por familias, sin esperar a que alguien se queje.
  useEffect(() => {
    emitClientEvent({
      severity: 'info',
      eventType: 'open_inscriptions_banner_view',
      metadata: {
        familia: userFamilia ?? null,
        zona: userZone ?? null,
        pool: total,
        de_su_familia: personalize ? deFamilia.length : null,
        mostradas: hideForFamilia ? 0 : shown.length,
        modo: hideForFamilia ? 'hidden_no_familia_match' : usingFamilia ? 'familia' : 'teaser_general',
      },
    })
    // Solo al montar / cambiar la señal del usuario: es una impresión, no un render.
  }, [userFamilia, userZone, total, personalize, deFamilia.length, hideForFamilia, usingFamilia, shown.length])

  if (hideForFamilia) return null

  return (
    <Link
      href="/oposiciones/inscripcion-abierta"
      className="block mb-10 rounded-xl border-2 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 p-5 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-600"></span>
        </span>
        <h2 className="text-base font-bold text-green-800 dark:text-green-300">
          {usingFamilia
            ? `${working.length} de ${familiaLabel(userFamilia)} con inscripción abierta`
            : total === 1
              ? '1 convocatoria con inscripción abierta'
              : `${total} convocatorias con inscripción abierta`}
        </h2>
      </div>
      {usingFamilia && (
        <p className="text-xs text-green-700/80 dark:text-green-400/80 mb-2 ml-4.5">
          Filtrado por tu oposición ({familiaLabel(userFamilia)})
        </p>
      )}

      <ul className="space-y-1 mb-2">
        {shown.map((c) => (
          <li key={c.slug} className="text-sm text-green-900 dark:text-green-200 flex items-center justify-between gap-3">
            <span className="truncate flex items-center gap-1.5 min-w-0">
              <span className="truncate">{c.nombre}</span>
              {c.subgrupo && (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-200/60 dark:bg-green-800/50 text-green-800 dark:text-green-300">
                  {c.subgrupo}
                </span>
              )}
              {!c.is_active && (
                <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-200/70 dark:bg-green-800/60 text-green-800 dark:text-green-300">
                  sin test
                </span>
              )}
            </span>
            {c.inscription_deadline && (
              <span className="shrink-0 text-xs text-green-700 dark:text-green-400 whitespace-nowrap">
                cierra {formatDeadline(c.inscription_deadline)}
              </span>
            )}
          </li>
        ))}
      </ul>

      <span className="text-sm font-medium text-green-700 dark:text-green-400">
        {rest > 0
          ? `Ver ${usingFamilia ? `las ${rest} más y el resto` : `las ${total}`} convocatorias abiertas →`
          : usingFamilia
            ? `Ver todas las ${total} convocatorias abiertas →`
            : 'Ver convocatorias abiertas →'}
      </span>
    </Link>
  )
}
