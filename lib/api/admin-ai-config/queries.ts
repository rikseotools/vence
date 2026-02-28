// lib/api/admin-ai-config/queries.ts - Queries para configuración de APIs de IA
import { getDb } from '@/db/client'
import { aiApiConfig } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ============================================
// GET ALL CONFIGS
// ============================================

export async function getAllConfigs() {
  try {
    const db = getDb()
    const configs = await db
      .select()
      .from(aiApiConfig)
      .orderBy(aiApiConfig.provider)

    return configs
  } catch (error) {
    console.error('❌ [AdminAiConfig] Error fetching configs:', error)
    return []
  }
}

// ============================================
// UPSERT CONFIG
// ============================================

export async function upsertConfig(provider: string, updateData: Record<string, unknown>) {
  const db = getDb()
  await db
    .insert(aiApiConfig)
    .values({
      provider,
      ...updateData,
      createdAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: aiApiConfig.provider,
      set: updateData as Record<string, unknown>,
    })
}

// ============================================
// GET CONFIG BY PROVIDER
// ============================================

export async function getConfigByProvider(provider: string) {
  const db = getDb()
  const [config] = await db
    .select({ apiKeyEncrypted: aiApiConfig.apiKeyEncrypted })
    .from(aiApiConfig)
    .where(eq(aiApiConfig.provider, provider))
    .limit(1)

  return config ?? null
}

// ============================================
// UPDATE VERIFICATION STATUS
// ============================================

export async function updateVerificationStatus(
  provider: string,
  status: string,
  errorMessage: string | null
) {
  const db = getDb()
  await db
    .update(aiApiConfig)
    .set({
      lastVerifiedAt: new Date().toISOString(),
      lastVerificationStatus: status,
      lastErrorMessage: errorMessage,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(aiApiConfig.provider, provider))
}
