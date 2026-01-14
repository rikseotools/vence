// lib/chat/shared/index.ts
// Exports públicos de shared

export { getDb, type Database } from './db'
export { getOpenAI, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS, CHAT_MODEL, CHAT_MODEL_PREMIUM } from './openai'
export { logger, type Logger } from './logger'
export * from './errors'
