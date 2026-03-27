// __tests__/config/landingVariables.test.ts
// Verifica que todas las variables {x} usadas en landing_faqs y landing_estadisticas
// de la BD tienen correspondencia en el mapa de resolveVars del template dinámico.
// Si alguien añade una variable nueva en BD sin añadirla al template, este test falla.

import * as fs from 'fs'
import * as path from 'path'

// Variables que el template define en varsMap (app/[oposicion]/page.tsx)
// Extraídas del código fuente para mantenerlas sincronizadas
function getTemplateVarNames(): string[] {
  const templatePath = path.join(process.cwd(), 'app/[oposicion]/page.tsx')
  const content = fs.readFileSync(templatePath, 'utf-8')

  // Buscar el bloque varsMap (puede ser multilínea) y extraer las keys
  const varsMapMatch = content.match(/const varsMap[\s\S]*?\{([\s\S]*?)\n  \}/)
  if (!varsMapMatch) throw new Error('No se encontró varsMap en el template')

  // Captura tanto "key: value" como shorthand "key," o "key\n"
  const block = varsMapMatch[1]
  const keyPattern = /^\s*(\w+)\s*[,:]/gm
  const keys: string[] = []
  let m
  while ((m = keyPattern.exec(block)) !== null) {
    keys.push(m[1])
  }
  if (keys.length === 0) throw new Error('No se encontraron keys en varsMap')

  return keys
}

// Variables usadas en los textos de BD (mock-free: lee del código, no de BD)
// Para test de integración con BD real, ver el describe de abajo
function getUsedVarsFromFile(filePath: string): string[] {
  if (!fs.existsSync(filePath)) return []
  const content = fs.readFileSync(filePath, 'utf-8')
  const matches = content.matchAll(/\{(\w+)\}/g)
  return [...new Set([...matches].map(m => m[1]))]
}

describe('Landing template: variables resueltas', () => {
  const templateVars = getTemplateVarNames()

  test('varsMap tiene al menos 10 variables definidas', () => {
    expect(templateVars.length).toBeGreaterThanOrEqual(10)
  })

  test('varsMap incluye las variables críticas', () => {
    const critical = [
      'plazasLibres', 'temasCount', 'tituloRequerido', 'boeRef',
      'textoExamen', 'textoInscripcion', 'salarioMin', 'salarioMax'
    ]
    for (const v of critical) {
      expect(templateVars).toContain(v)
    }
  })

  test('template usa resolveVars para FAQs', () => {
    const templatePath = path.join(process.cwd(), 'app/[oposicion]/page.tsx')
    const content = fs.readFileSync(templatePath, 'utf-8')
    expect(content).toContain('resolveVars(f.pregunta)')
    expect(content).toContain('resolveVars(f.respuesta)')
  })

  test('template usa resolveVars para estadísticas', () => {
    const templatePath = path.join(process.cwd(), 'app/[oposicion]/page.tsx')
    const content = fs.readFileSync(templatePath, 'utf-8')
    expect(content).toContain('resolveVars(s.numero)')
  })

  test('resolveVars devuelve string vacío para variables desconocidas (no muestra llaves)', () => {
    const templatePath = path.join(process.cwd(), 'app/[oposicion]/page.tsx')
    const content = fs.readFileSync(templatePath, 'utf-8')
    // Debe retornar val ?? '' (no val ?? `{${key}}`)
    expect(content).toContain("return val ?? ''")
  })
})

// Test de integración: lee las FAQs reales de BD y verifica que las variables existen
describe('Landing BD: variables en FAQs y estadísticas existen en varsMap', () => {
  const templateVars = getTemplateVarNames()

  // Este test lee de la BD real via REST API nativo (sin supabase-js)
  test('todas las variables en landing_faqs de BD están en varsMap', async () => {
    // Cargar .env.local con override para usar credenciales reales (no mocks de jest.setup)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const env = require(require('path').join(process.cwd(), 'node_modules/dotenv')).config({ path: '.env.local' })

    const url = env.parsed?.NEXT_PUBLIC_SUPABASE_URL
    const key = env.parsed?.SUPABASE_SERVICE_ROLE_KEY || env.parsed?.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !key) { console.warn('Skipping: no Supabase credentials'); return }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const https = require('https')
    const data: any[] = await new Promise((resolve, reject) => {
      const reqUrl = `${url}/rest/v1/oposiciones?is_active=eq.true&select=slug,landing_faqs,landing_estadisticas`
      const req = https.get(reqUrl, { headers: { apikey: key, Authorization: `Bearer ${key}` } }, (res: any) => {
        let body = ''
        res.on('data', (chunk: string) => { body += chunk })
        res.on('end', () => { try { resolve(JSON.parse(body)) } catch { reject(new Error('JSON parse failed')) } })
      })
      req.on('error', reject)
    })

    const missingVars: string[] = []

    for (const op of (data || [])) {
      // Check FAQs
      for (const faq of (op.landing_faqs || [])) {
        const text = `${faq.pregunta} ${faq.respuesta}`
        const matches = text.matchAll(/\{(\w+)\}/g)
        for (const m of matches) {
          if (!templateVars.includes(m[1])) {
            missingVars.push(`${op.slug}: FAQ usa {${m[1]}} pero no está en varsMap`)
          }
        }
      }

      // Check estadísticas
      for (const stat of (op.landing_estadisticas || [])) {
        const matches = stat.numero.matchAll(/\{(\w+)\}/g)
        for (const m of matches) {
          if (!templateVars.includes(m[1])) {
            missingVars.push(`${op.slug}: Estadística usa {${m[1]}} pero no está en varsMap`)
          }
        }
      }
    }

    if (missingVars.length > 0) {
      console.error('Variables faltantes:\n' + missingVars.join('\n'))
    }
    expect(missingVars).toEqual([])
  })
})
