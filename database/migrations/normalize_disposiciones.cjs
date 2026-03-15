/**
 * Migration: Normalize disposiciones article_numbers to canonical format
 *
 * Canonical formats:
 *   DA{n}  - Disposiciones Adicionales (DA1, DA2, DA14, DAunica)
 *   DT{n}  - Disposiciones Transitorias (DT1, DT2, DT9)
 *   DD{n}  - Disposiciones Derogatorias (DD, DDunica)
 *   DF{n}  - Disposiciones Finales (DF1, DF2, DF4, DFunica)
 *
 * Usage: node database/migrations/normalize_disposiciones.cjs
 *
 * WARNING: This script modifies data. Review the dry-run output first by
 * setting DRY_RUN=true below.
 */

const DRY_RUN = false // Set to true to preview changes without applying them

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

// =============================================================
// Ordinal mapping (feminine Spanish ordinals to numbers)
// =============================================================
const feminineToNumber = {
  'primera': '1', 'segunda': '2', 'tercera': '3', 'cuarta': '4',
  'quinta': '5', 'sexta': '6', 'séptima': '7', 'septima': '7',
  'octava': '8', 'novena': '9', 'décima': '10', 'decima': '10',
  'undécima': '11', 'undecima': '11', 'duodécima': '12', 'duodecima': '12',
  'decimotercera': '13', 'decimocuarta': '14', 'decimoquinta': '15',
  'decimosexta': '16', 'decimoséptima': '17', 'decimoseptima': '17',
  'decimoctava': '18', 'decimooctava': '18', 'décimo_octava': '18', 'decimo_octava': '18', 'decimonovena': '19', 'décimo_novena': '19',
  'vigésima': '20', 'vigesima': '20', 'vigésima_primera': '21',
  'vigesimoprimera': '21', 'vigésima_segunda': '22', 'vigesimosegunda': '22',
  'vigésima_tercera': '23', 'vigesimotercera': '23',
  'única': 'unica', 'unica': 'unica'
}

// Disposition type mapping (Spanish name to canonical code)
const dispTypeToCode = {
  'adicional': 'DA',
  'transitoria': 'DT',
  'derogatoria': 'DD',
  'final': 'DF'
}

/**
 * Convert any disposicion article_number to canonical format.
 * Returns null if the input is not a disposicion or already canonical.
 */
function toCanonical(articleNumber) {
  if (!articleNumber) return null
  const trimmed = articleNumber.trim()

  // Format: DA_adicional_primera, DA_transitoria_novena, DA_final_cuarta, DA_derogatoria_unica
  const legacyMatch = trimmed.match(/^DA_(adicional|transitoria|derogatoria|final)_([\w\u00e0-\u00ff]+)$/i)
  if (legacyMatch) {
    const typeCode = dispTypeToCode[legacyMatch[1].toLowerCase()] || 'DA'
    const ordinal = legacyMatch[2].toLowerCase()
    const ordinalNum = feminineToNumber[ordinal] || ordinal
    return `${typeCode}${ordinalNum}`
  }

  // Format: DT_transitoria_primera (other prefixes besides DA_)
  const otherPrefixMatch = trimmed.match(/^(DA|DT|DD|DF)_(adicional|transitoria|derogatoria|final)_([\w\u00e0-\u00ff]+)$/i)
  if (otherPrefixMatch) {
    const typeCode = dispTypeToCode[otherPrefixMatch[2].toLowerCase()] || otherPrefixMatch[1].toUpperCase()
    const ordinal = otherPrefixMatch[3].toLowerCase()
    const ordinalNum = feminineToNumber[ordinal] || ordinal
    return `${typeCode}${ordinalNum}`
  }

  // Format: DAdecimocuarta, DAprimera, DAunica, etc. (prefix + feminine ordinal glued)
  const compactMatch = trimmed.match(/^(DA|DT|DD|DF)([a-z\u00e0-\u00ff]+)$/i)
  if (compactMatch) {
    const prefix = compactMatch[1].toUpperCase()
    const ordinal = compactMatch[2].toLowerCase()
    if (feminineToNumber[ordinal] !== undefined) {
      return `${prefix}${feminineToNumber[ordinal]}`
    }
    // Unknown ordinal text - leave as is but uppercase prefix
    return `${prefix}${ordinal}`
  }

  // Format: da9, DA9, dt3, DT3, etc. (lowercase/mixed case with number)
  const lowerNumMatch = trimmed.match(/^(da|dt|dd|df)(\d+|unica)$/i)
  if (lowerNumMatch) {
    const prefix = lowerNumMatch[1].toUpperCase()
    const num = lowerNumMatch[2].toLowerCase() === 'unica' ? 'unica' : lowerNumMatch[2]
    const canonical = `${prefix}${num}`
    // Only return if different from input (needs normalization)
    if (canonical !== trimmed) return canonical
    return null // Already canonical
  }

  // Format: DD or DF alone (single disposicion without number)
  if (/^(DD|DF)$/i.test(trimmed)) {
    const canonical = trimmed.toUpperCase()
    if (canonical !== trimmed) return canonical
    return null
  }

  return null // Not a disposicion or already canonical
}

