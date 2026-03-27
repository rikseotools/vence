// lib/utils/landing-colors.ts — Mapa de colores para landings dinámicas
// Las clases Tailwind deben ser literales completas para que el purge las conserve.

export interface LandingColorScheme {
  gradient: string
  badge: string
  badgeText: string
  statColor: string
  subtitleBg: string
  subtitleText: string
  hoverBorder: string
  linkHover: string
  borderAccent: string
  oepText: string
}

export const COLOR_SCHEMES: Record<string, LandingColorScheme> = {
  emerald: {
    gradient: 'bg-gradient-to-r from-emerald-600 to-green-600',
    badge: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    statColor: 'text-emerald-600',
    subtitleBg: 'bg-emerald-100',
    subtitleText: 'text-emerald-700',
    hoverBorder: 'hover:border-emerald-300',
    linkHover: 'hover:text-emerald-600',
    borderAccent: 'border-emerald-500',
    oepText: 'text-green-100',
  },
  cyan: {
    gradient: 'bg-gradient-to-r from-cyan-600 to-cyan-700',
    badge: 'bg-cyan-100',
    badgeText: 'text-cyan-800',
    statColor: 'text-cyan-600',
    subtitleBg: 'bg-cyan-100',
    subtitleText: 'text-cyan-700',
    hoverBorder: 'hover:border-cyan-300',
    linkHover: 'hover:text-cyan-600',
    borderAccent: 'border-cyan-500',
    oepText: 'text-cyan-100',
  },
  blue: {
    gradient: 'bg-gradient-to-r from-blue-600 to-indigo-600',
    badge: 'bg-blue-100',
    badgeText: 'text-blue-800',
    statColor: 'text-blue-600',
    subtitleBg: 'bg-blue-100',
    subtitleText: 'text-blue-700',
    hoverBorder: 'hover:border-blue-300',
    linkHover: 'hover:text-blue-600',
    borderAccent: 'border-blue-500',
    oepText: 'text-blue-100',
  },
  purple: {
    gradient: 'bg-gradient-to-r from-purple-600 to-indigo-600',
    badge: 'bg-purple-100',
    badgeText: 'text-purple-800',
    statColor: 'text-purple-600',
    subtitleBg: 'bg-purple-100',
    subtitleText: 'text-purple-700',
    hoverBorder: 'hover:border-purple-300',
    linkHover: 'hover:text-purple-600',
    borderAccent: 'border-purple-500',
    oepText: 'text-purple-100',
  },
  red: {
    gradient: 'bg-gradient-to-r from-red-600 to-red-700',
    badge: 'bg-red-100',
    badgeText: 'text-red-800',
    statColor: 'text-red-600',
    subtitleBg: 'bg-red-100',
    subtitleText: 'text-red-700',
    hoverBorder: 'hover:border-red-300',
    linkHover: 'hover:text-red-600',
    borderAccent: 'border-red-500',
    oepText: 'text-red-100',
  },
  amber: {
    gradient: 'bg-gradient-to-r from-amber-600 to-amber-700',
    badge: 'bg-amber-100',
    badgeText: 'text-amber-800',
    statColor: 'text-amber-600',
    subtitleBg: 'bg-amber-100',
    subtitleText: 'text-amber-700',
    hoverBorder: 'hover:border-amber-300',
    linkHover: 'hover:text-amber-600',
    borderAccent: 'border-amber-500',
    oepText: 'text-amber-100',
  },
  orange: {
    gradient: 'bg-gradient-to-r from-orange-600 to-orange-700',
    badge: 'bg-orange-100',
    badgeText: 'text-orange-800',
    statColor: 'text-orange-600',
    subtitleBg: 'bg-orange-100',
    subtitleText: 'text-orange-700',
    hoverBorder: 'hover:border-orange-300',
    linkHover: 'hover:text-orange-600',
    borderAccent: 'border-orange-500',
    oepText: 'text-orange-100',
  },
  rose: {
    gradient: 'bg-gradient-to-r from-rose-600 to-rose-700',
    badge: 'bg-rose-100',
    badgeText: 'text-rose-800',
    statColor: 'text-rose-600',
    subtitleBg: 'bg-rose-100',
    subtitleText: 'text-rose-700',
    hoverBorder: 'hover:border-rose-300',
    linkHover: 'hover:text-rose-600',
    borderAccent: 'border-rose-500',
    oepText: 'text-rose-100',
  },
  green: {
    gradient: 'bg-gradient-to-r from-green-600 to-green-700',
    badge: 'bg-green-100',
    badgeText: 'text-green-800',
    statColor: 'text-green-600',
    subtitleBg: 'bg-green-100',
    subtitleText: 'text-green-700',
    hoverBorder: 'hover:border-green-300',
    linkHover: 'hover:text-green-600',
    borderAccent: 'border-green-500',
    oepText: 'text-green-100',
  },
  violet: {
    gradient: 'bg-gradient-to-r from-violet-600 to-violet-700',
    badge: 'bg-violet-100',
    badgeText: 'text-violet-800',
    statColor: 'text-violet-600',
    subtitleBg: 'bg-violet-100',
    subtitleText: 'text-violet-700',
    hoverBorder: 'hover:border-violet-300',
    linkHover: 'hover:text-violet-600',
    borderAccent: 'border-violet-500',
    oepText: 'text-violet-100',
  },
}

export function getColorScheme(color: string | null): LandingColorScheme {
  return COLOR_SCHEMES[color || 'emerald'] || COLOR_SCHEMES.emerald
}
