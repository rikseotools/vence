// app/page.js
import Link from 'next/link'
import Header from './Header'
import Footer from './Footer'

const SITE_URL = process.env.SITE_URL || 'https://www.vence.es'

export const metadata = {
  title: 'Free Legal Practice Tests Online | Vence - US Law & Spanish Law 2024',
  description: 'Free practice tests for US law, Spanish Constitution, Law 39/2015, Bar Exam prep. +10,000 updated questions for legal professionals and students.',
  keywords: [
    'legal practice tests',
    'bar exam prep',
    'constitutional law test',
    'free law tests',
    'legal studies online',
    'bar exam questions',
    'civil procedure test',
    'criminal law practice',
    'spanish constitution test',
    'law school prep'
  ].join(', '),
  authors: [{ name: 'iLoveTest' }],
  creator: 'iLoveTest',
  publisher: 'iLoveTest',
  metadataBase: new URL(SITE_URL),
  alternates: {
    canonical: SITE_URL,
    languages: {
      'en-US': SITE_URL,           // ✅ Self-referencing
      'es-ES': `${SITE_URL}/es`,   // ✅ Reciprocal link
      'x-default': SITE_URL
    }
  },
  openGraph: {
    title: 'Free Legal Practice Tests | iLoveTest - US & Spanish Law 2024',
    description: 'Master legal concepts with 10,000+ free practice tests. Bar exam prep, Constitutional law, Civil procedure and more.',
    url: SITE_URL,
    siteName: 'iLoveTest',
    locale: 'en_US',
    type: 'website',
    images: [
      {
        url: '/og-image-en.jpg',
        width: 1200,
        height: 630,
        alt: 'iLoveTest - Legal Practice Tests Platform',
      },
    ],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function EnglishHub() {
  const usLawTests = [
    {
      id: 'constitutional-law',
      title: 'Constitutional Law',
      description: 'Test your knowledge of US Constitutional law: Bill of Rights, Supreme Court cases, federal powers.',
      keywords: 'constitutional law test, bill of rights quiz',
      articles: '27 amendments',
      tests: '800+ questions',
      searchVolume: '8,100',
      difficulty: 'High',
      color: 'from-blue-600 to-blue-800',
      available: false
    },
    {
      id: 'civil-procedure',
      title: 'Civil Procedure',
      description: 'Federal Rules of Civil Procedure, jurisdiction, pleadings, discovery, and trial procedures.',
      keywords: 'civil procedure test, frcp quiz',
      articles: 'FRCP Rules',
      tests: '600+ questions',
      searchVolume: '5,400',
      difficulty: 'High',
      color: 'from-green-600 to-green-800',
      available: false
    },
    {
      id: 'criminal-law',
      title: 'Criminal Law',
      description: 'Elements of crimes, defenses, sentencing, and criminal procedure under federal and state law.',
      keywords: 'criminal law test, criminal procedure quiz',
      articles: 'Federal Code',
      tests: '700+ questions',
      searchVolume: '4,200',
      difficulty: 'High',
      color: 'from-red-600 to-red-800',
      available: false
    },
    {
      id: 'contracts',
      title: 'Contract Law',
      description: 'Formation, performance, breach, and remedies in contract law. UCC and common law.',
      keywords: 'contract law test, ucc quiz',
      articles: 'UCC Articles',
      tests: '500+ questions',
      searchVolume: '3,800',
      difficulty: 'Medium',
      color: 'from-purple-600 to-purple-800',
      available: false
    },
    {
      id: 'torts',
      title: 'Tort Law',
      description: 'Negligence, intentional torts, strict liability, and damages in personal injury law.',
      keywords: 'tort law test, negligence quiz',
      articles: 'Restatements',
      tests: '450+ questions',
      searchVolume: '2,900',
      difficulty: 'Medium',
      color: 'from-orange-600 to-orange-800',
      available: false
    },
    {
      id: 'property-law',
      title: 'Property Law',
      description: 'Real property, personal property, estates, future interests, and landlord-tenant law.',
      keywords: 'property law test, real estate law quiz',
      articles: 'Property Code',
      tests: '400+ questions',
      searchVolume: '2,100',
      difficulty: 'High',
      color: 'from-teal-600 to-teal-800',
      available: false
    }
  ]

  const barExamPrep = [
    {
      id: 'mbe-practice',
      title: 'MBE Practice Tests',
      description: 'Multistate Bar Examination practice questions covering all MBE subjects.',
      keywords: 'mbe practice test, bar exam prep',
      subjects: '7 subjects',
      tests: '2000+ questions',
      searchVolume: '12,100',
      difficulty: 'High',
      color: 'from-indigo-700 to-indigo-900',
      available: false
    },
    {
      id: 'mpre-prep',
      title: 'MPRE Practice Tests',
      description: 'Multistate Professional Responsibility Examination prep with ethics scenarios.',
      keywords: 'mpre practice test, legal ethics quiz',
      subjects: 'Ethics rules',
      tests: '500+ questions',
      searchVolume: '8,900',
      difficulty: 'Medium',
      color: 'from-gray-700 to-gray-900',
      available: false
    },
    {
      id: 'mee-practice',
      title: 'MEE Practice Tests',
      description: 'Multistate Essay Examination practice with model answers and grading.',
      keywords: 'mee practice test, bar essay prep',
      subjects: '12+ topics',
      tests: '300+ essays',
      searchVolume: '3,200',
      difficulty: 'High',
      color: 'from-yellow-600 to-yellow-800',
      available: false
    },
    {
      id: 'state-bar-ca',
      title: 'California Bar Exam',
      description: 'California-specific bar exam preparation including state law distinctions.',
      keywords: 'california bar exam, ca bar prep',
      subjects: 'CA specific',
      tests: '800+ questions',
      searchVolume: '6,600',
      difficulty: 'High',
      color: 'from-red-700 to-red-900',
      available: false
    },
    {
      id: 'state-bar-ny',
      title: 'New York Bar Exam',
      description: 'New York bar exam preparation with state-specific law and procedures.',
      keywords: 'new york bar exam, ny bar prep',
      subjects: 'NY specific',
      tests: '700+ questions',
      searchVolume: '4,800',
      difficulty: 'High',
      color: 'from-blue-700 to-blue-900',
      available: false
    },
    {
      id: 'ube-prep',
      title: 'UBE Practice Tests',
      description: 'Uniform Bar Examination preparation for participating jurisdictions.',
      keywords: 'ube practice test, uniform bar exam',
      subjects: 'Uniform format',
      tests: '1200+ questions',
      searchVolume: '7,300',
      difficulty: 'High',
      color: 'from-emerald-700 to-emerald-900',
      available: false
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Header />
      
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-800 mb-6">
            Free Legal Practice Tests
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-4xl mx-auto">
            Master US law and international legal systems with our comprehensive practice tests. 
            Perfect for bar exam preparation, law school studies, and continuing legal education.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto text-sm">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-blue-600">20+</div>
              <div className="text-gray-600">Legal Subjects</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-green-600">50+</div>
              <div className="text-gray-600">Bar Exam Topics</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-purple-600">10K+</div>
              <div className="text-gray-600">Practice Questions</div>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="text-3xl font-bold text-red-600">100%</div>
              <div className="text-gray-600">Free Access</div>
            </div>
          </div>
        </div>

        {/* US Law Section */}
        <section className="mb-20">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">📚 US Law Practice Tests</h2>
              <p className="text-gray-600">Master core legal subjects tested on bar exams and law school courses</p>
            </div>
            <div className="bg-gray-300 text-gray-500 px-6 py-3 rounded-lg font-semibold cursor-not-allowed">
              Coming Soon
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {usLawTests.map((subject) => (
              <article 
                key={subject.id} 
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1 opacity-60"
              >
                <div className={`h-32 bg-gradient-to-r ${subject.color} flex items-center justify-center`}>
                  <div className="text-center text-white px-4">
                    <h3 className="text-lg font-bold mb-1">{subject.title}</h3>
                    <div className="text-xs opacity-90">{subject.searchVolume} searches/month</div>
                  </div>
                </div>
                
                <div className="p-6">
                  <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                    {subject.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-center">
                      {subject.articles}
                    </span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-center">
                      {subject.tests}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${
                      subject.difficulty === 'High' ? 'bg-red-500' : 
                      subject.difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}>
                      {subject.difficulty}
                    </span>
                    <span className="text-xs text-gray-500">#{subject.keywords.split(',')[0]}</span>
                  </div>

                  <div className="block w-full text-center bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold cursor-not-allowed text-sm">
                    Coming Soon
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Bar Exam Prep Section */}
        <section className="mb-16">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">🎯 Bar Exam Preparation</h2>
              <p className="text-gray-600">Comprehensive preparation for MBE, MPRE, MEE, and state-specific bar exams</p>
            </div>
            <div className="bg-gray-300 text-gray-500 px-6 py-3 rounded-lg font-semibold cursor-not-allowed">
              Coming Soon
            </div>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {barExamPrep.map((exam) => (
              <article 
                key={exam.id} 
                className="bg-white rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-all transform hover:-translate-y-1 opacity-60"
              >
                <div className={`h-32 bg-gradient-to-r ${exam.color} flex items-center justify-center`}>
                  <div className="text-center text-white px-4">
                    <h3 className="text-lg font-bold mb-1">{exam.title}</h3>
                    <div className="text-xs opacity-90">{exam.searchVolume} searches/month</div>
                  </div>
                </div>
                
                <div className="p-6">
                  <p className="text-gray-600 mb-4 text-sm leading-relaxed">
                    {exam.description}
                  </p>
                  
                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-center">
                      {exam.subjects}
                    </span>
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded text-center">
                      {exam.tests}
                    </span>
                  </div>

                  <div className="flex justify-between items-center mb-4">
                    <span className={`px-3 py-1 rounded-full text-white text-xs font-semibold ${
                      exam.difficulty === 'High' ? 'bg-red-500' : 
                      exam.difficulty === 'Medium' ? 'bg-yellow-500' : 'bg-green-500'
                    }`}>
                      {exam.difficulty}
                    </span>
                    <span className="text-xs text-gray-500">#{exam.keywords.split(',')[0]}</span>
                  </div>

                  <div className="block w-full text-center bg-gray-400 text-white px-4 py-3 rounded-lg font-semibold cursor-not-allowed text-sm">
                    Coming Soon
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* International Law Section */}
        <section className="mb-16">
          <div className="bg-gradient-to-r from-green-600 to-blue-600 rounded-xl shadow-xl p-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold mb-4">🌍 International Legal Systems</h2>
                <p className="text-green-100 mb-6 max-w-2xl">
                  Expand your legal knowledge with tests on Spanish, French, and other international legal systems. 
                  Perfect for comparative law studies and international practice.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link 
                    href="/es" 
                    className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition-colors font-semibold flex items-center"
                  >
                    🇪🇸 Spanish Law Tests →
                  </Link>
                  <div className="bg-gray-600 text-gray-300 px-6 py-3 rounded-lg font-semibold cursor-not-allowed flex items-center">
                    🇫🇷 French Law (Soon)
                  </div>
                </div>
              </div>
              <div className="hidden lg:block">
                <div className="text-right">
                  <div className="text-4xl font-bold">15+</div>
                  <div className="text-green-100">Countries</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="mb-16 bg-white rounded-xl shadow-lg p-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-8 text-center">
            Why Choose Our Legal Practice Platform?
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">📊</span>
              </div>
              <h3 className="font-bold text-gray-800 mb-3">Comprehensive Coverage</h3>
              <p className="text-gray-600 text-sm">
                All major legal subjects tested on bar exams, including MBE subjects, state law, and specialized areas.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">⚡</span>
              </div>
              <h3 className="font-bold text-gray-800 mb-3">Instant Feedback</h3>
              <p className="text-gray-600 text-sm">
                Get immediate explanations for every answer with detailed legal reasoning and case citations.
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">🎯</span>
              </div>
              <h3 className="font-bold text-gray-800 mb-3">Exam-Focused</h3>
              <p className="text-gray-600 text-sm">
                Questions designed to mirror actual bar exam format and difficulty level for effective preparation.
              </p>
            </div>
          </div>
        </section>

        {/* Newsletter CTA */}
        <section className="bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-xl p-8 text-white text-center">
          <h3 className="text-2xl font-bold mb-4">Stay Updated with New Practice Tests</h3>
          <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
            Get notified when we add new subjects, update questions, or release new bar exam prep materials.
          </p>
          <div className="text-gray-300">
            📧 Newsletter coming soon
          </div>
        </section>
      </div>
      
      <Footer />
    </div>
  )
}