#!/usr/bin/env node
/**
 * fix-eu-articles.cjs
 * Corrige los errores de vinculación de artículos en TUE/TFUE
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Errores TFUE detectados
const tfueErrors = [
  { id: 'fec72e6e-5de2-475c-acd0-5c88f4e88b2e', mentioned: '3', linked: '2' },
  { id: '32be3377-2373-4e9d-96ca-d3a05550778b', mentioned: '273', linked: '272' },
  { id: 'a85ee151-c9fe-4968-b712-3315f4879944', mentioned: '285', linked: '286' },
  { id: 'b1c7301a-f519-4077-ad28-4c12157f74c6', mentioned: '302', linked: '301' },
  { id: 'bf031581-1e04-4f1f-b26f-7e90e8a0e8ea', mentioned: '247', linked: '245' },
  { id: '2017734e-3838-4c49-ab58-53959d12a7b6', mentioned: '4', linked: '2' },
  { id: '3fa4bc19-5dc3-46e4-86a4-d4c385ae5fcc', mentioned: '285', linked: '287' },
  { id: '0ed68922-001d-49e4-b30f-057ad118b3c8', mentioned: '234', linked: '244' },
  { id: '4b3fa73a-b080-4b0a-a6db-c5dd0af35b8d', mentioned: '303', linked: '301' },
  { id: '482aea24-a9fa-4c0a-a6d7-669a64625ea7', mentioned: '257', linked: '253' },
  { id: 'a1cc99a6-7e24-42cd-ad58-b04ce115229a', mentioned: '260', linked: '259' },
  { id: '2f9d1453-1d52-494d-9d00-4be870f037d4', mentioned: '234', linked: '244' },
  { id: '6f33d495-59b1-483b-ab7c-6480c7a3312a', mentioned: '306', linked: '305' },
  { id: '50f186e2-eac1-4df2-a283-3a7623897d5e', mentioned: '304', linked: '301' },
  { id: '4655f4a4-f12c-4c19-87df-f71af56a1126', mentioned: '304', linked: '301' },
  { id: 'e662a803-a5b6-4da6-aced-8013ecb9ae67', mentioned: '307', linked: '305' },
  { id: '7931cb21-9112-4ce9-8819-d69cfdb0a646', mentioned: '307', linked: '305' },
  { id: '5c5a3532-8d8d-4ecb-8147-0ee1bcf47478', mentioned: '4', linked: '3' },
  { id: '70f52e1d-b55c-4195-9d99-e5b44617bfec', mentioned: '288', linked: '290' }
]

// Errores TUE detectados
const tueErrors = [
  { id: 'fecef996-6544-4f16-aca4-4cc00e6cde1f', mentioned: '2', linked: '13' },
  { id: '2443fa13-822e-4589-a1b9-b5fe3ff3d319', mentioned: '5', linked: '13' },
  { id: '223932e6-4bf2-47e8-9b59-169d7bd4c1c5', mentioned: '4', linked: '13' },
  { id: '71a4105d-9834-4eba-a3c6-f36cb9c2b86a', mentioned: '27', linked: '18' },
  { id: '93b0f9a6-9316-4900-be04-ca08eff279ac', mentioned: '4', linked: '13' },
  { id: '0ac91939-905d-4822-9d3a-35730b2d728b', mentioned: '5', linked: '3' },
  { id: 'd8ab566f-4bc6-43e7-a218-391610ae56b0', mentioned: '1', linked: '13' },
  { id: 'e8c41a31-3949-408b-987d-1c30d4a5d2f5', mentioned: '5', linked: '13' }
]

async function main() {
  // Obtener IDs de leyes
  const { data: tfueLaw } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', 'TFUE')
    .single()

  const { data: tueLaw } = await supabase
    .from('laws')
    .select('id')
    .ilike('short_name', 'TUE')
    .single()

  // Obtener todos los artículos de TFUE
  const { data: tfueArts } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', tfueLaw.id)

  // Obtener todos los artículos de TUE
  const { data: tueArts } = await supabase
    .from('articles')
    .select('id, article_number')
    .eq('law_id', tueLaw.id)

  // Crear mapas
  const tfueArtMap = {}
  for (const a of tfueArts || []) tfueArtMap[a.article_number] = a.id

  const tueArtMap = {}
  for (const a of tueArts || []) tueArtMap[a.article_number] = a.id

  console.log('TFUE artículos disponibles:', Object.keys(tfueArtMap).sort((a,b) => parseInt(a) - parseInt(b)).join(', '))
  console.log('\nTUE artículos disponibles:', Object.keys(tueArtMap).sort((a,b) => parseInt(a) - parseInt(b)).join(', '))

  // Verificar qué artículos faltan en TFUE
  console.log('\n\n═══════════════════════════════════════════════════════════')
  console.log('CORRECCIONES TFUE')
  console.log('═══════════════════════════════════════════════════════════\n')

  let tfueFixed = 0
  let tfueMissing = 0

  for (const err of tfueErrors) {
    const targetArtId = tfueArtMap[err.mentioned]
    if (targetArtId) {
      // El artículo existe, podemos corregir
      const { error } = await supabase
        .from('questions')
        .update({ primary_article_id: targetArtId })
        .eq('id', err.id)

      if (error) {
        console.log(`❌ Error corrigiendo ${err.id}:`, error.message)
      } else {
        console.log(`✅ Corregido: Art. ${err.linked} → Art. ${err.mentioned}`)
        tfueFixed++
      }
    } else {
      console.log(`⚠️ Art. ${err.mentioned} NO existe en TFUE (pregunta ${err.id})`)
      tfueMissing++
    }
  }

  console.log(`\nTFUE: ${tfueFixed} corregidos, ${tfueMissing} sin artículo destino`)

  // Verificar qué artículos faltan en TUE
  console.log('\n\n═══════════════════════════════════════════════════════════')
  console.log('CORRECCIONES TUE')
  console.log('═══════════════════════════════════════════════════════════\n')

  let tueFixed = 0
  let tueMissing = 0

  for (const err of tueErrors) {
    const targetArtId = tueArtMap[err.mentioned]
    if (targetArtId) {
      // El artículo existe, podemos corregir
      const { error } = await supabase
        .from('questions')
        .update({ primary_article_id: targetArtId })
        .eq('id', err.id)

      if (error) {
        console.log(`❌ Error corrigiendo ${err.id}:`, error.message)
      } else {
        console.log(`✅ Corregido: Art. ${err.linked} → Art. ${err.mentioned}`)
        tueFixed++
      }
    } else {
      console.log(`⚠️ Art. ${err.mentioned} NO existe en TUE (pregunta ${err.id})`)
      tueMissing++
    }
  }

  console.log(`\nTUE: ${tueFixed} corregidos, ${tueMissing} sin artículo destino`)

  console.log('\n═══════════════════════════════════════════════════════════')
  console.log(`RESUMEN: ${tfueFixed + tueFixed} preguntas corregidas`)
  console.log('═══════════════════════════════════════════════════════════')
}

main().catch(console.error)
