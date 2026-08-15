'use client'

import { usePathname } from 'next/navigation'
import { useUiStore } from '@/stores/ui'

// ハブページのメインエリアに敷く全面背景（LP 的な演出）。
// 非スクロールの外側コンテナに絶対配置（-z-10）で置くため、内容がスクロールしても全面に残る。
// サイドバー幅ぶん左を空け、メインエリアの矩形を基準に cover/center させる（フレーミングをずらさない）。
// 濃い装飾画像なので、ページ背景色に金味（--palace）を混ぜた半透明オーバーレイで薄くし、下方向へフェード、
// 上下端に弱い blur を重ねて霞ませ、本文の可読性を保つ。

// route プレフィックス → 背景画像ファイル名（/backgrounds/<file>.jpg）。
// 配下ページ（/guide/[slug] 等）も startsWith で同じ背景を引き継ぐ。
const BACKDROPS: { prefix: string; file: string }[] = [
  { prefix: '/entrance', file: 'entrance' },
  { prefix: '/atelier', file: 'atelier' },
  { prefix: '/library', file: 'library' },
  { prefix: '/study', file: 'study' },
  { prefix: '/myroom', file: 'myroom' },
  // 市街・公式
  { prefix: '/delphi', file: 'acropolis' },
  { prefix: '/delphi', file: 'acropolis' },
  { prefix: '/agora', file: 'agora' },
  { prefix: '/stadion', file: 'stadion' },
  { prefix: '/guide', file: 'guide' },
  { prefix: '/blog', file: 'blog' },
]

// オーバーレイ・マスク・レイヤー基底は静的なので一度だけ算出する。
// ページ背景色に金味を混ぜ、上端は白をほんの少し足して明るく（白み）、上下でアルファを変える。
const WARM = 'color-mix(in srgb, var(--background) 92%, var(--palace))'
const WARM_TOP = `color-mix(in srgb, ${WARM} 90%, white)`
const OVERLAY =
  `linear-gradient(to bottom, color-mix(in srgb, ${WARM_TOP} 82%, transparent), ` +
  `color-mix(in srgb, ${WARM} 91%, transparent))`
// 上下の端を blur で霞ませる（中央はシャープ）。下部をやや広めに効かせる。
const EDGE_MASK = 'linear-gradient(to bottom, black 0%, transparent 28%, transparent 62%, black 100%)'
const LAYER_BASE: React.CSSProperties = {
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
}

export function HubBackground() {
  const pathname = usePathname()
  const sidebarExpanded = useUiStore((s) => s.sidebarExpanded)
  const match = BACKDROPS.find((b) => pathname === b.prefix || pathname.startsWith(`${b.prefix}/`))
  if (!match) return null

  const layer: React.CSSProperties = {
    ...LAYER_BASE,
    backgroundImage: `${OVERLAY}, url("/backgrounds/${match.file}.jpg")`,
  }
  // md 未満はサイドバー非表示なので left-0。展開状態に応じて右へ寄せる。
  const sidebarWidth = sidebarExpanded ? '240px' : '72px'

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-y-0 right-0 left-0 -z-10 overflow-hidden transition-[left] duration-200 md:left-[var(--sb)]"
      style={{ '--sb': sidebarWidth } as React.CSSProperties}
    >
      {/* メインエリア全面（シャープ） */}
      <div className="absolute inset-0" style={layer} />
      {/* 上下の端に弱い blur を重ねて霞ませる */}
      <div className="absolute inset-0 blur-[3px]" style={{ ...layer, maskImage: EDGE_MASK, WebkitMaskImage: EDGE_MASK }} />
    </div>
  )
}
