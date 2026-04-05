// __tests__/integration/temarioSemanticCoherence.test.ts
// Test semántico: valida que title, descripcion_corta y epigrafe son coherentes entre sí.
// Detecta títulos cruzados, epígrafes copiados de temas equivocados, descripciones inventadas.
// Cambia el threshold con cuidado: subir = más estricto, bajar = más tolerante con abreviaciones.

import dotenv from 'dotenv'
import https from 'https'

dotenv.config({ path: '.env.local', override: true })

const REAL_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const REAL_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hasRealDb = !!(REAL_URL && REAL_KEY && !REAL_URL.includes('test.supabase.co'))

function supabaseGet<T = unknown>(table: string, params: string): Promise<T[]> {
  const url = `${REAL_URL}/rest/v1/${table}?${params}`
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: { apikey: REAL_KEY!, Authorization: `Bearer ${REAL_KEY}` },
    }, (res) => {
      let data = ''
      res.on('data', (chunk: string) => { data += chunk })
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`${table}: ${res.statusCode}`))
        try { resolve(JSON.parse(data)) } catch (e) { reject(e) }
      })
    }).on('error', reject)
  })
}

interface Topic {
  position_type: string
  topic_number: number
  title: string
  description: string | null
  epigrafe: string | null
  descripcion_corta: string | null
  is_active: boolean
}

function normalize(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function significantWords(s: string): string[] {
  const stopwords = new Set([
    'sobre', 'entre', 'desde', 'hasta', 'segun', 'mediante', 'durante', 'contra',
    'cuando', 'donde', 'dentro', 'contra', 'nuestro', 'nuestra', 'otros', 'otras',
  ])
  return normalize(s).split(/\W+/).filter(w => w.length >= 5 && !stopwords.has(w))
}

function coverage(words: string[], text: string): number {
  if (words.length === 0) return 1
  const textNorm = normalize(text)
  const matched = words.filter(w => textNorm.includes(w)).length
  return matched / words.length
}

// Topics con abreviaciones/sinónimos que están OK (no son bugs, son casos conocidos)
const WHITELIST_ABBREVIATIONS = new Set([
  // Abreviaciones/sinónimos legítimos
  'auxiliar_administrativo_aragon:12',     // "documentos admin" vs "documento, archivo, registro"
  'auxiliar_administrativo_extremadura:3', // "TREBEP" abreviación
  'auxiliar_administrativo_baleares:28',   // "Word: corrección" vs "Comprobar la ortografía"
  'auxiliar_administrativo_baleares:31',   // "Excel: tablas" vs "Insertar tablas"
  'auxiliar_administrativo_valencia:8',    // "Consellerias" vs "Consell" (abreviación)
  'auxiliar_administrativo_valencia:9',    // "Derecho UE" vs "Unión Europea"
  'tramitacion_procesal:21',                // "LECrim (II)" - numeral romano
  'auxilio_judicial:7',                     // "Órganos jurisdiccionales superiores" - sinónimos
  'auxilio_judicial:8',                     // "Órganos jurisdiccionales de instancia" - sinónimos
  'auxilio_judicial:13',                    // "Ingreso y carrera" vs "Funciones. Formas de acceso"
])

const describeIf = hasRealDb ? describe : describe.skip

describeIf('Coherencia semántica temario: title ↔ descripcion_corta ↔ epigrafe', () => {
  let topics: Topic[] = []

  beforeAll(async () => {
    topics = await supabaseGet<Topic>('topics', 'is_active=eq.true&select=position_type,topic_number,title,description,epigrafe,descripcion_corta,is_active')
  }, 30000)

  it('title coincide semánticamente con epigrafe (>= 50% keywords)', () => {
    const misalignments: Array<{ key: string, title: string, epigrafe: string, coverage: string }> = []

    for (const t of topics) {
      if (!t.epigrafe || t.epigrafe.length < 20) continue
      if (t.title.length < 5) continue

      const key = `${t.position_type}:${t.topic_number}`
      if (WHITELIST_ABBREVIATIONS.has(key)) continue

      const titleKeywords = significantWords(t.title)
      if (titleKeywords.length === 0) continue

      const cov = coverage(titleKeywords, t.epigrafe)
      if (cov < 0.5) {
        misalignments.push({
          key,
          title: t.title,
          epigrafe: t.epigrafe.slice(0, 100),
          coverage: Math.round(cov * 100) + '%',
        })
      }
    }

    if (misalignments.length > 0) {
      console.error('\nTítulos cruzados detectados (title ↔ epigrafe):')
      for (const m of misalignments) {
        console.error(`  ${m.key} [${m.coverage}]`)
        console.error(`    title: ${m.title}`)
        console.error(`    epigrafe: ${m.epigrafe}`)
      }
    }

    // Debe fallar si aparecen NUEVOS mismatches (los actuales están en whitelist)
    expect(misalignments).toEqual([])
  })

  it('descripcion_corta deriva de description o title (no inventada)', () => {
    const invented: Array<{ key: string, descripcion_corta: string, description: string }> = []

    for (const t of topics) {
      if (!t.descripcion_corta) continue
      if (!t.description && !t.title) continue

      const descKeywords = significantWords(t.descripcion_corta)
      if (descKeywords.length === 0) continue

      const fullSource = (t.description || '') + ' ' + (t.title || '')
      const cov = coverage(descKeywords, fullSource)

      // La descripcion_corta debe tener >= 40% de keywords que aparezcan en description/title
      if (cov < 0.4) {
        invented.push({
          key: `${t.position_type}:${t.topic_number}`,
          descripcion_corta: t.descripcion_corta,
          description: (t.description || '').slice(0, 100),
        })
      }
    }

    if (invented.length > 0) {
      console.error('\nDescripciones cortas inventadas:')
      for (const i of invented.slice(0, 10)) {
        console.error(`  ${i.key}`)
        console.error(`    descripcion_corta: ${i.descripcion_corta}`)
        console.error(`    description: ${i.description}`)
      }
    }

    // 27 descripciones generadas desde title (CARM + topics sin description) son aceptables
    expect(invented.length).toBeLessThan(35)
  })

  it('no hay 2 topics con el mismo epigrafe (detecta epígrafes duplicados/cruzados)', () => {
    const byEpigrafe = new Map<string, string[]>()

    for (const t of topics) {
      if (!t.epigrafe || t.epigrafe.length < 50) continue
      const key = t.epigrafe.trim().toLowerCase()
      const list = byEpigrafe.get(key) || []
      list.push(`${t.position_type}:T${t.topic_number}`)
      byEpigrafe.set(key, list)
    }

    const duplicates: Array<{ topics: string[], epigrafe: string }> = []
    for (const [epigrafe, list] of byEpigrafe.entries()) {
      // Permitir duplicados entre oposiciones distintas (CE en varios temarios)
      const uniquePositions = new Set(list.map(l => l.split(':')[0]))
      if (list.length > uniquePositions.size) {
        duplicates.push({ topics: list, epigrafe: epigrafe.slice(0, 80) })
      }
    }

    if (duplicates.length > 0) {
      console.error('\nEpígrafes duplicados dentro de la misma oposición:')
      for (const d of duplicates.slice(0, 10)) {
        console.error(`  topics: ${d.topics.join(', ')}`)
        console.error(`  epigrafe: ${d.epigrafe}`)
      }
    }

    expect(duplicates).toEqual([])
  })
})
