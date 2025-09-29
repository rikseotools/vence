// app/test/explorar/page.js
import TestPageWrapper from '../../../../components/TestPageWrapper'

export default function ExplorarPage() {
  return (
    <TestPageWrapper
      tema={null}
      testType="explorar"
      customTitle="Explorar Contenido"
      customDescription="Nuevo contenido añadido recientemente"
      customIcon="🔍"
      customColor="from-blue-500 to-cyan-600"
      customSubtitle="Descubre las últimas preguntas"
      loadingMessage="🔍 Cargando contenido nuevo..."
    />
  )
}
