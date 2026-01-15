#!/usr/bin/env node
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const MOTIVO = '\n\n⚠️ PREGUNTA DESACTIVADA (Enero 2026): Los Planes I, II, III y IV de Gobierno Abierto ya no están vigentes. Desde octubre 2025 está vigente el V Plan de Gobierno Abierto (2025-2029) con estructura diferente.'

async function main() {
  const planIds = [
    'c5969699-09fa-4217-9c59-5e8a4940d6cd', // I Plan
    '41af924e-96f9-4a0e-a62b-9352858f9753', // II Plan
    '63cc2d50-551f-4a43-b991-9339343295be', // III Plan
    '08229d82-ed33-4307-a31d-f9cbd108f340'  // IV Plan
  ]

  const { data: arts } = await supabase
    .from('articles')
    .select('id')
    .in('law_id', planIds)

  const artIds = arts.map(a => a.id)

  const { data: qs } = await supabase
    .from('questions')
    .select('id, question_text, explanation, is_active')
    .eq('is_active', true)
    .in('primary_article_id', artIds)

  // Filtrar: mantener solo las históricas
  const desactivar = qs.filter(q => {
    const texto = q.question_text.toLowerCase()
    const esHistorica =
      texto.includes('cuántos planes') ||
      texto.includes('cuantos planes') ||
      texto.includes('en qué año') ||
      texto.includes('qué año se presentó') ||
      texto.includes('qué plan incluyó') ||
      texto.includes('qué plan de gobierno abierto incluyó')

    return !esHistorica
  })

  console.log('Desactivando', desactivar.length, 'preguntas...\n')

  let count = 0
  for (const q of desactivar) {
    const { error } = await supabase
      .from('questions')
      .update({
        is_active: false,
        explanation: (q.explanation || '') + MOTIVO
      })
      .eq('id', q.id)

    if (error) {
      console.log('❌ Error en', q.id, error.message)
    } else {
      count++
      console.log('✅', count + '/' + desactivar.length, q.question_text.substring(0, 50) + '...')
    }
  }

  console.log('\n✅ Desactivadas:', count, 'preguntas')
}

main().catch(console.error)
