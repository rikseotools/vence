#!/usr/bin/env node
/**
 * analyze-missing-eu-articles.cjs
 * Analiza qué artículos de TUE/TFUE faltan en la BD
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  // Obtener leyes
  const { data: tfueLaw } = await supabase
    .from('laws')
    .select('id, short_name')
    .ilike('short_name', 'TFUE')
    .single()

  const { data: tueLaw } = await supabase
    .from('laws')
    .select('id, short_name')
    .ilike('short_name', 'TUE')
    .single()

  // Obtener artículos existentes
  const { data: tfueArts } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', tfueLaw.id)
    .order('article_number')

  const { data: tueArts } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', tueLaw.id)
    .order('article_number')

  const tfueNums = new Set(tfueArts.map(a => a.article_number))
  const tueNums = new Set(tueArts.map(a => a.article_number))

  // Obtener preguntas y ver qué artículos mencionan
  const { data: allQs } = await supabase
    .from('questions')
    .select('id, question_text')
    .eq('is_active', true)
    .or('question_text.ilike.%TFUE%,question_text.ilike.%TUE%,question_text.ilike.%Tratado de Funcionamiento%,question_text.ilike.%Tratado de la Unión%')

  const tfueMentioned = new Set()
  const tueMentioned = new Set()

  for (const q of allQs || []) {
    const text = q.question_text

    // Buscar menciones TFUE
    const tfueMatches = text.matchAll(/art[íi]culo\s+(\d+)\s+(?:del\s+)?(?:TFUE|Tratado\s+de\s+Funcionamiento)/gi)
    for (const m of tfueMatches) {
      tfueMentioned.add(m[1])
    }
    const tfueMatches2 = text.matchAll(/art[íi]culo\s+(\d+)\s+TFUE/gi)
    for (const m of tfueMatches2) {
      tfueMentioned.add(m[1])
    }

    // Buscar menciones TUE
    const tueMatches = text.matchAll(/art[íi]culo\s+(\d+(?:\.\d+)?)\s+(?:del\s+)?(?:TUE|Tratado\s+de\s+la\s+Uni[oó]n\s+Europea)/gi)
    for (const m of tueMatches) {
      tueMentioned.add(m[1].split('.')[0])
    }
    const tueMatches2 = text.matchAll(/art[íi]culo\s+(\d+(?:\.\d+)?)\s+TUE/gi)
    for (const m of tueMatches2) {
      tueMentioned.add(m[1].split('.')[0])
    }
  }

  console.log('═══════════════════════════════════════════════════════════')
  console.log('ANÁLISIS DE ARTÍCULOS TUE/TFUE EN LA BD')
  console.log('═══════════════════════════════════════════════════════════\n')

  console.log('TFUE:')
  console.log('  Artículos en BD:', tfueArts.length)
  console.log('  Artículos mencionados en preguntas:', tfueMentioned.size)
  const tfueMissing = [...tfueMentioned].filter(n => !tfueNums.has(n)).sort((a,b) => parseInt(a) - parseInt(b))
  console.log('  Artículos FALTANTES:', tfueMissing.length)
  console.log('  Faltantes:', tfueMissing.join(', '))

  console.log('\nTUE:')
  console.log('  Artículos en BD:', tueArts.length)
  console.log('  Artículos mencionados en preguntas:', tueMentioned.size)
  const tueMissing = [...tueMentioned].filter(n => !tueNums.has(n)).sort((a,b) => parseInt(a) - parseInt(b))
  console.log('  Artículos FALTANTES:', tueMissing.length)
  console.log('  Faltantes:', tueMissing.join(', '))

  // Contar preguntas afectadas
  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('PREGUNTAS AFECTADAS POR ARTÍCULOS FALTANTES')
  console.log('═══════════════════════════════════════════════════════════\n')

  let tfueAffected = 0
  let tueAffected = 0

  for (const q of allQs || []) {
    const text = q.question_text
    for (const missing of tfueMissing) {
      const regex = new RegExp(`art[íi]culo\\s+${missing}\\s+(?:del\\s+)?(?:TFUE|Tratado\\s+de\\s+Funcionamiento)`, 'i')
      if (regex.test(text)) {
        tfueAffected++
        break
      }
    }
    for (const missing of tueMissing) {
      const regex = new RegExp(`art[íi]culo\\s+${missing}(?:\\.\\d+)?\\s+(?:del\\s+)?(?:TUE|Tratado\\s+de\\s+la\\s+Uni[oó]n)`, 'i')
      if (regex.test(text)) {
        tueAffected++
        break
      }
    }
  }

  console.log('TFUE: ~' + tfueAffected + ' preguntas mencionan artículos no indexados')
  console.log('TUE: ~' + tueAffected + ' preguntas mencionan artículos no indexados')

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log('RECOMENDACIÓN')
  console.log('═══════════════════════════════════════════════════════════\n')

  console.log('Para corregir completamente el problema se necesita:')
  console.log('1. Añadir los artículos faltantes del TFUE:', tfueMissing.join(', '))
  console.log('2. Añadir los artículos faltantes del TUE:', tueMissing.join(', '))
  console.log('\nMientras tanto, las preguntas quedan vinculadas al artículo')
  console.log('más cercano temáticamente que sí existe en la BD.')
}

main().catch(console.error)
