// components/Statistics/DeviceAnalytics.js
'use client'

export default function DeviceAnalytics({ deviceAnalytics }) {
  if (!deviceAnalytics) return null

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold text-gray-800 mb-4">💻 Análisis de Dispositivos</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Dispositivos Utilizados */}
        <div>
          <h4 className="font-bold text-gray-800 mb-3">📱 Dispositivos</h4>
          <div className="space-y-3">
            {Object.entries(deviceAnalytics.devices).map(([device, data]) => (
              <div key={device} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-800">{device}</span>
                  <span className={`px-2 py-1 rounded text-xs font-bold ${
                    device === deviceAnalytics.mostUsedDevice 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {device === deviceAnalytics.mostUsedDevice ? 'Favorito' : 'Secundario'}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="font-bold">{data.sessions}</div>
                    <div className="text-gray-600 text-xs">Sesiones</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{data.avgSessionTime}m</div>
                    <div className="text-gray-600 text-xs">Duración</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold">{data.avgEngagement}%</div>
                    <div className="text-gray-600 text-xs">Engagement</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recomendación */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-bold text-blue-800 mb-3">💡 Recomendación IA</h4>
          <div className="text-sm text-blue-700 mb-4">
            {deviceAnalytics.recommendation}
          </div>
          <div className="bg-blue-100 rounded-lg p-3">
            <div className="text-xs font-bold text-blue-800 mb-1">📊 Análisis:</div>
            <div className="text-xs text-blue-700">
              • {deviceAnalytics.totalDevices} dispositivos diferentes
            </div>
            <div className="text-xs text-blue-700">
              • Dispositivo principal: {deviceAnalytics.mostUsedDevice}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
