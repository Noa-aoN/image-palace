'use client'

import { usePathname } from 'next/navigation'
import { useUiStore } from '@/stores/ui'

// ハブページのメインエリアに敷く全面背景（LP 的な演出）。
// 非スクロールの外側コンテナに絶対配置（-z-10）で置くため、内容がスクロールしても全面に残る。
// サイドバー幅ぶん左を空け、メインエリアの矩形を基準に cover/center させる（フレーミングをずらさない）。
// 濃い装飾画像なので、ページ背景色に金味（--palace）を少し混ぜた半透明オーバーレイを重ねて薄くし、
// 下方向へフェード。さらに下部だけ弱い blur を重ねて霞ませ、本文の可読性を保つ。
const BACKDROPS: { prefix: string; src: string }[] = [
  { prefix: '/entrance', src: '/backgrounds/entrance.jpg' },
  { prefix: '/atelier', src: '/backgrounds/atelier.jpg' },
  { prefix: '/library', src: '/backgrounds/library.jpg' },
  { prefix: '/study', src: '/backgrounds/study.jpg' },
  { prefix: '/myroom', src: '/backgrounds/myroom.jpg' },
]

export function HubBackground() {
  const pathname = usePathname()
  const sidebarExpanded = useUiStore((s) => s.sidebarExpanded)
  const match = BACKDROPS.find((b) => pathname === b.prefix || pathname.startsWith(`${b.prefix}/`))
  if (!match) return null

  // サイドバー幅（md 未満は非表示なので left-0）。この幅ぶん右へ寄せて main の矩形に合わせる。
  const sidebarWidth = sidebarExpanded ? '240px' : '72px'

  // ページ背景色に金味を少しだけ混ぜた色を、上下でアルファを変えてオーバーレイにする
  const warm = 'color-mix(in srgb, var(--background) 92%, var(--palace))'
  // 上端は白をほんの少し混ぜて明るく（白み）
  const warmTop = `color-mix(in srgb, ${warm} 90%, white)`
  const overlay =
    'linear-gradient(to bottom, ' +
    `color-mix(in srgb, ${warmTop} 82%, transparent), ` +
    `color-mix(in srgb, ${warm} 91%, transparent))`
  const layer: React.CSSProperties = {
    backgroundImage: `${overlay}, url("${match.src}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
  }
  // 上下の端を blur で霞ませる（中央はシャープ）。下部をやや広めに効かせる。
  const edgeMask = 'linear-gradient(to bottom, black 0%, transparent 28%, transparent 62%, black 100%)'

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 left-0 -z-10 overflow-hidden transition-[left] duration-200 md:left-[var(--sb)]"
      style={{ '--sb': sidebarWidth } as React.CSSProperties}
    >
      {/* メインエリア全面（シャープ） */}
      <div className="absolute inset-0 bg-cover bg-center" style={layer} />
      {/* 上下の端に弱い blur を重ねて霞ませる（中央はシャープ） */}
      <div
        className="absolute inset-0 blur-[3px]"
        style={{ ...layer, maskImage: edgeMask, WebkitMaskImage: edgeMask }}
      />
    </div>
  )
}
