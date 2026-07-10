import TemaTestPage from '@/components/test/TemaTestPage'
export default function Page({ params }: { params: Promise<{ numero: string }> }) { return <TemaTestPage oposicionSlug="enfermero-ics" params={params} /> }
