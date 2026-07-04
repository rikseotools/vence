// __tests__/contexts/oposicionPreHydrationRace.test.ts
// SIMULACIÓN del bug Raquel (02-04/07/2026) y su fix de pre-hidratación.
//
// BUG: durante la ventana de carga async del perfil, OposicionContext tiene
// oposicionId=null → oposicionMenu=DEFAULT_MENU, cuyo featured es el PRIMER slug del
// catálogo (ALL_OPOSICION_SLUGS[0] = 'auxiliar-administrativo-estado'). El Header le
// añade '/test'. Un usuario logueado de OTRA oposición (Madrid) que pulsa "practicar"
// durante esa ventana navega a /auxiliar-administrativo-estado/test → "se me cambia la
// oposición a Estado".
//
// FIX: pre-hidratar la oposición cacheada ANTES del paint (useLayoutEffect) → el usuario
// recurrente ve SU oposición al instante. Aquí se SIMULA la lógica real (init null →
// DEFAULT featured Estado; hidratación con caché → oposición correcta).
import { ALL_OPOSICION_SLUGS, OPOSICIONES } from '@/lib/config/oposiciones'
import { readOposicionCache, writeOposicionCache, clearOposicionCache } from '@/lib/oposicion/oposicionCache'

const MADRID_ID = 'auxiliar_administrativo_madrid'
const DEFAULT_FEATURED_SLUG = ALL_OPOSICION_SLUGS[0]
const slugFor = (id: string): string | undefined => OPOSICIONES.find(o => o.id === id)?.slug

// Réplica EXACTA de la resolución del slug "activo" en el PRIMER paint de OposicionContext:
//   oposicionId inicial = null → featured del DEFAULT_MENU = ALL_OPOSICION_SLUGS[0] (Estado).
//   useLayoutEffect (pre-hidratación) corre ANTES del paint: si hay user + caché → oposicionId.
function activeSlugAtFirstPaint(user: { id: string } | null): string {
  let oposicionId: string | null = null // estado inicial de OposicionContext
  if (user) {
    const cached = readOposicionCache() // <- pre-hidratación (el fix)
    if (cached) oposicionId = cached.id
  }
  // El Header construye el link "practicar" del slug de la oposición activa:
  const slug = oposicionId ? slugFor(oposicionId) : DEFAULT_FEATURED_SLUG
  return slug as string
}

beforeEach(() => window.localStorage.clear())

describe('SIMULACIÓN: race del DEFAULT_MENU → Estado (bug Raquel) y fix de pre-hidratación', () => {
  it('CONFIRMA la causa: ALL_OPOSICION_SLUGS[0] es Estado → DEFAULT featured cae en Estado', () => {
    expect(DEFAULT_FEATURED_SLUG).toBe('auxiliar-administrativo-estado')
    expect(OPOSICIONES[0].id).toBe('auxiliar_administrativo_estado')
  })

  it('SIN caché (primer acceso de un usuario): "practicar" cae a Estado (race residual documentada)', () => {
    expect(activeSlugAtFirstPaint({ id: 'u' })).toBe('auxiliar-administrativo-estado')
  })

  it('CON caché (usuario recurrente, p.ej. Raquel=Madrid): al primer paint la oposición es MADRID, NO Estado', () => {
    writeOposicionCache(MADRID_ID, null)
    const slug = activeSlugAtFirstPaint({ id: 'u' })
    expect(slug).toBe('auxiliar-administrativo-madrid')
    expect(slug).not.toBe('auxiliar-administrativo-estado')
    // → "practicar" navega a su oposición real, no a Estado:
    expect(`/${slug}/test`).toBe('/auxiliar-administrativo-madrid/test')
  })

  it('la pre-hidratación NUNCA revive un id inválido (datos sucios) → cae al default, no a basura', () => {
    window.localStorage.setItem('vence_opo_cache_v1', JSON.stringify({ id: 'oposicion_retirada', data: null }))
    // readOposicionCache rechaza el id inválido → oposicionId sigue null → default Estado
    expect(activeSlugAtFirstPaint({ id: 'u' })).toBe('auxiliar-administrativo-estado')
  })

  it('logout limpia la caché → no se filtra la oposición al siguiente (dispositivo compartido)', () => {
    writeOposicionCache(MADRID_ID, null)
    clearOposicionCache() // el fix limpia en el bloque !user (logout)
    // usuario nulo no hidrata; y aunque hidratara, la caché ya no está:
    expect(activeSlugAtFirstPaint(null)).toBe('auxiliar-administrativo-estado')
    expect(readOposicionCache()).toBeNull()
  })

  it('anónimo (user=null): no hidrata → default Estado como siempre (no rompe anónimos)', () => {
    writeOposicionCache(MADRID_ID, null) // aunque hubiera caché
    expect(activeSlugAtFirstPaint(null)).toBe('auxiliar-administrativo-estado')
  })
})
