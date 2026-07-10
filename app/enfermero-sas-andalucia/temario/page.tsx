// app/enfermero-sas-andalucia/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Enfermero SAS Andalucía | Vence.es',
  description: 'Temario oficial del Enfermero/a del Servicio Andaluz de Salud (SAS). 79 temas de cuidados de enfermería, metodología y clínica. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/enfermero-sas-andalucia/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="enfermero-sas-andalucia"
      oposicionDisplayName="Enfermero SAS Andalucía"
    />
  )
}
