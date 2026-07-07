// lib/api/radar-contenido/queries.ts
//
// Queries del panel "Radar Contenido" (/admin/radar-contenido). Lee la tabla
// content_radar_posts (top posts de competidores en Instagram por engagement,
// poblada por Business Discovery). SQL crudo vía getDb().execute (mismo patrón
// que competitors/queries.ts). Runbook: docs/runbooks/radar-contenido-social.md

import { getDb } from '@/db/client'
import { sql } from 'drizzle-orm'

function rows<T>(res: unknown): T[] {
  return res as unknown as T[]
}

export interface RadarPost {
  id: string
  permalink: string
  competitor_name: string
  handle: string
  followers_count: number | null
  caption: string | null
  media_type: string | null
  like_count: number
  comments_count: number
  engagement: number
  engagement_rate: number | null
  posted_at: string | null
  rank_kind: string | null
  seen: boolean
  fetched_at: string | null
}

export interface RadarContenidoData {
  success: true
  posts: RadarPost[]
  fetchedAt: string | null
  unseen: number
}

/** Lista para el panel: top posts por engagement (los que más funcionan). */
export async function getRadarContenido(): Promise<RadarContenidoData> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT id, permalink, competitor_name, handle, followers_count, caption,
           media_type, like_count, comments_count, engagement, engagement_rate,
           posted_at, rank_kind, seen, fetched_at
    FROM content_radar_posts
    ORDER BY engagement DESC
    LIMIT 60
  `)
  const posts = rows<RadarPost>(res)
  return {
    success: true,
    posts,
    fetchedAt: posts[0]?.fetched_at ?? null,
    unseen: posts.filter((p) => !p.seen).length,
  }
}

export interface RadarContenidoCount {
  success: true
  count: number
}

/** Contador del badge: recomendaciones nuevas sin ver (seen=false). */
export async function getRadarContenidoCount(): Promise<RadarContenidoCount> {
  const db = getDb()
  const res = await db.execute(sql`
    SELECT count(*)::int AS count FROM content_radar_posts WHERE seen = false
  `)
  return { success: true, count: Number(rows<{ count: number }>(res)[0]?.count ?? 0) }
}

/** Marca todas como vistas (al abrir el panel) → el badge baja a 0. */
export async function markRadarSeen(): Promise<{ success: true; updated: number }> {
  const db = getDb()
  const res = await db.execute(sql`
    UPDATE content_radar_posts SET seen = true WHERE seen = false RETURNING id
  `)
  return { success: true, updated: rows<{ id: string }>(res).length }
}
