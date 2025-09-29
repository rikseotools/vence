// app/test/mantener-racha/page.js
import TestPageWrapper from '@/components/TestPageWrapper'

export default function MantenerRachaPage() {
  return (
    <TestPageWrapper
      tema={null}
      testType="mantener-racha"
      customTitle="Mantener Racha"
      customDescription="Test para continuar tu racha de estudio"
      customIcon="🔥"
      customColor="from-yellow-500 to-orange-600"
      customSubtitle="Mantén tu motivación activa"
      loadingMessage="🔥 Preparando test para mantener racha..."
    />
  )
}
