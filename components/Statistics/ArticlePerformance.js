// components/Statistics/ArticlePerformance.js
'use client'

const getScoreColor = (percentage) => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export default function ArticlePerformance({ articlePerformance }) {
  if (!articlePerformance || articlePerformance.length === 0) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">📖 Rendimiento por Artículo</h3>
      <div className="space-y-3">
        {articlePerformance.slice(0, 10).map((article, index) => (
          <div key={index} className={`p-4 rounded-lg border flex items-center justify-between ${
            article.status === 'dominado' ? 'bg-green-50 border-green-200' :
            article.status === 'bien' ? 'bg-blue-50 border-blue-200' :
            article.status === 'regular' ? 'bg-yellow-50 border-yellow-200' :
            'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-4">
              <div className="text-2xl">
                {article.status === 'dominado' ? '🏆' :
                 article.status === 'bien' ? '👍' :
                 article.status === 'regular' ? '⚠️' : '📚'}
              </div>
              <div>
                <div className="font-bold text-gray-800">{article.article}</div>
                <div className="text-sm text-gray-600">{article.law}</div>
                <div className="text-xs text-gray-500">
                  {article.correct}/{article.total} aciertos • {article.avgTime}s promedio
                  {article.avgRetention > 0 && (
                    <span> • Retención: {article.avgRetention} pts</span>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className={`text-xl font-bold ${getScoreColor(article.accuracy)}`}>
                {article.accuracy}%
              </div>
              <div className="text-xs text-gray-600 capitalize">
                {article.status}
              </div>
              {article.trend && (
                <div className={`text-xs mt-1 ${
                  article.trend === 'improving' ? 'text-green-600' :
                  article.trend === 'declining' ? 'text-red-600' :
                  'text-gray-600'
                }`}>
                  {article.trend === 'improving' ? '📈' :
                   article.trend === 'declining' ? '📉' : '➡️'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}