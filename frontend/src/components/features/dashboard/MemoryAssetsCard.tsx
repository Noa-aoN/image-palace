'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { GalleryVerticalEnd, Box, LayoutGrid, Frame } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDiagramMode } from '@/hooks/useDiagramMode'
import { DiagramModeToggle } from './DiagramModeToggle'
import type { ItemsSummary } from '@/lib/api/items'

// 立方体1個分の3面配色（天面・左面・右面）。種類ごとに色を変えて判別しやすくする。
type Palette = { top: string; left: string; right: string }
// 積み上げ単位の形。footprint は平面の w（横）× d（奥行き）で持つので、
// 正方形だけでなく長方形（カードのような縦長）も表せる。厚みは depth。
// 件数が増えたら perCol まで縦に積み、それを超えたら maxCols まで横に列を増やす。
// 積み上げが大きくなったぶんは描画側で自動縮小して枠に収める。
type UnitShape = { w: number; d: number; depth: number; perCol: number; maxCols: number }

// アイソメの基底ベクトル（2:1）。平面の +x / +y へ1進んだときの画面上のずれ。
const EX = { x: 0.5, y: 0.25 }
const EY = { x: -0.5, y: 0.25 }

// footprint を包む菱形の半幅・半高（配置や自動縮小の計算に使う）。
const halfW = (s: UnitShape) => (s.w + s.d) / 2
const halfH = (s: UnitShape) => halfW(s) / 2

// 2D（正面）のタイル1枚の寸法。3D の footprint とは別に、種類ごとの「らしさ」を出すために持つ。
type Tile = { w: number; h: number }

type AssetType = {
  key: string
  label: string
  href: string
  icon: ReactNode
  count: (s: ItemsSummary) => number
  pal: Palette
  shape: UnitShape
  tile: Tile
  // 最上段の天面に額縁状のレリーフを彫る（画像を持つ＝カード／キャンバス）。
  relief?: boolean
  // 2D で枚数が多いとき、10枚・100枚の束にまとめて描く（カード）。
  bundle?: boolean
}

// カード=薄いタイル、ボックス=立方体、キャンバス=平たい板、スペース=大きな低い床、と
// 形と色の両方で種類を区別する。
const ASSET_TYPES: AssetType[] = [
  {
    key: 'card',
    label: 'カード',
    href: '/items',
    icon: <GalleryVerticalEnd size={15} />,
    count: (s) => s.total_count,
    pal: { top: '#DCC488', left: '#C6A75E', right: '#A2803B' },
    // トレーディングカード風：ボックスより小さく、長辺は奥行き方向（横 12 × 奥行き 22）で薄い。
    shape: { w: 12, d: 22, depth: 1.6, perCol: 8, maxCols: 1 },
    // 2D は長辺の幅に合わせて幅広・薄く。枚数が増えたら束（10枚/100枚）にまとめる。
    tile: { w: 22, h: 4 },
    bundle: true,
    relief: true,
  },
  {
    key: 'box',
    label: 'ボックス',
    href: '/boxes',
    icon: <Box size={15} />,
    count: (s) => s.boxes_count,
    pal: { top: '#C79A63', left: '#AE7C41', right: '#8A5E2B' },
    shape: { w: 22, d: 22, depth: 12, perCol: 5, maxCols: 1 },
    tile: { w: 20, h: 20 },
  },
  {
    key: 'view',
    label: 'キャンバス',
    href: '/views',
    icon: <LayoutGrid size={15} />,
    count: (s) => s.views_count,
    pal: { top: '#8FB0AC', left: '#6E8F8B', right: '#4F6D6A' },
    shape: { w: 30, d: 30, depth: 3, perCol: 6, maxCols: 1 },
    tile: { w: 26, h: 7 },
    relief: true,
  },
  {
    key: 'space',
    label: 'スペース',
    href: '/spaces',
    icon: <Frame size={15} />,
    count: (s) => s.spaces_count,
    pal: { top: '#C9C3B4', left: '#A8A08C', right: '#837C6A' },
    shape: { w: 36, d: 36, depth: 7, perCol: 4, maxCols: 1 },
    tile: { w: 30, h: 12 },
  },
]

