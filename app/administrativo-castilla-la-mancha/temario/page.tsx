// app/administrativo-castilla-la-mancha/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Administrativo Castilla-La Mancha | Vence.es',
  description: 'Temario oficial de Administrativo Castilla-La Mancha con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/administrativo-castilla-la-mancha/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="administrativo-castilla-la-mancha"
      oposicionDisplayName="Administrativo Castilla-La Mancha"
    />
  )
}
