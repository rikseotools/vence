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
  // 🚫 PUBLICIDAD DESHABILITADA TEMPORALMENTE
  return null
}