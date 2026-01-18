// app/admin/monitoreo/page.js
'use client'

import { useState } from 'react'
import LawMonitoringTab from '@/components/Admin/LawMonitoringTab'
import DataIntegrityTab from '@/components/Admin/DataIntegrityTab'

export default function MonitoreoPage() {
  const [activeTab, setActiveTab] = useState('monitoring')

  return (
    <div>
      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-0">
        <nav className="flex space-x-4 px-3 sm:px-6" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('monitoring')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'monitoring'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Monitoreo BOE
          </button>
          <button
            onClick={() => setActiveTab('integrity')}
            className={`py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              activeTab === 'integrity'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
            }`}
          >
            Validacion Datos
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'monitoring' && <LawMonitoringTab />}
      {activeTab === 'integrity' && <DataIntegrityTab />}
    </div>
  )
}