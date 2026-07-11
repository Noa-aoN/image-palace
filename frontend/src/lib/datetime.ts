// 相対時刻（「3分前」「2日前」）の表示。Intl.RelativeTimeFormat を使うので依存追加は不要。
const rtf = new Intl.RelativeTimeFormat('ja', { numeric: 'auto' })

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

export function formatRelativeTime(iso: string): string {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000
  if (!Number.isFinite(seconds)) return ''
  if (seconds < 60) return 'たった今'

  for (const [unit, perUnit] of UNITS) {
    if (seconds >= perUnit) {
      return rtf.format(-Math.floor(seconds / perUnit), unit)
    }
  }
  return 'たった今'
}
