// app/celador-ics/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Zelador ICS Catalunya | Vence.es',
  description: 'Temario oficial del Celador del Institut Català de la Salut (ICS). 17 temas sobre funciones del celador en instituciones sanitarias. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/celador-ics/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="celador-ics"
      oposicionDisplayName="Zelador ICS Catalunya"
    />
  )
}
