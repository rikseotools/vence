// app/agente-hacienda/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Agente de la Hacienda Pública | Vence.es',
  description: 'Temario oficial de Agente de la Hacienda Pública con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/agente-hacienda/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="agente-hacienda"
      oposicionDisplayName="Agente de la Hacienda Pública"
    />
  )
}
