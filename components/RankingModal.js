'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import UserProfileModal from './UserProfileModal'

const PAGE_SIZE = 50

export default function RankingModal({ isOpen, onClose }) {
  const { user } = useAuth()
  const [ranking, setRanking] = useState([])
  const [streakRanking, setStreakRanking] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [currentUserRank, setCurrentUserRank] = useState(null)
  const [timeFilter, setTimeFilter] = useState('week')
  const [streakTimeFilter, setStreakTimeFilter] = useState('week')
  const [streakCategory, setStreakCategory] = useState('all')
  const [activeTab, setActiveTab] = useState('ranking')

  const scrollContainerRef = useRef(null)
  const loadMoreRef = useRef(null)

  useEffect(() => {
    if (isOpen && user) {
      if (activeTab === 'ranking') {
        loadRanking(false)
      } else if (activeTab === 'rachas') {
        loadStreakRanking(false)
      }
    }
  }, [isOpen, user, timeFilter, streakTimeFilter, streakCategory, activeTab])

  // Auto-detect user category when opening streaks tab
  useEffect(() => {
    if (!isOpen || !user || activeTab !== 'rachas') return

    fetch(`/api/ranking/streaks?timeFilter=${streakTimeFilter}&category=all&limit=1&userId=${user.id}`)
      .then(r => r.json())
      .then(data => {
        // If user's first streak entry says isNovato, auto-select that category
        const entry = data.streaks?.find(s => s.userId === user.id)
        if (entry) {
          setStreakCategory(entry.isNovato ? 'principiantes' : 'veteranos')
        }
      })
      .catch(() => {})
  }, [isOpen, activeTab, user])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = 'unset'
      }
    }
  }, [isOpen])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!isOpen || loading) return

    const sentinel = loadMoreRef.current
    const container = scrollContainerRef.current
    if (!sentinel || !container) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          if (activeTab === 'ranking') {
            loadRanking(true)
          } else {
            loadStreakRanking(true)
          }
        }
      },
      { root: container, threshold: 0.1 }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [isOpen, loading, hasMore, loadingMore, activeTab, ranking.length, streakRanking.length])

  const loadRanking = useCallback(async (append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setRanking([])
      setCurrentUserRank(null)
    }

    try {
      const offset = append ? ranking.length : 0
      const params = new URLSearchParams({
        timeFilter,
        limit: String(PAGE_SIZE),
        offset: String(offset),
        minQuestions: '1',
      })
      if (user?.id) params.set('userId', user.id)

      const res = await fetch(`/api/ranking?${params}`)
      const data = await res.json()

      if (!data.success) return

      // Mark current user
      const entries = (data.ranking || []).map(e => ({
        ...e,
        isCurrentUser: e.userId === user?.id,
      }))

      if (append) {
        setRanking(prev => [...prev, ...entries])
      } else {
        setRanking(entries)
      }

      setHasMore(data.hasMore ?? false)

      // User position (only on first load)
      if (!append && data.userPosition) {
        const userInList = entries.find(e => e.isCurrentUser)
        if (userInList) {
          setCurrentUserRank(userInList)
        } else {
          setCurrentUserRank({
            userId: user.id,
            totalQuestions: data.userPosition.totalQuestions,
            correctAnswers: data.userPosition.correctAnswers,
            accuracy: data.userPosition.accuracy,
            rank: data.userPosition.rank,
            name: 'Tu',
            ciudad: null,
            avatar: null,
            isCurrentUser: true,
          })
        }
      } else if (!append) {
        const userInList = entries.find(e => e.isCurrentUser)
        setCurrentUserRank(userInList || null)
      }
    } catch (error) {
      console.error('Error loading ranking')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [timeFilter, ranking.length, user])

  const loadStreakRanking = useCallback(async (append = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
      setStreakRanking([])
    }

    try {
      const offset = append ? streakRanking.length : 0
      const params = new URLSearchParams({
        timeFilter: streakTimeFilter,
        category: streakCategory,
        limit: String(PAGE_SIZE),
        offset: String(offset),
      })

      const res = await fetch(`/api/ranking/streaks?${params}`)
      const data = await res.json()

      if (!data.success) return

      const entries = (data.streaks || []).map(e => ({
        ...e,
        isCurrentUser: e.userId === user?.id,
      }))

      if (append) {
        setStreakRanking(prev => [...prev, ...entries])
      } else {
        setStreakRanking(entries)
      }

      setHasMore(data.hasMore ?? false)
    } catch (error) {
      console.error('Error loading streak ranking')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [streakTimeFilter, streakCategory, streakRanking.length, user])

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1: return '🥇'
      case 2: return '🥈'
      case 3: return '🥉'
      default: return '🏅'
    }
  }

  const getRankColor = (rank) => {
    if (rank === 1) return 'text-yellow-600'
    if (rank === 2) return 'text-gray-500'
    if (rank === 3) return 'text-amber-600'
    return 'text-gray-400'
  }

  const renderAvatar = (avatar, name) => {
    if (!avatar) {
      const initial = name?.charAt(0).toUpperCase() || 'U'
      return (
        <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
          {initial}
        </div>
      )
    }

    if (avatar.type === 'automatic') {
      return (
        <div className="w-8 h-8 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-lg">
          {avatar.emoji}
        </div>
      )
    }

    if (avatar.type === 'predefined') {
      return (
        <div className={`w-8 h-8 bg-gradient-to-r ${avatar.color} rounded-full flex items-center justify-center text-white text-base`}>
          {avatar.emoji}
        </div>
      )
    }

    if (avatar.type === 'uploaded' || avatar.type === 'google') {
      return (
        <img
          src={avatar.url}
          alt={name}
          className="w-8 h-8 rounded-full object-cover"
          onError={(e) => {
            e.target.style.display = 'none'
            const initial = name?.charAt(0).toUpperCase() || 'U'
            const fallback = document.createElement('div')
            fallback.className = 'w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm'
            fallback.textContent = initial
            e.target.parentNode.replaceChild(fallback, e.target)
          }}
        />
      )
    }

    const initial = name?.charAt(0).toUpperCase() || 'U'
    return (
      <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
        {initial}
      </div>
    )
  }

  const handleUserClick = (userInfo) => {
    setSelectedUser({
      userId: userInfo.userId,
      userName: userInfo.name
    })
    setShowProfileModal(true)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[999] overflow-y-auto"
    >
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white rounded-xl w-[90%] max-w-sm sm:w-full sm:max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg sm:text-2xl font-bold flex items-center">
              🏆 Ranking de Opositores
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm">Clasificación de estudiantes</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-white/20 hover:bg-white/30 rounded-full flex items-center justify-center transition-colors"
          >
            <span className="text-white font-bold">×</span>
          </button>
        </div>

        <div ref={scrollContainerRef} className="p-3 sm:p-6 max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          {/* Tabs */}
          <div className="flex justify-center space-x-1 mb-4 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('ranking')}
              data-tab="ranking"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'ranking'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🏆 Ranking
            </button>
            <button
              onClick={() => setActiveTab('rachas')}
              data-tab="rachas"
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'rachas'
                  ? 'bg-white text-orange-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              🔥 Rachas
            </button>
          </div>

          {/* Filtros de tiempo - solo en tab ranking */}
          {activeTab === 'ranking' && (
            <div className="flex justify-center space-x-2 mb-6">
            <button
              onClick={() => setTimeFilter('today')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'today'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Hoy
            </button>
            <button
              onClick={() => setTimeFilter('yesterday')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'yesterday'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Ayer
            </button>
            <button
              onClick={() => setTimeFilter('week')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'week'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Esta semana
            </button>
            <button
              onClick={() => setTimeFilter('month')}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                timeFilter === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Este mes
            </button>
          </div>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Cargando {activeTab === 'ranking' ? 'ranking' : 'rachas'}...</p>
            </div>
          ) : (
            <>
              {activeTab === 'ranking' ? (
                <>
                  {/* Tu posición */}
                  {currentUserRank && currentUserRank.rank > 10 && (
                    <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <span className="text-2xl">{getRankIcon(currentUserRank.rank)}</span>
                          {renderAvatar(currentUserRank.avatar, currentUserRank.name)}
                          <div>
                            <p className="font-bold text-blue-700">
                              Tu posición: #{currentUserRank.rank}
                              {currentUserRank.ciudad && <span className="text-gray-500 text-sm ml-1">• {currentUserRank.ciudad}</span>}
                            </p>
                            <p className="text-sm text-blue-600">{currentUserRank.accuracy}% de aciertos</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-green-600">{currentUserRank.accuracy}%</div>
                          <div className="text-xs text-gray-500">{currentUserRank.totalQuestions} preguntas</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Top Estudiantes */}
                  <div className="space-y-3">
                    <h3 className="font-bold text-gray-800 mb-4 text-center">
                      🏆 Top Estudiantes
                    </h3>

                    {ranking.length === 0 ? (
                      <div className="text-center py-8">
                        <div className="text-4xl mb-3">🏆</div>
                        <p className="text-gray-600">¡Sé el primero en el ranking!</p>
                        <p className="text-sm text-gray-500">Responde al menos 1 pregunta para aparecer</p>
                      </div>
                    ) : (
                      ranking.map((user) => (
                        <div
                          key={user.userId}
                          onClick={() => handleUserClick(user)}
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                            user.isCurrentUser
                              ? 'bg-blue-50 border border-blue-200 hover:bg-blue-100'
                              : 'bg-gray-50 hover:bg-gray-100'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${getRankColor(user.rank)}`}>
                              {user.rank <= 3 ? getRankIcon(user.rank) : `#${user.rank}`}
                            </div>
                            {renderAvatar(user.avatar, user.name)}
                            <div>
                              <p className={`font-medium ${user.isCurrentUser ? 'text-blue-700' : 'text-gray-800'}`}>
                                {user.name}
                                {user.ciudad && <span className="text-gray-500 text-sm ml-1">• {user.ciudad}</span>}
                                {user.isCurrentUser && <span className="ml-1 text-blue-600 text-sm">(Tú)</span>}
                              </p>
                              <p className="text-xs text-gray-500">
                                {user.correctAnswers} correctas sobre {user.totalQuestions} totales
                              </p>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-bold text-green-600">{user.accuracy}%</div>
                            <div className="text-xs text-gray-400">{user.totalQuestions} preguntas</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                /* Tab Rachas */
                <div className="space-y-3">
                  {/* Filtros de tiempo para rachas */}
                  <div className="flex justify-center space-x-2 mb-2">
                    <button
                      onClick={() => setStreakTimeFilter('week')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        streakTimeFilter === 'week'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Esta semana
                    </button>
                    <button
                      onClick={() => setStreakTimeFilter('month')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        streakTimeFilter === 'month'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {new Date().toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleString('es-ES', { month: 'long' }).slice(1)}
                    </button>
                    <button
                      onClick={() => setStreakTimeFilter('all')}
                      className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                        streakTimeFilter === 'all'
                          ? 'bg-orange-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Acumulado
                    </button>
                  </div>

                  {/* Filtros de categoría (Principiantes/Veteranos) */}
                  <div className="flex justify-center space-x-2 mb-4">
                    <button
                      onClick={() => setStreakCategory('all')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        streakCategory === 'all'
                          ? 'bg-purple-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Todos
                    </button>
                    <button
                      onClick={() => setStreakCategory('principiantes')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        streakCategory === 'principiantes'
                          ? 'bg-green-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      🌱 Principiantes
                    </button>
                    <button
                      onClick={() => setStreakCategory('veteranos')}
                      className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                        streakCategory === 'veteranos'
                          ? 'bg-amber-600 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      ⭐ Veteranos
                    </button>
                  </div>

                  <h3 className="font-bold text-gray-800 dark:text-white mb-2 text-center">
                    🔥 {streakTimeFilter === 'week'
                      ? 'Rachas de la Semana'
                      : streakTimeFilter === 'month'
                        ? `Rachas de ${new Date().toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date().toLocaleString('es-ES', { month: 'long' }).slice(1)}`
                        : 'Top Rachas (Acumulado)'}
                    {streakCategory !== 'all' && (
                      <span className={`ml-2 text-sm ${streakCategory === 'principiantes' ? 'text-green-600' : 'text-amber-600'}`}>
                        ({streakCategory === 'principiantes' ? '🌱 Principiantes' : '⭐ Veteranos'})
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-gray-400 text-center mb-4">
                    {streakCategory === 'principiantes' && '🌱 Usuarios con menos de 30 días en Vence • '}
                    {streakCategory === 'veteranos' && '⭐ Usuarios con más de 30 días en Vence • '}
                    {streakTimeFilter === 'week'
                      ? 'Días de estudio esta semana'
                      : streakTimeFilter === 'month'
                        ? 'Días de estudio este mes'
                        : 'Días consecutivos de estudio'
                    }
                    <br />
                    Sin días de gracia: si un día no estudias, perderás la racha
                  </p>

                  {streakRanking.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="text-4xl mb-3">{streakCategory === 'principiantes' ? '🌱' : streakCategory === 'veteranos' ? '⭐' : '🔥'}</div>
                      <p className="text-gray-600">
                        {streakCategory === 'principiantes'
                          ? '¡No hay principiantes con racha activa!'
                          : streakCategory === 'veteranos'
                            ? '¡No hay veteranos con racha activa!'
                            : '¡Nadie tiene racha activa!'}
                      </p>
                      <p className="text-sm text-gray-500">Estudia varios días seguidos para aparecer aquí</p>
                    </div>
                  ) : (
                    streakRanking.map((user) => (
                      <div
                        key={user.userId}
                        onClick={() => handleUserClick(user)}
                        className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer ${
                          user.isCurrentUser
                            ? 'bg-orange-50 border border-orange-200 hover:bg-orange-100'
                            : 'bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-lg ${
                            user.rank === 1 ? 'text-yellow-600' :
                            user.rank === 2 ? 'text-gray-500' :
                            user.rank === 3 ? 'text-amber-600' : 'text-gray-400'
                          }`}>
                            {user.rank <= 3 ? getRankIcon(user.rank) : `#${user.rank}`}
                          </div>
                          {renderAvatar(user.avatar, user.name)}
                          <div>
                            <p className={`font-medium ${user.isCurrentUser ? 'text-orange-700' : 'text-gray-800'}`}>
                              {user.name}
                              {user.ciudad && <span className="text-gray-500 text-sm ml-1">• {user.ciudad}</span>}
                              {user.isCurrentUser && <span className="ml-1 text-orange-600 text-sm">(Tú)</span>}
                            </p>
                            <p className="text-xs text-gray-500">
                              {streakTimeFilter === 'week'
                                ? 'Días activos esta semana'
                                : streakTimeFilter === 'month'
                                  ? 'Días activos este mes'
                                  : 'Días consecutivos estudiando'}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-orange-600 text-xl">
                            🔥 {user.streak}
                          </div>
                          <div className="text-xs text-gray-400">
                            {streakTimeFilter === 'all' ? 'días seguidos' : 'días'}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Sentinel for infinite scroll */}
              <div ref={loadMoreRef} className="py-2">
                {loadingMore && (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                  </div>
                )}
              </div>
            </>
          )}

          {/* Footer */}
          <div className="mt-6 pt-4 border-t text-center">
            <p className="text-xs text-gray-500">
              Mínimo 1 pregunta para aparecer en el ranking
            </p>
          </div>
        </div>
        </div>
      </div>

      {/* Modal de perfil de usuario */}
      {selectedUser && (
        <UserProfileModal
          isOpen={showProfileModal}
          onClose={() => {
            setShowProfileModal(false)
            setSelectedUser(null)
          }}
          userId={selectedUser.userId}
          userName={selectedUser.userName}
        />
      )}
    </div>
  )
}
