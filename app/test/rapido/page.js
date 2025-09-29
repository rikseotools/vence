// app/test/rapido/page.js
import TestPageWrapper from '@/components/TestPageWrapper'

export default function TestRapidoPage() {
  return (
    <TestPageWrapper
      oposicionBased={true}
      testType="rapido"
      customTitle="Test Rápido"
      customDescription="Test rápido para retomar el estudio"
      customIcon="⚡"
      customColor="from-green-500 to-emerald-600"
      customSubtitle="Práctica rápida para volver al ritmo"
      loadingMessage="⚡ Preparando test rápido..."
    />
  )
}
