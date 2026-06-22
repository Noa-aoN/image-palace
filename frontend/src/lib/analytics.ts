// GA4 (gtag.js) の薄いラッパー。
// - スクリプト本体の読み込みは Analytics コンポーネント側が担う（Consent Mode v2）
// - gtag.js は同意前から読み込まれるため、自前イベントは「同意済み」を別途確認して送る
// - NEXT_PUBLIC_GA_ID 未設定環境では全関数が no-op になる

import { useConsentStore } from '@/stores/consent'

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID

type GtagParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

/** gtag が利用可能 かつ ユーザーが計測に同意済みかを判定する */
function gtagReady(): boolean {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function' || !GA_ID) return false
  return useConsentStore.getState().consent === 'accepted'
}

/** カスタムイベントを送信する（単語など個人を特定しうる値は渡さない） */
export function trackEvent(name: string, params: GtagParams = {}): void {
  if (!gtagReady()) return
  window.gtag!('event', name, params)
}
