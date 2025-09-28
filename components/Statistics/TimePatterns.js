// components/Statistics/TimePatterns.js
'use client'

export default function TimePatterns({ timePatterns }) {
  if (!timePatterns) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">🕐 Patrones Temporales</h3>
      <div className="flex flex-wrap justify-center gap-4">
        
        {/* Mejores Horas */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 min-w-[180px]">
          <h4 className="font-bold text-green-800 mb-2 text-sm">🌟 Mejores Horas</h4>
          <div className="space-y-1">
            {timePatterns.bestHours.slice(0, 3).map((hour, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-xs">{hour}:00-{hour + 1}:00</span>
                <span className="text-green-600 font-bold text-sm">
                  {timePatterns.hourlyStats.find(h => h.hour === hour)?.accuracy || 0}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Peores Horas */}
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 min-w-[180px]">
          <h4 className="font-bold text-red-800 mb-2 text-sm">⚠️ Evitar</h4>
          <div className="space-y-1">
            {timePatterns.worstHours.slice(0, 3).map((hour, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-xs">{hour}:00-{hour + 1}:00</span>
                <span className="text-red-600 font-bold text-sm">
                  {timePatterns.hourlyStats.find(h => h.hour === hour)?.accuracy || 0}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
