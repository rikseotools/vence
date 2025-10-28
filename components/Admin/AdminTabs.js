// components/admin/AdminTabs.js
'use client'

import { useState } from 'react'
import { useLawChanges } from '@/hooks/useLawChanges'
import LawMonitoringTab from './LawMonitoringTab'

export default function AdminTabs() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const { hasUnreviewedChanges } = useLawChanges()

  const tabs = [
    { id: 'dashboard', name: '📊 Dashboard', component: null },
    { id: 'laws', name: '📚 Leyes', component: null },
    { id: 'users', name: '👥 Usuarios', component: null },
    { id: 'analytics', name: '📈 Analytics', component: null },
    { 
      id: 'monitoring', 
      name: '🚨 Monitoreo', 
      component: LawMonitoringTab,
      hasAlert: hasUnreviewedChanges
    }
  ]

  const renderTabContent = () => {
    const currentTab = tabs.find(tab => tab.id === activeTab)
    
    if (currentTab?.component) {
      const Component = currentTab.component
      return <Component />
    }
    
    return (
      <div className="p-6">
        <h2 className="text-xl font-bold">Contenido de {currentTab?.name}</h2>
        <p className="text-gray-600 mt-2">Esta sección está en desarrollo.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Tab Navigation */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto">
          <nav className="flex space-x-8" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  py-4 px-1 border-b-2 font-medium text-sm relative transition-colors
                  ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                  ${tab.hasAlert ? 'animate-pulse' : ''}
                `}
              >
                <span className={tab.hasAlert ? 'bg-red-50 px-2 py-1 rounded-lg border border-red-200' : ''}>
                  {tab.name}
                  {tab.hasAlert && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-red-100 bg-red-600 rounded-full animate-pulse">
                      !
                    </span>
                  )}
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto">
        {renderTabContent()}
      </div>
    </div>
  )
}

// CSS personalizado para el parpadeo más sutil
const styles = `
  @keyframes subtle-blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.7; }
  }
  
  .tab-alert {
    animation: subtle-blink 2s infinite;
  }
`