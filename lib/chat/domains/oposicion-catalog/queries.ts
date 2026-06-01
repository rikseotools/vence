// lib/chat/domains/oposicion-catalog/queries.ts
// Cache de oposiciones + registro de solicitudes de oposiciones no disponibles

import { getReadDb, getAdminDb } from '@/db/client'
import { oposiciones, userFeedback } from '@/db/schema'
import { eq, and, ilike, gte } from 'drizzle-orm'
import { logger } from '../../shared/logger'

export interface OposicionEntry {
  id: string
  slug: string
  nombre: string
  shortName: string | null
  categoria: string | null
  administracion: string | null
  isConvocatoriaActiva: boolean | null
  grupo: string | null           // "A", "B", "C" (grupo funcionarial EBEP)
  subgrupo: string | null        // "A1", "A2", "B", "C1", "C2" (subgrupo EBEP)
  tituloRequerido: string | null // para mostrar requisitos al usuario
  // Info de convocatoria (para responder "cuándo es el examen", "cuántas plazas")
  examDate: string | null
  examDateApproximate: boolean | null
  convocatoriaFecha: string | null
  plazasLibres: number | null
  plazasDiscapacidad: number | null
  plazasPromocionInterna: number | null
  estadoProceso: string | null
  boeReference: string | null
  keywords: string[] // tokens normalizados para matching
}

// ============================================
// CACHE
// ============================================

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 min
let cache: OposicionEntry[] | null = null
let cacheLoadedAt = 0

const STOPWORDS = new Set([
  'de','del','la','el','los','las','en','y','a','al','con','sin','para','por','que','o','u','e',
  'oposicion','oposiciones','convocatoria','convocatorias',
  'quiero','preparar','estudiar','tener','añadir','anadir','agregar','incorporar',
  'mas','más','tambien','también','aqui','aquí','ahi','ahí',
])

// Tokens "de rol" — si el mensaje contiene uno de estos, exigimos que el
// mismo rol aparezca en la oposición candidata (para evitar que "enfermero"
// matchee contra "administrativo" sólo por compartir región).
const ROLE_TOKENS = new Set([
  'auxiliar','tecnico','celador','enfermero','enfermera','medico','policia',
  'bombero','guardia','militar','tramitacion','gestor','gestora','administrativo',
  'administrativa','subalterno','ordenanza','conserje','maestro','maestra',
  'profesor','profesora','bibliotecario','archivero','secretario','secretaria',
  'interventor','notario','registrador','abogado','ingeniero','arquitecto',
  'veterinario','educador','operario','operaria','tcae',
])

