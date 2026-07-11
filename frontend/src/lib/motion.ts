/**
 * アニメーションを止めるべきかを返す（JS 駆動の演出用。CSS 側は data-motion / メディアクエリで対応）。
 * SettingsBootstrap が環境設定を解決して <html data-motion="on|off"> を付けるので、それを最優先で見る。
 * 属性が付く前（初回描画）や未ログイン時は、端末（OS）の prefers-reduced-motion にフォールバックする。
 */
export function motionDisabled(): boolean {
  if (typeof document === 'undefined') return false

  const motion = document.documentElement.dataset.motion
  if (motion === 'off') return true
  if (motion === 'on') return false

  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
