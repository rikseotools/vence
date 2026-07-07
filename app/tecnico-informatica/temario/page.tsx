// app/tecnico-informatica/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Técnico Auxiliar de Informática (TAI) del Estado | Vence.es',
  description: 'Temario oficial del Cuerpo de Técnicos Auxiliares de Informática de la Administración del Estado (TAI, C1) con legislación literal del BOE. Bloque I disponible; bloques técnicos en preparación.',
  alternates: {
    canonical: 'https://www.vence.es/tecnico-informatica/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="tecnico-informatica"
      oposicionDisplayName="Técnico Auxiliar de Informática (TAI) del Estado"
    />
  )
}