// Normalización de variantes (plurales/género/regionales/abreviaturas)
const NORMALIZE_MAP: Record<string, string> = {
  // regiones
  canarias: 'canario', canario: 'canario', canaria: 'canario',
  gva: 'valenciana',                    // Generalitat Valenciana → token autonómico
  generalitat: 'valenciana',
  // roles - género/plural
  enfermeria: 'enfermero', enfermera: 'enfermero', enfermero: 'enfermero',
  administrativa: 'administrativo', administrativo: 'administrativo',
  tecnica: 'tecnico', tecnico: 'tecnico',
  gestora: 'gestor', gestor: 'gestor',
  policias: 'policia', policia: 'policia',
  // roles - abreviaturas comunes
  tecae: 'tcae', tcae: 'tcae',          // Técnico Cuidados Auxiliares Enfermería
  aux: 'auxiliar',                      // "aux administrativo"
  advo: 'administrativo',               // "aux advo"
  admvo: 'administrativo',
  admin: 'administrativo',              // "aux admin"
}

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // quitar tildes
    .replace(/[^a-z0-9ñ\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function tokenize(s: string): string[] {
  return normalize(s).split(' ')
    .filter(t => t.length > 2 && !STOPWORDS.has(t))
    .map(t => NORMALIZE_MAP[t] || t)
}

function getRoleTokens(tokens: string[]): Set<string> {
  return new Set(tokens.filter(t => ROLE_TOKENS.has(t)))
}

function extractKeywords(op: { nombre: string; shortName: string | null; administracion: string | null; categoria: string | null }): string[] {
  const parts = [op.nombre, op.shortName, op.administracion, op.categoria].filter(Boolean) as string[]
  const tokens = new Set<string>()
  parts.forEach(p => tokenize(p).forEach(t => tokens.add(t)))
  return [...tokens]
}

export async function loadOposicionesCache(force = false): Promise<OposicionEntry[]> {
  const now = Date.now()
  if (!force && cache && (now - cacheLoadedAt) < CACHE_TTL_MS) return cache

  let data: Array<Record<string, any>>
  try {
    const db = getReadDb()
    data = await db
      .select({
        id: oposiciones.id,
        slug: oposiciones.slug,
        nombre: oposiciones.nombre,
        short_name: oposiciones.shortName,
        categoria: oposiciones.categoria,
        administracion: oposiciones.administracion,
        is_convocatoria_activa: oposiciones.isConvocatoriaActiva,
        grupo: oposiciones.grupo,
        subgrupo: oposiciones.subgrupo,
        titulo_requerido: oposiciones.tituloRequerido,
        exam_date: oposiciones.examDate,
        exam_date_approximate: oposiciones.examDateApproximate,
        convocatoria_fecha: oposiciones.convocatoriaFecha,
        plazas_libres: oposiciones.plazasLibres,
        plazas_discapacidad: oposiciones.plazasDiscapacidad,
        plazas_promocion_interna: oposiciones.plazasPromocionInterna,
        estado_proceso: oposiciones.estadoProceso,
        boe_reference: oposiciones.boeReference,
      })
      .from(oposiciones)
      .where(eq(oposiciones.isActive, true))
  } catch (error) {
    logger.error('Error loading oposiciones cache', error, { domain: 'oposicion-catalog' })
    return cache ?? []
  }

  cache = data.map(r => ({
    id: r.id,
    slug: r.slug,
    nombre: r.nombre,
    shortName: r.short_name,
    categoria: r.categoria,
    administracion: r.administracion,
    isConvocatoriaActiva: r.is_convocatoria_activa,
    grupo: r.grupo,
    subgrupo: r.subgrupo,
    tituloRequerido: r.titulo_requerido,
    examDate: r.exam_date,
    examDateApproximate: r.exam_date_approximate,
    convocatoriaFecha: r.convocatoria_fecha,
    plazasLibres: r.plazas_libres,
    plazasDiscapacidad: r.plazas_discapacidad,
    plazasPromocionInterna: r.plazas_promocion_interna,
    estadoProceso: r.estado_proceso,
    boeReference: r.boe_reference,
    keywords: extractKeywords({
      nombre: r.nombre,
      shortName: r.short_name,
      administracion: r.administracion,
      categoria: r.categoria,
    }),
  }))
  cacheLoadedAt = now
  logger.info(`Oposiciones cache loaded: ${cache.length} entries`, { domain: 'oposicion-catalog' })
  return cache
}

// ============================================
// MATCHING
// ============================================

export interface MatchResult {
  entry: OposicionEntry | null
  score: number
  alternatives: Array<{ entry: OposicionEntry; score: number }>
}

export function matchOposicion(message: string, cached: OposicionEntry[]): MatchResult {
  const msgTokensArr = tokenize(message)
  const msgTokens = new Set(msgTokensArr)
  if (msgTokens.size === 0) return { entry: null, score: 0, alternatives: [] }

  const msgRoles = getRoleTokens(msgTokensArr)

  // Si el mensaje NO menciona explícitamente "ayuntamiento|ayto|municipal|diputaci",
  // penalizamos opciones cuyo nombre incluye esos tokens (para no preferir municipales
  // cuando el usuario habla de oposición autonómica).
  const messageMentionsLocal = /\b(ayuntamiento|ayto|municipal|diputaci|local)\b/i.test(message)
  const LOCAL_TOKENS = new Set(['ayuntamiento','ayto','diputacion','municipal','local'])

  // Si el mensaje menciona "universidad", penalizamos fuertemente opciones que
  // NO sean de universidad. Caso real: "Administrativo Universidad de Murcia"
  // no debe matchear "Aux. Admin. CARM" (Comunidad Autónoma vs Universidad
  // son entidades muy distintas con procesos selectivos independientes).
  const messageMentionsUniversidad = /\b(universidad|univ\.?)\b/i.test(message)

  const scored = cached.map(entry => {
    // Regla dura: si el mensaje menciona tokens de rol, TODOS deben aparecer
    // en las keywords de la oposición. Esto evita que "enfermería" matchee
    // contra "auxiliar administrativo" aunque compartan "auxiliar"+"canarias".
    if (msgRoles.size > 0) {
      for (const role of msgRoles) {
        if (!entry.keywords.includes(role)) {
          return { entry, score: 0, hits: 0 }
        }
      }
    }

    let hits = 0
    for (const kw of entry.keywords) {
      if (msgTokens.has(kw)) hits++
    }
    // Score: combinación de recall (qué fracción del mensaje matchea)
    // y precision (qué fracción de la oposición está en el mensaje).
    const recall = msgTokens.size > 0 ? hits / msgTokens.size : 0
    const precision = entry.keywords.length > 0 ? hits / entry.keywords.length : 0
    let score = Math.max(recall, precision)
    // Penalizar opciones con tokens locales/municipales si el mensaje no los menciona
    if (!messageMentionsLocal) {
      const hasLocalToken = entry.keywords.some(k => LOCAL_TOKENS.has(k))
      if (hasLocalToken) score *= 0.7
    }
    // Penalizar fuertemente si mensaje menciona "universidad" pero la opo NO
    // tiene "universidad" en su nombre (son entidades distintas).
    if (messageMentionsUniversidad) {
      const isUniversity = entry.keywords.includes('universidad')
      if (!isUniversity) score *= 0.2
    }
    return { entry, score, hits }
  }).filter(s => s.hits > 0).sort((a, b) => b.score - a.score)

  if (scored.length === 0) return { entry: null, score: 0, alternatives: [] }

  const top = scored[0]
  // Necesita al menos 2 tokens coincidentes o score >= 0.5
  let matched = (top.hits >= 2 && top.score >= 0.25) || top.score >= 0.5

  // Excepción: si el mensaje sólo aporta un único role token (ej: "tcae"),
  // y SOLO una oposición del catálogo lo contiene, aceptamos con 1 hit.
  if (!matched && msgRoles.size === 1) {
    const [onlyRole] = [...msgRoles]
    const candidates = cached.filter(e => e.keywords.includes(onlyRole))
    if (candidates.length === 1 && candidates[0] === top.entry) {
      matched = true
    }
  }

  return {
    entry: matched ? top.entry : null,
    score: top.score,
    alternatives: scored.slice(0, 3).map(s => ({ entry: s.entry, score: s.score })),
  }
}

// ============================================
// REGISTRO DE SOLICITUDES
// ============================================

export interface OposicionRequestInput {
  userId: string | null
  detectedName: string
  userMessage: string
  userOposicion: string | null
  logId: string | null
}

export type RegisterResult =
  | { status: 'created'; id: string }
  | { status: 'deduplicated'; existingId: string }
  | { status: 'failed'; error: string }

/**
 * Inserta una solicitud de oposición nueva en user_feedback (type='suggestion').
 * Dedupe: no crea registro si el mismo user pidió la misma oposición en últimos 7 días.
 */
export async function registerOposicionRequest(input: OposicionRequestInput): Promise<RegisterResult> {
  const db = getAdminDb()

  // Dedupe
  if (input.userId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const existing = await db
      .select({ id: userFeedback.id })
      .from(userFeedback)
      .where(and(
        eq(userFeedback.userId, input.userId),
        eq(userFeedback.type, 'suggestion'),
        ilike(userFeedback.message, `%[SOLICITUD OPOSICIÓN]%${input.detectedName}%`),
        gte(userFeedback.createdAt, sevenDaysAgo),
      ))
      .limit(1)

    if (existing.length > 0) {
      logger.info('Oposición request deduplicated', {
        domain: 'oposicion-catalog',
        userId: input.userId,
        detectedName: input.detectedName,
      })
      return { status: 'deduplicated', existingId: existing[0].id }
    }
  }

  const message = `[SOLICITUD OPOSICIÓN] ${input.detectedName}

Mensaje original del usuario: "${input.userMessage}"

Oposición activa del usuario: ${input.userOposicion || 'ninguna'}
Log chat: ${input.logId || 'n/a'}`

  try {
    const inserted = await db
      .insert(userFeedback)
      .values({
        userId: input.userId,
        type: 'suggestion',
        message,
        url: 'chat:oposicion-catalog',
        status: 'pending',
        priority: 'medium',
      })
      .returning({ id: userFeedback.id })

    return { status: 'created', id: inserted[0].id }
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error'
    logger.error('Error registering oposición request', err, { domain: 'oposicion-catalog' })
    return { status: 'failed', error }
  }
}
