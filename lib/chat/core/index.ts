// lib/chat/core/index.ts
// Exports públicos del core

export * from './types'
export { buildChatContext, getQuestionInfo, detectMessageIntent, formatMessagesForOpenAI } from './ChatContext'
export { ChatResponseBuilder, StreamEncoder, createChatStream, streamOpenAIResponse } from './ChatResponseBuilder'
export { ChatOrchestrator, getOrchestrator, resetOrchestrator } from './ChatOrchestrator'
export { AITracer, createTracer, getTracer, resetTracer, type TraceSpan, type TraceType } from './AITracer'
