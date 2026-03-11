// components/TestConfigurator.tsx - CON FILTRO DE PREGUNTAS OFICIALES POR TEMA CORREGIDO
'use client'
import React, { useState, useEffect, useMemo, useRef } from 'react';
import SectionFilterModal from './SectionFilterModal';
import { fetchLawSections } from '../lib/teoriaFetchers';
import { getCanonicalSlug } from '../lib/lawMappingUtils';
import type {
  TestConfiguratorProps,
  TestStartConfig,
  LawData,
  ArticleItem,
  EssentialArticleItem,
  FailedQuestionsData,
  FailedQuestionItem,
  SavedFavorite,
  DifficultyMode,
  TotalQuestions,
  SectionFilter,
} from './TestConfigurator.types';

const TestConfigurator: React.FC<TestConfiguratorProps> = ({
  tema = 7,
  temaDisplayName = null,
  totalQuestions = 100,
  onStartTest,
  userStats = null,
  loading = false,
  currentUser = null,
  lawsData = [],
  preselectedLaw = null,
  hideOfficialQuestions = false,
  hideEssentialArticles = false,
  officialQuestionsCount = 0,
  testMode = 'practica',
  positionType = 'auxiliar_administrativo'
}) => {
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
  const [onlyFailedQuestions, setOnlyFailedQuestions] = useState(false); // 🆕 Solo preguntas falladas
  const [showFailedQuestionsModal, setShowFailedQuestionsModal] = useState(false); // 🆕 Modal preguntas falladas
  const [failedQuestionsData, setFailedQuestionsData] = useState<FailedQuestionsData | null>(null);
  const [failedQuestionsCount, setFailedQuestionsCount] = useState<number | 'all'>(25);
  const [selectedFailedOrder, setSelectedFailedOrder] = useState<string | null>(null);

  // 🆕 Estados para filtro de leyes
  const [selectedLaws, setSelectedLaws] = useState<Set<string>>(new Set());
  const [showLawsFilter, setShowLawsFilter] = useState(!tema && lawsData?.length > 1);
  const [lawSearchQuery, setLawSearchQuery] = useState('');

  // 🆕 Estados para filtro de artículos
  const [selectedArticlesByLaw, setSelectedArticlesByLaw] = useState<Map<string, Set<string | number>>>(new Map());
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [currentLawForArticles, setCurrentLawForArticles] = useState<string | null>(null);
  const [availableArticlesByLaw, setAvailableArticlesByLaw] = useState<Map<string, ArticleItem[]>>(new Map());
  const [loadingArticles, setLoadingArticles] = useState(false);

  // 🆕 Estados para filtro de títulos/secciones (MULTI-SELECT)
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [selectedSectionFilters, setSelectedSectionFilters] = useState<SectionFilter[]>([]);
  const [availableSectionsByLaw, setAvailableSectionsByLaw] = useState<Map<string, any[]>>(new Map());

  // 💾 Estados para favoritos (configuraciones guardadas)
  const [savedFavorites, setSavedFavorites] = useState<SavedFavorite[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [showSaveFavoriteModal, setShowSaveFavoriteModal] = useState(false);
  const [showLoadFavoriteModal, setShowLoadFavoriteModal] = useState(false);
  const [favoriteName, setFavoriteName] = useState('');
  const [favoriteDescription, setFavoriteDescription] = useState('');
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState('');


  // officialQuestionsCount viene como prop, ya no necesitamos loading state

  // Estados para artículos imprescindibles
  const [essentialArticlesCount, setEssentialArticlesCount] = useState(0);
  const [loadingEssentialCount, setLoadingEssentialCount] = useState(false);
  const [essentialArticlesList, setEssentialArticlesList] = useState<EssentialArticleItem[]>([]);
  const [essentialQuestionsCount, setEssentialQuestionsCount] = useState(0);
  const [essentialQuestionsByDifficulty, setEssentialQuestionsByDifficulty] = useState<Record<string, number>>({});

  // officialQuestionsCount ahora viene como prop desde la página principal


  // Cargar conteo de artículos imprescindibles POR TEMA (v2 API)
  const loadEssentialArticlesCount = async () => {
    if (!tema) return;

    setLoadingEssentialCount(true);
    try {
      console.log(`⭐ Cargando artículos imprescindibles para tema ${tema} (v2)...`);

      const params = new URLSearchParams({
        topicNumber: String(tema),
        positionType,
      });

      const res = await fetch(`/api/v2/test-config/essential-articles?${params}`);
      const data = await res.json();

      if (!data.success) {
        console.error('❌ Error API essential-articles:', data.error);
        setEssentialArticlesCount(0);
        setEssentialArticlesList([]);
        setEssentialQuestionsCount(0);
        setEssentialQuestionsByDifficulty({});
        return;
      }

      console.log(`⭐ Total artículos imprescindibles tema ${tema}: ${data.essentialCount}`);
      console.log(`📋 Total preguntas de artículos imprescindibles tema ${tema}: ${data.totalQuestions}`);
      console.log(`📊 Distribución por dificultad:`, data.byDifficulty);

      setEssentialArticlesCount(data.essentialCount || 0);
      setEssentialArticlesList(data.essentialArticles || []);
      setEssentialQuestionsCount(data.totalQuestions || 0);
      setEssentialQuestionsByDifficulty(data.byDifficulty || {});
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
  const handleEssentialArticlesChange = (checked: boolean) => {
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

  // officialQuestionsCount ahora se pasa como prop, no se carga aquí

  // 💾 EFECTO: Cargar favoritos guardados del usuario (solo en páginas de leyes, no en temas)
  useEffect(() => {
    if (currentUser && !tema) {
      loadUserFavorites();
    }
  }, [currentUser, tema]);

  // 💾 Función para cargar favoritos del usuario
  const loadUserFavorites = async () => {
    if (!currentUser) return;

    setLoadingFavorites(true);
    try {
      const response = await fetch(`/api/profile/test-favorites?userId=${currentUser.id}`);
      const result = await response.json();

      if (result.success && result.data) {
        setSavedFavorites(result.data);
        console.log('💾 [Favorites] Cargados:', result.data.length, 'favoritos');
      }
    } catch (error) {
      console.error('❌ [Favorites] Error cargando favoritos:', error);
    } finally {
      setLoadingFavorites(false);
    }
  };

  // 💾 Función para guardar configuración actual como favorito
  const saveCurrentAsFavorite = async () => {
    if (!favoriteName.trim()) {
      setFavoriteError('El nombre es obligatorio');
      return;
    }

    if (selectedLaws.size === 0) {
      setFavoriteError('Debes tener al menos una ley seleccionada');
      return;
    }

    setSavingFavorite(true);
    setFavoriteError('');

    try {
      const favoriteData = {
        userId: currentUser!.id,
        name: favoriteName.trim(),
        description: favoriteDescription.trim() || null,
        selectedLaws: Array.from(selectedLaws),
        selectedArticlesByLaw: Object.fromEntries(
          Array.from(selectedArticlesByLaw.entries()).map(([lawId, articlesSet]) => [
            lawId,
            Array.from(articlesSet)
          ])
        ),
        positionType: positionType
      };

      console.log('💾 [Favorites] Enviando datos:', JSON.stringify(favoriteData, null, 2));

      const response = await fetch('/api/profile/test-favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(favoriteData)
      });

      const result = await response.json();

      if (result.success && result.data) {
        setSavedFavorites(prev => [result.data, ...prev]);
        setFavoriteName('');
        setFavoriteDescription('');
        setShowSaveFavoriteModal(false);
        console.log('✅ [Favorites] Favorito guardado:', result.data.name);
      } else {
        console.error('❌ [Favorites] Error de validación:', result);
        // Mostrar detalles de validación si existen
        if (result.details && Array.isArray(result.details)) {
          const detailMsg = result.details.map((d: any) => d.message || d.path?.join('.')).join(', ');
          setFavoriteError(detailMsg || result.error || 'Error al guardar');
        } else {
          setFavoriteError(result.error || 'Error al guardar el favorito');
        }
      }
    } catch (error) {
      console.error('❌ [Favorites] Error guardando favorito:', error);
      setFavoriteError('Error de conexión');
    } finally {
      setSavingFavorite(false);
    }
  };

  // 💾 Función para cargar un favorito guardado
  const loadFavorite = (favorite: SavedFavorite) => {
    console.log('📂 [Favorites] Cargando favorito:', favorite.name);

    // Cargar leyes seleccionadas
    setSelectedLaws(new Set(favorite.selectedLaws || []));

    // Cargar artículos seleccionados por ley
    // 🔧 FIX: Mantener artículos como strings para coincidir con article.article_number de la BD
    const articlesMap = new Map<string, Set<string | number>>();
    if (favorite.selectedArticlesByLaw) {
      Object.entries(favorite.selectedArticlesByLaw).forEach(([lawId, articles]) => {
        articlesMap.set(lawId, new Set(articles.map((a: string | number) => String(a))));
      });
    }
    setSelectedArticlesByLaw(articlesMap);

    // Limpiar filtros de secciones (no se guardan en favoritos por ahora)
    setSelectedSectionFilters([]);

    // Cerrar modal
    setShowLoadFavoriteModal(false);

    console.log('✅ [Favorites] Favorito cargado:', {
      laws: favorite.selectedLaws?.length || 0,
      articlesEntries: Object.keys(favorite.selectedArticlesByLaw || {}).length
    });
  };

  // 💾 Función para eliminar un favorito
  const deleteFavoriteHandler = async (favoriteId: string, favoriteNameToDelete: string) => {
    if (!confirm(`¿Eliminar el favorito "${favoriteNameToDelete}"?`)) return;

    try {
      const response = await fetch(`/api/profile/test-favorites?id=${favoriteId}&userId=${currentUser!.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (result.success) {
        setSavedFavorites(prev => prev.filter(p => p.id !== favoriteId));
        console.log('🗑️ [Favorites] Favorito eliminado:', favoriteNameToDelete);
      } else {
        alert(result.error || 'Error al eliminar el favorito');
      }
    } catch (error) {
      console.error('❌ [Favorites] Error eliminando favorito:', error);
      alert('Error de conexión');
    }
  };

  // 🔧 EFECTO: Inicializar selectedLaws cuando preselectedLaw está presente
  useEffect(() => {
    if (preselectedLaw && lawsData && lawsData.length > 0) {
      const matchingLaw = lawsData.find(law => law.law_short_name === preselectedLaw);
      if (matchingLaw) {
        console.log('🎯 Inicializando selectedLaws con ley preseleccionada:', preselectedLaw);
        setSelectedLaws(new Set([preselectedLaw]));
        
        // También cargar artículos automáticamente para la ley preseleccionada
        if (!availableArticlesByLaw.has(preselectedLaw)) {
          console.log('🔄 Cargando artículos automáticamente para ley preseleccionada:', preselectedLaw);
          loadArticlesForLaw(preselectedLaw).then(articles => {
            setAvailableArticlesByLaw(prev => {
              const newMap = new Map(prev);
              newMap.set(preselectedLaw, articles);
              return newMap;
            });
            // NO inicializar artículos como seleccionados por defecto - solo cargar los disponibles
            console.log('✅ Artículos cargados para', preselectedLaw, ':', articles.length, 'artículos disponibles');
          });
        }
      }
    }
  }, [preselectedLaw, lawsData]);

  // Estados y funciones existentes...

  // 🆕 Estado para estimación del servidor (null = aún no cargada)
  const [apiEstimate, setApiEstimate] = useState<number | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const estimateAbortRef = useRef<AbortController | null>(null);

  // availableQuestions: prefiere estimación del servidor, fallback a cálculo local
  const availableQuestions = useMemo(() => {
    if (apiEstimate !== null) return apiEstimate;

    // Sin tema (modo por-leyes): calcular desde lawsData + selectedLaws
    if (!tema && lawsData && lawsData.length > 0) {
      if (selectedLaws.size === 0) return 0;
      return lawsData
        .filter(law => selectedLaws.has(law.law_short_name))
        .reduce((sum, law) => sum + (law.questions_count || 0), 0);
    }

    // Fallback desde totalQuestions prop (mientras el API no haya respondido)
    if (typeof totalQuestions === 'number') return totalQuestions;
    if (typeof totalQuestions === 'object' && totalQuestions !== null) {
      return Object.values(totalQuestions).reduce((sum, count) => sum + count, 0);
    }
    return 0;
  }, [apiEstimate, totalQuestions, tema, lawsData, selectedLaws]);

  // 🆕 Fetch estimación de preguntas disponibles desde v2 API (fuente única de verdad)
  useEffect(() => {
    // Solo llamar al API cuando hay tema (para configurador standalone sin tema, usar totalQuestions prop)
    if (!tema) return;

    // Abortar fetch anterior si hay uno en vuelo
    if (estimateAbortRef.current) {
      estimateAbortRef.current.abort();
    }
    const controller = new AbortController();
    estimateAbortRef.current = controller;

    const fetchEstimate = async () => {
      setLoadingEstimate(true);
      try {
        // Construir params para la API
        const params = new URLSearchParams({
          topicNumber: String(tema),
          positionType,
          onlyOfficialQuestions: String(onlyOfficialQuestions),
          focusEssentialArticles: String(focusEssentialArticles),
          difficultyMode,
        });

        // Añadir leyes seleccionadas
        const selectedLawsArray = Array.from(selectedLaws);
        if (selectedLawsArray.length > 0) {
          params.set('selectedLaws', selectedLawsArray.join(','));
        }

        // Añadir artículos seleccionados (como JSON)
        const articlesByLawObj: Record<string, (string | number)[]> = {};
        for (const [lawName, articlesSet] of selectedArticlesByLaw) {
          if (articlesSet.size > 0) {
            articlesByLawObj[lawName] = Array.from(articlesSet);
          }
        }
        if (Object.keys(articlesByLawObj).length > 0) {
          params.set('selectedArticlesByLaw', JSON.stringify(articlesByLawObj));
        }

        // Añadir filtros de secciones (como JSON)
        if (selectedSectionFilters && selectedSectionFilters.length > 0) {
          params.set('selectedSectionFilters', JSON.stringify(selectedSectionFilters));
        }

        const res = await fetch(`/api/v2/test-config/estimate?${params}`, {
          signal: controller.signal,
        });
        const data = await res.json();

        if (data.success) {
          console.log('📊 Estimación v2:', data.count, 'preguntas disponibles', data.byLaw);
          setApiEstimate(data.count ?? 0);
        } else {
          console.warn('⚠️ Error en estimación v2:', data.error);
          // En caso de error del API, no tocar apiEstimate — fallback a totalQuestions prop
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('❌ Error fetching estimate:', error);
        }
      } finally {
        setLoadingEstimate(false);
      }
    };

    // Debounce: esperar 150ms antes de fetch para evitar ráfagas
    const timer = setTimeout(fetchEstimate, 150);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [tema, positionType, onlyOfficialQuestions, focusEssentialArticles, difficultyMode, selectedLaws, selectedArticlesByLaw, selectedSectionFilters]);

  const maxQuestions = useMemo(() => {
    const result = Math.min(selectedQuestions, availableQuestions);
    // Validar que no sea NaN
    if (isNaN(result) || result < 0) {
      console.warn('⚠️ maxQuestions es NaN o negativo:', { selectedQuestions, availableQuestions, result });
      return 0;
    }
    return result;
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

  // 🆕 Inicializar leyes seleccionadas SOLO la primera vez que lawsData tiene datos
  // 🔧 FIX: Usar ref para evitar resetear la selección del usuario cada vez que lawsData cambie
  const lawsInitializedRef = useRef(false);
  const articlesInFlightRef = useRef(new Map()); // Dedup: promises en vuelo por ley
  const sectionsInFlightRef = useRef(new Map()); // Dedup: promises en vuelo por ley

  useEffect(() => {
    // Solo inicializar si lawsData tiene datos Y no se ha inicializado antes
    if (lawsData && lawsData.length > 0 && !lawsInitializedRef.current) {
      lawsInitializedRef.current = true;
      const initialSelectedLaws = new Set(lawsData.map(law => law.law_short_name));
      setSelectedLaws(initialSelectedLaws);

      // 📖 Mostrar filtro desplegado por defecto cuando hay múltiples leyes y no hay tema
      if (!tema && lawsData.length > 1) {
        setShowLawsFilter(true);
      }

      // 🔄 Para LawTestConfigurator, cargar artículos y secciones automáticamente
      if (lawsData.length === 1) {
        const law = lawsData[0];
        const lawShortName = law.law_short_name;
        
        // Cargar artículos si no están en cache
        if (!availableArticlesByLaw.has(lawShortName)) {
          console.log('🔄 Cargando artículos automáticamente para LawTestConfigurator:', lawShortName);
          loadArticlesForLaw(lawShortName).then(articles => {
            setAvailableArticlesByLaw(prev => {
              const newMap = new Map(prev);
              newMap.set(lawShortName, articles);
              return newMap;
            });
            console.log('✅ Artículos cargados para LawTestConfigurator', lawShortName, ':', articles.length, 'artículos disponibles');
          });
        }

        // Cargar secciones si no están en cache (para determinar si mostrar el botón)
        if (!availableSectionsByLaw.has(lawShortName)) {
          console.log('📚 Cargando secciones automáticamente para LawTestConfigurator:', lawShortName);
          const lawSlug = getCanonicalSlug(lawShortName);
          loadSectionsForLaw(lawSlug).then(sections => {
            setAvailableSectionsByLaw(prev => {
              const newMap = new Map(prev);
              newMap.set(lawShortName, sections);
              return newMap;
            });
            console.log('✅ Secciones cargadas para LawTestConfigurator', lawShortName, ':', sections.length, 'secciones disponibles');
          });
        }
      }
    }
  }, [lawsData]);

  // 🆕 Cargar secciones automáticamente cuando hay solo una ley seleccionada
  useEffect(() => {
    if (selectedLaws.size === 1) {
      const selectedLawName = Array.from(selectedLaws)[0];
      // Solo cargar si no están ya en cache
      if (!availableSectionsByLaw.has(selectedLawName)) {
        console.log('📚 Cargando secciones automáticamente para ley seleccionada:', selectedLawName);
        const lawSlug = getCanonicalSlug(selectedLawName);
        loadSectionsForLaw(lawSlug).then(sections => {
          setAvailableSectionsByLaw(prev => {
            const newMap = new Map(prev);
            newMap.set(selectedLawName, sections);
            return newMap;
          });
          console.log('✅ Secciones cargadas para', selectedLawName, ':', sections.length, 'secciones disponibles');
        });
      }
    }
  }, [selectedLaws]);

  // 🆕 Funciones para manejar filtro de leyes
  const toggleLawSelection = (lawShortName: string) => {
    const newSelectedLaws = new Set(selectedLaws);
    if (newSelectedLaws.has(lawShortName)) {
      newSelectedLaws.delete(lawShortName);
    } else {
      newSelectedLaws.add(lawShortName);
    }
    setSelectedLaws(newSelectedLaws);
    // Limpiar filtro de títulos cuando cambia la selección de leyes
    setSelectedSectionFilters([]);
  };

  const selectAllLaws = () => {
    const allLaws = new Set(lawsData.map(law => law.law_short_name));
    setSelectedLaws(allLaws);
    setSelectedSectionFilters([]); // Limpiar títulos al seleccionar todas las leyes
  };

  const deselectAllLaws = () => {
    setSelectedLaws(new Set());
    setSelectedSectionFilters([]); // Limpiar títulos al deseleccionar leyes
  };

  // 🆕 Función para cargar artículos disponibles por ley (con dedup de requests en vuelo)
  const loadArticlesForLaw = async (lawShortName: string): Promise<ArticleItem[]> => {
    // Si ya hay una request en vuelo para esta ley, reusar la misma promise
    if (articlesInFlightRef.current.has(lawShortName)) {
      console.log(`⏳ Reutilizando request en vuelo para ${lawShortName}`);
      return articlesInFlightRef.current.get(lawShortName);
    }

    const promise = _loadArticlesForLawImpl(lawShortName);
    articlesInFlightRef.current.set(lawShortName, promise);

    try {
      return await promise;
    } finally {
      articlesInFlightRef.current.delete(lawShortName);
    }
  };

  const _loadArticlesForLawImpl = async (lawShortName: string): Promise<ArticleItem[]> => {
    setLoadingArticles(true);
    try {
      console.log(`📋 Cargando artículos para ley ${lawShortName} (tema: ${tema || 'configurador específico'}) (v2)...`);

      const params = new URLSearchParams({
        lawShortName,
        positionType,
      });
      if (tema) {
        params.set('topicNumber', String(tema));
      }

      const res = await fetch(`/api/v2/test-config/articles?${params}`);
      const data = await res.json();

      if (!data.success) {
        console.error('❌ Error API articles:', data.error);
        return [];
      }

      console.log(`✅ Cargados ${data.articles.length} artículos para ${lawShortName} (v2)`);
      return data.articles || [];
    } catch (error) {
      console.error('❌ Error cargando artículos:', error);
      return [];
    } finally {
      setLoadingArticles(false);
    }
  };

  // 🆕 Función para cargar secciones de una ley específica (con dedup de requests en vuelo)
  const loadSectionsForLaw = async (lawSlug: string) => {
    // Si ya hay una request en vuelo para este slug, reusar la misma promise
    if (sectionsInFlightRef.current.has(lawSlug)) {
      console.log(`⏳ Reutilizando request de secciones en vuelo para ${lawSlug}`);
      return sectionsInFlightRef.current.get(lawSlug);
    }

    const promise = (async () => {
      try {
        console.log('📚 Cargando secciones para ley:', lawSlug);
        const data = await fetchLawSections(lawSlug);
        return data.sections || [];
      } catch (error) {
        console.error('❌ Error cargando secciones:', error);
        return [];
      }
    })();

    sectionsInFlightRef.current.set(lawSlug, promise);
    try {
      return await promise;
    } finally {
      sectionsInFlightRef.current.delete(lawSlug);
    }
  };

  // 🆕 Función para cargar preguntas falladas del usuario (v2 - Drizzle + Zod)
  const loadFailedQuestions = async () => {
    if (!currentUser) return

    try {
      console.log(`🔍 [v2] Cargando preguntas falladas para ${tema ? `tema ${tema}` : 'configurador específico'}...`)

      // Validar que hay filtros suficientes
      if (!tema && selectedLaws.size === 0) {
        console.warn('⚠️ No hay tema ni leyes seleccionadas para buscar preguntas falladas')
        alert('No se puede determinar qué preguntas buscar. Selecciona una ley primero.')
        setOnlyFailedQuestions(false)
        return
      }

      // Llamar a la API v2
      const response = await fetch('/api/questions/user-failed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          topicNumber: tema || undefined,
          selectedLaws: tema ? [] : Array.from(selectedLaws),
        })
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        console.error('❌ Error obteniendo preguntas falladas:', data.error)
        alert('Error al cargar las preguntas falladas')
        setOnlyFailedQuestions(false)
        return
      }

      if (!data.questions || data.questions.length === 0) {
        alert('No tienes preguntas falladas en este tema aún.\nCompleta algunos tests primero para poder usar esta función.')
        setOnlyFailedQuestions(false)
        return
      }

      setFailedQuestionsData({
        totalQuestions: data.totalQuestions,
        totalFailures: data.totalFailures,
        questions: data.questions
      })

      setShowFailedQuestionsModal(true)

      console.log(`✅ [v2] ${data.questions.length} preguntas falladas cargadas`)

    } catch (error) {
      console.error('❌ Error cargando preguntas falladas:', error)
      alert('Error al cargar las preguntas falladas')
      setOnlyFailedQuestions(false)
    }
  }

  // 🆕 Función para iniciar test de preguntas falladas con orden específico
  const startFailedQuestionsTest = (sortOrder: string) => {
    if (!failedQuestionsData || !currentUser) return

    // Ordenar las preguntas según la opción elegida
    let sortedQuestions = [...failedQuestionsData.questions]

    switch (sortOrder) {
      case 'most_failed':
        sortedQuestions.sort((a, b) => b.failedCount - a.failedCount)
        break
      case 'recent_failed':
        sortedQuestions.sort((a, b) => new Date(b.lastFailed).getTime() - new Date(a.lastFailed).getTime())
        break
      case 'oldest_failed':
        sortedQuestions.sort((a, b) => new Date(a.firstFailed).getTime() - new Date(b.firstFailed).getTime())
        break
      case 'random':
        // Mezclar aleatoriamente
        for (let i = sortedQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [sortedQuestions[i], sortedQuestions[j]] = [sortedQuestions[j], sortedQuestions[i]]
        }
        break
    }
    
    // Obtener IDs de las preguntas ordenadas
    const sortedQuestionIds = sortedQuestions.map(q => q.questionId)
    
    // Crear configuración especial para preguntas falladas
    const config = {
      tema: tema,
      numQuestions: failedQuestionsCount === 'all' ? sortedQuestions.length : Math.min(failedQuestionsCount, sortedQuestions.length),
      difficultyMode: 'random', // No importa la dificultad para preguntas falladas
      onlyOfficialQuestions: false,
      focusEssentialArticles: false,
      excludeRecent: false,
      recentDays: 30,
      focusWeakAreas: false,
      adaptiveMode: false, // Desactivar modo adaptativo para preguntas específicas
      onlyFailedQuestions: true,
      failedQuestionIds: sortedQuestionIds, // 🆕 Lista específica de preguntas falladas ordenadas
      failedQuestionsOrder: sortOrder, // 🆕 Tipo de ordenación aplicada
      // 🆕 FILTRO DE LEYES (mantener si estaban seleccionadas)
      selectedLaws: Array.from(selectedLaws),
      selectedArticlesByLaw: Object.fromEntries(
        Array.from(selectedArticlesByLaw.entries()).map(([lawId, articlesSet]) => [
          lawId, 
          Array.from(articlesSet)
        ])
      ),
      // 🆕 FILTRO DE SECCIONES/TÍTULOS (MULTI-SELECT)
      selectedSectionFilters: selectedSectionFilters,
      timeLimit: null,
      configSource: 'failed_questions_test',
      configTimestamp: new Date().toISOString()
    }

    console.log('🎯 Iniciando test de preguntas falladas:', {
      sortOrder,
      questionsCount: sortedQuestions.length,
      firstFewIds: sortedQuestionIds.slice(0, 5)
    })

    // Cerrar modal
    setShowFailedQuestionsModal(false)
    
    try {
      // Enviar configuración al componente padre
      onStartTest?.(config as TestStartConfig)
      console.log('✅ Test de preguntas falladas iniciado')
      
    } catch (error) {
      console.error('❌ Error iniciando test de preguntas falladas:', error)
      alert('Error al iniciar el test. Por favor, inténtalo de nuevo.')
    }
  }

  // 🆕 Funciones para manejar filtro de artículos
  const openArticleModal = async (lawShortName: string) => {
    setCurrentLawForArticles(lawShortName);
    setShowArticleModal(true);

    // Cargar artículos si no están en cache
    if (!availableArticlesByLaw.has(lawShortName)) {
      const articles = await loadArticlesForLaw(lawShortName);
      setAvailableArticlesByLaw(prev => {
        const newMap = new Map(prev);
        newMap.set(lawShortName, articles);
        return newMap;
      });

      // Inicializar todos los artículos como seleccionados
      const articleNumbers = new Set<string | number>(articles.map((art: ArticleItem) => art.article_number));
      setSelectedArticlesByLaw(prev => {
        const newMap = new Map(prev);
        newMap.set(lawShortName, articleNumbers);
        return newMap;
      });
    } else {
      // Si los artículos ya están cargados, verificar si hay alguno seleccionado
      const currentSelection = selectedArticlesByLaw.get(lawShortName);
      if (!currentSelection || currentSelection.size === 0) {
        // Si no hay artículos seleccionados, seleccionar todos por defecto (mejor UX)
        const articles = availableArticlesByLaw.get(lawShortName) || [];
        const articleNumbers = new Set<string | number>(articles.map((art: ArticleItem) => art.article_number));
        setSelectedArticlesByLaw(prev => {
          const newMap = new Map(prev);
          newMap.set(lawShortName, articleNumbers);
          return newMap;
        });
      }
    }
  };

  const closeArticleModal = () => {
    setShowArticleModal(false);
    setCurrentLawForArticles(null);
  };

  const toggleArticleSelection = (lawShortName: string, articleNumber: string | number) => {
    // Ignorar artículos sin preguntas
    const articles = availableArticlesByLaw.get(lawShortName) || [];
    const article = articles.find((a: ArticleItem) => a.article_number === articleNumber);
    if (article && article.question_count === 0) return;

    // Limpiar filtro de títulos cuando se selecciona filtro de artículos
    setSelectedSectionFilters([]);

    // 🔄 Cargar artículos automáticamente si no están disponibles
    if (!availableArticlesByLaw.has(lawShortName)) {
      loadArticlesForLaw(lawShortName).then(articles => {
        setAvailableArticlesByLaw(prev => {
          const newMap = new Map(prev);
          newMap.set(lawShortName, articles);
          return newMap;
        });
      });
    }

    setSelectedArticlesByLaw(prev => {
      const newMap = new Map(prev);
      const currentArticles = newMap.get(lawShortName) || new Set();
      const newArticles = new Set(currentArticles);

      if (newArticles.has(articleNumber)) {
        newArticles.delete(articleNumber);
      } else {
        newArticles.add(articleNumber);
      }

      newMap.set(lawShortName, newArticles);
      return newMap;
    });
  };

  const selectAllArticlesForLaw = (lawShortName: string) => {
    // Limpiar filtro de títulos cuando se selecciona filtro de artículos
    setSelectedSectionFilters([]);

    // 🔄 Cargar artículos automáticamente si no están disponibles
    if (!availableArticlesByLaw.has(lawShortName)) {
      loadArticlesForLaw(lawShortName).then(articles => {
        setAvailableArticlesByLaw(prev => {
          const newMap = new Map(prev);
          newMap.set(lawShortName, articles);
          return newMap;
        });
        // Seleccionar todos después de cargar (solo con preguntas)
        const allArticles = new Set<string | number>(
          articles.filter((art: ArticleItem) => art.question_count > 0).map((art: ArticleItem) => art.article_number)
        );
        setSelectedArticlesByLaw(prev => {
          const newMap = new Map(prev);
          newMap.set(lawShortName, allArticles);
          return newMap;
        });
      });
      return;
    }

    const articles = availableArticlesByLaw.get(lawShortName) || [];
    const allArticles = new Set<string | number>(
      articles.filter((art: ArticleItem) => art.question_count > 0).map((art: ArticleItem) => art.article_number)
    );
    setSelectedArticlesByLaw(prev => {
      const newMap = new Map(prev);
      newMap.set(lawShortName, allArticles);
      return newMap;
    });
  };

  const deselectAllArticlesForLaw = (lawShortName: string) => {
    // Limpiar filtro de títulos cuando se selecciona filtro de artículos
    setSelectedSectionFilters([]);

    setSelectedArticlesByLaw(prev => {
      const newMap = new Map(prev);
      newMap.set(lawShortName, new Set());
      return newMap;
    });
  };

  const handleStartTest = () => {
    // Validación básica antes de continuar
    if (maxQuestions <= 0) {
      console.error('❌ No hay preguntas disponibles para el test')
      return
    }

    // 🆕 Validación de leyes seleccionadas
    if (lawsData.length > 0 && selectedLaws.size === 0) {
      alert('⚠️ Debes seleccionar al menos una ley para hacer el test')
      return
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
      focusWeakAreas: adaptiveMode, // ✨ Activar con modo adaptativo
      adaptiveMode: adaptiveMode, // ✨ Incluir modo adaptativo
      onlyFailedQuestions: onlyFailedQuestions, // 🆕 Solo preguntas falladas alguna vez
      // 🆕 FILTRO DE LEYES
      selectedLaws: Array.from(selectedLaws), // Convertir Set a Array
      // 🆕 FILTRO DE ARTÍCULOS POR LEY
      selectedArticlesByLaw: Object.fromEntries(
        Array.from(selectedArticlesByLaw.entries()).map(([lawId, articlesSet]) => [
          lawId,
          Array.from(articlesSet)
        ])
      ), // Convertir Map<string, Set> a Object<string, Array>
      // 🆕 FILTRO DE SECCIONES/TÍTULOS (MULTI-SELECT)
      selectedSectionFilters: selectedSectionFilters,
      // 🆕 INCLUIR METADATOS ADICIONALES
      timeLimit: null, // Por si se añade límite de tiempo en el futuro
      configSource: 'test_configurator',
      configTimestamp: new Date().toISOString()
    }

    console.log('🎛️ Configuración final del test:', config)

    // 📚 DEBUG: Log específico para filtro de secciones
    console.log('📚 DEBUG TestConfigurator - selectedSectionFilters:', {
      stateValue: selectedSectionFilters,
      length: selectedSectionFilters?.length,
      configValue: config.selectedSectionFilters
    })

    // Validaciones adicionales
    if (focusEssentialArticles) {
      console.log('⭐ Artículos imprescindibles incluidos en configuración')
    }

    // 🔧 Log artículos seleccionados si existen
    if (selectedArticlesByLaw.size > 0) {
      selectedArticlesByLaw.forEach((articles, lawId) => {
        console.log(`🔧 Ley ${lawId}: ${articles.size} artículos seleccionados:`, Array.from(articles))
      })
    }
    

    if (onlyOfficialQuestions && officialQuestionsCount === 0) {
      console.warn('⚠️ Solo preguntas oficiales activado pero no hay preguntas oficiales disponibles')
      // El TestPageWrapper manejará este error
    }

    try {
      // ✅ Pasar configuración al componente padre
      onStartTest?.(config as TestStartConfig)
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

        {/* 🆕 3. Filtro de Leyes y Artículos */}
        {lawsData && lawsData.length >= 1 && (
          <div className="mb-6">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-blue-900">
                  {lawsData.length > 1 ? '📖 Filtrar por Leyes' : '📄 Filtrar por Artículos'}
                </h3>
                <button
                  onClick={() => setShowLawsFilter(!showLawsFilter)}
                  className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                >
                  {showLawsFilter ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              
              {showLawsFilter && (
                <div className="space-y-3">
                  {lawsData.length === 1 && (
                    <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
                      💡 Puedes filtrar por artículos específicos de esta ley usando el botón "🔧 Filtrar artículos"
                    </div>
                  )}
                  {lawsData.length > 1 && (
                    <div className="space-y-2 mb-3">
                      <input
                        type="text"
                        placeholder="🔍 Buscar ley..."
                        value={lawSearchQuery}
                        onChange={(e) => setLawSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={selectAllLaws}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200"
                        >
                          Seleccionar todas
                        </button>
                        <button
                          onClick={deselectAllLaws}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200"
                        >
                          Deseleccionar todas
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 max-h-80 overflow-y-auto">
                    {lawsData.filter(law => {
                      if (!lawSearchQuery.trim()) return true;
                      const query = lawSearchQuery.toLowerCase();
                      return law.law_short_name?.toLowerCase().includes(query) ||
                             law.display_name?.toLowerCase().includes(query);
                    }).map((law) => {
                      const isSelected = selectedLaws.has(law.law_short_name);
                      const sectionsForLaw = availableSectionsByLaw.get(law.law_short_name) || [];
                      const hasSections = sectionsForLaw.length > 0;
                      const isOnlySelected = isSelected && selectedLaws.size === 1;

                      return (
                        <div
                          key={law.law_short_name}
                          className={`p-2 bg-white rounded border ${isSelected ? 'border-blue-300 bg-blue-50/50' : 'hover:bg-blue-50'}`}
                        >
                          <div className="flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleLawSelection(law.law_short_name)}
                              className="text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1">
                              <div className="font-medium text-sm text-gray-900">
                                {law.law_short_name}
                              </div>
                              <div className="text-xs text-gray-600">
                                {law.articles_with_questions} artículo{law.articles_with_questions > 1 ? 's' : ''} disponible{law.articles_with_questions > 1 ? 's' : ''}
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex items-center gap-1">
                                {/* Botón Títulos - solo si es la única ley seleccionada y tiene secciones */}
                                {isOnlySelected && hasSections && (
                                  <button
                                    onClick={() => setIsSectionModalOpen(true)}
                                    className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded hover:bg-purple-200 flex items-center space-x-1"
                                  >
                                    <span>📚</span>
                                    <span>Títulos</span>
                                  </button>
                                )}
                                {/* Botón Artículos */}
                                <button
                                  onClick={() => openArticleModal(law.law_short_name)}
                                  className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 flex items-center space-x-1"
                                >
                                  <span>🔧</span>
                                  <span>Artículos</span>
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Mostrar títulos seleccionados debajo de la ley */}
                          {isOnlySelected && selectedSectionFilters.length > 0 && (
                            <div className="mt-2 ml-6 p-2 bg-purple-50 border border-purple-200 rounded text-xs">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-purple-800 font-medium">
                                  {selectedSectionFilters.length} título{selectedSectionFilters.length > 1 ? 's' : ''}:
                                </span>
                                <button
                                  onClick={() => setSelectedSectionFilters([])}
                                  className="text-purple-600 hover:text-purple-800"
                                >
                                  ✕
                                </button>
                              </div>
                              <div className="text-purple-600">
                                {selectedSectionFilters.map(s => s.title).join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  
                  <div className="text-xs text-blue-700 mt-2">
                    ✓ {selectedLaws.size} de {lawsData.length} leyes seleccionadas
                  </div>

                  {/* 💾 Botones de Favoritos - Solo en páginas de leyes (no en temas) */}
                  {currentUser && !tema && (
                    <div className="flex gap-2 mt-3 pt-3 border-t border-blue-200">
                      <button
                        onClick={() => {
                          setFavoriteName('');
                          setFavoriteDescription('');
                          setFavoriteError('');
                          setShowSaveFavoriteModal(true);
                        }}
                        disabled={selectedLaws.size === 0}
                        className={`text-xs px-3 py-1.5 rounded flex items-center gap-1 transition-colors ${
                          selectedLaws.size === 0
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        <span>💾</span>
                        <span>Guardar selección</span>
                      </button>
                      {savedFavorites.length > 0 && (
                        <button
                          onClick={() => setShowLoadFavoriteModal(true)}
                          className="text-xs bg-amber-100 text-amber-700 px-3 py-1.5 rounded hover:bg-amber-200 flex items-center gap-1"
                        >
                          <span>📂</span>
                          <span>Cargar ({savedFavorites.length})</span>
                        </button>
                      )}
                      {loadingFavorites && (
                        <span className="text-xs text-gray-500 flex items-center">
                          <span className="animate-spin mr-1">⏳</span> Cargando...
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. Configuraciones Avanzadas */}
        <div className="mb-6">
          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-4">
            
            {/* Solo preguntas oficiales - CON CONTEO CORREGIDO POR TEMA */}
            {!hideOfficialQuestions && officialQuestionsCount > 0 && (
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
                    <span className="text-xs text-red-600 ml-1">
                      ({officialQuestionsCount})
                    </span>
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
                            Modo Oficial Activado{temaDisplayName ? ` para ${temaDisplayName}` : ''}
                          </p>
                          <p className="text-xs text-red-700">
                            {availableQuestions} preguntas de exámenes oficiales disponibles
                          </p>
                          <p className="text-xs text-red-600 mt-1 italic">
                            💡 Estas preguntas aparecieron en exámenes oficiales de {
                              positionType === 'auxiliar_administrativo' ? 'Auxiliar Administrativo del Estado (C2)' :
                              positionType === 'administrativo' ? 'Administrativo del Estado (C1)' :
                              positionType === 'tramitacion_procesal' ? 'Tramitación Procesal' :
                              positionType === 'auxilio_judicial' ? 'Auxilio Judicial' :
                              positionType === 'gestion_procesal' ? 'Gestión Procesal' :
                              'tu oposición'
                            }
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
                  {onlyOfficialQuestions && officialQuestionsCount === 0 && (
                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-600 text-lg">📭</span>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">
                            No hay preguntas oficiales disponibles{temaDisplayName ? ` para ${temaDisplayName}` : ''}
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
            )}

            {/* 🆕 ARTÍCULOS IMPRESCINDIBLES */}
            {!hideEssentialArticles && officialQuestionsCount > 0 && (
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
                      El test priorizará artículos que han aparecido en exámenes oficiales de {
                        positionType === 'auxiliar_administrativo' ? 'Auxiliar Administrativo del Estado (C2)' :
                        positionType === 'administrativo' ? 'Administrativo del Estado (C1)' :
                        positionType === 'tramitacion_procesal' ? 'Tramitación Procesal' :
                        positionType === 'auxilio_judicial' ? 'Auxilio Judicial' :
                        positionType === 'gestion_procesal' ? 'Gestión Procesal' :
                        'tu oposición'
                      }
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
                      <div className="flex items-center space-x-2 text-xs text-gray-600 italic">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-600"></div>
                        <span>Cargando artículos imprescindibles... esto puede tardar un momento</span>
                      </div>
                    ) : essentialArticlesList.length > 0 ? (
                      <div className="mt-2">
                        <p className="text-xs text-red-700 font-medium mb-1">
                          📋 Artículos imprescindibles{temaDisplayName ? ` para ${temaDisplayName}` : ''}:
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
            )}
          </div>

          {/* ✨ MODO ADAPTATIVO */}
          {testMode === 'practica' && (
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
          )}

          {/* 🎯 SOLO PREGUNTAS FALLADAS */}
          {currentUser && (
            <div className="border-t border-gray-200 pt-4">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={onlyFailedQuestions}
                  onChange={(e) => {
                    if (e.target.checked) {
                      loadFailedQuestions()
                    } else {
                      setOnlyFailedQuestions(false)
                      setFailedQuestionsData(null)
                    }
                  }}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  ❌ Solo preguntas falladas alguna vez
                  <span className="text-xs text-red-600 ml-1">(repaso)</span>
                </span>
              </label>

              {/* Información sobre preguntas falladas */}
              <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700 mb-1">
                  🎯 Incluye solo preguntas que has respondido incorrectamente al menos una vez
                </p>
                <p className="text-xs text-red-600">
                  💡 Perfecto para repasar tus puntos débiles y reforzar el aprendizaje
                </p>
              </div>
            </div>
          )}
        </div>


        {/* 5. Resumen de Configuración */}
        <div className={`mb-6 p-4 rounded-lg border ${testMode === 'examen' ? 'bg-purple-50 border-purple-200' : 'bg-blue-50 border-blue-200'}`}>
          <h4 className={`font-bold mb-2 text-sm ${testMode === 'examen' ? 'text-purple-800' : 'text-blue-800'}`}>
            📋 Resumen de tu Test:
          </h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <span className={testMode === 'examen' ? 'text-purple-600' : 'text-blue-600'}>📝 Preguntas:</span>
              <span className={`font-bold ml-1 ${testMode === 'examen' ? 'text-purple-800' : 'text-blue-800'}`}>
                {maxQuestions} {onlyOfficialQuestions ? '🏛️' : ''}
              </span>
            </div>
            <div>
              <span className={testMode === 'examen' ? 'text-purple-600' : 'text-blue-600'}>🎯 Dificultad:</span>
              <span className={`font-bold ml-1 ${testMode === 'examen' ? 'text-purple-800' : 'text-blue-800'}`}>
                {difficultyMode}
              </span>
            </div>
            {testMode === 'practica' && (
              <>
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
                {currentUser && onlyFailedQuestions && (
                  <div className="col-span-2">
                    <span className="text-red-600">❌ Tipo:</span>
                    <span className="font-bold text-red-800 ml-1">
                      Solo preguntas falladas
                    </span>
                  </div>
                )}
              </>
            )}
            {testMode === 'examen' && (
              <div className="col-span-2">
                <span className="text-purple-600">📝 Modo:</span>
                <span className="font-bold text-purple-800 ml-1">
                  Examen (todas las preguntas de una vez)
                </span>
              </div>
            )}
          </div>
          
          {onlyOfficialQuestions && (
            <div className="mt-2 text-xs text-red-700 font-medium">
              🏛️ Solo preguntas de exámenes oficiales reales{temaDisplayName ? ` de ${temaDisplayName}` : ''} ({officialQuestionsCount} total)
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
              className={`w-full bg-gradient-to-r ${
                testMode === 'examen'
                  ? 'from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700'
                  : 'from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
              } text-white py-4 px-6 rounded-xl text-lg font-bold transition-all duration-300 hover:scale-105 hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 leading-relaxed`}
            >
              {loading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Preparando {testMode === 'examen' ? 'Examen' : 'Test'}...</span>
                </div>
              ) : (
                <div className="text-center">
                  {testMode === 'examen' ? '📝' : '🚀'} Empezar {testMode === 'examen' ? 'Examen' : 'Test Personalizado'}<br />
                  ({maxQuestions} preguntas{onlyOfficialQuestions ? ' oficiales' : ''}{testMode === 'practica' && focusEssentialArticles ? ' + artículos clave' : ''}{testMode === 'practica' && adaptiveMode ? ' ✨' : ''})
                </div>
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
          {/* 🆕 Indicador de leyes seleccionadas */}
          {lawsData.length > 0 && selectedLaws.size < lawsData.length && (
            <span className="block text-blue-600 mt-1">
              📖 Filtro activo: {selectedLaws.size} de {lawsData.length} leyes seleccionadas
            </span>
          )}
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
                    <span>Priorización sobre preguntas de exámenes oficiales</span>
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
                  <p className="text-blue-100 text-sm">Extraídas de exámenes oficiales</p>
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

      {/* 🆕 Modal de Filtro de Artículos */}
      {showArticleModal && currentLawForArticles && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="bg-blue-600 text-white px-6 py-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">📋 Filtrar Artículos - {currentLawForArticles}</h3>
                <button
                  onClick={closeArticleModal}
                  className="text-white hover:text-gray-300 text-xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {loadingArticles ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Cargando artículos...</p>
                </div>
              ) : (
                <>
                  {/* Controles */}
                  <div className="flex gap-2 mb-4">
                    <button
                      onClick={() => selectAllArticlesForLaw(currentLawForArticles)}
                      className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200"
                    >
                      ☑️ Seleccionar todos
                    </button>
                    <button
                      onClick={() => deselectAllArticlesForLaw(currentLawForArticles)}
                      className="text-sm bg-gray-100 text-gray-700 px-3 py-1 rounded hover:bg-gray-200"
                    >
                      ❌ Deseleccionar todos
                    </button>
                  </div>

                  {/* Aviso de artículos sin preguntas */}
                  {(availableArticlesByLaw.get(currentLawForArticles) || []).some(art => art.question_count === 0) && (
                    <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                      Los artículos en gris no tienen preguntas disponibles.
                    </div>
                  )}

                  {/* Lista de artículos */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-96 overflow-y-auto">
                    {(availableArticlesByLaw.get(currentLawForArticles) || []).map((article) => {
                      const hasQuestions = article.question_count > 0;
                      const isSelected = hasQuestions && (selectedArticlesByLaw.get(currentLawForArticles)?.has(article.article_number) || false);
                      return (
                        <label
                          key={article.article_number}
                          className={`flex items-center space-x-2 p-2 rounded border transition-colors ${
                            !hasQuestions
                              ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                              : isSelected
                                ? 'bg-blue-50 border-blue-200 cursor-pointer'
                                : 'bg-white hover:bg-gray-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            disabled={!hasQuestions}
                            onChange={() => toggleArticleSelection(currentLawForArticles, article.article_number)}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <div className="flex-1">
                            <div className={`font-medium text-sm ${hasQuestions ? 'text-gray-900' : 'text-gray-400'}`}>
                              Art. {article.article_number}
                              {article.title && <span className={`font-normal ${hasQuestions ? 'text-gray-600' : 'text-gray-400'}`}> - {article.title}</span>}
                            </div>
                            <div className={`text-xs ${hasQuestions ? 'text-gray-600' : 'text-gray-400 italic'}`}>
                              {hasQuestions
                                ? `${article.question_count} pregunta${article.question_count > 1 ? 's' : ''}`
                                : 'Sin preguntas aún'}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Resumen */}
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <div className="text-sm text-blue-800">
                      ✓ {selectedArticlesByLaw.get(currentLawForArticles)?.size || 0} de {(availableArticlesByLaw.get(currentLawForArticles) || []).filter(art => art.question_count > 0).length} artículos seleccionados
                    </div>
                    <div className="text-xs text-blue-600 mt-1">
                      Preguntas estimadas: {(availableArticlesByLaw.get(currentLawForArticles) || [])
                        .filter(art => selectedArticlesByLaw.get(currentLawForArticles)?.has(art.article_number))
                        .reduce((sum, art) => sum + art.question_count, 0)}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
              <button
                onClick={closeArticleModal}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded hover:bg-gray-300 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={closeArticleModal}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Aplicar filtro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🆕 MODAL DE PREGUNTAS FALLADAS */}
      {showFailedQuestionsModal && failedQuestionsData && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white px-4 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                <span className="text-xl sm:text-2xl">❌</span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-bold leading-tight">
                    Preguntas Falladas{temaDisplayName ? ` - ${temaDisplayName}` : ''}
                  </h3>
                  <p className="text-red-100 text-xs sm:text-sm">
                    {failedQuestionsData.totalQuestions} preguntas diferentes • {failedQuestionsData.totalFailures} fallos en total
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowFailedQuestionsModal(false)
                  setOnlyFailedQuestions(false)
                  setFailedQuestionsData(null)
                }}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 max-h-[70vh] overflow-y-auto">
              
              {/* Información de preguntas disponibles */}
              <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-center">
                  <span className="text-2xl mr-3">📊</span>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-800">
                      {failedQuestionsData.totalQuestions}
                    </div>
                    <div className="text-sm text-blue-600">
                      preguntas diferentes que has fallado
                    </div>
                    <div className="text-xs text-blue-500 mt-1">
                      ({failedQuestionsData.totalFailures} fallos en total entre todas)
                    </div>
                  </div>
                </div>
              </div>

              {/* Opciones de ordenación */}
              <div className="mb-6">
                <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                  <span className="mr-2">🎯</span>
                  ¿Cómo quieres ordenar las preguntas?
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => setSelectedFailedOrder('most_failed')}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      selectedFailedOrder === 'most_failed'
                        ? 'border-red-500 bg-red-50'
                        : 'border-red-200 hover:border-red-400 hover:bg-red-50'
                    }`}
                  >
                    <div className="font-bold text-red-800 mb-1">🔥 Más veces falladas primero</div>
                    <div className="text-sm text-red-600">Empieza por las que más te cuesta dominar</div>
                  </button>
                  
                  <button
                    onClick={() => setSelectedFailedOrder('recent_failed')}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      selectedFailedOrder === 'recent_failed'
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-orange-200 hover:border-orange-400 hover:bg-orange-50'
                    }`}
                  >
                    <div className="font-bold text-orange-800 mb-1">⏰ Últimas falladas primero</div>
                    <div className="text-sm text-orange-600">Repasa tus errores más recientes</div>
                  </button>
                  
                  <button
                    onClick={() => setSelectedFailedOrder('oldest_failed')}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      selectedFailedOrder === 'oldest_failed'
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-blue-200 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                  >
                    <div className="font-bold text-blue-800 mb-1">📅 Más antiguas primero</div>
                    <div className="text-sm text-blue-600">Refuerza conceptos que llevas tiempo sin repasar</div>
                  </button>
                  
                  <button
                    onClick={() => setSelectedFailedOrder('random')}
                    className={`p-4 border-2 rounded-lg transition-all text-left ${
                      selectedFailedOrder === 'random'
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50'
                    }`}
                  >
                    <div className="font-bold text-purple-800 mb-1">🎲 Orden aleatorio</div>
                    <div className="text-sm text-purple-600">Mezcladas para variar el repaso</div>
                  </button>
                </div>
              </div>

              {/* Selector de cantidad (solo se muestra cuando se ha elegido orden) */}
              {selectedFailedOrder && (
                <div className="mb-6">
                  <h4 className="font-bold text-gray-800 mb-3 flex items-center">
                    <span className="mr-2">🔢</span>
                    ¿Cuántas preguntas quieres hacer?
                  </h4>
                  
                  <div className="grid grid-cols-5 gap-1 sm:gap-2 mb-4">
                    {(() => {
                      const totalQuestions = failedQuestionsData.totalQuestions;
                      const options: (number | 'all')[] = [];
                      
                      // Solo añadir opciones que sean menores al total disponible
                      if (totalQuestions > 10) options.push(10);
                      if (totalQuestions > 25) options.push(25);
                      if (totalQuestions > 50) options.push(50);
                      if (totalQuestions > 100) options.push(100);
                      
                      // Siempre añadir la opción "Todas" (número exacto)
                      options.push('all');
                      
                      return options.map((count) => (
                        <button
                          key={count}
                          onClick={() => setFailedQuestionsCount(count)}
                          className={`p-2 sm:p-3 border-2 rounded-lg transition-all text-center font-medium ${
                            failedQuestionsCount === count
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-200 hover:border-green-300 hover:bg-green-25'
                          }`}
                        >
                          <div className="text-sm sm:text-lg font-bold">
                            {count === 'all' ? totalQuestions : count}
                          </div>
                          <div className="text-xs text-gray-600 hidden sm:block">
                            {count === 'all' ? 'Todas' : 'preguntas'}
                          </div>
                        </button>
                      ));
                    })()}
                  </div>
                  
                  {/* Botón para iniciar el test */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => startFailedQuestionsTest(selectedFailedOrder)}
                      className="px-8 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-lg hover:from-green-700 hover:to-emerald-700 transition-all shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      🚀 Comenzar Test de Repaso
                    </button>
                  </div>
                </div>
              )}

              {/* Lista de preguntas falladas */}
              <div>
                <h5 className="font-bold text-gray-800 mb-3">📋 Tus preguntas falladas:</h5>
                <div className="max-h-64 overflow-y-auto space-y-2">
                  {failedQuestionsData.questions.slice(0, 20).map((question, index) => (
                    <div key={question.questionId} className="p-3 bg-gray-50 rounded-lg border">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-800 mb-1">
                            {question.questionText}
                          </div>
                          <div className="flex items-center space-x-3 text-xs text-gray-600">
                            <span>📝 Art. {question.articleNumber} {question.lawShortName}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              question.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                              question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                              question.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {question.difficulty}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-red-600">
                            ❌ {question.failedCount}
                          </div>
                          <div className="text-xs text-gray-500">
                            {new Date(question.lastFailed).toLocaleDateString('es-ES')}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  
                  {failedQuestionsData.questions.length > 20 && (
                    <div className="text-center text-sm text-gray-500 py-2">
                      ... y {failedQuestionsData.questions.length - 20} preguntas más
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 💾 Modal de Guardar Favorito */}
      {showSaveFavoriteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            {/* Header */}
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">💾</span>
                <div>
                  <h3 className="text-lg font-bold">Guardar configuración</h3>
                  <p className="text-green-100 text-sm">Guarda tu selección para reutilizarla</p>
                </div>
              </div>
              <button
                onClick={() => setShowSaveFavoriteModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-4">
              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={favoriteName}
                  onChange={(e) => setFavoriteName(e.target.value)}
                  placeholder="Ej: CE Títulos I y II"
                  maxLength={100}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>

              {/* Descripción (opcional) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Descripción <span className="text-gray-400">(opcional)</span>
                </label>
                <textarea
                  value={favoriteDescription}
                  onChange={(e) => setFavoriteDescription(e.target.value)}
                  placeholder="Ej: Para repasar derechos fundamentales..."
                  maxLength={500}
                  rows={2}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                />
              </div>

              {/* Resumen de lo que se va a guardar */}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <h4 className="font-medium text-green-800 mb-2 text-sm">Se guardará:</h4>
                <ul className="text-xs text-green-700 space-y-1">
                  <li>✓ {selectedLaws.size} ley{selectedLaws.size !== 1 ? 'es' : ''} seleccionada{selectedLaws.size !== 1 ? 's' : ''}</li>
                  {Array.from(selectedArticlesByLaw.values()).some(s => s.size > 0) && (
                    <li>✓ Filtro de artículos específicos</li>
                  )}
                </ul>
              </div>

              {/* Error */}
              {favoriteError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  ❌ {favoriteError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 rounded-b-xl flex justify-end gap-3">
              <button
                onClick={() => setShowSaveFavoriteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={saveCurrentAsFavorite}
                disabled={savingFavorite || !favoriteName.trim()}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  savingFavorite || !favoriteName.trim()
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {savingFavorite ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin">⏳</span> Guardando...
                  </span>
                ) : (
                  '💾 Guardar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 📂 Modal de Cargar Favorito */}
      {showLoadFavoriteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl max-w-lg w-full max-h-[80vh] shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">📂</span>
                <div>
                  <h3 className="text-lg font-bold">Cargar configuración</h3>
                  <p className="text-amber-100 text-sm">{savedFavorites.length} configuración{savedFavorites.length !== 1 ? 'es' : ''} guardada{savedFavorites.length !== 1 ? 's' : ''}</p>
                </div>
              </div>
              <button
                onClick={() => setShowLoadFavoriteModal(false)}
                className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
              >
                <span className="text-white font-bold">×</span>
              </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto max-h-[50vh]">
              {savedFavorites.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <span className="text-4xl block mb-2">📭</span>
                  <p>No tienes configuraciones guardadas</p>
                  <p className="text-sm mt-1">Usa "Guardar selección" para crear una</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedFavorites.map((favorite) => (
                    <div
                      key={favorite.id}
                      className="p-4 bg-white border border-gray-200 rounded-lg hover:border-amber-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-800 truncate">{favorite.name}</h4>
                          {favorite.description && (
                            <p className="text-sm text-gray-600 mt-1 line-clamp-2">{favorite.description}</p>
                          )}
                          <div className="flex flex-wrap gap-2 mt-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                              {(favorite.selectedLaws || []).length} ley{(favorite.selectedLaws || []).length !== 1 ? 'es' : ''}
                            </span>
                            {Object.keys(favorite.selectedArticlesByLaw || {}).length > 0 && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                                Con filtro de artículos
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            Guardado: {new Date(favorite.createdAt).toLocaleDateString('es-ES')}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 ml-4">
                          <button
                            onClick={() => loadFavorite(favorite)}
                            className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors"
                          >
                            Cargar
                          </button>
                          <button
                            onClick={() => deleteFavoriteHandler(favorite.id, favorite.name)}
                            className="px-4 py-2 bg-red-100 text-red-600 text-sm font-medium rounded-lg hover:bg-red-200 transition-colors"
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-4 flex justify-end">
              <button
                onClick={() => setShowLoadFavoriteModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Filtro por Títulos/Secciones (MULTI-SELECT) */}
      <SectionFilterModal
        isOpen={isSectionModalOpen}
        onClose={() => setIsSectionModalOpen(false)}
        lawSlug={preselectedLaw || (selectedLaws.size === 1 ? Array.from(selectedLaws)[0] : (lawsData.length === 1 ? lawsData[0].law_short_name : null))}
        selectedSections={selectedSectionFilters as any}
        onSectionSelect={(sections: SectionFilter[]) => {
          console.log('📚 TestConfigurator - Recibiendo selección del modal:', {
            sections,
            count: sections.length,
            titles: sections.map((s: SectionFilter) => s.title)
          })
          setSelectedSectionFilters(sections);
          // Limpiar filtro de artículos cuando se selecciona filtro de títulos
          if (sections.length > 0) {
            setSelectedArticlesByLaw(new Map());
          }
        }}
      />
    </div>
  );
};

export default TestConfigurator;
