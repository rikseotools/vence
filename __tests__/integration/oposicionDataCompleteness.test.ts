/**
 * @jest-environment node
 *
 * Test de integridad: verifica que las oposiciones activas tienen los datos
 * necesarios para landings, seguimiento y breadcrumbs.
 *
 * Detecta datos incompletos que causan errores en producción:
 * - Sin seguimiento_url → no se monitorea
 * - Sin programa_url → link roto en predicciones
 * - Sin temas_count → predicciones incorrectas
 * - Sin boe_reference → landing incompleta
 *
 * Agnóstico a la BD: lee la BD VIVA (DATABASE_URL → RDS), la MISMA capa que la app,
 * NO el cliente Supabase (que apuntaba al backup CONGELADO post-cutover y daba falsos
 * negativos de oposiciones creadas en RDS). Requiere DATABASE_URL en .env.local.
 * (`@jest-environment node` es obligatorio: postgres-js no funciona en jsdom.)
 */
import postgres from 'postgres'
import dotenv from 'dotenv'
import { OPOSICIONES } from '@/lib/config/oposiciones'

dotenv.config({ path: '.env.local', override: true })

const DB_URL = process.env.DATABASE_URL
const hasRealDb = !!DB_URL
const sql = hasRealDb ? postgres(DB_URL!, { prepare: false, ssl: 'require', onnotice: () => {}, max: 2 }) : null

const describeIfDb = hasRealDb ? describe : describe.skip

// Campos requeridos para TODAS las oposiciones activas
const REQUIRED_FIELDS = ['nombre', 'temas_count', 'bloques_count'] as const
// Campos requeridos solo para oposiciones con convocatoria activa
const CONVOCATORIA_FIELDS = ['seguimiento_url', 'boe_reference'] as const

interface OposicionRow {
  slug: string
  nombre: string | null
  is_convocatoria_activa: boolean
  seguimiento_url: string | null
  programa_url: string | null
  boe_reference: string | null
  plazas_libres: number | null
  temas_count: number | null
  bloques_count: number | null
}