const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`

// footprint（w × d）の四隅を、底面の中心 (cx,cy) から求める。
// 奥 → 右 → 手前 → 左 の順（アイソメ）。
function corners(cx: number, cy: number, s: UnitShape) {
  const ex = { x: (s.w / 2) * EX.x * 2, y: (s.w / 2) * EX.y * 2 }
  const ey = { x: (s.d / 2) * EY.x * 2, y: (s.d / 2) * EY.y * 2 }
  return {
    back: { x: cx - ex.x - ey.x, y: cy - ex.y - ey.y },
    right: { x: cx + ex.x - ey.x, y: cy + ex.y - ey.y },
    front: { x: cx + ex.x + ey.x, y: cy + ex.y + ey.y },
    left: { x: cx - ex.x + ey.x, y: cy - ex.y + ey.y },
  }
}

// (cx,cy) を底面の中心とする箱1個を描く。footprint が長方形なら、そのまま長方形に見える。
function unitPolys(cx: number, cy: number, s: UnitShape, pal: Palette, key: string) {
  const { back, right, front, left } = corners(cx, cy, s)
  const d = s.depth
  return [
    <polygon key={`${key}-l`} points={`${p(left.x, left.y)} ${p(front.x, front.y)} ${p(front.x, front.y - d)} ${p(left.x, left.y - d)}`} fill={pal.left} />,
    <polygon key={`${key}-r`} points={`${p(right.x, right.y)} ${p(front.x, front.y)} ${p(front.x, front.y - d)} ${p(right.x, right.y - d)}`} fill={pal.right} />,
    <polygon
      key={`${key}-t`}
      points={`${p(back.x, back.y - d)} ${p(right.x, right.y - d)} ${p(front.x, front.y - d)} ${p(left.x, left.y - d)}`}
      fill={pal.top}
      stroke="rgba(255,255,255,0.28)"
      strokeWidth={0.6}
    />,
  ]
}

// アイテムの足元に敷く石床。アイテムが乗る中央の1枚を囲む 3×3＝9枚の石畳を敷き、
// 中央から外へ向かってフェードさせる（外周は途中で消えて、床が広がり続ける感じを出す）。
function StoneFloor({ cx, cy, hw, id }: { cx: number; cy: number; hw: number; id: string }) {
  const w = hw + 3
  const h = w / 2
  const tiles: { key: string; points: string; dim: boolean }[] = []
  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      // アイソメの2軸に沿って隣の石へずらす。
      const tx = cx + (i - j) * w
      const ty = cy + (i + j) * h
      tiles.push({
        key: `${i}${j}`,
        points: `${p(tx, ty - h)} ${p(tx + w, ty)} ${p(tx, ty + h)} ${p(tx - w, ty)}`,
        // 市松に濃淡をつけて石畳らしくする。
        dim: (i + j) % 2 !== 0,
      })
    }
  }
  return (
    <>
      <defs>
        {/* 中央は残し、外側ほど透明になる楕円グラデーション（アイソメに合わせて縦を潰す）。 */}
        <radialGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" cx={cx} cy={cy} r={44} gradientTransform={`matrix(1 0 0 0.5 0 ${cy / 2})`}>
          <stop offset="0.35" stopColor="#fff" stopOpacity={1} />
          <stop offset="1" stopColor="#fff" stopOpacity={0} />
        </radialGradient>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x={0} y={0} width={92} height={100}>
          <rect x={0} y={0} width={92} height={100} fill={`url(#${id}-fade)`} />
        </mask>
      </defs>
      <g mask={`url(#${id}-mask)`}>
        {tiles.map((t) => (
          <polygon
            key={t.key}
            points={t.points}
            fill="var(--palace)"
            fillOpacity={t.dim ? 0.05 : 0.14}
            stroke="var(--palace)"
            strokeOpacity={0.28}
            strokeWidth={0.7}
          />
        ))}
      </g>
    </>
  )
}

// 最上段の天面に彫る額縁状のレリーフ（＝そこに画像がある、という記号）。
// half を渡すと、天面の「奥半分」に寄せて置く（トレーディングカードの絵柄の位置）。
function reliefPolys(cx: number, cy: number, s: UnitShape, pal: Palette, half = false) {
  // 奥へ半分ぶんずらす（平面の -y 方向）。+y へ1進むときの画面上のずれが EY。
  const shift = half ? s.d * 0.25 : 0
  const ox = cx - EY.x * shift
  const oy = cy - EY.y * shift
  const scale = half ? { w: 0.72, d: 0.42 } : { w: 0.66, d: 0.66 }

  const dia = (k: number) => {
    const c = corners(ox, oy, { ...s, w: s.w * scale.w * k, d: s.d * scale.d * k })
    return `${p(c.back.x, c.back.y)} ${p(c.right.x, c.right.y)} ${p(c.front.x, c.front.y)} ${p(c.left.x, c.left.y)}`
  }
  return (
    <g>
      {/* 額縁 */}
      <polygon points={dia(1)} fill="rgba(0,0,0,0.07)" stroke="rgba(255,255,255,0.5)" strokeWidth={0.7} />
      {/* 彫り込まれた画面 */}
      <polygon points={dia(0.66)} fill={pal.right} fillOpacity={0.35} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
    </g>
  )
}

