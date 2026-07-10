import TestExamenPage from '@/components/test/TestExamenPage'
export default function Page({ params }: { params: Promise<{ numero: string }> }) { return <TestExamenPage oposicionSlug="enfermero-ics" params={params} /> }
