// app/administrativo-gva/temario/page.tsx - Thin wrapper del componente dinámico compartido.
// Fuente única de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Administrativo Generalitat Valenciana C1-01 | Vence.es',
  description: 'Temario oficial Administrativo Generalitat Valenciana C1-01 (DOGV Convocatoria 58/26). 35 temas con legislación literal. Acceso gratuito a todos los temas organizados por Parte General y Parte Especial.',
  alternates: {
    canonical: 'https://www.vence.es/administrativo-gva/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="administrativo-gva"
      oposicionDisplayName="Administrativo Generalitat Valenciana"
    />
  )
}
