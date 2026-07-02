// app/administrativo-junta-general-asturias/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Administrativo de la Junta General del Principado de Asturias | Vence.es',
  description: 'Temario oficial de Administrativo de la Junta General del Principado de Asturias con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/administrativo-junta-general-asturias/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="administrativo-junta-general-asturias"
      oposicionDisplayName="Administrativo de la Junta General del Principado de Asturias"
    />
  )
}
