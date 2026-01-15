#!/usr/bin/env node
/**
 * verify-eu-refined.cjs
 * Verificación refinada de preguntas EU - solo errores reales
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  console.log('VERIFICACIÓN REFINADA DE NORMATIVA EUROPEA\n')
  console.log('Solo detectamos errores cuando la pregunta menciona explícitamente')
  console.log('un artículo del TUE/TFUE y está vinculada a otro diferente.\n')
  console.log('═'.repeat(70))

  // TFUE
  const { data: tfueLaw } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', 'TFUE')
    .single()

  if (tfueLaw) {
    const { data: tfueArts } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', tfueLaw.id)

    const tfueArtIds = tfueArts?.map(a => a.id) || []
    const artMap = {}
    for (const a of tfueArts || []) artMap[a.id] = a.article_number

    const { data: tfueQs } = await supabase
      .from('questions')
      .select('id, question_text, explanation, primary_article_id')
      .eq('is_active', true)
      .in('primary_article_id', tfueArtIds)

    console.log(`\nTFUE: ${tfueQs?.length || 0} preguntas activas`)

    const issues = []
    for (const q of tfueQs || []) {
      const linkedArt = artMap[q.primary_article_id]
      const text = q.question_text.toLowerCase()

      // Solo buscar menciones explícitas al TFUE
      const tfueMatch = text.match(/art[íi]culo\s+(\d+)\s+(?:del\s+)?(?:tfue|tratado\s+de\s+funcionamiento)/i)
      if (tfueMatch) {
        const mentioned = tfueMatch[1]
        if (mentioned !== linkedArt) {
          issues.push({
            id: q.id,
            text: q.question_text.substring(0, 100),
            mentioned,
            linked: linkedArt
          })
        }
      }

      // También buscar "artículo X TFUE" o "artículo X del TFUE"
      const tfueMatch2 = text.match(/art[íi]culo\s+(\d+)\s+tfue/i)
      if (tfueMatch2) {
        const mentioned = tfueMatch2[1]
        if (mentioned !== linkedArt && !issues.find(i => i.id === q.id)) {
          issues.push({
            id: q.id,
            text: q.question_text.substring(0, 100),
            mentioned,
            linked: linkedArt
          })
        }
      }
    }

    if (issues.length > 0) {
      console.log(`\n⚠️ ERRORES REALES TFUE: ${issues.length}`)
      for (const iss of issues) {
        console.log(`\n  ID: ${iss.id}`)
        console.log(`  Pregunta: ${iss.text}...`)
        console.log(`  Menciona: Art. ${iss.mentioned} TFUE`)
        console.log(`  Vinculado a: Art. ${iss.linked}`)
      }
    } else {
      console.log(`✅ Sin errores reales en TFUE`)
    }
  }

  // TUE
  const { data: tueLaw } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', 'TUE')
    .single()

  if (tueLaw) {
    const { data: tueArts } = await supabase
      .from('articles')
      .select('id, article_number')
      .eq('law_id', tueLaw.id)

    const tueArtIds = tueArts?.map(a => a.id) || []
    const artMap = {}
    for (const a of tueArts || []) artMap[a.id] = a.article_number

    const { data: tueQs } = await supabase
      .from('questions')
      .select('id, question_text, explanation, primary_article_id')
      .eq('is_active', true)
      .in('primary_article_id', tueArtIds)

    console.log(`\n\nTUE: ${tueQs?.length || 0} preguntas activas`)

    const issues = []
    for (const q of tueQs || []) {
      const linkedArt = artMap[q.primary_article_id]
      const text = q.question_text.toLowerCase()

      // Solo buscar menciones explícitas al TUE
      const tueMatch = text.match(/art[íi]culo\s+(\d+(?:\.\d+)?)\s+(?:del\s+)?(?:tue|tratado\s+de\s+la\s+uni[oó]n\s+europea)/i)
      if (tueMatch) {
        const mentioned = tueMatch[1].split('.')[0] // Quitar decimales
        if (mentioned !== linkedArt) {
          issues.push({
            id: q.id,
            text: q.question_text.substring(0, 100),
            mentioned,
            linked: linkedArt
          })
        }
      }

      // También buscar "artículo X TUE" o "artículo X del TUE"
      const tueMatch2 = text.match(/art[íi]culo\s+(\d+(?:\.\d+)?)\s+tue/i)
      if (tueMatch2) {
        const mentioned = tueMatch2[1].split('.')[0]
        if (mentioned !== linkedArt && !issues.find(i => i.id === q.id)) {
          issues.push({
            id: q.id,
            text: q.question_text.substring(0, 100),
            mentioned,
            linked: linkedArt
          })
        }
      }
    }

    if (issues.length > 0) {
      console.log(`\n⚠️ ERRORES REALES TUE: ${issues.length}`)
      for (const iss of issues) {
        console.log(`\n  ID: ${iss.id}`)
        console.log(`  Pregunta: ${iss.text}...`)
        console.log(`  Menciona: Art. ${iss.mentioned} TUE`)
        console.log(`  Vinculado a: Art. ${iss.linked}`)
      }
    } else {
      console.log(`✅ Sin errores reales en TUE`)
    }
  }

  // RGPD
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
    const artMap = {}
    for (const a of rgpdArts || []) artMap[a.id] = a.article_number

    const { data: rgpdQs } = await supabase
      .from('questions')
      .select('id, question_text, explanation, primary_article_id')
      .eq('is_active', true)
      .in('primary_article_id', rgpdArtIds)

    console.log(`\n\nRGPD: ${rgpdQs?.length || 0} preguntas activas`)

    const issues = []
    for (const q of rgpdQs || []) {
      const linkedArt = artMap[q.primary_article_id]
      const text = q.question_text.toLowerCase()

      // Solo buscar menciones explícitas al RGPD
      const rgpdMatch = text.match(/art[íi]culo\s+(\d+)\s+(?:del\s+)?rgpd/i)
      if (rgpdMatch) {
        const mentioned = rgpdMatch[1]
        if (mentioned !== linkedArt) {
          issues.push({
            id: q.id,
            text: q.question_text.substring(0, 100),
            mentioned,
            linked: linkedArt
          })
        }
      }
    }

    if (issues.length > 0) {
      console.log(`\n⚠️ ERRORES REALES RGPD: ${issues.length}`)
      for (const iss of issues) {
        console.log(`\n  ID: ${iss.id}`)
        console.log(`  Pregunta: ${iss.text}...`)
        console.log(`  Menciona: Art. ${iss.mentioned} RGPD`)
        console.log(`  Vinculado a: Art. ${iss.linked}`)
      }
    } else {
      console.log(`✅ Sin errores reales en RGPD`)
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('Verificación completada')
}

main().catch(console.error)
