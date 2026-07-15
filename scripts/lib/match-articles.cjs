// scripts/lib/match-articles.cjs
// Helper agnóstico (RDS) para la búsqueda semántica pgvector `match_articles`.
// Sustituye a `supabase.rpc('match_articles', ...)` (el shim pg-agnostic NO cubre .rpc).
// Fuente de verdad: RDS (DATABASE_URL). La función SQL match_articles(vector, float, int)
// existe en RDS. Conecta con postgres.js (misma lib que usa el shim).

const postgres = require('postgres')

let _sql
function sql() {
  if (!_sql) {
    const url = (process.env.DATABASE_URL || '').replace(/\?.*$/, '')
    if (!url) throw new Error('[match-articles] DATABASE_URL no configurada (agnóstico: RDS, NO Supabase)')
    _sql = postgres(url, { ssl: 'require', max: 2 })
  }
  return _sql
}

/**
 * Devuelve los artículos semánticamente más cercanos al embedding.
 * @param {number[]} embedding  vector de la query
 * @param {number} matchThreshold  umbral de similitud (default 0.2)
 * @param {number} matchCount  nº máximo de resultados (default 10)
 * @returns {Promise<Array>} filas de match_articles
 */
async function matchArticles(embedding, matchThreshold = 0.2, matchCount = 10) {
  const vec = '[' + embedding.join(',') + ']'
  return await sql()`SELECT * FROM match_articles(${vec}::vector, ${matchThreshold}, ${matchCount})`
}

module.exports = { matchArticles }