// 描画領域（viewBox）と、積み上げの基準点。
const VB = { w: 92, h: 100, pad: 3 }
const BASE = { cx: 46, y: 80 }

// 2D（平面）の積み上げ。アイソメをやめ、種類ごとの形・色のタイルを正面から積む。
// 件数の上限・列数・自動縮小のロジックは 3D と同じものを使う。
// 束の単位。枚数が多いときは 10枚束・100枚束にまとめ、枠に収める。
function bundleUnit(count: number, cap: number): number {
  for (const unit of [1, 10, 100, 1000]) {
    if (Math.ceil(count / unit) <= cap) return unit
  }
  return 1000
}

// 2D は「横から見た絵」なので、天面のレリーフ（額縁）は描かない。
function AssetStack2D({
  count,
  pal,
  shape,
  tile,
  bundle,
}: {
  count: number
  pal: Palette
  shape: UnitShape
  tile: Tile
  bundle?: boolean
}) {
  const { cx, y: baseY } = BASE
  const cap = shape.perCol * shape.maxCols
  // 束にまとめる種類（カード）は、1枚→10枚→100枚と単位を上げて枠に収める。
  const unit = bundle ? bundleUnit(count, cap) : 1
  // 満杯の束と、端数の1枚を分けて数える（見た目と実数を合わせる）。
  const fullBundles = unit > 1 ? Math.floor(count / unit) : Math.min(count, cap)
  const remainder = unit > 1 ? count - fullBundles * unit : 0
  const n = Math.min(fullBundles + (remainder > 0 ? 1 : 0), cap)
  const cols = Math.max(1, Math.ceil(n / shape.perCol))

  const tw = tile.w
  const thinH = tile.h // 1枚ぶんの薄いタイル
  const bundleH = tile.h * 2.2 // 束（重なった枚数ぶん厚い）
  const th = unit > 1 ? bundleH : thinH
  const gap = 1.5
  const colX = (j: number) => cx + (j - (cols - 1) / 2) * (tw + 4)

  const nodes: ReactNode[] = []
  if (n === 0) {
    nodes.push(
      <rect
        key="ghost"
        x={cx - tw / 2}
        y={baseY - th}
        width={tw}
        height={th}
        fill="none"
        stroke="var(--palace)"
        strokeOpacity={0.35}
        strokeDasharray="3 3"
        strokeWidth={1}
        rx={1.5}
      />
    )
  } else {
    // 下から積む。束（満杯）を先に置き、最後に端数の1枚を薄く載せる。
    let placed = 0
    for (let j = 0; j < cols; j++) {
      const x = colX(j) - tw / 2
      const m = Math.min(shape.perCol, n - j * shape.perCol)
      let y = baseY
      for (let i = 0; i < m; i++) {
        const isBundle = unit > 1 && placed < fullBundles
        const h = isBundle ? bundleH : thinH
        y -= h
        nodes.push(
          <rect key={`c${j}t${i}`} x={x} y={y} width={tw} height={h} rx={1.5} fill={pal.top} stroke={pal.right} strokeWidth={0.6} />
        )
        // 束（10枚・100枚）は、重なった枚数がわかるように内側へ線を引く。
        if (isBundle) {
          const lines = 3
          for (let k = 1; k <= lines; k++) {
            const ly = y + (h / (lines + 1)) * k
            nodes.push(
              <line
                key={`c${j}t${i}l${k}`}
                x1={x + 1}
                y1={ly}
                x2={x + tw - 1}
                y2={ly}
                stroke={pal.right}
                strokeOpacity={0.55}
                strokeWidth={0.4}
              />
            )
          }
        }
        y -= gap
        placed += 1
      }
    }
  }

  // 地面（石床の 2D 版＝1本の線）。
  const groundHalf = Math.max(tw, (colX(cols - 1) - colX(0)) / 2 + tw / 2) + 6

  // 枠に収まるよう縮小する。
  const stackH = shape.perCol * (Math.max(th, bundleH) + gap)
  const halfW = (colX(cols - 1) - colX(0)) / 2 + tw / 2
  const k = Math.min(
    1,
    (baseY - VB.pad) / Math.max(stackH, 1),
    (VB.w / 2 - VB.pad) / Math.max(halfW + 6, 1)
  )

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full" role="img" aria-hidden>
      <g transform={`translate(${cx} ${baseY}) scale(${k.toFixed(3)}) translate(${-cx} ${-baseY})`}>
        <line
          x1={cx - groundHalf}
          y1={baseY}
          x2={cx + groundHalf}
          y2={baseY}
          stroke="var(--palace)"
          strokeOpacity={0.4}
          strokeWidth={1}
        />
        {nodes}
      </g>
    </svg>
  )
}

