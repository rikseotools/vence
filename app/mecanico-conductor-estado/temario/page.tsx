// app/mecanico-conductor-estado/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado | Vence.es',
  description: 'Temario oficial de Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/mecanico-conductor-estado/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="mecanico-conductor-estado"
      oposicionDisplayName="Conducción de Vehículos de Transporte por Carretera del Parque Móvil del Estado"
    />
  )
}
