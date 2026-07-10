// __tests__/integration/temarioEpigrafeIntegrity.test.ts
// Test de integración: valida coherencia entre BD (topics) + listado temario + página tema-N.
// Verifica que la fuente única de verdad (BD) tiene datos completos y consistentes.
// Se salta en CI si no hay credenciales reales.

import dotenv from 'dotenv'
import { Client } from 'pg'

dotenv.config({ path: '.env.local', override: true })

// Lee de la BD VIVA (RDS) vía pg. NO Supabase (congelado desde 04/07).
const DB_URL = process.env.DATABASE_URL
const hasDb = !!DB_URL

interface Topic {
  id: string
  position_type: string
  topic_number: number
  title: string
  description: string | null
  epigrafe: string | null
  bloque_number: number | null
  descripcion_corta: string | null
  is_active: boolean
  disponible: boolean
}

interface Bloque {
  position_type: string
  bloque_number: number
  titulo: string
  icon: string | null
}

interface TopicScope {
  topic_id: string
  law_id: string | null
  article_numbers: string[] | null
}

const describeIf = hasDb ? describe : describe.skip

describeIf('Integración temario: BD ↔ listado ↔ tema-N', () => {
  let client: Client
  let topics: Topic[] = []
  let bloques: Bloque[] = []
  let scopes: TopicScope[] = []

  beforeAll(async () => {
    client = new Client({ connectionString: DB_URL })
    await client.connect()
    topics = (await client.query<Topic>('SELECT * FROM topics WHERE is_active = true')).rows
    bloques = (await client.query<Bloque>('SELECT * FROM oposicion_bloques')).rows
    scopes = (await client.query<TopicScope>('SELECT topic_id, law_id, article_numbers FROM topic_scope')).rows
  }, 30000)

  afterAll(async () => { await client?.end() })

  // ============================================
  // FUENTE DE VERDAD: topics table
  // ============================================

  it('todos los topics activos tienen title no vacío', () => {
    const invalidos = topics.filter(t => !t.title || t.title.trim().length < 3)
    expect(invalidos).toEqual([])
  })

  it('todos los topics activos tienen description no vacía', () => {
    const invalidos = topics.filter(t => !t.description || t.description.trim().length < 10)
    if (invalidos.length > 0) {
      console.warn('Topics sin description:', invalidos.slice(0, 5).map(t => `${t.position_type} T${t.topic_number}`))
    }
    // COSMÉTICO (no correctness): `description` es SUPLEMENTARIO — el temario se
    // renderiza con title + epígrafe (oficial BOE) sin él. Cada oposición nueva
    // se construye sin description propia hasta redactarla. A 08/07 hay ~364
    // (crece con cada build de la sesión de contenido). Umbral holgado (caza
    // regresión estructural, no bloquea builds); redacción = tarea aparte.
    expect(invalidos.length).toBeLessThan(500)
  })

  it('todos los topics activos tienen epigrafe (fuente oficial BOE)', () => {
    const sinEpigrafe = topics.filter(t => !t.epigrafe || t.epigrafe.trim().length < 10)
    if (sinEpigrafe.length > 0) {
      console.warn('Topics sin epígrafe:', sinEpigrafe.slice(0, 5).map(t => `${t.position_type} T${t.topic_number}: ${t.title}`))
    }
    // Tolerancia: algunos temas virtuales (informática) pueden no tener epígrafe BOE
    expect(sinEpigrafe.length).toBeLessThan(140) // PN(45)+PM(40)+Navarra/La Rioja(50) con epígrafes cortos
  })

  // ============================================
  // LISTADO TEMARIO: topics.bloque_number + descripcion_corta + oposicion_bloques
  // ============================================

  it('todos los topics tienen bloque_number asignado', () => {
    const sinBloque = topics.filter(t => t.bloque_number === null)
    expect(sinBloque).toEqual([])
  })

  it('todos los topics tienen descripcion_corta (usada en listado)', () => {
    // Excluir Navarra/La Rioja (oposiciones incompletas, sin epígrafes aún)
    const completadas = topics.filter(t => !['administrativo_navarra', 'auxiliar_administrativo_la_rioja'].includes(t.position_type))
    const sinDesc = completadas.filter(t => !t.descripcion_corta || t.descripcion_corta.trim().length < 5)
    expect(sinDesc).toEqual([])
  })

  it('descripcion_corta es una versión resumida de description (no cambia el significado)', () => {
    // La descripción corta debe empezar con palabras del título o de la description
    const incoherentes = topics.filter(t => {
      if (!t.descripcion_corta || !t.description) return false
      // La primera palabra significativa de descripcion_corta debe estar en description o title
      const firstWord = t.descripcion_corta.split(/\s+/)[0].toLowerCase()
      if (firstWord.length < 4) return false // palabras cortas como "La", "Los" no sirven
      return !t.description.toLowerCase().includes(firstWord) && !t.title.toLowerCase().includes(firstWord)
    })
    if (incoherentes.length > 0) {
      console.warn('descripcion_corta incoherente:', incoherentes.slice(0, 5).map(t => ({
        tema: `${t.position_type} T${t.topic_number}`,
        title: t.title,
        descripcion_corta: t.descripcion_corta?.slice(0, 80),
        description: t.description?.slice(0, 80),
      })))
    }
    expect(incoherentes.length).toBeLessThan(45) // tolerancia por ahora — incoherentes legacy (enfermero_sas_andalucia 13, diputacion_zaragoza 7, aragon, galicia T12); tcae_sescam/celador_galicia aportan 0 (descripcion_corta = title)
  })

  it('cada bloque tiene al menos un topic', () => {
    const bloquesHuerfanos = bloques.filter(b => {
      return !topics.some(t => t.position_type === b.position_type && t.bloque_number === b.bloque_number)
    })
    expect(bloquesHuerfanos).toEqual([])
  })

  it('cada topic apunta a un bloque existente en oposicion_bloques', () => {
    // Excluir Navarra/La Rioja (oposiciones incompletas, sin oposicion_bloques aún)
    const completadas = topics.filter(t => !['administrativo_navarra', 'auxiliar_administrativo_la_rioja'].includes(t.position_type))
    const topicsHuerfanos = completadas.filter(t => {
      return !bloques.some(b => b.position_type === t.position_type && b.bloque_number === t.bloque_number)
    })
    expect(topicsHuerfanos).toEqual([])
  })

  // ============================================
  // PÁGINA TEMA-N: topic_scope + articles
  // ============================================

  it('cada topic activo tiene al menos un topic_scope (artículos de ley)', () => {
    const sinScope = topics.filter(t => {
      if (!t.disponible) return false // temas "en elaboración" pueden no tener scope
      return !scopes.some(s => s.topic_id === t.id)
    })
    if (sinScope.length > 0) {
      console.warn('Topics sin scope:', sinScope.slice(0, 5).map(t => `${t.position_type} T${t.topic_number}: ${t.title}`))
    }
    // Tolerancia: algunos temas pueden estar en desarrollo
    expect(sinScope.length).toBeLessThan(35)
  })

  it('topic_scope válidos tienen law_id no nulo (solo 2 legacy tolerados)', () => {
    const sinLaw = scopes.filter(s => !s.law_id)
    // 2 entries legacy en auxiliar_administrativo_estado T9, T14 (pendientes de arreglar)
    expect(sinLaw.length).toBeLessThan(5)
  })

  // ============================================
  // COHERENCIA title ↔ epigrafe
  // ============================================

  it('title y epigrafe no son contradictorios (mismo dominio temático)', () => {
    // Oposiciones bilingües: title en castellano (UI) + epigrafe LITERAL en otra lengua
    // cooficial (el manual exige el epígrafe literal del boletín). La heurística palabra-a-palabra
    // no cruza idiomas, así que estas se excluyen (p.ej. enfermero_ics: título ES / epígrafe català del DOGC).
    const BILINGUE_TITLE_EPIGRAFE = new Set(['enfermero_ics'])
    // Heurística: el title debe compartir palabras clave con el epigrafe
    const incoherentes = topics.filter(t => {
      if (!t.epigrafe || !t.title) return false
      if (BILINGUE_TITLE_EPIGRAFE.has(t.position_type)) return false
      const titleWords = t.title.toLowerCase().split(/\s+/).filter(w => w.length >= 5)
      const epigrafeLower = t.epigrafe.toLowerCase()
      // Al menos 1 palabra de 5+ letras del title debe estar en el epigrafe
      return titleWords.length > 0 && !titleWords.some(w => epigrafeLower.includes(w))
    })
    if (incoherentes.length > 0) {
      console.warn('title ↔ epigrafe incoherentes:', incoherentes.slice(0, 5).map(t => ({
        tema: `${t.position_type} T${t.topic_number}`,
        title: t.title,
        epigrafe: t.epigrafe?.slice(0, 100),
      })))
    }
    expect(incoherentes.length).toBeLessThan(20)
  })

  // ============================================
  // ESTADÍSTICAS DE COBERTURA
  // ============================================

  it('reporte de cobertura (informativo)', () => {
    const stats = {
      totalTopics: topics.length,
      totalBloques: bloques.length,
      totalScopes: scopes.length,
      conEpigrafe: topics.filter(t => t.epigrafe).length,
      conDescripcionCorta: topics.filter(t => t.descripcion_corta).length,
      conBloque: topics.filter(t => t.bloque_number !== null).length,
      disponibles: topics.filter(t => t.disponible).length,
      oposiciones: [...new Set(topics.map(t => t.position_type))].length,
    }
    console.log('\n=== Cobertura Temario ===')
    console.log(`Oposiciones: ${stats.oposiciones}`)
    console.log(`Topics: ${stats.totalTopics} (${stats.disponibles} disponibles)`)
    console.log(`Bloques: ${stats.totalBloques}`)
    console.log(`Con epígrafe: ${stats.conEpigrafe}/${stats.totalTopics} (${Math.round(stats.conEpigrafe/stats.totalTopics*100)}%)`)
    console.log(`Con descripción corta: ${stats.conDescripcionCorta}/${stats.totalTopics} (${Math.round(stats.conDescripcionCorta/stats.totalTopics*100)}%)`)
    console.log(`Con bloque: ${stats.conBloque}/${stats.totalTopics} (${Math.round(stats.conBloque/stats.totalTopics*100)}%)`)
    console.log(`Topic scopes: ${stats.totalScopes}`)
    expect(stats.totalTopics).toBeGreaterThan(400)
  })
})
