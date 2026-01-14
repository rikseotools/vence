// lib/chat/domains/stats/index.ts
// Exports públicos del dominio Stats

// Dominio principal
export { StatsDomain, getStatsDomain } from './StatsDomain'

// Servicio
export {
  searchStats,
  detectStatsQueryType,
  isExamStatsQuery,
  isUserStatsQuery,
  parseTemporalPhrase,
  extractLawFromMessage,
  formatExamStatsResponse,
  formatUserStatsResponse,
  type StatsSearchResult,
} from './StatsService'

// Queries
export { getExamStats, getUserStats } from './queries'

// Schemas
export * from './schemas'
