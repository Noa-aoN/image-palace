'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useSettingsStore } from '@/stores/settings'
import {
  DEFAULT_DISPLAY_STYLE,
  DEFAULT_SHELF_ORIENTATION,
  isDisplayStyle,
  isShelfOrientation,
  type Surface,
} from '@/lib/display-style'

/** 現在の表示スタイル。設定が届くまでは既定（宮殿スタイル）で描く */
export function useDisplayStyle() {
  const value = useSettingsStore((s) => s.settings?.display_style)
  return isDisplayStyle(value) ? value : DEFAULT_DISPLAY_STYLE
}

/**
 * 棚の並べ方。シンプル表示のときは段組みしないので rows 固定として扱う。
 * 表示スタイルとは別軸の設定にしてあり、宮殿スタイルのときだけ効く。
 */
export function useShelfOrientation() {
  const style = useDisplayStyle()
  const value = useSettingsStore((s) => s.settings?.shelf_orientation)
  if (style === 'simple') return DEFAULT_SHELF_ORIENTATION
  return isShelfOrientation(value) ? value : DEFAULT_SHELF_ORIENTATION
}

/** 既に段組みの中にいるか。入れ子の段組みは列がさらに割れて破綻するため抑止する */
const InShelfGridContext = createContext(false)

/**
 * 棚を並べる枠。縦棚を横に並べる設定のときだけ段組みにする。
 * 棚の高さは中身で決まるので、列の高さを揃えるために items-stretch を効かせる。
 *
 * 段組みは最も外側の 1 段だけに掛ける。傘セクションの中でさらに段組みすると
 * 1 列の幅が 1/3 の 1/3 になり、棚として読めなくなるため。
 */
export function ShelfGroup({ children, className = '' }: { children: ReactNode; className?: string }) {
  const orientation = useShelfOrientation()
  const nested = useContext(InShelfGridContext)

  if (orientation === 'columns' && !nested) {
    return (
      <InShelfGridContext.Provider value>
        {/*
          広い画面では 4 列を基本にする。auto-fill だと余白やサイドバーの有無で列数が
          3 になったり 5 になったりして棚の太さが安定しないため、段階を明示して決め打ちする。
          アイテムは列いっぱいに広がるので、列数が決まれば棚の太さも決まる。
        */}
        <div
          className={`grid grid-cols-1 items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${className}`}
        >
          {children}
        </div>
      </InShelfGridContext.Provider>
    )
  }
  return <div className={`space-y-8 ${className}`}>{children}</div>
}

/**
 * 「場」に応じた器。宮殿スタイルのときだけ装飾を出し、シンプルのときは素通しする。
 *
 * ライブラリの棚は画像（public/shelf/）を使う。CSS で石の造作を組むより、
 * 陰影・面取り・溝彫りの情報量が桁違いに多く、宮殿の質感が出るため。
 * 背景は透過済みなので、ページの地色にそのまま重なる。
 *
 * 画像は縦横それぞれ用意し、棚の向きで差し替える。引き伸ばしはするが、
 * 元の縦横比に近い形でしか使わないので柱が痩せて見えることはない。
 * 中身は棚の内側に収まるよう、余白で押し込む。
 *
 * 場が増えても設定は増やさない方針なので、何を出すかはここで場ごとに決める。
 * atelier（制作台）/ study（机）は今後この分岐に足す。
 */
export function SurfaceBoard({ surface, children }: { surface: Surface; children: ReactNode }) {
  const style = useDisplayStyle()
  const orientation = useShelfOrientation()

  if (style === 'simple' || surface !== 'library') return <>{children}</>

  // 横棚は 1 段なので棚板に接地させる。縦棚は上から積むので上寄せにする
  const stacked = orientation === 'columns'

  /*
    棚は border-image で描く。背景画像として引き伸ばすと柱や繰形まで一緒に伸びるが、
    border-image なら四隅と四辺を切り出して固定し、中央だけを伸ばせる。
    slice の値は、透明な余白を切り落とした画像の実測値。
      - 横 1282x304: 繰形 y=..50 / 内部 50..235 / 棚板 235..304、柱 x=51..120・1200..1251
      - 縦 655x1478: 繰形 y=..210 / 柱 x=93..150・500..543 / 台座 y=1288..

    棚は 2 枚重ねる。
      - 奥（塗りあり）: 背板・棚板を含む棚そのもの
      - 手前（塗りなし）: 柱・繰形などの枠だけ
    中身をその間に挟むことで、アイテムは柱の *下を潜って* 流れる。
    柱を消す必要がなくなるので、送っている間も棚の幅は変わらない。
  */
  // 枠の内側がそのまま棚の内側になるので、アイテムが柱に載ることはない
  const shelf = stacked
    ? {
        borderTopWidth: '137px',
        borderBottomWidth: '124px',
        borderLeftWidth: '104px',
        borderRightWidth: '104px',
        borderImageSource: "url('/shelf/vertical.webp')",
        borderImageSlice: '210 160 190 160 fill',
      }
    : {
        borderTopWidth: '45px',
        borderBottomWidth: '62px',
        borderLeftWidth: '135px',
        borderRightWidth: '135px',
        borderImageSource: "url('/shelf/horizontal.webp')",
        borderImageSlice: '50 150 69 150 fill',
      }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        className={`relative flex flex-1 ${stacked ? 'items-start' : 'items-end'}`}
        style={{ ...shelf, borderStyle: 'solid', borderColor: 'transparent', borderImageRepeat: 'stretch' }}
      >
        <div
          className={`relative z-10 min-w-0 flex-1 [&>[data-rail]>*]:drop-shadow-[0_6px_5px_rgba(0,0,0,0.22)] ${
            stacked ? '' : '-mb-3 px-3 pt-4'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
