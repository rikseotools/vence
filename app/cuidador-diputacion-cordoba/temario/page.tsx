// app/cuidador-diputacion-cordoba/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Cuidador/a de la Diputación Provincial de Córdoba | Vence.es',
  description: 'Temario oficial de Cuidador/a de la Diputación Provincial de Córdoba con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/cuidador-diputacion-cordoba/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="cuidador-diputacion-cordoba"
      oposicionDisplayName="Cuidador/a de la Diputación Provincial de Córdoba"
    />
  )
}
