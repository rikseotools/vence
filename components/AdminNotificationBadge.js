// components/AdminNotificationBadge.js - Badge con parpadeo para notificaciones admin
'use client'

export default function AdminNotificationBadge({ count, children, className = "" }) {
  const hasPending = count > 0
  const isUrgent = count > 5 // Más de 5 elementos pendientes es urgente

  return (
    <div className={`relative ${className} ${hasPending ? 'admin-urgent-pulse' : ''}`}>
      {children}
      
      {hasPending && (
        <>
          {/* Badge con número */}
          <div className={`absolute -top-2 -right-2 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center font-medium z-10 ${
            isUrgent ? 'admin-notification-blink' : 'bg-red-500 animate-pulse'
          }`}>
            {count > 99 ? '99+' : count}
          </div>
          
          {/* Efecto de pulso para casos urgentes */}
          {isUrgent && (
            <div className="absolute -top-3 -right-3 bg-red-300 rounded-full w-7 h-7 animate-ping opacity-40"></div>
          )}
        </>
      )}
    </div>
  )
}