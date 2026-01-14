// lib/chat/core/index.ts
// Exports públicos del core

export * from './types'
export { buildChatContext, getQuestionInfo, detectMessageIntent, formatMessagesForOpenAI } from './ChatContext'
export { ChatResponseBuilder, StreamEncoder, createChatStream, streamOpenAIResponse } from './ChatResponseBuilder'
export { ChatOrchestrator, getOrchestrator, resetOrchestrator } from './ChatOrchestrator'
