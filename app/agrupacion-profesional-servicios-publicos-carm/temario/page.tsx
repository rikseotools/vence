// app/agrupacion-profesional-servicios-publicos-carm/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Agrup. Prof. Servicios Públicos CARM | Vence.es',
  description: 'Temario oficial de Agrup. Prof. Servicios Públicos CARM con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/agrupacion-profesional-servicios-publicos-carm/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="agrupacion-profesional-servicios-publicos-carm"
      oposicionDisplayName="Agrup. Prof. Servicios Públicos CARM"
    />
  )
}
