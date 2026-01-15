#!/usr/bin/env node
/**
 * verify-eu-questions.cjs
 * Verificación exhaustiva de preguntas de normativa europea
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  // Buscar leyes europeas
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name')
    .or('short_name.ilike.%TUE%,short_name.ilike.%TFUE%,short_name.ilike.%RGPD%,short_name.ilike.%tratado%')

  console.log('VERIFICACIÓN EXHAUSTIVA DE NORMATIVA EUROPEA\n')
  console.log('═'.repeat(70))

  for (const law of laws || []) {
    // Obtener artículos de esta ley
    const { data: articles } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', law.id)
      .order('article_number')

    if (!articles || articles.length === 0) continue

    // Obtener preguntas activas de esta ley
    const artIds = articles.map(a => a.id)
    const { data: questions } = await supabase
      .from('questions')
      .select('id, question_text, explanation, primary_article_id')
      .eq('is_active', true)
      .in('primary_article_id', artIds)

    if (!questions || questions.length === 0) continue

    console.log(`\n${law.short_name} (${law.name?.substring(0, 50)}...)`)
    console.log(`  Artículos en BD: ${articles.length}`)
    console.log(`  Preguntas activas: ${questions.length}`)

    // Crear mapa de artículos
    const artMap = {}
    for (const a of articles) {
      artMap[a.id] = a
    }

    // Analizar cada pregunta
    const issues = []
    for (const q of questions) {
      const art = artMap[q.primary_article_id]
      if (!art) {
        issues.push({ q, issue: 'Artículo no encontrado' })
        continue
      }

      // Buscar menciones de artículos en el texto de la pregunta
      const artMentions = q.question_text.match(/art[íi]culo\s+(\d+)/gi) || []
      const numMentions = artMentions.map(m => {
        const match = m.match(/(\d+)/)
        return match ? match[1] : null
      }).filter(Boolean)

      // Verificar si el artículo vinculado coincide con los mencionados
      if (numMentions.length > 0) {
        const linkedNum = art.article_number
        const mentioned = numMentions[0] // Primera mención

        // Si menciona un artículo específico y no coincide
        if (mentioned !== linkedNum && linkedNum !== '0') {
          // Verificar en explicación también
          const explMentions = (q.explanation || '').match(/art[íi]culo\s+(\d+)/gi) || []
          const explNums = explMentions.map(m => {
            const match = m.match(/(\d+)/)
            return match ? match[1] : null
          }).filter(Boolean)

          // Si la explicación también menciona otro artículo diferente
          if (!explNums.includes(linkedNum) && explNums.includes(mentioned)) {
            issues.push({
              q,
              art,
              issue: `Menciona Art. ${mentioned} pero vinculado a Art. ${linkedNum}`,
              mentioned,
              linked: linkedNum
            })
          }
        }
      }

      // Verificar artículos sin contenido
      if (!art.content || art.content.length < 50) {
        issues.push({
          q,
          art,
          issue: `Artículo ${art.article_number} sin contenido sustancial`
        })
      }
    }

    if (issues.length > 0) {
      console.log(`\n  ⚠️ PROBLEMAS DETECTADOS: ${issues.length}`)
      for (const iss of issues.slice(0, 10)) {
        console.log(`\n  ID: ${iss.q.id}`)
        console.log(`  Pregunta: ${iss.q.question_text.substring(0, 80)}...`)
        console.log(`  Problema: ${iss.issue}`)
        if (iss.art) {
          console.log(`  Vinculado a: Art. ${iss.art.article_number}`)
        }
      }
      if (issues.length > 10) {
        console.log(`\n  ... y ${issues.length - 10} más`)
      }
    } else {
      console.log(`  ✅ Sin problemas detectados`)
    }
  }

  // Verificar RGPD específicamente
  console.log('\n' + '═'.repeat(70))
  console.log('VERIFICACIÓN ESPECÍFICA RGPD')
  console.log('═'.repeat(70))

  const { data: rgpdLaw } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', '%RGPD%')
    .single()

  if (rgpdLaw) {
    const { data: rgpdArts } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', rgpdLaw.id)

    const rgpdArtIds = rgpdArts?.map(a => a.id) || []
    const { data: rgpdQs } = await supabase
      .from('questions')
      .select('id, question_text')
      .eq('is_active', true)
      .in('primary_article_id', rgpdArtIds)

    console.log(`\nRGPD: ${rgpdQs?.length || 0} preguntas activas`)
    console.log(`Artículos disponibles: ${rgpdArts?.length || 0}`)

    // Mostrar distribución por artículo
    const artCount = {}
    for (const art of rgpdArts || []) {
      const count = rgpdQs?.filter(q => q.primary_article_id === art.id).length || 0
      if (count > 0) artCount[art.article_number] = count
    }

    const sorted = Object.entries(artCount).sort((a, b) => b[1] - a[1])
    console.log('\nDistribución por artículo (top 10):')
    for (const [num, count] of sorted.slice(0, 10)) {
      console.log(`  Art. ${num}: ${count} preguntas`)
    }
  }
}

main().catch(console.error)
