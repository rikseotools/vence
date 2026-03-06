// components/TopicNavFooter.tsx — Navegación entre temas del temario
// Componente compartido que muestra el número de tema visible (displayNum)
// en vez del topic_number interno, evitando confusión al usuario.
'use client'

import Link from 'next/link'

interface TopicNavFooterProps {
  topicNumber: number
  basePath: string
  getDisplayNum: (topicNumber: number) => number
}

export default function TopicNavFooter({ topicNumber, basePath, getDisplayNum }: TopicNavFooterProps) {
  return (
    <footer className="no-print mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex gap-3">
          {topicNumber > 1 && (
            <Link
              href={`${basePath}/temario/tema-${topicNumber - 1}`}
              className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Tema {getDisplayNum(topicNumber - 1)}
            </Link>
          )}
          <Link
            href={`${basePath}/temario/tema-${topicNumber + 1}`}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-300 dark:border-gray-600 rounded-md transition-colors"
          >
            Tema {getDisplayNum(topicNumber + 1)}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

        <Link
          href={`${basePath}/test/tema/${topicNumber}`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          Practicar este tema
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </footer>
  )
}
