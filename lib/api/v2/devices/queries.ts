// lib/api/v2/devices/queries.ts
// Queries Drizzle para gestión de dispositivos del usuario

// CANARY pooler (sweep masivo oleada 5 — todos user-facing 2026-05-10):
import { getDb, getPoolerDb } from '@/db/client'

function getDevicesDb() {
  return process.env.USE_SELF_HOSTED_POOLER === 'true' ? getPoolerDb() : getDb()
}
import { userDevices } from '@/db/schema'
import { eq, and, desc } from 'drizzle-orm'
import type { Device } from './schemas'

/**
 * Lista los dispositivos del usuario autenticado.
 * Ordenados por última conexión (más reciente primero).
 */
export async function listUserDevices(userId: string): Promise<Device[]> {
  const db = getDevicesDb()
  const rows = await db
    .select({
      id: userDevices.id,
      deviceLabel: userDevices.deviceLabel,
      lastSeenAt: userDevices.lastSeenAt,
    })
    .from(userDevices)
    .where(eq(userDevices.userId, userId))
    .orderBy(desc(userDevices.lastSeenAt))

  return rows.map((row) => ({
    id: row.id,
    deviceLabel: row.deviceLabel,
    lastSeenAt: row.lastSeenAt ?? '',
  }))
}

/**
 * Elimina un dispositivo del usuario autenticado.
 * Solo elimina si el dispositivo pertenece al userId (seguridad).
 * Devuelve true si se eliminó, false si no existía o no era suyo.
 */
export async function removeUserDevice(
  userId: string,
  deviceId: string,
): Promise<boolean> {
  const db = getDevicesDb()
  const result = await db
    .delete(userDevices)
    .where(and(eq(userDevices.id, deviceId), eq(userDevices.userId, userId)))
    .returning({ id: userDevices.id })

  return result.length > 0
}
