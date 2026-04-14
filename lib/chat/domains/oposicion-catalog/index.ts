// lib/chat/domains/oposicion-catalog/index.ts
export { OposicionCatalogDomain, getOposicionCatalogDomain } from './OposicionCatalogDomain'
export {
  detectOposicionIntent,
  isCatalogFollowUp,
  processOposicionCatalog,
  extractDetectedName,
} from './OposicionCatalogService'
export {
  loadOposicionesCache,
  matchOposicion,
  registerOposicionRequest,
  type OposicionEntry,
} from './queries'
