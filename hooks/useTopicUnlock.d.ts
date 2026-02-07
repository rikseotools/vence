// hooks/useTopicUnlock.d.ts - Type declarations for useTopicUnlock hook

interface TopicProgress {
  accuracy: number
  questionsAnswered: number
}

interface WeakArticle {
  lawName: string
  articleNumber: string
  failedCount: number
  totalAttempts: number
  correctCount: number
  avgSuccessRate: number
}

interface UseTopicUnlockOptions {
  positionType?: string | null
}

interface UseTopicUnlockReturn {
  loading: boolean
  topicProgress: Record<string, TopicProgress>
  getTopicProgress: (temaId: number) => TopicProgress
  getWeakArticles: (temaId: number) => WeakArticle[]
}

export function useTopicUnlock(options?: UseTopicUnlockOptions): UseTopicUnlockReturn
