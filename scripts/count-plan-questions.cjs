#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  const planes = [
    { id: 'c5969699-09fa-4217-9c59-5e8a4940d6cd', nombre: 'I Plan (2012-2014)' },
    { id: '41af924e-96f9-4a0e-a62b-9352858f9753', nombre: 'II Plan (2014-2016)' },
    { id: '63cc2d50-551f-4a43-b991-9339343295be', nombre: 'III Plan (2017-2019)' },
    { id: '08229d82-ed33-4307-a31d-f9cbd108f340', nombre: 'IV Plan (2020-2024)' }
  ]

  console.log('PREGUNTAS POR PLAN DE GOBIERNO ABIERTO:\n')

  for (const plan of planes) {
    const { data: arts } = await supabase
      .from('articles')
      .select('id')
      .eq('law_id', plan.id)

    if (!arts || arts.length === 0) {
      console.log(plan.nombre + ': Sin artículos')
      continue
    }

    const artIds = arts.map(a => a.id)
    const { data: qs } = await supabase
      .from('questions')
      .select('id, question_text, is_active')
      .in('primary_article_id', artIds)

    const activas = qs.filter(q => q.is_active)
    const inactivas = qs.filter(q => !q.is_active)

    console.log('═'.repeat(50))
    console.log(plan.nombre)
    console.log('═'.repeat(50))
    console.log('  ✅ Activas:', activas.length)
    console.log('  ❌ Desactivadas:', inactivas.length)

    if (activas.length > 0) {
      console.log('\n  Preguntas activas:')
      for (const q of activas) {
        console.log('    •', q.question_text.substring(0, 60) + '...')
      }
    }
    console.log('')
  }
}

main().catch(console.error)