/**
 * Check if the article_number looks like a disposicion in any format
 */
function isDisposicion(articleNumber) {
  if (!articleNumber) return false
  return /^(DA|DT|DD|DF)/i.test(articleNumber.trim()) ||
         /^DA_(adicional|transitoria|derogatoria|final)_/i.test(articleNumber.trim())
}

async function main() {
  console.log('='.repeat(70))
  console.log('  MIGRATION: Normalize disposiciones article_numbers')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE (will modify data)'}`)
  console.log('='.repeat(70))
  console.log()

  // =============================================
  // PHASE 1: Normalize articles table
  // =============================================
  console.log('--- PHASE 1: Normalize articles.article_number ---')
  console.log()

  // Fetch all articles that might be disposiciones
  // We fetch broadly and filter in JS because Supabase doesn't support regex well
  const { data: allArticles, error: artError } = await supabase
    .from('articles')
    .select('id, article_number, law_id, content, is_active')
    .order('law_id')

  if (artError) {
    console.error('Error fetching articles:', artError)
    process.exit(1)
  }

  // Filter to only disposiciones
  const dispArticles = allArticles.filter(a => isDisposicion(a.article_number))
  console.log(`Found ${dispArticles.length} disposicion articles out of ${allArticles.length} total`)
  console.log()

  // Group by law_id for conflict detection
  const byLaw = {}
  for (const art of dispArticles) {
    if (!byLaw[art.law_id]) byLaw[art.law_id] = []
    byLaw[art.law_id].push(art)
  }

  let updatedCount = 0
  let skippedCount = 0
  let conflictCount = 0
  let deletedCount = 0

  for (const [lawId, articles] of Object.entries(byLaw)) {
    // Build a map: canonical -> list of articles that map to it
    const canonicalMap = {} // canonical -> [{ article, canonical }]

    for (const art of articles) {
      const canonical = toCanonical(art.article_number)
      if (!canonical) {
        // Already canonical
        skippedCount++
        continue
      }

      if (!canonicalMap[canonical]) canonicalMap[canonical] = []
      canonicalMap[canonical].push(art)
    }

    // Also check for existing articles that already have the canonical number
    // (to detect conflicts with articles not in our disposicion list)
    const allLawArticles = allArticles.filter(a => a.law_id === lawId)
    const existingCanonicals = new Set(
      allLawArticles
        .filter(a => !isDisposicion(a.article_number) || toCanonical(a.article_number) === null)
        .map(a => a.article_number)
    )

    for (const [canonical, arts] of Object.entries(canonicalMap)) {
      // Check if there's already an article with this canonical number in the same law
      const existingWithCanonical = allLawArticles.find(
        a => a.article_number === canonical && !arts.some(x => x.id === a.id)
      )

      if (existingWithCanonical) {
        // Conflict: another article already has this canonical number
        // Keep the one with more content
        const allCandidates = [...arts, existingWithCanonical]
        allCandidates.sort((a, b) => (b.content || '').length - (a.content || '').length)
        const keeper = allCandidates[0]
        const toDelete = allCandidates.slice(1)

        console.log(`  CONFLICT in law ${lawId}: ${arts.map(a => a.article_number).join(', ')} + existing "${canonical}"`)
        console.log(`    Keeping: id=${keeper.id} (${(keeper.content || '').length} chars)`)

        for (const del of toDelete) {
          if (del.id === keeper.id) continue
          console.log(`    Deleting: id=${del.id} article_number="${del.article_number}" (${(del.content || '').length} chars)`)
          if (!DRY_RUN) {
            // First deactivate associated questions
            const { error: qErr } = await supabase
              .from('questions')
              .update({ is_active: false })
              .eq('primary_article_id', del.id)
            if (qErr) console.error(`      Error deactivating questions for ${del.id}:`, qErr)

            const { error: delErr } = await supabase
              .from('articles')
              .delete()
              .eq('id', del.id)
            if (delErr) console.error(`      Error deleting article ${del.id}:`, delErr)
          }
          deletedCount++
        }

        // Update keeper to canonical if needed
        if (keeper.article_number !== canonical) {
          console.log(`    Updating keeper: "${keeper.article_number}" -> "${canonical}"`)
          if (!DRY_RUN) {
            const { error: upErr } = await supabase
              .from('articles')
              .update({ article_number: canonical })
              .eq('id', keeper.id)
            if (upErr) console.error(`      Error updating article ${keeper.id}:`, upErr)
          }
          updatedCount++
        }
        conflictCount++
        continue
      }

      // No conflict - check if multiple articles map to same canonical
      if (arts.length > 1) {
        // Multiple articles mapping to same canonical - keep longest content
        arts.sort((a, b) => (b.content || '').length - (a.content || '').length)
        const keeper = arts[0]
        const toDelete = arts.slice(1)

        console.log(`  DUPLICATE in law ${lawId}: ${arts.map(a => `"${a.article_number}"`).join(', ')} -> "${canonical}"`)
        console.log(`    Keeping: id=${keeper.id} (${(keeper.content || '').length} chars)`)

        for (const del of toDelete) {
          console.log(`    Deleting: id=${del.id} article_number="${del.article_number}" (${(del.content || '').length} chars)`)
          if (!DRY_RUN) {
            const { error: qErr } = await supabase
              .from('questions')
              .update({ is_active: false })
              .eq('primary_article_id', del.id)
            if (qErr) console.error(`      Error deactivating questions for ${del.id}:`, qErr)

            const { error: delErr } = await supabase
              .from('articles')
              .delete()
              .eq('id', del.id)
            if (delErr) console.error(`      Error deleting article ${del.id}:`, delErr)
          }
          deletedCount++
        }

        // Update keeper
        console.log(`    Updating: "${keeper.article_number}" -> "${canonical}"`)
        if (!DRY_RUN) {
          const { error: upErr } = await supabase
            .from('articles')
            .update({ article_number: canonical })
            .eq('id', keeper.id)
          if (upErr) console.error(`      Error updating article ${keeper.id}:`, upErr)
        }
        updatedCount++
        conflictCount++
        continue
      }

      // Simple rename - no conflict
      const art = arts[0]
      console.log(`  RENAME in law ${lawId}: "${art.article_number}" -> "${canonical}"`)
      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('articles')
          .update({ article_number: canonical })
          .eq('id', art.id)
        if (upErr) console.error(`    Error updating article ${art.id}:`, upErr)
      }
      updatedCount++
    }
  }

  console.log()
  console.log(`Phase 1 summary:`)
  console.log(`  Updated: ${updatedCount}`)
  console.log(`  Skipped (already canonical): ${skippedCount}`)
  console.log(`  Conflicts resolved: ${conflictCount}`)
  console.log(`  Deleted (duplicates): ${deletedCount}`)
  console.log()

  // =============================================
  // PHASE 2: Normalize topic_scope article_numbers arrays
  // =============================================
  console.log('--- PHASE 2: Normalize topic_scope.article_numbers ---')
  console.log()

  const { data: scopes, error: scopeError } = await supabase
    .from('topic_scope')
    .select('id, topic_id, law_id, article_numbers')

  if (scopeError) {
    console.error('Error fetching topic_scope:', scopeError)
    process.exit(1)
  }

  let scopeUpdated = 0
  let scopeSkipped = 0

  for (const scope of scopes) {
    if (!scope.article_numbers || !Array.isArray(scope.article_numbers)) {
      scopeSkipped++
      continue
    }

    let changed = false
    const normalizedNumbers = scope.article_numbers.map(artNum => {
      if (!isDisposicion(artNum)) return artNum

      const canonical = toCanonical(artNum)
      if (canonical && canonical !== artNum) {
        changed = true
        return canonical
      }
      return artNum
    })

    // Deduplicate after normalization
    const dedupedNumbers = [...new Set(normalizedNumbers)]
    if (dedupedNumbers.length !== normalizedNumbers.length) {
      changed = true
    }

    if (!changed) {
      scopeSkipped++
      continue
    }

    console.log(`  topic_scope id=${scope.id} (topic=${scope.topic_id}, law=${scope.law_id}):`)
    console.log(`    Before: [${scope.article_numbers.filter(a => isDisposicion(a)).join(', ')}]`)
    console.log(`    After:  [${dedupedNumbers.filter(a => isDisposicion(a)).join(', ')}]`)

    if (!DRY_RUN) {
      const { error: upErr } = await supabase
        .from('topic_scope')
        .update({ article_numbers: dedupedNumbers })
        .eq('id', scope.id)
      if (upErr) console.error(`    Error updating topic_scope ${scope.id}:`, upErr)
    }
    scopeUpdated++
  }

  console.log()
  console.log(`Phase 2 summary:`)
  console.log(`  Updated: ${scopeUpdated}`)
  console.log(`  Skipped (no changes needed): ${scopeSkipped}`)
  console.log()

  // =============================================
  // SUMMARY
  // =============================================
  console.log('='.repeat(70))
  console.log('  MIGRATION COMPLETE')
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no changes applied)' : 'LIVE'}`)
  console.log(`  Articles updated: ${updatedCount}`)
  console.log(`  Articles deleted (duplicates): ${deletedCount}`)
  console.log(`  Conflicts resolved: ${conflictCount}`)
  console.log(`  Topic scopes updated: ${scopeUpdated}`)
  console.log('='.repeat(70))
}

main().catch(err => {
  console.error('Migration failed:', err)
  process.exit(1)
})
