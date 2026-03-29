// __tests__/integration/lawSlugIntegrity.test.ts
// TEST DE INTEGRIDAD DE BD: Verifica que los datos de la tabla laws
// son consistentes y no producirán 404s en producción.
//
// Ejecutar: npx jest __tests__/integration/lawSlugIntegrity --no-coverage
// Requiere: .env.local con NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
//
// Este test habría detectado los 10 slugs rotos que encontramos en la simulación.

// Cargar .env.local REAL (jest.setup.js sobreescribe con mocks)
import { resolve } from 'path'
import { readFileSync } from 'fs'

function loadRealEnv() {
  try {
    const envPath = resolve(__dirname, '../../.env.local')
    const content = readFileSync(envPath, 'utf-8')
    const vars: Record<string, string> = {}
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/)
      if (match) vars[match[1].trim()] = match[2].trim()
    }
    return vars
  } catch {
    return {}
  }
}

const realEnv = loadRealEnv()
const SUPABASE_URL = realEnv.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = realEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
const canRunIntegration = !!(SUPABASE_URL && SUPABASE_KEY && !SUPABASE_URL.includes('test.supabase'))

const describeIf = canRunIntegration ? describe : describe.skip

// ============================================
// HELPERS
// ============================================

/** Consulta REST directa a Supabase (sin SDK, evita problemas ESM con Jest) */
async function queryLaws(): Promise<Array<{ short_name: string; slug: string | null; is_active: boolean; name: string }>> {
  const url = `${SUPABASE_URL}/rest/v1/laws?select=short_name,slug,is_active,name&order=short_name`
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_KEY!,
      'Authorization': `Bearer ${SUPABASE_KEY!}`,
    },
  })
  if (!res.ok) throw new Error(`Supabase query failed: ${res.status}`)
  return res.json()
}

