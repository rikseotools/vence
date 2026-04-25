// lib/api/v2/devices/schemas.ts
// Zod schemas para la API de gestión de dispositivos

import { z } from 'zod/v3'

// ============================================
// RESPONSE: lista de dispositivos
// ============================================

export const deviceSchema = z.object({
  id: z.string().uuid(),
  deviceLabel: z.string().nullable(),
  lastSeenAt: z.string(),
})

export type Device = z.infer<typeof deviceSchema>

export const listDevicesResponseSchema = z.object({
  success: z.literal(true),
  devices: z.array(deviceSchema),
})

export type ListDevicesResponse = z.infer<typeof listDevicesResponseSchema>

// ============================================
// REQUEST: eliminar un dispositivo
// ============================================

export const removeDeviceRequestSchema = z.object({
  deviceId: z.string().uuid('ID de dispositivo inválido'),
})

export type RemoveDeviceRequest = z.infer<typeof removeDeviceRequestSchema>

export const removeDeviceResponseSchema = z.object({
  success: z.boolean(),
  removed: z.boolean(),
})

export type RemoveDeviceResponse = z.infer<typeof removeDeviceResponseSchema>
