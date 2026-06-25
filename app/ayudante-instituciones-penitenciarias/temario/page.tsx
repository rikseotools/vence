// app/ayudante-instituciones-penitenciarias/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Ayudante de Instituciones Penitenciarias | Vence.es',
  description: 'Temario oficial de Ayudante de Instituciones Penitenciarias con legislación literal del BOE. Acceso gratuito a todos los temas organizados por bloques.',
  alternates: {
    canonical: 'https://www.vence.es/ayudante-instituciones-penitenciarias/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="ayudante-instituciones-penitenciarias"
      oposicionDisplayName="Ayudante de Instituciones Penitenciarias"
    />
  )
}
