#!/usr/bin/env node
/**
 * check-eu-structure.cjs
 * Verifica estructura actual de TUE/TFUE en BD
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function main() {
  // Obtener leyes EU
  const { data: laws } = await supabase
    .from('laws')
    .select('id, short_name, name, boe_url, official_url')
    .or('short_name.ilike.%TUE%,short_name.ilike.%TFUE%')

  console.log('LEYES EU EN LA BD:\n')
  for (const law of laws || []) {
    console.log('═'.repeat(60))
    console.log('ID:', law.id)
    console.log('Short name:', law.short_name)
    console.log('Name:', law.name)
    console.log('BOE URL:', law.boe_url || 'No tiene')
    console.log('Official URL:', law.official_url || 'No tiene')

    const { data: arts } = await supabase
      .from('articles')
      .select('id, article_number, title, content')
      .eq('law_id', law.id)
      .order('article_number')

    console.log('\nArtículos:', arts?.length || 0)
    console.log('Números:', arts?.map(a => a.article_number).join(', '))

    // Mostrar ejemplo de un artículo
    if (arts && arts.length > 0) {
      const sample = arts[0]
      console.log('\nEjemplo de artículo:')
      console.log('  Number:', sample.article_number)
      console.log('  Title:', sample.title || 'Sin título')
      console.log('  Content:', (sample.content || 'Sin contenido').substring(0, 200) + '...')
    }
    console.log('')
  }
}

main().catch(console.error)
