// components/AdSenseComponent.js
'use client'
import { useEffect, useRef } from 'react'

export default function AdSenseComponent({ 
  adSlot, 
  style = { display: 'block' }, 
  format = 'auto',
  fullWidthResponsive = true,
  className = ''
}) {
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
        style={style}
        data-ad-client="ca-pub-5346427920432730"
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={fullWidthResponsive}
      />
    </div>
  )
}