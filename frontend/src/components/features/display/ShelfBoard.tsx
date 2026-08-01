'use client'

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
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

// 大理石の棚。木ではなく石として組み立てる。
// 光は上から当たる前提で、天面は明るく・小口はやや暗く・繰形の陰は最も暗くする。
const MARBLE_LIGHT = 'color-mix(in srgb, var(--ivory) 88%, white)'
const MARBLE_BASE = 'var(--ivory)'
const MARBLE_SHADE = 'color-mix(in srgb, var(--ivory-dark) 85%, var(--foreground))'
const GOLD = 'color-mix(in srgb, var(--palace) 70%, transparent)'

const MARBLE_DEEP = 'color-mix(in srgb, var(--ivory-dark) 72%, var(--foreground))'

// 箱の奥行き（px）。CSS の 3D 変換で実際にこの距離だけ奥へ引く
const DEPTH = 26

/**
 * 箱の大きさに応じた視距離を測る。
 *
 * perspective を固定値にすると、横に長い棚では左右端が広角レンズのように破綻し、
 * 縦に高い棚では逆にパースがほとんど付かない。視距離は箱の寸法に比例させる必要がある。
 * CSS だけでは要素サイズを参照できないため、ResizeObserver で測って渡す。
 */
function useBoxPerspective() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize(Math.max(width, height))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 測る前は破綻しにくい遠めの視点にしておく（初回描画のちらつきを避ける）
  return { ref, perspective: size > 0 ? Math.max(size * 1.5, 420) : 1200 }
}

/**
 * 「場」に応じた器。宮殿スタイルのときだけ装飾を出し、シンプルのときは素通しする。
 *
 * ライブラリは、正面から覗いた大理石の箱（棚）にしている。
 * 台形を手で描くのではなく CSS の 3D 変換で実際に箱を組む。
 *   - 奥の壁を translateZ(-DEPTH) で押し込む（遠いので小さく写る）
 *   - 床・天井・左右の壁は、開口の各辺を軸に 90 度倒した面
 *   - 開口（手前）にアイテムを置き、床の手前端に接地させる
 * こうすると 5 面の消失方向が 1 点に揃うので、作図の破綻なくパースが付く。
 * perspective は親に置く必要があり、かつ overflow-hidden は 3D を平坦化するため、
 * 開口側では clip を掛けない。
 *
 * 場が増えても設定は増やさない方針なので、何を出すかはここで場ごとに決める。
 * atelier（制作台）/ study（机）は今後この分岐に足す。
 */
export function SurfaceBoard({ surface, children }: { surface: Surface; children: ReactNode }) {
  const style = useDisplayStyle()
  const orientation = useShelfOrientation()
  const { ref, perspective } = useBoxPerspective()

  if (style === 'simple' || surface !== 'library') return <>{children}</>

  // 横棚は 1 段なので床に接地させる。縦棚は上から積むので上寄せにする
  const stacked = orientation === 'columns'

  // 縦棚を横に並べるときは列いっぱいまで伸ばし、棚台の高さを揃える
  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={ref}
        className={`relative flex min-h-[7rem] flex-1 rounded-t-xl pt-8 ${
          stacked ? 'items-start px-4 pb-3' : 'items-end px-6 sm:px-8'
        }`}
        style={{
          perspective: `${perspective}px`,
          // 視点をやや上に置くと床（棚板）の天面がよく見える
          perspectiveOrigin: '50% 34%',
          background: MARBLE_DEEP,
        }}
      >
        {/* 箱の 5 面。開口の各辺から実際に奥へ倒して組む */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-t-xl"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* 奥の壁。遠いぶん小さく写り、これが箱の内側であることの基準になる */}
          <span
            className="absolute inset-0"
            style={{
              transform: `translateZ(-${DEPTH}px)`,
              background: `linear-gradient(to bottom, ${MARBLE_DEEP} 0%, ${MARBLE_SHADE} 60%, ${MARBLE_BASE} 100%)`,
            }}
          />
          {/* 床＝棚板の天面。手前がいちばん明るく、奥へ向かって沈む */}
          <span
            className="absolute inset-x-0 bottom-0"
            style={{
              height: DEPTH,
              transformOrigin: 'bottom center',
              transform: 'rotateX(-90deg)',
              background: `linear-gradient(to top, ${MARBLE_LIGHT} 0%, ${MARBLE_BASE} 45%, ${MARBLE_SHADE} 100%)`,
            }}
          />
          {/* 天井。下から見上げる面なので最も暗い */}
          <span
            className="absolute inset-x-0 top-0"
            style={{
              height: DEPTH,
              transformOrigin: 'top center',
              transform: 'rotateX(90deg)',
              background: `linear-gradient(to bottom, ${MARBLE_DEEP} 0%, ${MARBLE_SHADE} 100%)`,
            }}
          />
          {/* 左右の壁。光源が左上なので左を明るく、右を暗くする */}
          <span
            className="absolute inset-y-0 left-0"
            style={{
              width: DEPTH,
              transformOrigin: 'left center',
              transform: 'rotateY(90deg)',
              background: `linear-gradient(to left, ${MARBLE_SHADE} 0%, ${MARBLE_BASE} 100%)`,
            }}
          />
          <span
            className="absolute inset-y-0 right-0"
            style={{
              width: DEPTH,
              transformOrigin: 'right center',
              transform: 'rotateY(-90deg)',
              background: `linear-gradient(to right, ${MARBLE_DEEP} 0%, ${MARBLE_SHADE} 100%)`,
            }}
          />
        </span>

        {/* 開口の額縁。箱の手前の縁として、金の細線で四辺を締める */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 rounded-t-xl"
          style={{ boxShadow: `inset 0 0 0 3px ${MARBLE_BASE}, inset 0 0 0 4px ${GOLD}` }}
        />

        {/*
          中身。床の手前端に下揃えで接地させ、子（アイテム 1 つずつ）に落ち影を持たせる。
          影を器側で一括して掛けるのは、アイテム側の実装に依存せず「載っている」状態を
          保証するため。Rail / EmptyRail のどちらでも同じ深さの階層になる。
        */}
        <div className="relative z-10 min-w-0 flex-1 [&>[data-rail]>*]:drop-shadow-[0_7px_5px_rgba(0,0,0,0.3)]">
          {children}
        </div>
      </div>

      {/* 棚板の小口。箱の下辺から前へ張り出させ、板の厚みを見せる */}
      <div aria-hidden className="relative -mx-2 sm:-mx-3">
        <div
          className="h-2.5 rounded-b-lg"
          style={{
            background: `linear-gradient(to bottom, ${MARBLE_LIGHT} 0 1px, ${GOLD} 1px 2px, ${MARBLE_BASE} 2px 55%, ${MARBLE_SHADE} 100%)`,
            boxShadow: '0 9px 14px -9px color-mix(in srgb, var(--foreground) 60%, transparent)',
          }}
        />
      </div>
    </div>
  )
}
