// app/test-oposiciones/layout.js
export const metadata = {
  title: 'Tests de Oposiciones | Vence',
  description: 'Tests de preparación para oposiciones: Constitución Española, Administrativos del Estado y más.',
}

export default function TestOposicionesLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50">
      {children}
    </div>
  )
}