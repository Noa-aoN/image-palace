// GA4 (gtag.js) の薄いラッパー。
// - スクリプト本体の読み込みと同意ゲートは Analytics コンポーネント側が担う
// - ここでは window.gtag が存在する（＝同意済み＆読込済み）場合のみ送信する
// - NEXT_PUBLIC_GA_ID 未設定環境では全関数が no-op になる

export const GA_ID = process.env.NEXT_PUBLIC_GA_ID

type GtagParams = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

/** gtag が利用可能か（＝同意済みでタグ読込済み）を判定する */
function gtagReady(): boolean {
  return typeof window !== 'undefined' && typeof window.gtag === 'function' && !!GA_ID
}

/** カスタムイベントを送信する（単語など個人を特定しうる値は渡さない） */
export function trackEvent(name: string, params: GtagParams = {}): void {
  if (!gtagReady()) return
  window.gtag!('event', name, params)
}
