// app/oposiciones/page.js - MEJORADO con tarjetas clickeables
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useOposicion } from '@/contexts/OposicionContext'

export default function OposicionesPage() {
  const { changeOposicion, oposicionMenu, hasOposicion } = useOposicion()
  const [selectedOposicion, setSelectedOposicion] = useState(null)

  // Datos de oposiciones disponibles - Actualizados BOE 22/12/2025
  const oposiciones = [
    {
      id: 'auxiliar-administrativo-estado',
      name: 'Auxiliar Administrativo del Estado',
      shortName: 'Aux. Administrativo',
      badge: 'C2',
      icon: '🏛️',
      color: 'emerald',
      description: 'Oposición para trabajar en la Administración General del Estado como Auxiliar Administrativo. Temario oficial publicado en BOE 22/12/2025.',
      category: 'Administración General',
      level: 'Grupo C, Subgrupo C2',
      temarios: 28,
      tests: 500,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BOE 2025 (28 temas)',
        'Tests por temas y bloques',
        'Simulacros de examen',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/auxiliar-administrativo-estado',
      boeUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26261'
    },
    {
      id: 'administrativo-estado',
      name: 'Administrativo del Estado',
      shortName: 'Administrativo',
      badge: 'C1',
      icon: '🏢',
      color: 'blue',
      description: 'Oposición de mayor nivel para la Administración General del Estado. Temario oficial publicado en BOE 22/12/2025.',
      category: 'Administración General',
      level: 'Grupo C, Subgrupo C1',
      temarios: 45,
      tests: 800,
      difficulty: 'Alto',
      duration: '12-18 meses',
      salary: '22.000€ - 28.000€',
      features: [
        'Temario oficial BOE 2025 (45 temas)',
        'Tests por temas y bloques',
        '6 bloques temáticos',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Bachiller o Técnico',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/administrativo-estado',
      boeUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-26262'
    },
    {
      id: 'tramitacion-procesal',
      name: 'Tramitación Procesal y Administrativa',
      shortName: 'Tramitación Procesal',
      badge: 'C1',
      icon: '⚖️',
      color: 'purple',
      description: 'Oposición para trabajar en la Administración de Justicia como funcionario del Cuerpo de Tramitación Procesal. Temario oficial publicado en BOE 30/12/2025.',
      category: 'Administración de Justicia',
      level: 'Grupo C, Subgrupo C1',
      temarios: 37,
      tests: 100,
      difficulty: 'Alto',
      duration: '12-18 meses',
      salary: '22.000€ - 28.000€',
      features: [
        'Temario oficial BOE 2025 (37 temas)',
        'Tests por temas y bloques',
        '3 bloques temáticos',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Bachiller o Técnico',
        'Nacionalidad española o UE',
        'Tener 18 años y no exceder edad jubilación'
      ],
      href: '/tramitacion-procesal',
      boeUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-27053'
    },
    {
      id: 'auxilio-judicial',
      name: 'Auxilio Judicial',
      shortName: 'Auxilio Judicial',
      badge: 'C2',
      icon: '⚖️',
      color: 'indigo',
      description: 'Oposicion para trabajar en la Administracion de Justicia como funcionario del Cuerpo de Auxilio Judicial. Temario oficial publicado en BOE 30/12/2025.',
      category: 'Administracion de Justicia',
      level: 'Grupo C, Subgrupo C2',
      temarios: 26,
      tests: 100,
      difficulty: 'Intermedio',
      duration: '9-15 meses',
      salary: '18.000 - 22.000',
      features: [
        'Temario oficial BOE 2025 (26 temas)',
        'Tests por temas y bloques',
        '3 bloques tematicos',
        'Seguimiento de progreso',
        'Estadisticas detalladas'
      ],
      requirements: [
        'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Tener 16 anos y no exceder edad jubilacion'
      ],
      href: '/auxilio-judicial',
      boeUrl: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2025-27053'
    },
    {
      id: 'auxiliar-administrativo-carm',
      name: 'Auxiliar Administrativo CARM (Murcia)',
      shortName: 'Aux. Admin. CARM',
      badge: 'C2',
      icon: '🏛️',
      color: 'amber',
      description: 'Oposición para trabajar en la Comunidad Autónoma de la Región de Murcia como Auxiliar Administrativo. 58 plazas. Temario según BORM 17/10/2016.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 16,
      tests: 100,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BORM 2016 (16 temas)',
        'Tests por temas y bloques',
        '2 bloques temáticos',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/auxiliar-administrativo-carm',
    },
    {
      id: 'auxiliar-administrativo-cyl',
      name: 'Auxiliar Administrativo de Castilla y León',
      shortName: 'Aux. Admin. CyL',
      badge: 'C2',
      icon: '🏛️',
      color: 'rose',
      description: 'Oposición para trabajar en la Junta de Castilla y León como Auxiliar Administrativo. 362 plazas convocadas en BOCYL 13/01/2026. Temario oficial con 28 temas.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 28,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BOCYL 2026 (28 temas)',
        'Tests por temas y bloques',
        '2 grupos temáticos',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/auxiliar-administrativo-cyl',
    },
    {
      id: 'auxiliar-administrativo-andalucia',
      name: 'Auxiliar Administrativo Junta de Andalucía',
      shortName: 'Aux. Admin. Andalucía',
      badge: 'C2',
      icon: '🏛️',
      color: 'teal',
      description: 'Oposición para trabajar en la Junta de Andalucía como Auxiliar Administrativo. Temario oficial según BOJA junio 2024 (IAAP). 22 temas en 2 bloques.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 22,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BOJA 2024 (22 temas)',
        'Tests por temas y bloques',
        '2 bloques temáticos',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/auxiliar-administrativo-andalucia',
    },
    {
      id: 'auxiliar-administrativo-madrid',
      name: 'Auxiliar Administrativo Comunidad de Madrid',
      shortName: 'Aux. Admin. Madrid',
      badge: 'C2',
      icon: '🏛️',
      color: 'red',
      description: 'Oposición para trabajar en la Comunidad de Madrid como Auxiliar Administrativo. 645 plazas previstas. Examen octubre 2026. 21 temas en 2 bloques.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 21,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial 2026 (21 temas)',
        'Tests por temas y bloques',
        '2 bloques temáticos',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/auxiliar-administrativo-madrid',
    },
    {
      id: 'auxiliar-administrativo-canarias',
      name: 'Auxiliar Administrativo Gobierno de Canarias',
      shortName: 'Aux. Admin. Canarias',
      badge: 'C2',
      icon: '🏛️',
      color: 'amber',
      description: 'Oposición para trabajar en el Gobierno de Canarias como Auxiliar Administrativo. 299 plazas convocadas. OEP 2021 turno libre. 40 temas en 2 bloques.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 40,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BOC 2024 (40 temas)',
        'Tests por temas y bloques',
        '2 bloques temáticos',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/auxiliar-administrativo-canarias',
    },
    {
      id: 'auxiliar-administrativo-clm',
      name: 'Auxiliar Administrativo Junta de Castilla-La Mancha',
      shortName: 'Aux. Admin. CLM',
      badge: 'C2',
      icon: '🏰',
      color: 'orange',
      description: 'Oposición para trabajar en la Junta de Comunidades de Castilla-La Mancha como Auxiliar Administrativo. 249 plazas convocadas. DOCM 18/12/2024. 24 temas en 2 bloques.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 24,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial DOCM 2024 (24 temas)',
        'Tests por temas y bloques',
        'Organización Administrativa + Ofimática',
        'Seguimiento de progreso',
        'Estadísticas detalladas'
      ],
      requirements: [
        'Título de Graduado en ESO o equivalente',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/auxiliar-administrativo-clm',
    },
    {
      id: 'auxiliar-administrativo-extremadura',
      name: 'Auxiliar Administrativo Junta de Extremadura',
      shortName: 'Aux. Admin. Extremadura',
      badge: 'C2',
      icon: '🌿',
      color: 'teal',
      description: 'Oposicion para trabajar en la Junta de Extremadura como Auxiliar Administrativo del Cuerpo Auxiliar. 146 plazas convocadas. DOE 27/12/2024. 25 temas en 2 bloques.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 25,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial DOE 2024 (25 temas)',
        'Tests por temas y bloques',
        'Empleo Publico + Derecho Administrativo y Ofimatica',
        'Seguimiento de progreso',
        'Estadisticas detalladas'
      ],
      requirements: [
        'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Tener 16 anos y no exceder edad jubilacion'
      ],
      href: '/auxiliar-administrativo-extremadura',
    },
    {
      id: 'auxiliar-administrativo-valencia',
      name: 'Auxiliar Administrativo Generalitat Valenciana',
      shortName: 'Aux. Admin. Valencia',
      badge: 'C2',
      icon: '🍊',
      color: 'red',
      description: 'Oposicion para trabajar en la Generalitat Valenciana como Auxiliar Administrativo. 245 plazas OPE 2026 turno libre. 24 temas en 2 bloques.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 24,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial DOGV (24 temas)',
        'Tests por temas y bloques',
        'Materias Comunes + Materias Especificas',
        'Seguimiento de progreso',
        'Estadisticas detalladas'
      ],
      requirements: [
        'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Tener 16 anos y no exceder edad jubilacion'
      ],
      href: '/auxiliar-administrativo-valencia',
    },
    {
      id: 'auxiliar-administrativo-galicia',
      name: 'Auxiliar Administrativo Xunta de Galicia',
      shortName: 'Aux. Admin. Galicia',
      badge: 'C2',
      icon: '🐚',
      color: 'sky',
      description: 'Oposicion para trabajar en la Xunta de Galicia como Auxiliar Administrativo. 83 plazas (OEP 2022+2024). 17 temas en 2 partes. Primer ejercicio previsto septiembre 2026.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 17,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial DOG 2022 (17 temas)',
        'Tests por temas y bloques',
        'Parte General + Parte Especifica',
        'Seguimiento de progreso',
        'Estadisticas detalladas'
      ],
      requirements: [
        'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Tener 16 anos y no exceder edad jubilacion'
      ],
      href: '/auxiliar-administrativo-galicia',
    },
    {
      id: 'auxiliar-administrativo-aragon',
      name: 'Auxiliar Administrativo de Aragón',
      shortName: 'Aux. Admin. Aragón',
      badge: 'C2',
      icon: '🏔️',
      color: 'yellow',
      description: 'Oposicion para trabajar en la Diputacion General de Aragon como Auxiliar Administrativo. 28 plazas (OPE 2023-2025, BOA 23/12/2025). 20 temas en 2 bloques. Examenes previstos 2026.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 20,
      tests: 0,
      difficulty: 'Intermedio',
      duration: '6-12 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BOA diciembre 2025 (20 temas)',
        'Tests por temas y bloques',
        'Materias Comunes + Materias Especificas',
        'Seguimiento de progreso',
        'Estadisticas detalladas'
      ],
      requirements: [
        'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Tener 16 anos y no exceder edad jubilacion'
      ],
      href: '/auxiliar-administrativo-aragon',
    },
    {
      id: 'auxiliar-administrativo-asturias',
      name: 'Auxiliar Administrativo del Principado de Asturias',
      shortName: 'Aux. Admin. Asturias',
      badge: 'C2',
      icon: '⛰️',
      color: 'indigo',
      description: 'Oposicion para trabajar en el Principado de Asturias como Auxiliar Administrativo. 7 plazas OPE 2025. 25 temas en 3 bloques. Concurso-oposicion.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 25,
      tests: 0,
      difficulty: 'Intermedio-Alto',
      duration: '8-14 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BOPA (25 temas)',
        'Tests por temas y bloques',
        'Derecho Constitucional + Administrativo + Ofimatica',
        'Seguimiento de progreso',
        'Estadisticas detalladas'
      ],
      requirements: [
        'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Tener 16 anos y no exceder edad jubilacion'
      ],
      href: '/auxiliar-administrativo-asturias',
    },
    {
      id: 'auxiliar-administrativo-baleares',
      name: 'Auxiliar Administrativo de la CAIB',
      shortName: 'Aux. Admin. Baleares',
      badge: 'C2',
      icon: '🏝️',
      color: 'cyan',
      description: 'Oposicion para trabajar en la Comunitat Autonoma de les Illes Balears como Auxiliar Administrativo. 128 plazas OPE 2022-2024. 36 temas en 2 bloques. Requisito catalan B2.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C2',
      temarios: 36,
      tests: 0,
      difficulty: 'Intermedio-Alto',
      duration: '10-16 meses',
      salary: '18.000€ - 22.000€',
      features: [
        'Temario oficial BOIB (36 temas)',
        'Tests por temas y bloques',
        'Materias Comunes + Ofimatica',
        'Seguimiento de progreso',
        'Estadisticas detalladas'
      ],
      requirements: [
        'Titulo de Graduado en ESO o equivalente',
        'Nacionalidad espanola o UE',
        'Certificado catalan B2',
        'Tener 16 anos y no exceder edad jubilacion'
      ],
      href: '/auxiliar-administrativo-baleares',
    },
    {
      id: 'administrativo-castilla-leon',
      name: 'Administrativo Junta de Castilla y León',
      shortName: 'Administrativo CyL',
      badge: 'C1',
      icon: '🦁',
      color: 'purple',
      description: 'Oposición para trabajar en la Junta de Castilla y León como funcionario del Cuerpo Administrativo. 191 plazas convocadas en BOCYL 08/10/2024.',
      category: 'Comunidades Autónomas',
      level: 'Grupo C, Subgrupo C1',
      temarios: 41,
      tests: 0,
      difficulty: 'Alto',
      duration: '12-18 meses',
      salary: '22.000€ - 28.000€',
      comingSoon: true,
      features: [
        'Temario oficial BOCYL 2024 (41 temas)',
        '5 grupos temáticos',
        'Examen 100 preguntas test',
        'Próximamente con tests',
        'Próximamente con estadísticas'
      ],
      requirements: [
        'Título de Bachiller o Técnico',
        'Nacionalidad española o UE',
        'Tener 16 años y no exceder edad jubilación'
      ],
      href: '/administrativo-castilla-leon',
      boeUrl: 'https://bocyl.jcyl.es/boletines/2024/10/08/pdf/BOCYL-D-08102024-4.pdf'
    }
  ]

  // Detectar oposición actual al cargar
  useEffect(() => {
    if (hasOposicion && oposicionMenu) {
      setSelectedOposicion(oposiciones.find(op => op.id === 'auxiliar-administrativo-estado'))
    }
  }, [hasOposicion, oposicionMenu])

  // 🆕 Manejar click en tarjeta - ir directamente a la oposición
  const handleCardClick = async (oposicion, event) => {
    // Evitar que se active si se hace click en enlaces/botones
    if (event.target.tagName === 'A' || event.target.tagName === 'BUTTON' || event.target.closest('a, button')) {
      return
    }

    // Convertir id con guiones a underscores (formato BD)
    const oposicionDbId = oposicion.id.replace(/-/g, '_')
    await changeOposicion(oposicionDbId)

    // Para oposiciones "comingSoon", ir al temario
    // Para las demás, ir a la página principal
    window.location.href = oposicion.comingSoon
      ? `${oposicion.href}/temario`
      : oposicion.href
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-950 text-white">
        <div className="container mx-auto px-4 py-10">
          <div className="text-center">
            <span className="text-4xl">🏛️</span>
            <h1 className="text-3xl md:text-4xl font-bold mt-3 mb-2">
              Oposiciones Disponibles
            </h1>
            <p className="text-lg text-blue-100 mb-4">
              Elige tu oposición y empieza a hacer tests. Así de fácil.
            </p>
            <div className="flex items-center justify-center gap-4 text-blue-100 text-sm">
              <span className="flex items-center gap-1">
                <span className="text-green-400">✓</span> Preguntas ilimitadas
              </span>
              <span className="flex items-center gap-1">
                <span className="text-green-400">✓</span> Seguimiento detallado
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <div className="container mx-auto px-4 py-12">
        
        {/* Oposición actual */}
        {hasOposicion && selectedOposicion && (
          <div className="mb-12">
            <div className="bg-gradient-to-r from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl p-6">
              <div className="flex items-center space-x-4 mb-4">
                <span className="text-3xl">{selectedOposicion.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-emerald-800">
                    🎯 Estudiando actualmente
                  </h2>
                  <p className="text-emerald-600">{selectedOposicion.name}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link 
                  href={`${selectedOposicion.href}/temario`}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors"
                >
                  <span>📚</span>
                  <span>Ir al Temario</span>
                </Link>
                <Link 
                  href={`${selectedOposicion.href}/test`}
                  className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  <span>🎯</span>
                  <span>Hacer Tests</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Grid de Oposiciones */}
        <div className="grid gap-8 max-w-4xl mx-auto">
          {oposiciones.map((oposicion) => (
            <div 
              key={oposicion.id}
              onClick={(e) => handleCardClick(oposicion, e)}
              className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border-2 cursor-pointer group border-gray-200 hover:border-blue-300 hover:shadow-blue-100"
            >
              {/* Header */}
              <div className={`${oposicion.comingSoon ? 'bg-gradient-to-r from-amber-600 to-amber-700' : 'bg-gradient-to-r from-slate-700 to-slate-800'} text-white p-6 relative overflow-hidden`}>

                {/* Badge Próximamente */}
                {oposicion.comingSoon && (
                  <div className="absolute top-4 right-4 bg-white/20 px-3 py-1 rounded-full text-xs font-medium">
                    Próximamente
                  </div>
                )}

                {/* Efecto hover en header */}
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

                <div className="flex items-start justify-between relative z-10">
                  <div className="flex items-center space-x-4">
                    <span className="text-4xl transform group-hover:scale-110 transition-transform duration-300">
                      {oposicion.icon}
                    </span>
                    <div>
                      <h3 className="text-2xl font-bold mb-2">{oposicion.name}</h3>
                      <div className="flex items-center space-x-4 text-sm opacity-90">
                        <span className="bg-white/20 px-3 py-1 rounded-full">
                          {oposicion.badge}
                        </span>
                        <span>{oposicion.level}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-6">
                <p className="text-gray-600 mb-6 text-lg leading-relaxed">
                  {oposicion.description}
                </p>

                {/* Estadísticas */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                    <div className="text-2xl font-bold text-slate-700">{oposicion.temarios}</div>
                    <div className="text-sm text-slate-600">Temas</div>
                  </div>
                  <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                    <div className="text-2xl font-bold text-slate-700">{oposicion.tests}+</div>
                    <div className="text-sm text-slate-600">Tests</div>
                  </div>
                  <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                    <div className="text-lg font-bold text-slate-700">{oposicion.difficulty}</div>
                    <div className="text-sm text-slate-600">Dificultad</div>
                  </div>
                  <div className="text-center p-3 bg-slate-100 rounded-lg group-hover:bg-slate-200 transition-colors">
                    <div className="text-lg font-bold text-slate-700">{oposicion.duration}</div>
                    <div className="text-sm text-slate-600">Duración</div>
                  </div>
                </div>

                {/* Características */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">✨</span>
                    Características incluidas
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {oposicion.features.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2 text-gray-600">
                        <span className="text-emerald-500">✓</span>
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Requisitos */}
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">📋</span>
                    Requisitos básicos
                  </h4>
                  <div className="space-y-2">
                    {oposicion.requirements.map((req, index) => (
                      <div key={index} className="flex items-start space-x-2 text-gray-600">
                        <span className="text-blue-500 mt-1">•</span>
                        <span className="text-sm">{req}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex flex-col sm:flex-row gap-3 relative z-10">
                  <Link
                    href={`${oposicion.href}/temario`}
                    className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <span>📚</span>
                    <span>Ver Temario</span>
                  </Link>
                  {oposicion.comingSoon ? (
                    <div
                      className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-amber-100 text-amber-700 rounded-lg font-semibold cursor-not-allowed"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>🕐</span>
                      <span>Tests próximamente</span>
                    </div>
                  ) : (
                    <Link
                      href={`${oposicion.href}/test`}
                      className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-slate-700 hover:bg-slate-800 text-white rounded-lg font-semibold transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>🎯</span>
                      <span>Hacer Tests</span>
                    </Link>
                  )}
                </div>

                {/* Enlace BOE */}
                {oposicion.boeUrl && (
                  <div className="mt-4 text-center">
                    <a
                      href={oposicion.boeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span>📄</span>
                      <span>Ver convocatoria en BOE</span>
                      <span>↗</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon */}
        <div className="mt-16 text-center">
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-8 max-w-2xl mx-auto">
            <h3 className="text-xl font-bold text-slate-700 mb-3">
              Próximamente más oposiciones
            </h3>
            <p className="text-slate-600 mb-4 text-sm">
              Estamos trabajando para añadir más oposiciones a nuestra plataforma.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
              <span>Gestion Procesal</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}