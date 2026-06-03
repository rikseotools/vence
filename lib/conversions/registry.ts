// lib/conversions/registry.ts
//
// Registro de destinos de conversión. Añadir una plataforma = añadir su
// adapter aquí (sin tocar recordConversion ni el worker).

import type { ConversionDestination } from './types'
import { googleAdsDestination } from '@/lib/services/googleAds'
import { ga4Destination } from '@/lib/services/ga4/conversions'

export function getDestinations(): ConversionDestination[] {
  // ga4 solo acepta ventas con client_id y si GA4_UPLOAD_ENABLED=true (ver
  // supports()), así que añadirlo aquí es seguro: no encola nada hasta activarlo.
  return [googleAdsDestination, ga4Destination]
  // Futuro: metaCapiDestination, tiktokDestination…
}

export function getDestinationByName(name: string): ConversionDestination | undefined {
  return getDestinations().find((d) => d.name === name)
}
