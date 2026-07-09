// app/enfermero-scs-canarias/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Enfermero SCS Canarias | Vence.es',
  description: 'Temario oficial del Enfermero/a del Servicio Canario de la Salud (SCS). 50 temas de cuidados de enfermería, metodología y clínica. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/enfermero-scs-canarias/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="enfermero-scs-canarias"
      oposicionDisplayName="Enfermero SCS Canarias"
    />
  )
}
