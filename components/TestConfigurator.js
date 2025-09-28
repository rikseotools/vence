// components/TestConfigurator.js - CON FILTRO DE PREGUNTAS OFICIALES POR TEMA CORREGIDO
'use client'
import React, { useState, useEffect, useMemo } from 'react';
import { getSupabaseClient } from '../lib/supabase';

const TestConfigurator = ({ 
  tema = 7,
  totalQuestions = 100, 
  onStartTest,
  userStats = null,
  loading = false,
  currentUser = null
}) => {
  const supabase = getSupabaseClient();

  // Estados de configuración
  const [selectedQuestions, setSelectedQuestions] = useState(25);
  const [showPrioritizationModal, setShowPrioritizationModal] = useState(false);
  const [showEssentialArticlesModal, setShowEssentialArticlesModal] = useState(false);
  const [showOfficialQuestionsModal, setShowOfficialQuestionsModal] = useState(false);
  const [showEssentialArticlesInfoModal, setShowEssentialArticlesInfoModal] = useState(false);
  
  // Estados de dificultad
  const [difficultyMode, setDifficultyMode] = useState('random');
  
  // Estados adicionales
  const [onlyOfficialQuestions, setOnlyOfficialQuestions] = useState(false);
  const [focusEssentialArticles, setFocusEssentialArticles] = useState(false);
  const [adaptiveMode, setAdaptiveMode] = useState(true); // ✨ Activado por defecto


  // Estados para preguntas oficiales
  const [officialQuestionsCount, setOfficialQuestionsCount] = useState(0);
  const [loadingOfficialCount, setLoadingOfficialCount] = useState(false);

  // Estados para artículos imprescindibles
  const [essentialArticlesCount, setEssentialArticlesCount] = useState(0);
  const [loadingEssentialCount, setLoadingEssentialCount] = useState(false);
  const [essentialArticlesList, setEssentialArticlesList] = useState([]);
  const [essentialQuestionsCount, setEssentialQuestionsCount] = useState(0);
  const [essentialQuestionsByDifficulty, setEssentialQuestionsByDifficulty] = useState({});

  // Cargar conteo de preguntas oficiales POR TEMA
  const loadOfficialCount = async () => {
    if (!supabase) return;
    
    setLoadingOfficialCount(true);
    try {
      console.log(`🏛️ Cargando preguntas oficiales para tema ${tema}...`);
      
      // 1️⃣ OBTENER MAPEO DEL TEMA DESDE TOPIC_SCOPE (patrón multi-ley)
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', tema)
        .eq('topics.position_type', 'auxiliar_administrativo');

      if (mappingError) {
        console.error('❌ Error obteniendo mapeo del tema:', mappingError);
        setOfficialQuestionsCount(0);
        return;
      }

      if (!mappings || mappings.length === 0) {
        console.warn(`⚠️ No se encontró mapeo para tema ${tema}`);
        setOfficialQuestionsCount(0);
        return;
      }

      console.log(`📋 Mapeo encontrado para tema ${tema}:`, mappings);

      // 2️⃣ PARA CADA LEY MAPEADA, CONTAR PREGUNTAS OFICIALES POR SEPARADO
      let totalOfficialCount = 0;

      for (const mapping of mappings) {
        console.log(`🔍 Contando oficiales de ${mapping.laws.short_name}, artículos:`, mapping.article_numbers);
        
        // 🔧 CONSULTA CORREGIDA: Incluir articles en select para poder filtrar por ellos
        const { count, error: countError } = await supabase
          .from('questions')
          .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('is_official_exam', true)
          .eq('articles.laws.short_name', mapping.laws.short_name)
          .in('articles.article_number', mapping.article_numbers);

        if (countError) {
          console.error(`❌ Error contando oficiales de ${mapping.laws.short_name}:`, countError);
          continue;
        }

        console.log(`✅ ${mapping.laws.short_name}: ${count || 0} preguntas oficiales`);
        totalOfficialCount += (count || 0);
      }

      console.log(`🏛️ Total preguntas oficiales tema ${tema}: ${totalOfficialCount}`);
      setOfficialQuestionsCount(totalOfficialCount);

    } catch (error) {
      console.error('❌ Error general cargando preguntas oficiales:', error);
      setOfficialQuestionsCount(0);
    } finally {
      setLoadingOfficialCount(false);
    }
  };


  // Cargar conteo de artículos imprescindibles POR TEMA
  const loadEssentialArticlesCount = async () => {
    if (!supabase) return;
    
    setLoadingEssentialCount(true);
    try {
      console.log(`⭐ Cargando artículos imprescindibles para tema ${tema}...`);
      
      // 1️⃣ OBTENER MAPEO DEL TEMA DESDE TOPIC_SCOPE
      const { data: mappings, error: mappingError } = await supabase
        .from('topic_scope')
        .select(`
          article_numbers,
          laws!inner(short_name, id),
          topics!inner(topic_number, position_type)
        `)
        .eq('topics.topic_number', tema)
        .eq('topics.position_type', 'auxiliar_administrativo');

      if (mappingError) {
        console.error('❌ Error obteniendo mapeo del tema:', mappingError);
        setEssentialArticlesCount(0);
        return;
      }

      if (!mappings || mappings.length === 0) {
        console.warn(`⚠️ No se encontró mapeo para tema ${tema}`);
        setEssentialArticlesCount(0);
        return;
      }

      console.log(`📋 Mapeo encontrado para tema ${tema}:`, mappings);

      // 2️⃣ PARA CADA LEY MAPEADA, CONTAR ARTÍCULOS IMPRESCINDIBLES Y SUS PREGUNTAS
      // Un artículo es "imprescindible" si tiene al menos 1 pregunta oficial
      let totalEssentialCount = 0;
      let essentialArticles = [];
      let totalEssentialQuestions = 0;

      for (const mapping of mappings) {
        console.log(`🔍 Contando artículos imprescindibles de ${mapping.laws.short_name}, artículos:`, mapping.article_numbers);
        
        // Para cada artículo, contar cuántas preguntas oficiales tiene
        for (const articleNumber of mapping.article_numbers) {
          const { count, error: countError } = await supabase
            .from('questions')
            .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('is_official_exam', true)
            .eq('articles.laws.short_name', mapping.laws.short_name)
            .eq('articles.article_number', articleNumber);

          if (countError) {
            console.error(`❌ Error contando preguntas del artículo ${articleNumber}:`, countError);
            continue;
          }

          // Si el artículo tiene 1 o más preguntas oficiales, es "imprescindible"
          if (count >= 1) {
            totalEssentialCount++;
            essentialArticles.push({
              number: articleNumber,
              law: mapping.laws.short_name,
              questionsCount: count
            });
            console.log(`⭐ Artículo ${articleNumber} de ${mapping.laws.short_name} es imprescindible (${count} preguntas oficiales)`);
          }
        }
      }

      // 3️⃣ CONTAR TOTAL DE PREGUNTAS DE ARTÍCULOS IMPRESCINDIBLES POR DIFICULTAD
      const difficultyBreakdown = {};
      
      for (const article of essentialArticles) {
        // Contar total de preguntas de este artículo
        const { count: totalQuestionsCount, error: totalCountError } = await supabase
          .from('questions')
          .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('articles.laws.short_name', article.law)
          .eq('articles.article_number', article.number);

        if (!totalCountError && totalQuestionsCount > 0) {
          totalEssentialQuestions += totalQuestionsCount;
        }
        
        // 🔥 NUEVO: Contar por dificultad para este artículo
        const difficulties = ['easy', 'medium', 'hard', 'extreme'];
        for (const difficulty of difficulties) {
          const { count: difficultyCount, error: diffError } = await supabase
            .from('questions')
            .select('id, articles!inner(laws!inner(short_name))', { count: 'exact', head: true })
            .eq('is_active', true)
            .eq('difficulty', difficulty)
            .eq('articles.laws.short_name', article.law)
            .eq('articles.article_number', article.number);

          if (!diffError && difficultyCount > 0) {
            difficultyBreakdown[difficulty] = (difficultyBreakdown[difficulty] || 0) + difficultyCount;
          }
        }
      }
      
      console.log(`📊 Distribución por dificultad de artículos imprescindibles tema ${tema}:`, difficultyBreakdown);

      console.log(`⭐ Total artículos imprescindibles tema ${tema}: ${totalEssentialCount}`);
      console.log(`📋 Total preguntas de artículos imprescindibles tema ${tema}: ${totalEssentialQuestions}`);
      setEssentialArticlesCount(totalEssentialCount);
      setEssentialArticlesList(essentialArticles);
      setEssentialQuestionsCount(totalEssentialQuestions);
      setEssentialQuestionsByDifficulty(difficultyBreakdown);

    } catch (error) {
      console.error('❌ Error general cargando artículos imprescindibles:', error);
      setEssentialArticlesCount(0);
      setEssentialArticlesList([]);
      setEssentialQuestionsCount(0);
      setEssentialQuestionsByDifficulty({});
    } finally {
      setLoadingEssentialCount(false);
    }
  };

  // Función para manejar el cambio de artículos imprescindibles
  const handleEssentialArticlesChange = (checked) => {
    setFocusEssentialArticles(checked);
    
    // 🔄 Si se activa, desactivar preguntas oficiales
    if (checked && onlyOfficialQuestions) {
      setOnlyOfficialQuestions(false);
      console.log('🔄 Desactivando preguntas oficiales al activar artículos imprescindibles');
    }
    
    // Solo cargar el conteo si se activa y aún no se ha cargado
    if (checked && essentialArticlesCount === 0 && !loadingEssentialCount) {
      loadEssentialArticlesCount();
    }
  };

  // Función para manejar la apertura del modal de info
  const handleEssentialArticlesInfo = () => {
    // Cargar el conteo si aún no se ha cargado
    if (essentialArticlesCount === 0 && !loadingEssentialCount) {
      loadEssentialArticlesCount();
    }
    setShowEssentialArticlesModal(true);
  };

  // 🔧 EFECTO: Cargar conteo de preguntas oficiales cuando cambia el tema
  useEffect(() => {
    loadOfficialCount();
  }, [supabase, tema]); // ✅ DEPENDENCIA DE 'tema' AÑADIDA


  // Estados y funciones existentes...

  const baseQuestionCount = useMemo(() => {
    // 🔥 PRIORIDAD 1: Artículos imprescindibles (si está activado)
    if (focusEssentialArticles) {
      // Si hay filtro de dificultad específico, usar ese conteo
      if (difficultyMode !== 'random' && essentialQuestionsByDifficulty[difficultyMode]) {
        console.log(`📊 Usando ${essentialQuestionsByDifficulty[difficultyMode]} preguntas de artículos imprescindibles con dificultad "${difficultyMode}"`);
        return essentialQuestionsByDifficulty[difficultyMode];
      }
      // Si no, usar el total
      return essentialQuestionsCount;
    }
    
    // 🔥 PRIORIDAD 2: Solo preguntas oficiales
    if (onlyOfficialQuestions) {
      return officialQuestionsCount;
    }
    
    // 🎯 CALCULAR SEGÚN TIPO DE DATOS
    if (typeof totalQuestions === 'object' && totalQuestions !== null) {
      // Si totalQuestions es un objeto con stats por dificultad
      if (difficultyMode !== 'random') {
        // Filtro específico de dificultad
        switch (difficultyMode) {
          case 'easy': return totalQuestions.easy || 0;
          case 'medium': return totalQuestions.medium || 0;
          case 'hard': return totalQuestions.hard || 0;
          case 'extreme': return totalQuestions.extreme || 0;
          default: return Object.values(totalQuestions).reduce((sum, count) => sum + count, 0);
        }
      } else {
        // Modo random: sumar todas las dificultades
        return Object.values(totalQuestions).reduce((sum, count) => sum + count, 0);
      }
    }
    
    // Fallback: usar el total como número (para casos legacy)
    return typeof totalQuestions === 'number' ? totalQuestions : 0;
  }, [focusEssentialArticles, essentialQuestionsCount, essentialQuestionsByDifficulty, difficultyMode, onlyOfficialQuestions, officialQuestionsCount, totalQuestions]);

  const availableQuestions = useMemo(() => {
    return baseQuestionCount;
  }, [baseQuestionCount]);

  const maxQuestions = useMemo(() => {
    return Math.min(selectedQuestions, availableQuestions);
  }, [selectedQuestions, availableQuestions]);

  // Funciones existentes (getDifficulty* eliminadas)...


  useEffect(() => {
    if (selectedQuestions > availableQuestions && availableQuestions > 0) {
      setSelectedQuestions(Math.min(selectedQuestions, availableQuestions));
    }
  }, [availableQuestions, selectedQuestions]);

  useEffect(() => {
    if (onlyOfficialQuestions && selectedQuestions > officialQuestionsCount) {
      setSelectedQuestions(Math.min(25, officialQuestionsCount));
    }
  }, [onlyOfficialQuestions, officialQuestionsCount, selectedQuestions]);

  const handleStartTest = () => {
    // Validación básica antes de continuar
    if (maxQuestions <= 0) {
      console.error('❌ No hay preguntas disponibles para el test')
      return
    }

    // Validación de artículos imprescindibles si está activado
    if (focusEssentialArticles) {
      console.log('⭐ Enfoque en artículos imprescindibles activado')
    }

    // Construir configuración completa
    const config = {
      tema: tema,
      numQuestions: maxQuestions,
      intelligentPrioritization: true, // 🆕 Nueva función de priorización
      difficultyMode: difficultyMode,
      // customDifficulty eliminado
      onlyOfficialQuestions: onlyOfficialQuestions,
      focusEssentialArticles: focusEssentialArticles,
      excludeRecent: false, // Por defecto no excluir preguntas recientes
      recentDays: 30, // Valor por defecto para días recientes
      focusWeakAreas: false, // Por defecto no enfocar en áreas débiles
      adaptiveMode: adaptiveMode, // ✨ Incluir modo adaptativo
      // 🆕 INCLUIR METADATOS ADICIONALES
      timeLimit: null, // Por si se añade límite de tiempo en el futuro
      configSource: 'test_configurator',
      configTimestamp: new Date().toISOString()
    }

    console.log('🎛️ Configuración final del test:', config)

    // Validaciones adicionales
    if (focusEssentialArticles) {
      console.log('⭐ Artículos imprescindibles incluidos en configuración')
    }

    if (onlyOfficialQuestions && officialQuestionsCount === 0) {
      console.warn('⚠️ Solo preguntas oficiales activado pero no hay preguntas oficiales disponibles')
      // El TestPageWrapper manejará este error
    }

    try {
      // ✅ Pasar configuración al componente padre
      onStartTest(config)
      console.log('✅ Configuración enviada al componente padre')
      
    } catch (error) {
      console.error('❌ Error enviando configuración:', error)
      alert('Error al iniciar el test. Por favor, inténtalo de nuevo.')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border-2 border-blue-200 p-6">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center space-x-3 mb-3">
            <div className="text-2xl">
              📝
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-lg sm:text-xl">Test Personalizado</h3>
            </div>
          </div>
        </div>

        {/* 1. Número de Preguntas */}
        <div className="mb-6">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            📝 Número de preguntas: <span className="text-blue-600">{maxQuestions}</span>
            {onlyOfficialQuestions && (
              <span className="ml-2 text-red-600 text-xs">🏛️ Solo oficiales</span>
            )}
          </label>
          <div className="grid grid-cols-4 gap-2 mb-2">
            {[10, 25, 50, 100].map((num) => (
              <button
                key={num}
                onClick={() => setSelectedQuestions(num)}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                  selectedQuestions === num
                    ? 'bg-blue-600 text-white shadow-lg scale-105'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } ${num > availableQuestions ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={num > availableQuestions}
              >
                {num > availableQuestions ? `${num}*` : num}
              </button>
            ))}
          </div>
          {selectedQuestions > availableQuestions && (
            <p className="text-xs text-orange-600 mt-1">
              * Solo hay {availableQuestions} preguntas {onlyOfficialQuestions ? 'oficiales' : ''} disponibles
            </p>
          )}
        </div>

        {/* 2. Configuración de Dificultad */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 mb-3">
            <label className={`text-sm font-bold ${
              onlyOfficialQuestions ? 'text-gray-400' : 'text-gray-700'
            }`}>
              🎯 Dificultad del Test
              {onlyOfficialQuestions && (
                <span className="text-xs text-gray-500 ml-2">(deshabilitado con preguntas oficiales)</span>
              )}
            </label>
            <button
              className={`w-5 h-5 rounded-full flex items-center justify-center text-sm transition-colors ${
                onlyOfficialQuestions 
                  ? 'text-gray-300 cursor-not-allowed' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
              onClick={() => !onlyOfficialQuestions && setShowPrioritizationModal(true)}
              disabled={onlyOfficialQuestions}
            >
              ℹ️
            </button>
          </div>
          
          <div className="grid grid-cols-4 gap-2 mb-4">
            <button
              onClick={() => !onlyOfficialQuestions && setDifficultyMode('random')}
              disabled={onlyOfficialQuestions}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                onlyOfficialQuestions
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                  : difficultyMode === 'random'
                  ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🎲 Aleatoria
            </button>
            <button
              onClick={() => !onlyOfficialQuestions && setDifficultyMode('easy')}
              disabled={onlyOfficialQuestions}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                onlyOfficialQuestions
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                  : difficultyMode === 'easy'
                  ? 'bg-gradient-to-r from-green-400 to-green-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🟢 Fácil
            </button>
            <button
              onClick={() => !onlyOfficialQuestions && setDifficultyMode('medium')}
              disabled={onlyOfficialQuestions}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                onlyOfficialQuestions
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                  : difficultyMode === 'medium'
                  ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🟡 Medio
            </button>
            <button
              onClick={() => !onlyOfficialQuestions && setDifficultyMode('hard')}
              disabled={onlyOfficialQuestions}
              className={`py-2 px-2 rounded-lg text-xs font-medium transition-all ${
                onlyOfficialQuestions
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed opacity-50'
                  : difficultyMode === 'hard'
                  ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white shadow-lg'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              🟠 Difícil
            </button>
          </div>


        </div>

        {/* 3. Configuraciones Avanzadas */}
        <div className="mb-6">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
            
            {/* Solo preguntas oficiales - CON CONTEO CORREGIDO POR TEMA */}
            <div>
              <label className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={onlyOfficialQuestions}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setOnlyOfficialQuestions(checked);
                      
                      // 🔄 Si se activa, desactivar artículos imprescindibles
                      if (checked && focusEssentialArticles) {
                        setFocusEssentialArticles(false);
                        console.log('🔄 Desactivando artículos imprescindibles al activar preguntas oficiales');
                      }
                      
                      // 🎯 Si se activa, resetear dificultad a aleatoria (preguntas oficiales tienen su dificultad natural)
                      if (checked && difficultyMode !== 'random') {
                        setDifficultyMode('random');
                        console.log('🎯 Reseteando dificultad a aleatoria para preguntas oficiales');
                      }
                    }}
                    disabled={focusEssentialArticles}
                    className={`rounded border-gray-300 text-red-600 focus:ring-red-500 ${
                      focusEssentialArticles ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  />
                  <span className={`text-sm font-medium ${
                    focusEssentialArticles ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    🏛️ Preguntas oficiales 
                    {loadingOfficialCount ? (
                      <span className="text-xs text-gray-500 ml-1">(cargando...)</span>
                    ) : (
                      <span className="text-xs text-red-600 ml-1">
                        ({officialQuestionsCount})
                      </span>
                    )}
                  </span>
                  <button
                    className="w-5 h-5 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center text-sm transition-colors"
                    onClick={() => setShowOfficialQuestionsModal(true)}
                  >
                    ℹ️
                  </button>
                </div>
              </label>

              {/* 🚨 AVISOS INTELIGENTES CUANDO ESTÁN ACTIVADAS */}
              {onlyOfficialQuestions && (
                <div className="mt-3 space-y-2">
                  

                  {/* ✅ AVISO: Preguntas oficiales disponibles */}
                  {onlyOfficialQuestions && availableQuestions > 0 && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-red-600 text-lg">🏛️</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-red-800">
                            Modo Oficial Activado para Tema {tema}
                          </p>
                          <p className="text-xs text-red-700">
                            {availableQuestions} preguntas de exámenes reales disponibles
                          </p>
                          <p className="text-xs text-red-600 mt-1 italic">
                            💡 Estas preguntas aparecieron en exámenes oficiales reales
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 📊 AVISO: Pocos oficiales disponibles */}
                  {onlyOfficialQuestions && officialQuestionsCount > 0 && availableQuestions > 0 && availableQuestions < 10 && (
                    <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-yellow-600 text-lg">⚡</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-yellow-800">
                            Pocas preguntas oficiales disponibles
                          </p>
                          <p className="text-xs text-yellow-700">
                            Solo {availableQuestions} preguntas oficiales sin estudiar recientemente.
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            💡 Considera combinar con preguntas normales para tener más variedad
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ❌ AVISO: Sin preguntas oficiales en base de datos */}
                  {onlyOfficialQuestions && officialQuestionsCount === 0 && !loadingOfficialCount && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600 text-lg">📭</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">
                            No hay preguntas oficiales disponibles para tema {tema}
                          </p>
                          <p className="text-xs text-gray-700">
                            Aún no se han añadido preguntas de exámenes oficiales para este tema.
                          </p>
                          <p className="text-xs text-gray-600 mt-1">
                            💡 Usa el modo normal mientras se añaden más preguntas oficiales
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 🆕 ARTÍCULOS IMPRESCINDIBLES */}
            <div className="border-t border-gray-200 pt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={focusEssentialArticles}
                  onChange={(e) => handleEssentialArticlesChange(e.target.checked)}
                  disabled={onlyOfficialQuestions}
                  className={`rounded border-gray-300 text-red-600 focus:ring-red-500 ${
                    onlyOfficialQuestions ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                />
                <span className={`text-sm font-medium ${
                  onlyOfficialQuestions ? 'text-gray-400' : 'text-gray-700'
                }`}>
                  ⭐ Enfocar en artículos imprescindibles
                  {loadingEssentialCount ? (
                    <span className="text-xs text-gray-500 ml-1">(cargando...)</span>
                  ) : essentialArticlesCount > 0 ? (
                    <span className="text-xs text-red-600 ml-1">
                      ({essentialArticlesCount})
                    </span>
                  ) : null}
                </span>
                <button
                  className="w-5 h-5 text-gray-400 hover:text-gray-600 rounded-full flex items-center justify-center text-sm transition-colors"
                  onClick={handleEssentialArticlesInfo}
                >
                  ℹ️
                </button>
              </label>

              {/* Información sobre artículos imprescindibles */}
              {focusEssentialArticles && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="py-2">
                    <div className="mb-2 flex items-center">
                      <span className="text-lg">⭐</span>
                      <span className="text-sm text-red-700 font-bold ml-2">Enfoque en Artículos Clave</span>
                      <button
                        className="w-4 h-4 text-red-400 hover:text-red-600 rounded-full flex items-center justify-center text-xs transition-colors ml-1"
                        onClick={() => setShowEssentialArticlesInfoModal(true)}
                      >
                        ℹ️
                      </button>
                    </div>
                    <p className="text-xs text-red-600 mb-2">
                      El test priorizará artículos que han aparecido frecuentemente en exámenes oficiales
                    </p>
                    
                    {/* Mostrar contador de preguntas disponibles */}
                    {!loadingEssentialCount && essentialQuestionsCount > 0 && (
                      <div className="mb-2 p-2 bg-red-100 border border-red-200 rounded">
                        <div className="flex items-center text-xs text-red-800">
                          <span className="mr-1">⭐</span>
                          <strong>{essentialQuestionsCount} preguntas de artículos imprescindibles encontradas</strong>
                        </div>
                        <div className="text-xs text-red-600 mt-1">
                          {essentialArticlesCount} artículos imprescindibles • Solo preguntas de estos artículos
                        </div>
                      </div>
                    )}
                    
                    {/* Mostrar lista de artículos si están cargados */}
                    {loadingEssentialCount ? (
                      <p className="text-xs text-gray-600 italic">
                        🔄 Cargando artículos imprescindibles...
                      </p>
                    ) : essentialArticlesList.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs text-red-700 font-medium mb-1">
                          📋 Artículos imprescindibles para tema {tema}:
                        </p>
                        <div className="max-h-24 sm:max-h-16 overflow-y-auto">
                          {essentialArticlesList.map((article, index) => (
                            <span key={index} className="inline-block text-xs bg-red-100 text-red-800 px-2 py-1 rounded mr-1 mb-1">
                              Art. {article.number} {article.law} ({article.questionsCount})
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-red-700 italic">
                        💡 Estos artículos son fundamentales para aprobar la oposición
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✨ MODO ADAPTATIVO */}
          <div className="border-t border-gray-200 pt-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={adaptiveMode}
                onChange={(e) => setAdaptiveMode(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-gray-700">
                ✨ Modo adaptativo
                <span className="text-xs text-blue-600 ml-1">(recomendado)</span>
              </span>
            </label>
            
            {/* Información sobre el modo adaptativo */}
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-xs text-blue-700 mb-1">
                📈 Se adapta automáticamente a tu rendimiento durante el test
              </p>
              <p className="text-xs text-blue-600">
                💡 Ajusta automáticamente la dificultad según tu % de aciertos
              </p>
            </div>
          </div>
        </div>


        {/* 5. Resumen de Configuración */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h4 className="font-bold text-blue-800 mb-2 text-sm">📋 Resumen de tu Test:</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className="text-blue-600">📝 Preguntas:</span>
              <span className="font-bold text-blue-800 ml-1">
                {maxQuestions} {onlyOfficialQuestions ? '🏛️' : ''}
              </span>
            </div>
            <div>
              <span className="text-blue-600">🎯 Dificultad:</span>
              <span className="font-bold text-blue-800 ml-1">
                {difficultyMode}
              </span>
            </div>
            <div>
              <span className="text-blue-600">✨ Priorización:</span>
              <span className="font-bold text-blue-800 ml-1">
                Inteligente
              </span>
            </div>
            <div>
              <span className="text-blue-600">⭐ Artículos clave:</span>
              <span className="font-bold text-blue-800 ml-1">
                {focusEssentialArticles ? 'Sí' : 'No'}
              </span>
            </div>
            <div>
              <span className="text-blue-600">✨ Modo adaptativo:</span>
              <span className="font-bold text-blue-800 ml-1">
                {adaptiveMode ? 'Activo' : 'Desactivado'}
              </span>
            </div>
          </div>
          
          {onlyOfficialQuestions && (
            <div className="mt-2 text-xs text-red-700 font-medium">
              🏛️ Solo preguntas de exámenes oficiales reales del tema {tema} ({officialQuestionsCount} total)
            </div>
          )}
          
          {focusEssentialArticles && (
            <div className="mt-1 text-xs text-red-700 font-medium">
              ⭐ Priorizando artículos que han aparecido en exámenes oficiales
            </div>
          )}
        </div>

        {/* 6. Botón de Iniciar */}
        <div className="text-center">
          {maxQuestions > 0 ? (
            <button
              onClick={handleStartTest}
              disabled={loading}
              className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-4 px-6 rounded-xl text-lg font-bold transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Preparando Test...</span>
                </div>
              ) : (
                <>
                  🚀 Empezar Test Personalizado ({maxQuestions} preguntas
                  {onlyOfficialQuestions ? ' oficiales' : ''}
                  {focusEssentialArticles && ' + artículos clave'}
                  {adaptiveMode && ' ✨'}
                  )
                </>
              )}
            </button>
          ) : (
            <button className="w-full bg-gray-300 text-gray-500 py-4 px-6 rounded-xl text-lg cursor-not-allowed" disabled>
              Sin preguntas {onlyOfficialQuestions ? 'oficiales' : ''} disponibles con esta configuración
            </button>
          )}
        </div>

        {/* Indicador de preguntas disponibles */}
        <div className="mt-3 text-center text-xs text-gray-500">
          📊 {availableQuestions} preguntas {
            focusEssentialArticles ? 'de artículos imprescindibles' :
            onlyOfficialQuestions ? 'oficiales' : ''
          } disponibles con tu configuración
          <span className="block text-green-600">
            ✨ Con priorización inteligente de preguntas
          </span>
          {focusEssentialArticles && (
            <span className="block text-red-600">
              ⭐ Solo artículos imprescindibles (han aparecido en exámenes oficiales)
            </span>
          )}
          {onlyOfficialQuestions && !focusEssentialArticles && (
            <span className="block text-blue-600">
              🏛️ Solo preguntas de exámenes oficiales reales
            </span>
          )}
        </div>
      </div>

      {/* Modal de Información de Priorización Inteligente */}
      {showPrioritizationModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">✨</span>
                <div>
                  <h3 className="text-xl font-bold">Priorización Inteligente</h3>
                  <p className="text-green-100 text-sm">Optimización pedagógica automática</p>
                </div>
              </div>
              <button
                onClick={() => setShowPrioritizationModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Introducción */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-bold text-green-800 mb-2 flex items-center">
                  <span className="mr-2">✨</span>
                  ¿Qué es la Priorización Inteligente?
                </h4>
                <p className="text-green-700 text-sm">
                  Es un sistema que selecciona automáticamente las mejores preguntas para maximizar tu aprendizaje, 
                  sin necesidad de configuraciones complejas.
                </p>
              </div>

              {/* Algoritmo */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">🔍</span>
                  ¿Cómo funciona el algoritmo?
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <h5 className="font-bold text-blue-800">1º Prioridad: Preguntas nunca vistas</h5>
                      <p className="text-blue-700 text-sm">
                        El sistema identifica preguntas que nunca has respondido y las prioriza para 
                        expandir tu conocimiento hacia nuevas áreas.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <span className="text-2xl">⏰</span>
                    <div>
                      <h5 className="font-bold text-orange-800">2º Prioridad: Repaso inteligente</h5>
                      <p className="text-orange-700 text-sm">
                        Para preguntas ya respondidas, selecciona las más antiguas para hacer repaso efectivo, 
                        siguiendo la curva del olvido para consolidar conocimientos.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Beneficios */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">🚀</span>
                  Beneficios del Sistema
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Aprendizaje progresivo y estructurado</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Repaso espaciado automático</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Sin configuraciones complejas</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Optimizado pedagógicamente</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Cobertura completa del temario</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-700">
                    <span>✅</span>
                    <span>Consolidación de conocimientos</span>
                  </div>
                </div>
              </div>

              {/* Aplicación */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">🔄</span>
                  ¿Cuándo se aplica?
                </h4>
                
                <div className="space-y-2 text-sm">
                  <div className="flex items-center space-x-2 text-blue-700">
                    <span>🎲</span>
                    <span className="font-medium">Tests aleatorios:</span>
                    <span>Priorización completa activa</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-700">
                    <span>🎯</span>
                    <span className="font-medium">Tests con dificultad:</span>
                    <span>Priorización dentro de la dificultad seleccionada</span>
                  </div>
                  <div className="flex items-center space-x-2 text-blue-700">
                    <span>🏛️</span>
                    <span className="font-medium">Tests oficiales:</span>
                    <span>Priorización sobre preguntas de exámenes reales</span>
                  </div>
                </div>
              </div>

              {/* Ejemplo práctico */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h5 className="font-bold text-gray-800 mb-2">📋 Ejemplo práctico:</h5>
                <p className="text-gray-700 text-sm">
                  Si solicitas 25 preguntas para el Tema 5 y tienes 80 nunca vistas + 120 ya respondidas:
                </p>
                <ul className="mt-2 text-sm text-gray-600 space-y-1">
                  <li>• El sistema priorizará preguntas nunca vistas</li>
                  <li>• Si necesita más, incluirá las respondidas hace más tiempo</li>
                  <li>• Resultado: aprendizaje óptimo sin repeticiones innecesarias</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl text-center">
              <button
                onClick={() => setShowPrioritizationModal(false)}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                ✅ Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Información de Artículos Imprescindibles */}
      {showEssentialArticlesModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <h3 className="text-xl font-bold">Artículos Imprescindibles</h3>
                  <p className="text-red-100 text-sm">Enfoque estratégico para aprobar</p>
                </div>
              </div>
              <button
                onClick={() => setShowEssentialArticlesModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Introducción */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-800 mb-2 flex items-center">
                  <span className="mr-2">🎯</span>
                  ¿Qué son los Artículos Imprescindibles?
                </h4>
                <p className="text-red-700 text-sm">
                  Son aquellos artículos que han aparecido <strong>repetidamente en exámenes oficiales</strong> del Estado, 
                  CCAA y Ayuntamientos, demostrando ser fundamentales para aprobar la oposición.
                </p>
              </div>

              {/* Por qué son importantes */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">🔥</span>
                  ¿Por qué son tan importantes?
                </h4>
                
                <div className="space-y-4">
                  <div className="flex items-start space-x-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                    <span className="text-2xl">📊</span>
                    <div>
                      <h5 className="font-bold text-orange-800">Alta probabilidad de aparecer</h5>
                      <p className="text-orange-700 text-sm">
                        Los tribunales suelen repetir preguntas sobre artículos que consideran esenciales 
                        para el puesto de Auxiliar Administrativo.
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-start space-x-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <span className="text-2xl">⚖️</span>
                    <div>
                      <h5 className="font-bold text-yellow-800">Aplicación práctica real</h5>
                      <p className="text-yellow-700 text-sm">
                        Son artículos que realmente usarás en tu trabajo diario como funcionario, 
                        por eso los tribunales los priorizan.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <h5 className="font-bold text-green-800">Diferenciadores clave</h5>
                      <p className="text-green-700 text-sm">
                        Dominar estos artículos puede marcar la diferencia entre aprobar y suspender, 
                        ya que muchos opositores los pasan por alto.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estrategia de estudio */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">📚</span>
                  Estrategia de Estudio Recomendada
                </h4>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start space-x-2">
                      <span className="font-bold text-blue-800">1.</span>
                      <div>
                        <span className="font-bold text-blue-800">Memorización profunda:</span>
                        <span className="text-blue-700"> Estos artículos debes saberlos prácticamente de memoria</span>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-bold text-blue-800">2.</span>
                      <div>
                        <span className="font-bold text-blue-800">Comprensión contextual:</span>
                        <span className="text-blue-700"> Entiende cuándo y cómo se aplican en situaciones reales</span>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-bold text-blue-800">3.</span>
                      <div>
                        <span className="font-bold text-blue-800">Repaso frecuente:</span>
                        <span className="text-blue-700"> Revísalos semanalmente hasta el examen</span>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="font-bold text-blue-800">4.</span>
                      <div>
                        <span className="font-bold text-blue-800">Practica con preguntas tipo:</span>
                        <span className="text-blue-700"> Usa este modo para familiarizarte con cómo se preguntan</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consejo de oro */}
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border border-orange-300 rounded-lg p-4">
                <h5 className="font-bold text-orange-800 mb-2 flex items-center">
                  <span className="mr-2">💡</span>
                  Consejo de Oro
                </h5>
                <p className="text-orange-700 text-sm">
                  <strong>Si solo pudieras estudiar el 20% del temario</strong>, estos artículos imprescindibles 
                  deberían ser tu prioridad absoluta. Muchos opositores aprueban dominando estos conceptos clave 
                  mejor que conociendo superficialmente todo el temario.
                </p>
              </div>

              {/* Cómo funciona */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">⚙️</span>
                  ¿Cómo funciona esta función?
                </h4>
                
                <div className="text-sm text-gray-700 space-y-2">
                  <p>• <strong>Análisis de frecuencia:</strong> Identificamos qué artículos aparecen más en exámenes oficiales</p>
                  <p>• <strong>Priorización inteligente:</strong> El test incluirá más preguntas de estos artículos</p>
                  <p>• <strong>Combinación estratégica:</strong> Se puede combinar con otras opciones (dificultad, oficiales, etc.)</p>
                  <p>• <strong>Actualización constante:</strong> La lista se actualiza con cada nuevo examen oficial</p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl text-center">
              <button
                onClick={() => setShowEssentialArticlesModal(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                ⭐ ¡Entendido! Vamos a por los imprescindibles
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Información de Preguntas Oficiales */}
      {showOfficialQuestionsModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">🏛️</span>
                <div>
                  <h3 className="text-xl font-bold">Preguntas Oficiales</h3>
                  <p className="text-blue-100 text-sm">Extraídas de exámenes reales</p>
                </div>
              </div>
              <button
                onClick={() => setShowOfficialQuestionsModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              
              {/* Introducción */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-bold text-blue-800 mb-2 flex items-center">
                  <span className="mr-2">🎯</span>
                  ¿Qué son las preguntas oficiales?
                </h4>
                <p className="text-blue-700 text-sm">
                  Son preguntas extraídas directamente de <strong>exámenes oficiales reales</strong> de convocatorias pasadas del Auxiliar Administrativo del Estado. 
                  Representan el <strong>estándar oficial</strong> de dificultad y formato que encontrarás en tu examen.
                </p>
              </div>

              {/* Ventajas estratégicas */}
              <div>
                <h4 className="font-bold text-gray-800 mb-4 flex items-center">
                  <span className="mr-2">⭐</span>
                  Ventajas de practicar con preguntas oficiales
                </h4>
                
                <div className="space-y-3">
                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 font-bold text-sm">1</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-blue-800">Formato auténtico</h5>
                      <p className="text-blue-700 text-sm">Conoces exactamente cómo se formulan las preguntas en el examen real</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 font-bold text-sm">2</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-blue-800">Dificultad real</h5>
                      <p className="text-blue-700 text-sm">El nivel de dificultad es exactamente el mismo que encontrarás</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                      <span className="text-blue-600 font-bold text-sm">3</span>
                    </div>
                    <div>
                      <h5 className="font-bold text-blue-800">Confianza extra</h5>
                      <p className="text-blue-700 text-sm">Te familiarizas con el estilo y formato del examen oficial</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Consejo de oro */}
              <div className="bg-gradient-to-r from-yellow-100 to-orange-100 border border-orange-300 rounded-lg p-4">
                <h5 className="font-bold text-orange-800 mb-2 flex items-center">
                  <span className="mr-2">💡</span>
                  Consejo de Oro
                </h5>
                <p className="text-orange-700 text-sm">
                  <strong>Practica primero con preguntas oficiales</strong> para conocer el estilo del examen, 
                  luego combina con nuestras preguntas generadas para ampliar tu preparación. 
                  ¡La familiaridad con el formato oficial puede marcar la diferencia!
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl text-center">
              <button
                onClick={() => setShowOfficialQuestionsModal(false)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                🏛️ ¡Entendido! Vamos con las oficiales
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Información sobre Artículos Imprescindibles (en el recuadro rojo) */}
      {showEssentialArticlesInfoModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">⭐</span>
                <div>
                  <h3 className="text-lg font-bold">Artículos Imprescindibles</h3>
                  <p className="text-red-100 text-sm">Explicación de la lista</p>
                </div>
              </div>
              <button
                onClick={() => setShowEssentialArticlesInfoModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              
              {/* Explicación principal */}
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h4 className="font-bold text-red-800 mb-2 flex items-center">
                  <span className="mr-2">📋</span>
                  ¿Qué indica esta lista?
                </h4>
                <p className="text-red-700 text-sm">
                  Aquí se muestran los <strong>artículos específicos</strong> que han aparecido en exámenes oficiales reales 
                  para este tema.
                </p>
              </div>

              {/* Explicación del formato */}
              <div>
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">🔢</span>
                  ¿Qué significa el número entre paréntesis?
                </h4>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="inline-block text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        Art. 15 Ley 19/2013 (3)
                      </span>
                      <span className="text-sm text-gray-600">← Ejemplo</span>
                    </div>
                    <p className="text-sm text-gray-700">
                      El <strong>(3)</strong> indica que el Artículo 15 de la Ley 19/2013 ha aparecido en 
                      <strong> 3 preguntas de exámenes oficiales</strong> diferentes.
                    </p>
                  </div>
                  
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <h5 className="font-bold text-blue-800 mb-1">💡 Interpretación:</h5>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• <strong>Número más alto</strong> = Artículo muy importante para estudiar</li>
                      <li>• <strong>Aparece frecuentemente</strong> = Alta probabilidad de que salga</li>
                      <li>• <strong>Prioridad máxima</strong> = Dominar estos artículos es clave</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl text-center">
              <button
                onClick={() => setShowEssentialArticlesInfoModal(false)}
                className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                ✅ Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestConfigurator;
