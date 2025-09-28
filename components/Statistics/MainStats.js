// components/Statistics/MainStats.js
'use client'

const formatTime = (seconds) => {
  if (!seconds) return '0m'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return minutes > 0 ? `${minutes}m` : '0m'
}

const getScoreColor = (percentage) => {
  if (percentage >= 85) return 'text-green-600'
  if (percentage >= 70) return 'text-blue-600'
  if (percentage >= 50) return 'text-yellow-600'
  return 'text-red-600'
}

export default function MainStats({ stats }) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Resumen de tu Progreso</h3>
      
      {/* Métricas en líneas horizontales compactas */}
      <div className="space-y-4">
        
        {/* Línea 1: Tests y Preguntas */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎯</span>
            <div>
              <span className="font-bold text-purple-600 text-xl">{stats.testsCompleted}</span>
              <span className="text-gray-600 ml-2">tests completados</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">📊 {stats.totalQuestions} preguntas totales</div>
            <div className="text-xs text-green-600">🧠 Sistema IA activo</div>
          </div>
        </div>

        {/* Línea 2: Precisión */}
        <div className="flex items-center justify-between py-3 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <span className="text-2xl">🎓</span>
            <div>
              <span className={`font-bold text-2xl ${getScoreColor(stats.accuracy)}`}>{stats.accuracy}%</span>
              <span className="text-gray-600 ml-2">precisión global</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">✅ {stats.correctAnswers}/{stats.totalQuestions} correctas</div>
            <div className="text-xs text-gray-500">
              📈 {stats.averageTime < 60 ? `${stats.averageTime}s` : `${Math.round(stats.averageTime / 60)}min`} por pregunta
            </div>
          </div>
        </div>

        {/* Línea 3: Tiempo y Racha */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center space-x-6">
            {/* Tiempo */}
            <div className="flex items-center space-x-3">
              <span className="text-2xl">⏰</span>
              <div>
                <span className="font-bold text-blue-600 text-xl">{formatTime(stats.totalStudyTime)}</span>
                <span className="text-gray-600 ml-2">estudiadas</span>
              </div>
            </div>
            
            {/* Racha */}
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🔥</span>
              <div>
                <span className="font-bold text-orange-600 text-xl">{stats.currentStreak}</span>
                <span className="text-gray-600 ml-2">días seguidos</span>
              </div>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-xs text-gray-500">
              📅 {stats.currentStreak === 0 ? 'Sin actividad reciente' : 'Mantén la racha activa'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}