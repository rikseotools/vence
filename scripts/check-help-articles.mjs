// scripts/check-help-articles.mjs
// Se ejecuta durante el build de Vercel para marcar artículos de ayuda afectados por cambios.
// Uso: node scripts/check-help-articles.mjs

import { execSync } from 'child_process'
import pg from 'pg'

const { Pool } = pg

async function main() {
  const prevSha = process.env.VERCEL_GIT_PREVIOUS_SHA
  const currentSha = process.env.VERCEL_GIT_COMMIT_SHA || 'HEAD'

  if (!prevSha) {
    console.log('⏭️ [help-articles] Sin VERCEL_GIT_PREVIOUS_SHA, saltando check')
    return
  }

  if (!process.env.DATABASE_URL) {
    console.log('⏭️ [help-articles] Sin DATABASE_URL, saltando check')
    return
  }

  // 1. Obtener archivos cambiados
  let changedFiles
  try {
    changedFiles = execSync(`git diff --name-only ${prevSha}..${currentSha}`, { encoding: 'utf-8' })
      .split('\n')
      .filter(f => f.trim())
  } catch {
    console.log('⚠️ [help-articles] No se pudo ejecutar git diff')
    return
  }

  if (changedFiles.length === 0) {
    console.log('✅ [help-articles] Sin cambios')
    return
  }

  console.log(`📝 [help-articles] ${changedFiles.length} archivos cambiados`)

  // 2. Obtener artículos con sus paths
  const pool = new Pool({ connectionString: process.env.DATABASE_URL })

  try {
    const { rows: articles } = await pool.query(
      'SELECT id, slug, title, related_paths FROM help_articles WHERE is_published = true AND related_paths IS NOT NULL'
    )

    // 3. Para cada artículo, verificar si algún archivo cambiado matchea sus paths
    let marked = 0
    for (const article of articles) {
      const paths = article.related_paths || []
      if (paths.length === 0) continue

      // Convertir globs a regex simples
      const matchers = paths.map(p => {
        const regex = p
          .replace(/\*\*/g, '@@DOUBLESTAR@@')
          .replace(/\*/g, '[^/]*')
          .replace(/@@DOUBLESTAR@@/g, '.*')
        return new RegExp('^' + regex)
      })

      const affectedFiles = changedFiles.filter(f => matchers.some(m => m.test(f)))

      if (affectedFiles.length > 0) {
        const reason = `Deploy ${currentSha.substring(0, 8)} cambió: ${affectedFiles.slice(0, 3).join(', ')}${affectedFiles.length > 3 ? ` (+${affectedFiles.length - 3} más)` : ''}`

        await pool.query(
          'UPDATE help_articles SET needs_review = true, review_reason = $1 WHERE id = $2',
          [reason, article.id]
        )

        console.log(`⚠️ [help-articles] "${article.title}" → ${affectedFiles.length} archivos afectados`)
        marked++
      }
    }

    if (marked > 0) {
      console.log(`📋 [help-articles] ${marked} artículos marcados para revisión`)
    } else {
      console.log('✅ [help-articles] Ningún artículo afectado')
    }
  } finally {
    await pool.end()
  }
}

main().catch(err => {
  console.error('❌ [help-articles] Error:', err.message)
  // No fallar el build por esto
  process.exit(0)
})
