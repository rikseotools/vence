// components/DailyLimitBanner.js
// Banner que muestra el contador de preguntas diarias
'use client'

import Link from 'next/link'
import { useDailyQuestionLimit } from '../hooks/useDailyQuestionLimit'

export default function DailyLimitBanner({ className = '' }) {
  const {
    questionsToday,
    questionsRemaining,
    dailyLimit,
    isLimitReached,
    isPremiumUser,
    hasLimit,
    loading
  } = useDailyQuestionLimit()

  // No mostrar para usuarios premium o mientras carga
  if (loading || isPremiumUser || !hasLimit) {
    return null
  }

  const progressPercentage = Math.min((questionsToday / dailyLimit) * 100, 100)
  const isNearLimit = questionsRemaining <= 5 && !isLimitReached
  const isAtLimit = isLimitReached

  return (
    <div className={`
      fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80
      bg-white dark:bg-gray-800
      rounded-xl shadow-lg border
      ${isAtLimit
        ? 'border-red-300 dark:border-red-700'
        : isNearLimit
          ? 'border-yellow-300 dark:border-yellow-700'
          : 'border-gray-200 dark:border-gray-700'
      }
      p-3 z-40
      transition-all duration-300
      ${className}
    `}>
      <div className="flex items-center gap-3">
        {/* Icono */}
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
          ${isAtLimit
            ? 'bg-red-100 dark:bg-red-900/30'
            : isNearLimit
              ? 'bg-yellow-100 dark:bg-yellow-900/30'
              : 'bg-blue-100 dark:bg-blue-900/30'
          }
        `}>
          {isAtLimit ? (
            <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          ) : (
            <span className={`
              font-bold text-sm
              ${isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 'text-blue-600 dark:text-blue-400'}
            `}>
              {questionsRemaining}
            </span>
          )}
        </div>

        {/* Texto y barra de progreso */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {isAtLimit
                ? 'Limite diario alcanzado'
                : `${questionsToday}/${dailyLimit} preguntas hoy`
              }
            </span>
            {!isAtLimit && (
              <span className={`
                text-xs font-medium ml-2
                ${isNearLimit ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-gray-400'}
              `}>
                {questionsRemaining} restantes
              </span>
            )}
          </div>

          {/* Barra de progreso */}
          <div className="w-full h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`
                h-full rounded-full transition-all duration-500
                ${isAtLimit
                  ? 'bg-red-500'
                  : isNearLimit
                    ? 'bg-yellow-500'
                    : 'bg-blue-500'
                }
              `}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* CTA Premium */}
        {(isAtLimit || isNearLimit) && (
          <Link
            href="/premium"
            className={`
              ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold
              whitespace-nowrap transition-colors flex-shrink-0
              ${isAtLimit
                ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white hover:from-yellow-600 hover:to-orange-600'
                : 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900'
              }
            `}
          >
            {isAtLimit ? 'Ser Premium' : 'Sin limites'}
          </Link>
        )}
      </div>
    </div>
  )
}
