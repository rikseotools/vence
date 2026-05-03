// app/admin/revision-temas/page.js
'use client'

import { useState } from 'react'
import TopicReviewTab from '@/components/Admin/TopicReviewTab'
import LifecycleQueueTab from '@/components/Admin/LifecycleQueueTab'

export default function RevisionTemasPage() {
  const [view, setView] = useState('queue')  // 'topic' | 'queue' — default queue (Por tema tiene bug pre-existente que tarda 76s)

  return (
    <div>
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex gap-4 px-4 sm:px-6">
          <button
            onClick={() => setView('topic')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition ${
              view === 'topic'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Por tema
          </button>
          <button
            onClick={() => setView('queue')}
            className={`py-3 px-1 border-b-2 text-sm font-medium transition ${
              view === 'queue'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            }`}
          >
            Por cola (lifecycle)
          </button>
        </nav>
      </div>

      <div className="px-4 sm:px-6">
        {view === 'topic' ? <TopicReviewTab /> : <LifecycleQueueTab />}
      </div>
    </div>
  )
}