function AssetStack({ id, count, pal, shape, relief }: { id: string; count: number; pal: Palette; shape: UnitShape; relief?: boolean }) {
  const { cx, y: baseY } = BASE
  // perCol まで縦に積み、あふれたら列を増やす（maxCols が上限）。
  // 上限を超えた件数は絵にしない（実数は隣の数字が示す）。
  const n = Math.min(count, shape.perCol * shape.maxCols)
  const cols = Math.max(1, Math.ceil(n / shape.perCol))
  // 列は左奥→右手前へアイソメの横軸に沿って並べる（中央揃え）。
  const colBase = (j: number) => {
    const t = j - (cols - 1) / 2
    return { x: cx + t * (halfW(shape) + 2), y: baseY + t * (halfH(shape) + 1) }
  }

  const nodes: ReactNode[] = []
  if (n === 0) {
    // 0個のときは薄い輪郭だけ置いて「空の土台」を示す。
    nodes.push(
      <polygon
        key="ghost"
        points={`${p(cx, baseY - halfH(shape))} ${p(cx + halfW(shape), baseY)} ${p(cx, baseY + halfH(shape))} ${p(cx - halfW(shape), baseY)}`}
        fill="none"
        stroke="var(--palace)"
        strokeOpacity={0.35}
        strokeDasharray="3 3"
        strokeWidth={1}
      />
    )
  } else {
    // 奥の列から描き、各列は下から積む（後に描くほど手前に重なる）。
    for (let j = 0; j < cols; j++) {
      const b = colBase(j)
      const m = Math.min(shape.perCol, n - j * shape.perCol)
      for (let i = 0; i < m; i++) {
        nodes.push(...unitPolys(b.x, b.y - i * shape.depth, shape, pal, `c${j}u${i}`))
      }
      // 各列の最上段の天面にだけレリーフを彫る（天面は底面ダイヤを厚みぶん持ち上げた位置）。
      if (relief) {
        const topCy = b.y - (m - 1) * shape.depth - shape.depth
        // 長方形の footprint（＝カード）は、天面の奥半分に絵柄を置く。
        nodes.push(<g key={`c${j}relief`}>{reliefPolys(b.x, topCy, shape, pal, shape.w !== shape.d)}</g>)
      }
    }
  }

  // 列数・段数が増えて枠からはみ出す場合は、底面の中心を軸に全体を縮小して収める。
  const first = colBase(0)
  const last = colBase(cols - 1)
  const tallest = Math.min(shape.perCol, n || 1)
  const up = baseY - (first.y - (tallest - 1) * shape.depth - shape.depth - halfH(shape))
  const down = last.y + halfH(shape) - baseY
  const half = (last.x - first.x) / 2 + halfW(shape)
  const k = Math.min(
    1,
    (baseY - VB.pad) / Math.max(up, 1),
    (VB.h - VB.pad - baseY) / Math.max(down, 1),
    (VB.w / 2 - VB.pad) / Math.max(half, 1)
  )

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full" role="img" aria-hidden>
      <g transform={`translate(${cx} ${baseY}) scale(${k.toFixed(3)}) translate(${-cx} ${-baseY})`}>
        <StoneFloor id={id} cx={cx} cy={baseY} hw={halfW(shape)} />
        {nodes}
      </g>
    </svg>
  )
}

/**
 * エントランスの「記憶資産」カード。カード/ボックス/キャンバス/スペースを、
 * 種類ごとに異なる形・色のアイソメ積み上げで表す（個数が多いほど高く積み上がる）。
 * 各列はクリックで該当の一覧ページへ遷移する。
 */
export function MemoryAssetsCard({ summary }: { summary: ItemsSummary }) {
  const [mode, setMode] = useDiagramMode('memory-assets')

  return (
    <Card>
      <CardContent>
        <div className="mb-2 flex justify-end">
          <DiagramModeToggle mode={mode} onChange={setMode} label="宮殿の記憶資産" />
        </div>

        {/* 種類が増えても自動で折り返す（4種のときは今まで通り 2列→4列）。 */}
        <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))' }}>
          {ASSET_TYPES.map((t) => {
            const c = t.count(summary)
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-label={`${t.label}（${c}）を見る`}
                className="group flex flex-col items-center rounded-xl border border-transparent px-1 py-2 transition hover:border-[var(--palace)] hover:bg-[rgba(198,167,94,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
              >
                {mode === '3d' ? (
                  <AssetStack id={`asset-${t.key}`} count={c} pal={t.pal} shape={t.shape} relief={t.relief} />
                ) : (
                  <AssetStack2D count={c} pal={t.pal} shape={t.shape} tile={t.tile} bundle={t.bundle} />
                )}
                <span className="mt-1 text-2xl font-bold tabular-nums leading-none">{c}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span style={{ color: 'var(--palace)' }}>{t.icon}</span>
                  {t.label}
                </span>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
