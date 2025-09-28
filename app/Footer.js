// Footer.js - CORREGIDO - Solo enlaces que funcionan, sin 404s
import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-gray-800 text-white py-12 mt-auto">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <span className="text-red-500 mr-2">❤️</span> iLoveTest
            </h3>
            <p className="text-gray-300 text-sm">
              Interactive learning platform for Spanish and international law practice tests.
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Study Materials</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {/* ✅ CORREGIDO: Solo enlaces que SÍ existen */}
              <li>
                <Link href="/es/auxiliar-administrativo-estado/temario" className="hover:text-white">
                  📚 Spanish Law Syllabus
                </Link>
              </li>
              <li>
                <Link href="/es/auxiliar-administrativo-estado/temario/tema-7" className="hover:text-white">
                  📖 Law 19/2013 Transparency
                </Link>
              </li>
              {/* ❌ ELIMINADO: Enlaces a páginas que no existen
              <li><Link href="/es/leyes/constitucion-espanola" className="hover:text-white">🇪🇸 Spanish Constitution</Link></li>
              */}
              <li><span className="text-gray-500">🇪🇸 Spanish Constitution (Soon)</span></li>
              <li><span className="text-gray-500">🇪🇸 Law 39/2015 (Soon)</span></li>
              <li><span className="text-gray-500">🇫🇷 French Law (Soon)</span></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Practice Tests</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              {/* ✅ CORREGIDO: Enlaces que SÍ funcionan */}
              <li>
                <Link href="/es/auxiliar-administrativo-estado" className="hover:text-white">
                  🏛️ Auxiliar Administrativo Estado
                </Link>
              </li>
              <li>
                <Link href="/es/auxiliar-administrativo-estado/test" className="hover:text-white">
                  🎯 Practice Tests
                </Link>
              </li>
              <li>
                <Link href="/es/auxiliar-administrativo-estado/test/tema/7" className="hover:text-white">
                  📝 Transparency Law Tests
                </Link>
              </li>
              {/* ❌ ELIMINADO: Enlace problemático
              <li><Link href="/es/leyes" className="hover:text-white">Test de Leyes →</Link></li>
              */}
              <li><span className="text-gray-500">Civil Guard (Soon)</span></li>
              <li><span className="text-gray-500">US Bar Exam (Soon)</span></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold mb-4">Platform</h4>
            <ul className="space-y-2 text-sm text-gray-300">
              <li>
                <Link href="/es" className="hover:text-white">
                  🏠 Spanish Version
                </Link>
              </li>
              <li>
                <Link href="/" className="hover:text-white">
                  🇺🇸 English Version
                </Link>
              </li>
              <li><span className="text-gray-500">📧 Contact (Soon)</span></li>
              <li><span className="text-gray-500">📊 Analytics (Soon)</span></li>
            </ul>
            
            {/* Language switcher */}
            <div className="mt-4">
              <p className="text-gray-400 text-xs mb-2">Choose your language:</p>
              <div className="flex space-x-2">
                <Link href="/es" className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors">
                  🇪🇸 ES
                </Link>
                <Link href="/" className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors">
                  🇺🇸 EN
                </Link>
                <span className="bg-gray-600 text-gray-400 px-3 py-1 rounded text-sm cursor-not-allowed">
                  🇫🇷 FR (Soon)
                </span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="border-t border-gray-700 mt-8 pt-6 flex flex-col md:flex-row justify-between items-center">
          <div className="text-sm text-gray-400 mb-4 md:mb-0">
            © 2025 iLoveTest. Educational content based on official legal texts.
          </div>
          <div className="flex items-center space-x-4 text-sm text-gray-400">
            {/* ✅ CORREGIDO: Enlaces seguros o próximamente */}
            <Link href="/es/unsubscribe" className="hover:text-white">Unsubscribe</Link>
            <span className="cursor-not-allowed">Privacy (Soon)</span>
            <span className="cursor-not-allowed">Terms (Soon)</span>
            <span className="cursor-not-allowed">Sitemap (Soon)</span>
          </div>
        </div>
      </div>
    </footer>
  )
}