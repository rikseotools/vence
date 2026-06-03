// lib/conversions/registry.ts
//
// Registro de destinos de conversión. Añadir una plataforma = añadir su
// adapter aquí (sin tocar recordConversion ni el worker).

import type { ConversionDestination } from './types'
import { googleAdsDestination } from '@/lib/services/googleAds'

export function getDestinations(): ConversionDestination[] {
  return [googleAdsDestination]
  // Futuro: metaCapiDestination, ga4Destination, tiktokDestination…
}

export function getDestinationByName(name: string): ConversionDestination | undefined {
  return getDestinations().find((d) => d.name === name)
}
