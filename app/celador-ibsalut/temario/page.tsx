// app/celador-ibsalut/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Celador IB-Salut Balears | Vence.es',
  description: 'Temario oficial del Celador del Servei de Salut de les Illes Balears (IB-Salut). 20 temas sobre funciones del celador en instituciones sanitarias. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/celador-ibsalut/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="celador-ibsalut"
      oposicionDisplayName="Celador IB-Salut Balears"
    />
  )
}
