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
  const { hostRef, atStart, atEnd } = useRailEdges(children)

  if (style === 'simple' || surface !== 'library') return <>{children}</>

  // 横棚は 1 段なので棚板に接地させる。縦棚は上から積むので上寄せにする
  const stacked = orientation === 'columns'

  /*
    棚の切れ目。中身が送れる方向の端は、柱ごと棚を透過させて途切れさせる。
    マスクを border-image の要素に掛けるので、柱・繰形・棚板が同じ位置で一緒に消え、
    「棚がそこで切れている」と読める。送りきった端では柱を出して棚を閉じる。
  */
  const cutStart = atStart ? '#000 0%' : 'transparent 0%, #000 4rem'
  const cutEnd = atEnd ? '#000 100%' : '#000 calc(100% - 4rem), transparent 100%'

  /*
    棚は border-image で描く。背景画像として引き伸ばすと柱や繰形まで一緒に伸びて
    絵が崩れるが、border-image なら四隅と四辺を切り出して固定し、中央だけを伸ばせる。
    slice の値は画像の不透明度プロファイルから採った実測値。
      横: 柱 x=90..260 / 1140..1310、上の繰形 y=..90、棚板と台座 y=250..
      縦: 柱 x=90..190 / 630..730、上の繰形 y=..210、台座 y=1288..
    border の内側がそのまま棚の内側になるので、アイテムが柱に載ることはない。
  */
  const shelf = stacked
    ? {
        borderWidth: '52px 48px 48px 48px',
        borderImageSource: "url('/shelf/vertical.webp')",
        borderImageSlice: '210 190 190 190 fill',
      }
    : {
        borderWidth: '31px 91px 56px 91px',
        borderImageSource: "url('/shelf/horizontal.webp')",
        borderImageSlice: '90 260 160 260 fill',
      }

  return (
    <div className="relative flex h-full min-h-0 flex-1 flex-col">
      <div
        ref={hostRef}
        className={`relative flex flex-1 ${stacked ? 'items-start' : 'items-end'}`}
        style={{
          ...shelf,
          borderStyle: 'solid',
          borderColor: 'transparent',
          borderImageRepeat: 'stretch',
          maskImage: stacked ? undefined : `linear-gradient(to right, ${cutStart}, ${cutEnd})`,
        }}
      >
        {/*
          中身。横棚では棚板に少し掛かるところまで下げる。
          こうするとアイテムは板の上に載って見え、スクロールバーは板の小口に重なる。
        */}
        <div
          className={`relative z-10 min-w-0 flex-1 [&>[data-rail]>*]:drop-shadow-[0_6px_5px_rgba(0,0,0,0.22)] ${
            stacked ? '' : '-mb-4'
          }`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

/**
 * 中身が送れる方向を見張る。
 *
 * 棚の端を切って見せるかどうかは「まだ先があるか」で決まるため、
 * スクロール位置・中身の量・棚の幅のいずれが変わっても取り直す。
 * Rail は呼び出し側が描く要素なので、data-rail を目印に辿る。
 */
function useRailEdges(children: ReactNode) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ atStart: true, atEnd: true })

  useEffect(() => {
    const rail = hostRef.current?.querySelector<HTMLElement>('[data-rail]')
    if (!rail) return

    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth
      setEdges({ atStart: rail.scrollLeft <= 1, atEnd: rail.scrollLeft >= max - 1 })
    }
    update()
    rail.addEventListener('scroll', update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(rail)
    return () => {
      rail.removeEventListener('scroll', update)
      ro.disconnect()
    }
  }, [children])

  return { hostRef, ...edges }
}
