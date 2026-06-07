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
  setCampaignFinalUrlSuffix,
  setCampaignDailyBudget,
  setCampaignCpcCeiling,
  type MutationResult,
} from './mutations'
export {
  getCustomerInfo,
  applyTrackingSuffixToAllCampaigns,
  RECOMMENDED_FINAL_URL_SUFFIX,
  type CustomerInfo,
  type TrackingApplyResult,
} from './account'
export { getCampaignRoi, type CampaignRoi } from './roi'
export {
  uploadPurchaseConversion,
  hashEmail,
  googleAdsDestination,
  type PurchaseConversionInput,
} from './conversions'
