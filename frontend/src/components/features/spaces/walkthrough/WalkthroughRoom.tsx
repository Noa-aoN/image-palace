'use client'

// ルーム型のフェーズ1バリエーション: 道の後退は使わず、柔らかい背景の上で
// パネル（WalkthroughPanel）を position 順にめくる（自動再生の停留はドライバ共有）。
// フェーズ2で x/y 俯瞰パンなどに拡張予定。
export function WalkthroughRoom() {
  return (
    <div
      className="absolute inset-0"
      aria-hidden
      style={{
        background:
          'radial-gradient(120% 80% at 50% 20%, color-mix(in srgb, var(--palace) 12%, var(--background)), var(--background) 70%)',
      }}
    />
  )
}
