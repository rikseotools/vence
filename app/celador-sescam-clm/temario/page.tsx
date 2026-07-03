// app/celador-sescam-clm/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Celador SESCAM Castilla-La Mancha | Vence.es',
  description: 'Temario oficial del Celador del SESCAM (Castilla-La Mancha). 15 temas sobre funciones del celador en instituciones sanitarias. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/celador-sescam-clm/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="celador-sescam-clm"
      oposicionDisplayName="Celador SESCAM Castilla-La Mancha"
    />
  )
}
