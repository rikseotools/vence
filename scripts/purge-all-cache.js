#!/usr/bin/env node
// scripts/purge-all-cache.js
// Revalida TODAS las rutas cacheadas (ISR) de la web.
// Uso: node scripts/purge-all-cache.js
//
// Rutas revalidadas:
// - Landing + test + temario de cada oposición
// - Páginas de leyes
// - Páginas estáticas (home, /leyes, /oposiciones, etc.)

require('dotenv').config({ path: '.env.local' })

const BASE_URL = process.env.SITE_URL || 'https://www.vence.es'
const CRON_SECRET = process.env.CRON_SECRET

if (!CRON_SECRET) {
  console.error('CRON_SECRET no configurado en .env.local')
  process.exit(1)
}

async function purge(path) {
  try {
    const res = await fetch(`${BASE_URL}/api/purge-cache`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-cron-secret': CRON_SECRET,
      },
      body: JSON.stringify({ path }),
    })
    const data = await res.json()
    return data.success
  } catch {
    return false
  }
}

async function main() {
  const { createClient } = require('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // Obtener slugs de oposiciones activas
  const { data: oposiciones } = await supabase
    .from('oposiciones')
    .select('slug')
    .eq('is_active', true)

  const routes = []

  // Landing + test + temario de cada oposición
  for (const op of oposiciones || []) {
    routes.push(`/${op.slug}`)
    routes.push(`/${op.slug}/test`)
    routes.push(`/${op.slug}/temario`)
  }

  // Páginas de leyes
  const { data: laws } = await supabase
    .from('laws')
    .select('short_name')
    .eq('is_active', true)

  for (const law of laws || []) {
    // Generar slug de ley (simplificado)
    const slug = law.short_name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
    if (slug) routes.push(`/leyes/${slug}`)
  }

  // Estáticas
  routes.push('/')
  routes.push('/leyes')
  routes.push('/oposiciones')
  routes.push('/test-oposiciones')
  routes.push('/temarios')
  routes.push('/leyes-de-oposiciones')
  routes.push('/psicotecnicos')
  routes.push('/oposiciones')
  // /nuestras-oposiciones eliminado (07-may-2026): es 308 redirect a /oposiciones,
  // no necesita purge (el redirect siempre devuelve la misma respuesta).

  // Actualidad
  routes.push('/actualidad/lo-1-2026-multirreincidencia')

  console.log(`Revalidando ${routes.length} rutas...`)

  let ok = 0
  let fail = 0
  for (let i = 0; i < routes.length; i++) {
    const success = await purge(routes[i])
    if (success) ok++
    else fail++
    // Progreso cada 20
    if ((i + 1) % 20 === 0) {
      console.log(`  ${i + 1}/${routes.length}...`)
    }
  }

  console.log(`\nCompletado: ${ok} OK, ${fail} fallos de ${routes.length} rutas`)
}

main().catch(console.error)
