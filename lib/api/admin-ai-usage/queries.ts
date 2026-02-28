// lib/api/admin-ai-usage/queries.ts
import { getDb } from '@/db/client'
import { aiApiUsage } from '@/db/schema'
import { eq, gte, desc, and } from 'drizzle-orm'
import type { AiUsageResponse, ProviderStats } from './schemas'

// Precios aproximados por 1M tokens
const PRICES: Record<string, Record<string, { input: number; output: number }>> = {
  openai: {
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4o': { input: 2.50, output: 10.00 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 }
  },
  anthropic: {
    'claude-3-haiku-20240307': { input: 0.25, output: 1.25 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 }
  },
  google: {
    'gemini-1.5-flash': { input: 0.075, output: 0.30 },
    'gemini-1.5-flash-8b': { input: 0.0375, output: 0.15 },
    'gemini-1.5-pro': { input: 1.25, output: 5.00 },
    'gemini-2.0-flash-exp': { input: 0.075, output: 0.30 }
  }
}

// ============================================
// OBTENER ESTADÍSTICAS DE USO DE IA
// ============================================

export async function getAiUsageStats(
  days: number,
  provider?: string
): Promise<AiUsageResponse> {
  const db = getDb()

  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Build conditions
  const conditions = [gte(aiApiUsage.createdAt, startDate.toISOString())]
  if (provider) {
    conditions.push(eq(aiApiUsage.provider, provider))
  }

  const usageData = await db
    .select()
    .from(aiApiUsage)
    .where(and(...conditions))
    .orderBy(desc(aiApiUsage.createdAt))

  // Agregar por proveedor
  const statsMap: Record<string, ProviderStats> = {}

  for (const entry of usageData) {
    const prov = entry.provider
    if (!statsMap[prov]) {
      statsMap[prov] = {
        provider: prov,
        total_requests: 0,
        total_input_tokens: 0,
        total_output_tokens: 0,
        total_tokens: 0,
        total_questions_verified: 0,
        by_model: {},
        by_feature: {},
        by_day: {}
      }
    }

    const s = statsMap[prov]
    s.total_requests++
    s.total_input_tokens += entry.inputTokens || 0
    s.total_output_tokens += entry.outputTokens || 0
    s.total_tokens += entry.totalTokens || 0
    s.total_questions_verified += entry.questionsCount || 0

    // Por modelo
    const model = entry.model || 'unknown'
    if (!s.by_model[model]) {
      s.by_model[model] = { requests: 0, tokens: 0 }
    }
    s.by_model[model].requests++
    s.by_model[model].tokens += entry.totalTokens || 0

    // Por feature
    const feature = entry.feature || 'unknown'
    if (!s.by_feature[feature]) {
      s.by_feature[feature] = { requests: 0, tokens: 0 }
    }
    s.by_feature[feature].requests++
    s.by_feature[feature].tokens += entry.totalTokens || 0

    // Por día
    const day = entry.createdAt?.split('T')[0] || 'unknown'
    if (!s.by_day[day]) {
      s.by_day[day] = { requests: 0, tokens: 0 }
    }
    s.by_day[day].requests++
    s.by_day[day].tokens += entry.totalTokens || 0
  }

  // Calcular costes estimados
  for (const provStats of Object.values(statsMap)) {
    let totalCost = 0
    for (const [model, data] of Object.entries(provStats.by_model)) {
      const prices = PRICES[provStats.provider]?.[model]
      if (prices) {
        // Asumimos 50% input, 50% output como aproximación
        const inputTokens = data.tokens * 0.5
        const outputTokens = data.tokens * 0.5
        const cost = (inputTokens / 1_000_000 * prices.input) + (outputTokens / 1_000_000 * prices.output)
        data.estimated_cost_usd = Math.round(cost * 10000) / 10000
        totalCost += cost
      }
    }
    provStats.estimated_total_cost_usd = Math.round(totalCost * 10000) / 10000
  }

  return {
    success: true,
    period: {
      days,
      from: startDate.toISOString(),
      to: new Date().toISOString()
    },
    stats: Object.values(statsMap),
    total_records: usageData.length
  }
}
