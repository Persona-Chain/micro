import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatSatoshis(sats: number): string {
  if (sats >= 100000000) {
    return `${(sats / 100000000).toFixed(8)} BSV`
  }
  if (sats >= 100000) {
    return `${(sats / 100000000).toFixed(4)} BSV`
  }
  return `${sats.toLocaleString()} sats`
}

export function formatBsvFromSats(sats: number): string {
  const value = Number(sats || 0) / 100000000
  return `${value.toFixed(8)} BSV`
}

export function formatBsv(value: number): string {
  return `${Number(value || 0).toFixed(8)} BSV`
}

export function formatCurrency(sats: number, btcPrice: number = 65000): string {
  const BSV = sats / 100000000
  const usd = BSV * btcPrice
  return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str
  return str.slice(0, length) + '...'
}

export function timeAgo(date: Date | string): string {
  const now = new Date()
  const then = new Date(date)
  const thenTime = then.getTime()
  if (!Number.isFinite(thenTime)) return 'unknown time'

  const diffSeconds = Math.floor((now.getTime() - thenTime) / 1000)
  const seconds = Math.abs(diffSeconds)
  const suffix = diffSeconds >= 0 ? 'ago' : 'from now'

  if (seconds < 60) return diffSeconds >= 0 ? `${Math.max(1, seconds)}s ago` : `in ${Math.max(1, seconds)}s`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${suffix}`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${suffix}`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ${suffix}`
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ${suffix}`
  return `${Math.floor(seconds / 2592000)}mo ${suffix}`
}