/** Genera slug limpio (debe coincidir con lawSlugSync.generateSlug) */
function autoGenerateSlug(shortName: string): string {
  return shortName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Detecta si un slug tiene encoding roto */
function hasBrokenEncoding(slug: string): boolean {
  // Genera lo que el slug DEBERÍA ser y compara longitudes
  // Los slugs con encoding roto son más cortos que el esperado
  // porque caracteres acentuados se reemplazan por un solo guión
  // Ej: "informática" → "inform-tica" (roto) vs "informatica" (correcto)

  // Patrones específicos de encoding roto
  return (
    /\b[a-z]-tica\b/.test(slug) ||      // informá-tica
    /\b[a-z]-n\b/.test(slug) ||          // resolució-n
    /\b[a-z]-n-[a-z]/.test(slug) ||      // funció-n-pú -> funci-n-p
    /\b[a-z]-sica\b/.test(slug) ||       // bá-sica
    /\b[a-z]-fico\b/.test(slug) ||       // trá-fico
    /\b[a-z]-nica\b/.test(slug) ||       // electró-nica
    /\b[a-z]-blica\b/.test(slug)         // pú-blica
  )
}

// ============================================
// TESTS
// ============================================

describeIf('Integridad de slugs en BD (integración)', () => {
  let allLaws: Awaited<ReturnType<typeof queryLaws>> = []
  let activeLaws: typeof allLaws = []

  // Restaurar fetch real (jest.setup.js lo mockea globalmente)
  const realFetch = jest.requireActual('node-fetch') as typeof fetch
  beforeAll(async () => {
    const originalFetch = global.fetch
    global.fetch = realFetch
    try {
      allLaws = await queryLaws()
      activeLaws = allLaws.filter(l => l.is_active)
    } finally {
      global.fetch = originalFetch
    }
  }, 15000)

  // ─── INTEGRIDAD BÁSICA ─────────────────────────────────────

  describe('integridad básica', () => {
    it('hay leyes en la BD', () => {
      expect(allLaws.length).toBeGreaterThan(100)
    })

    it('todas las leyes activas tienen slug', () => {
      const sinSlug = activeLaws.filter(l => !l.slug)
      if (sinSlug.length > 0) {
        console.error('Leyes activas SIN slug:', sinSlug.map(l => l.short_name))
      }
      expect(sinSlug).toHaveLength(0)
    })

    it('no hay slugs duplicados', () => {
      const slugs = activeLaws.filter(l => l.slug).map(l => l.slug!)
      const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
      if (dupes.length > 0) {
        console.error('Slugs duplicados:', dupes)
      }
      expect(dupes).toHaveLength(0)
    })

    it('no hay short_names duplicados entre leyes activas', () => {
      const names = activeLaws.map(l => l.short_name)
      const dupes = names.filter((n, i) => names.indexOf(n) !== i)
      // Duplicados conocidos: leyes desactivadas que comparten nombre con la versión vigente
      // Ej: LO 1/2004 tiene versión nacional y autonómica
      const knownDupes = new Set(['LO 1/2004', 'LO 2/2012', 'LOTC', 'RDL 17/1977'])
      const unknownDupes = dupes.filter(d => !knownDupes.has(d))
      if (unknownDupes.length > 0) {
        console.error('Short names duplicados NUEVOS:', unknownDupes)
      }
      expect(unknownDupes).toHaveLength(0)
    })
  })

  // ─── FORMATO DE SLUGS ──────────────────────────────────────

  describe('formato de slugs', () => {
    it('todos los slugs son lowercase', () => {
      const bad = activeLaws.filter(l => l.slug && l.slug !== l.slug.toLowerCase())
      if (bad.length > 0) console.error('Slugs con mayúsculas:', bad.map(l => l.slug))
      expect(bad).toHaveLength(0)
    })

    it('ningún slug contiene barras (/)', () => {
      const bad = activeLaws.filter(l => l.slug?.includes('/'))
      if (bad.length > 0) console.error('Slugs con /:', bad.map(l => l.slug))
      expect(bad).toHaveLength(0)
    })

    it('ningún slug contiene espacios', () => {
      const bad = activeLaws.filter(l => l.slug?.includes(' '))
      expect(bad).toHaveLength(0)
    })

    it('ningún slug empieza o termina con guión', () => {
      const bad = activeLaws.filter(l => l.slug?.startsWith('-') || l.slug?.endsWith('-'))
      expect(bad).toHaveLength(0)
    })

    it('ningún slug tiene guiones dobles', () => {
      const bad = activeLaws.filter(l => l.slug?.includes('--'))
      expect(bad).toHaveLength(0)
    })

    it('ningún slug tiene encoding roto', () => {
      const broken = activeLaws.filter(l => l.slug && hasBrokenEncoding(l.slug))
      if (broken.length > 0) {
        console.error('Slugs con encoding roto:')
        for (const l of broken) {
          console.error(`  "${l.slug}" → debería ser "${autoGenerateSlug(l.short_name)}" (${l.short_name})`)
        }
      }
      expect(broken).toHaveLength(0)
    })

    it('todos los slugs solo contienen a-z, 0-9 y guiones', () => {
      const invalid = activeLaws.filter(l => l.slug && !/^[a-z0-9-]+$/.test(l.slug))
      if (invalid.length > 0) console.error('Slugs inválidos:', invalid.map(l => `"${l.slug}"`))
      expect(invalid).toHaveLength(0)
    })
  })

  // ─── LEYES CRÍTICAS ────────────────────────────────────────

  describe('leyes críticas tienen slugs correctos', () => {
    const criticalMappings: [string, string][] = [
      ['CE', 'constitucion-espanola'],
      ['Ley 39/2015', 'ley-39-2015'],
      ['Ley 40/2015', 'ley-40-2015'],
      ['Ley 19/2013', 'ley-19-2013'],
      ['RDL 5/2015', 'rdl-5-2015'],
      ['Código Civil', 'codigo-civil'],
      ['CP', 'codigo-penal'],
      ['LO 6/1985', 'lo-6-1985'],
      ['TUE', 'tue'],
      ['TFUE', 'tfue'],
      ['LO 3/2018', 'lo-3-2018'],
      ['Ley 7/1985', 'ley-7-1985'],
      ['Ley 50/1997', 'ley-50-1997'],
      ['RDL 2/2015', 'estatuto-trabajadores'],
      ['Reglamento del Congreso', 'reglamento-del-congreso'],
      ['Reglamento del Senado', 'reglamento-del-senado'],
      ['Informática Básica', 'informatica-basica'],
      ['Hojas de cálculo. Excel', 'hojas-de-calculo-excel'],
      ['Correo electrónico', 'correo-electronico'],
      ['Ley Tráfico', 'ley-trafico'],
      ['RI Comisión', 'ri-comision'],
      ['Administración electrónica y servicios al ciudadano (CSL)', 'administracion-electronica-csl'],
    ]

    it.each(criticalMappings)(
      '%s → "%s"',
      (shortName, expectedSlug) => {
        const law = activeLaws.find(l => l.short_name === shortName)
        expect(law).toBeDefined()
        expect(law!.slug).toBe(expectedSlug)
      }
    )
  })

  // ─── BIDIRECCIONALIDAD ─────────────────────────────────────

  describe('bidireccionalidad slug ↔ shortName', () => {
    it('cada slug mapea a exactamente un short_name', () => {
      const slugToNames = new Map<string, string[]>()
      for (const law of activeLaws) {
        if (!law.slug) continue
        const names = slugToNames.get(law.slug) || []
        names.push(law.short_name)
        slugToNames.set(law.slug, names)
      }
      const conflicts = Array.from(slugToNames.entries()).filter(([, names]) => names.length > 1)
      if (conflicts.length > 0) {
        for (const [slug, names] of conflicts) console.error(`  "${slug}" → ${names.join(', ')}`)
      }
      expect(conflicts).toHaveLength(0)
    })
  })

  // ─── ESCALABILIDAD: auto-detectar problemas nuevos ─────────

  describe('detección automática de problemas nuevos', () => {
    it('todas las leyes activas tienen nombre y short_name no vacíos', () => {
      const empty = activeLaws.filter(l => !l.name?.trim() || !l.short_name?.trim())
      expect(empty).toHaveLength(0)
    })

    it('reporta slugs custom que difieren del auto-generado', () => {
      // No falla, pero reporta para revisión manual
      const knownCustom = new Set([
        'CE', 'CP', 'LOTC', 'LOGP', 'LOFCS', 'LOMLOE', 'LSP', 'LAJG',
        'RDL 5/2015', 'RDL 2/2015', 'LO 6/1985', 'LO 3/2018', 'LO 5/1985',
        'Reglamento del Congreso', 'Reglamento del Senado', 'Base de datos: Access', 'LECrim',
      ])

      const mismatches = activeLaws.filter(l => {
        if (!l.slug || knownCustom.has(l.short_name)) return false
        return autoGenerateSlug(l.short_name) !== l.slug
      })

      if (mismatches.length > 0) {
        console.warn(`⚠️ ${mismatches.length} leyes con slug custom no registrado`)
        for (const m of mismatches.slice(0, 10)) {
          console.warn(`  "${m.short_name}": BD="${m.slug}" vs auto="${autoGenerateSlug(m.short_name)}"`)
        }
      }
    })
  })
})
