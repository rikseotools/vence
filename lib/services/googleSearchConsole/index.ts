// lib/services/googleSearchConsole/index.ts — API pública de Search Console.
export { querySearchAnalytics, type GscRow, type SearchAnalyticsOpts } from './client'
export {
  getOrganicByOposicion,
  getTopQueriesForSlug,
  type OrganicStats,
  type OrganicQuery,
} from './reports'
