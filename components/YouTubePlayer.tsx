'use client'

import { useEffect, useRef, useCallback } from 'react'

interface YouTubePlayerProps {
  videoId: string
  lawName: string
}

// Track milestones to avoid duplicate events per session
const trackedMilestones = new Set<string>()

function trackVideoEvent(action: string, lawName: string, videoId: string, extra?: Record<string, unknown>) {
  const key = `${videoId}-${action}`
  if (action.startsWith('milestone_') && trackedMilestones.has(key)) return
  if (action.startsWith('milestone_')) trackedMilestones.add(key)

  fetch('/api/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      eventType: 'video_' + action,
      eventCategory: 'video',
      component: 'YouTubePlayer',
      action,
      label: lawName,
      value: { videoId, ...extra },
      pageUrl: window.location.pathname,
    }),
  }).catch(() => {})
}

declare global {
  interface Window {
    YT: any
    onYouTubeIframeAPIReady: () => void
  }
}

let apiLoaded = false
let apiReady = false
const pendingPlayers: Array<() => void> = []

function loadYouTubeAPI() {
  if (apiLoaded) return
  apiLoaded = true

  const tag = document.createElement('script')
  tag.src = 'https://www.youtube.com/iframe_api'
  document.head.appendChild(tag)

  window.onYouTubeIframeAPIReady = () => {
    apiReady = true
    pendingPlayers.forEach(fn => fn())
    pendingPlayers.length = 0
  }
}

function onAPIReady(fn: () => void) {
  if (apiReady) fn()
  else pendingPlayers.push(fn)
}

export default function YouTubePlayer({ videoId, lawName }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<any>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)

  const setupPlayer = useCallback(() => {
    if (!containerRef.current || playerRef.current) return

    const divId = `yt-player-${videoId}`
    containerRef.current.id = divId

    playerRef.current = new window.YT.Player(divId, {
      videoId,
      playerVars: { rel: 0, modestbranding: 1 },
      events: {
        onReady: () => {
          trackVideoEvent('loaded', lawName, videoId)
        },
        onStateChange: (event: any) => {
          const state = event.data
          const player = event.target

          if (state === window.YT.PlayerState.PLAYING) {
            startTimeRef.current = Date.now()
            trackVideoEvent('play', lawName, videoId)

            if (intervalRef.current) clearInterval(intervalRef.current)
            intervalRef.current = setInterval(() => {
              try {
                const duration = player.getDuration()
                const current = player.getCurrentTime()
                if (duration <= 0) return
                const pct = Math.floor((current / duration) * 100)
                if (pct >= 25) trackVideoEvent('milestone_25', lawName, videoId)
                if (pct >= 50) trackVideoEvent('milestone_50', lawName, videoId)
                if (pct >= 75) trackVideoEvent('milestone_75', lawName, videoId)
                if (pct >= 95) trackVideoEvent('milestone_100', lawName, videoId)
              } catch { /* player might be destroyed */ }
            }, 5000)
          }

          if (state === window.YT.PlayerState.PAUSED) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            const watchedSec = Math.round((Date.now() - startTimeRef.current) / 1000)
            trackVideoEvent('pause', lawName, videoId, { watched_seconds: watchedSec })
          }

          if (state === window.YT.PlayerState.ENDED) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            trackVideoEvent('ended', lawName, videoId)
          }
        },
      },
    })
  }, [videoId, lawName])

  useEffect(() => {
    loadYouTubeAPI()
    onAPIReady(setupPlayer)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (playerRef.current?.destroy) playerRef.current.destroy()
      playerRef.current = null
    }
  }, [setupPlayer])

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl shadow-lg"
      style={{ aspectRatio: '16/9' }}
    />
  )
}
