// components/AdSenseComponent.js
'use client'
import { useEffect, useRef } from 'react'
import { getAdSlot, getAdStyle } from '../lib/adsense-config'

export default function AdSenseComponent({ 
  adSlot = null, 
  adType = 'TEST_AFTER_ANSWER',
  style = null, 
  format = 'auto',
  fullWidthResponsive = true,
  className = ''
}) {
  // Usar configuración dinámica
  const finalAdSlot = adSlot || getAdSlot(adType)
  const finalStyle = style || getAdStyle(adType)
  const adRef = useRef(null)

  useEffect(() => {
    try {
      // Push the ad to AdSense queue
      if (typeof window !== 'undefined' && window.adsbygoogle) {
        (window.adsbygoogle = window.adsbygoogle || []).push({})
      }
    } catch (err) {
      console.warn('AdSense error:', err)
    }
  }, [])

  return (
    <div className={`adsense-container ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={finalStyle}
        data-ad-client="ca-pub-5346427920432730"
        data-ad-slot={finalAdSlot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  )
}