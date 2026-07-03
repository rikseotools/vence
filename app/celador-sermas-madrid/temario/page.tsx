// app/celador-sermas-madrid/temario/page.tsx - Thin wrapper del componente dinamico compartido.
// Fuente unica de verdad: BD (oposicion_bloques + topics).
import DynamicTemarioPage from '@/components/temario/DynamicTemarioPage'

// force-dynamic: renderizar bajo demanda para no saturar BD en build (3600+ páginas)
export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Temario Celador SERMAS Madrid | Vence.es',
  description: 'Temario oficial del Celador del Servicio Madrileño de Salud (SERMAS). 16 temas sobre funciones del celador en instituciones sanitarias. Acceso gratuito.',
  alternates: {
    canonical: 'https://www.vence.es/celador-sermas-madrid/temario',
  },
}

export default async function TemarioPage() {
  return (
    <DynamicTemarioPage
      oposicionSlug="celador-sermas-madrid"
      oposicionDisplayName="Celador SERMAS Madrid"
    />
  )
}
