// lib/services/googleAds/index.ts
//
// API pública de la integración con Google Ads. Importa siempre desde aquí:
//   import { getCampaignPerformance } from '@/lib/services/googleAds'

export { loadAdsConfig, normalizeCustomerId, type GoogleAdsConfig } from './config'
export { getGoogleAdsCustomer, resetGoogleAdsCustomer } from './client'
export { GoogleAdsError, normalizeGoogleAdsError, type GoogleAdsErrorDetail } from './errors'
export {
  getCampaignPerformance,
  type CampaignPerformance,
  type DateRange,
} from './reports'
export {
  setCampaignStatus,
  pauseCampaign,
  enableCampaign,
  setCampaignDailyBudget,
  type MutationResult,
} from './mutations'