describeIfDb('Oposición data completeness', () => {
  let oposiciones: OposicionRow[]

  beforeAll(async () => {
    oposiciones = (await sql!`
      SELECT slug, nombre, is_convocatoria_activa, seguimiento_url, programa_url,
             boe_reference, plazas_libres, temas_count, bloques_count
      FROM oposiciones WHERE is_active = true`) as unknown as OposicionRow[]
  }, 30000)

  afterAll(async () => { if (sql) await sql.end({ timeout: 5 }) })

  test('all active oposiciones have nombre, temas_count, bloques_count', () => {
    const missing: string[] = []
    for (const o of oposiciones) {
      for (const field of REQUIRED_FIELDS) {
        if (!o[field] && o[field] !== 0) {
          missing.push(`${o.slug}: missing ${field}`)
        }
      }
    }
    if (missing.length > 0) console.warn('Missing required fields:', missing)
    expect(missing.length).toBe(0)
  })

  test('all oposiciones with convocatoria activa have seguimiento_url', () => {
    const active = oposiciones.filter(o => o.is_convocatoria_activa)
    const missing = active.filter(o => !o.seguimiento_url)
    if (missing.length > 0) {
      console.warn('Active oposiciones without seguimiento_url:', missing.map(o => o.slug))
    }
    expect(missing.length).toBe(0)
  })

  test('all oposiciones with convocatoria activa have boe_reference', () => {
    const active = oposiciones.filter(o => o.is_convocatoria_activa)
    const missing = active.filter(o => !o.boe_reference)
    if (missing.length > 0) {
      console.warn('Active oposiciones without boe_reference:', missing.map(o => o.slug))
    }
    expect(missing.length).toBe(0)
  })

  test('every OPOSICIONES config entry has a matching row in BD', () => {
    // Whitelist de oposiciones en preparación (en config pero aún sin fila en BD).
    // Cuando se complete su INSERT en oposiciones, eliminar de aquí.
    const KNOWN_PENDING = new Set<string>([
      'auxiliar-administrativo-universidad-almeria', // go-live en curso: BD lista + verificada (116 preg IA triple-auditadas, 24 temas ≥10); is_active=true tras el deploy
      'auxiliar-museos-estado', // en preparación en otra sesión (worktree museos-frontend): config añadido, is_active=false hasta go-live
      'administrativo-castilla-leon', // C1 CyL en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-enfermeria-osakidetza', // en preparación en otra sesión
      'auxiliar-administrativo-diputacion-cordoba', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-ayuntamiento-madrid', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-universidad-complutense', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-universidad-alcala', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-ayuntamiento-sevilla', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-universidad-huelva', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-alicante', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-universidad-cadiz', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-universidad-leon', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-consell-formentera', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-cuenca', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-ourense', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-girona', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-barcelona', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-ayuntamiento-alcala-henares', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-ayuntamiento-granada', // en preparación: BD lista (is_active=false hasta go-live)
      'administrativo-andalucia', // C1 en preparación: BD lista (is_active=false hasta go-live)
      'administrativo-cantabria', // C1 en preparación: BD lista (is_active=false hasta go-live)
      'administrativo-madrid', // C1 en preparación: BD lista (is_active=false hasta go-live)
      'administrativo-castilla-la-mancha', // C1 en preparación: BD lista (is_active=false hasta go-live)
      'administrativo-universidad-leon', // C1 en preparación (otra sesión): config sin fila activa en BD
      'auxiliar-administrativo-diputacion-zamora', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-ayuntamiento-huesca', // go-live en curso: is_active=true tras deploy (8 plazas, BOA 11/06/2026)
      'auxiliar-administrativo-diputacion-huesca', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-avila', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-segovia', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-diputacion-huelva', // en preparación: BD lista (is_active=false hasta go-live)
      'auxiliar-administrativo-ayuntamiento-salamanca', // en preparación: BD lista (is_active=false hasta go-live)
      'celador-ics', // en preparación (otra sesión): config sin fila activa en RDS
      'celador-ibsalut', // en preparación (otra sesión): config sin fila activa en RDS
    ])
    const dbSlugs = new Set(oposiciones.map(o => o.slug))
    const missing = OPOSICIONES.filter(o => !dbSlugs.has(o.slug) && !KNOWN_PENDING.has(o.slug))
    if (missing.length > 0) {
      console.warn('Config oposiciones not in BD:', missing.map(o => o.slug))
    }
    expect(missing.length).toBe(0)
  })

  test('every BD oposición has a matching OPOSICIONES config entry', () => {
    const configSlugs = new Set(OPOSICIONES.map(o => o.slug))
    const extra = oposiciones.filter(o => o.slug && !configSlugs.has(o.slug))
    if (extra.length > 0) {
      console.warn('BD oposiciones not in config:', extra.map(o => o.slug))
    }
    // Allow some extra in BD (null slugs, etc.) but warn
    const meaningful = extra.filter(o => o.slug && o.slug !== 'null')
    expect(meaningful.length).toBe(0)
  })

  // Guardarraíl de DOS FUENTES DE VERDAD (añadido 20/07/2026).
  // Los bloques/temas viven en DOS sitios: la tabla `topics` (que pinta el
  // TEMARIO) y `OPOSICIONES[].blocks` (que pinta el HUB DE TESTS y define el
  // rango del test aleatorio, ver lib/api/random-test-data/schemas.ts).
  // Si un tema está en la BD pero no en el config, el alumno LO VE en el temario
  // pero NO PUEDE hacer tests de él — fallo silencioso, sin error en logs.
  // Casos reales que motivaron el test: Policía Nacional T46 (inglés, 5.071
  // preguntas activas invisibles) y País Vasco T14-31 (18 temas invisibles).
  test('config blocks cover exactly the active topics in BD (tests hub vs temario)', async () => {
    const rows = await sql!<{ position_type: string; nums: number[] }[]>`
      SELECT position_type, array_agg(topic_number ORDER BY topic_number) AS nums
      FROM topics WHERE is_active GROUP BY position_type`
    const byPosition = new Map(rows.map(r => [r.position_type, r.nums.map(Number)]))

    // Las dos direcciones NO son igual de graves:
    //  - tema en BD y NO en config  => FALLO. El alumno lo ve en el temario y no
    //    puede testearlo. Es silencioso: no hay error en logs ni página rota.
    //  - tema en config y NO en BD  => solo aviso. Es el estado NORMAL de una
    //    oposición en construcción (config escrito antes de poblar los temas) y
    //    además es visible a simple vista (el tema sale vacío).
    const invisiblesEnTests: string[] = []
    const soloEnConfig: string[] = []
    for (const o of OPOSICIONES) {
      const enBd = byPosition.get(o.positionType)
      if (!enBd?.length) continue // sin temas en BD todavía: lo cubren los tests de arriba
      const enConfig = (o.blocks || []).flatMap(b => b.themes.map(t => t.id))
      const soloBd = enBd.filter(n => !enConfig.includes(n))
      const soloCfg = enConfig.filter(n => !enBd.includes(n))
      if (soloBd.length) invisiblesEnTests.push(`${o.slug}: temas [${soloBd.join(', ')}]`)
      if (soloCfg.length) soloEnConfig.push(`${o.slug}: temas [${soloCfg.join(', ')}]`)
    }
    if (soloEnConfig.length > 0) {
      console.warn('Temas en config sin fila activa en BD (¿oposición en construcción?):\n' + soloEnConfig.join('\n'))
    }
    if (invisiblesEnTests.length > 0) {
      console.warn('Temas VISIBLES en temario pero NO testeables:\n' + invisiblesEnTests.join('\n'))
    }
    expect(invisiblesEnTests).toEqual([])
  })

  // GUARDARRAÍL (gap real 24/07, feedback Maricarmen): el número VISIBLE del tema tiene DOS
  // fuentes — la BD (`topics.display_number`, que usa el ÍNDICE vía getTemarioByPositionType) y
  // el config (`blocks[].themes[].displayNumber`, que usan BREADCRUMBS y la CABECERA del tema vía
  // getBlockForTopic). En Cuidador Córdoba la BD tenía el número oficial (Bloque II 1-16) pero el
  // config NO llevaba displayNumber → los temas del Bloque II salían con el topic_number interno
  // (5-20) en breadcrumbs/cabecera mientras el índice mostraba 1-16. La app se contradecía y una
  // usuaria se confundió. Este test fuerza que el número visible del config == el de la BD para
  // TODA oposición con temas, así no puede volver a divergir al añadir/renumerar una oposición.
  test('config displayNumber == BD display_number (número VISIBLE coherente en toda la UI)', async () => {
    const rows = await sql!<{ position_type: string; topic_number: number; display_number: number | null }[]>`
      SELECT position_type, topic_number, display_number FROM topics WHERE is_active`
    const dbVisible = new Map<string, number>()
    for (const r of rows) dbVisible.set(`${r.position_type}:${r.topic_number}`, Number(r.display_number ?? r.topic_number))

    // RATCHET: divergencias PRE-EXISTENTES (deuda, descubiertas por este guardarraíl el 24/07).
    // Reconciliar cada una verificando su programa oficial y decidiendo la fuente correcta
    // (config o BD) — no se pudo en el momento por alcance. El guardarraíl las salta pero exige
    // que NINGUNA otra (ni una nueva) diverja. Al reconciliar una, quitarla de aquí (el ratchet
    // solo puede bajar). NUNCA añadir una nueva aquí para "callar" el test: eso reintroduce el bug.
    // 3 reconciliadas el 24/07 (asturias, osakidetza, granada): tenían display_number NULL en BD
    // → el índice mostraba el topic_number roto (Tema 201, 301…); se pobló BD.display_number con la
    // numeración de la config (asturias continua 1-38; osakidetza y granada por-bloque). Ya no divergen.
    // Quedan 2, que requieren su TEMARIO OFICIAL (Resolución/programa aparte de la convocatoria) para
    // decidir por-bloque vs continuo — pendiente de verificar sin prisa antes de sincronizar:
    //   - administrativo-estado: BOE-A-2025-26262 (config continuo 1-45 vs BD por-bloque)
    //   - enfermero-sms: temario en Resolución aparte (config continuo 16-71 vs BD por-bloque 1-56)
    const KNOWN_DIVERGENCES = new Set([
      'administrativo-estado',
      'enfermero-sms',
    ])

    const mismatches: string[] = []
    const knownStillDiverging: string[] = []
    for (const o of OPOSICIONES) {
      let oposDiverge = false
      for (const b of o.blocks || []) {
        for (const t of b.themes) {
          const db = dbVisible.get(`${o.positionType}:${t.id}`)
          if (db === undefined) continue // tema en config sin fila activa en BD → lo cubre el test de cobertura
          const configVisible = t.displayNumber ?? t.id
          if (configVisible !== db) {
            oposDiverge = true
            if (!KNOWN_DIVERGENCES.has(o.slug)) {
              mismatches.push(`${o.slug} tema id=${t.id}: config muestra "Tema ${configVisible}" pero la BD (display_number) muestra "Tema ${db}"`)
            }
          }
        }
      }
      if (oposDiverge && KNOWN_DIVERGENCES.has(o.slug)) knownStillDiverging.push(o.slug)
    }
    if (mismatches.length > 0) {
      console.error('Número de tema INCOHERENTE (config vs BD) — breadcrumbs/cabecera divergen del índice:\n' + mismatches.join('\n'))
    }
    // Higiene del ratchet: una entrada del allowlist que YA no diverge debe quitarse.
    const staleAllowlist = [...KNOWN_DIVERGENCES].filter(s => !knownStillDiverging.includes(s))
    if (staleAllowlist.length > 0) {
      console.warn('Allowlist obsoleto (ya no divergen, quítalos de KNOWN_DIVERGENCES): ' + staleAllowlist.join(', '))
    }
    expect(mismatches).toEqual([])
  })
})
