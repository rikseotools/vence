// lib/services/googleSearchConsole/index.ts — API pública de Search Console.
export { querySearchAnalytics, type GscRow, type SearchAnalyticsOpts } from './client'
export {
  getOrganicByOposicion,
  getTopQueriesForSlug,
  getSeoOpportunities,
  type OrganicStats,
  type OrganicQuery,
  type SeoOpportunity,
} from './reports'
