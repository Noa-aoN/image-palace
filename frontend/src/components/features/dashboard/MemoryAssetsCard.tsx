import Link from 'next/link'
import type { ReactNode } from 'react'
import { GalleryVerticalEnd, Box, LayoutGrid, Frame } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ItemsSummary } from '@/lib/api/items'

// 立方体1個分の3面配色（天面・左面・右面）。種類ごとに色を変えて判別しやすくする。
type Palette = { top: string; left: string; right: string }
// 積み上げ単位の形（アイソメの半幅・半高・厚み）と、積み方の上限。
// 件数が増えたら perCol まで縦に積み、それを超えたら maxCols まで横に列を増やす。
// 積み上げが大きくなったぶんは描画側で自動縮小して枠に収める。
type UnitShape = { hw: number; hh: number; depth: number; perCol: number; maxCols: number }

type AssetType = {
  key: string
  label: string
  href: string
  icon: ReactNode
  count: (s: ItemsSummary) => number
  pal: Palette
  shape: UnitShape
  // 最上段の天面に額縁状のレリーフを彫る（画像を持つ＝カード／キャンバス）。
  relief?: boolean
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
    shape: { hw: 17, hh: 8.5, depth: 4, perCol: 6, maxCols: 1 },
    relief: true,
  },
  {
    key: 'box',
    label: 'ボックス',
    href: '/boxes',
    icon: <Box size={15} />,
    count: (s) => s.boxes_count,
    pal: { top: '#C79A63', left: '#AE7C41', right: '#8A5E2B' },
    shape: { hw: 15, hh: 7.5, depth: 12, perCol: 5, maxCols: 1 },
  },
  {
    key: 'view',
    label: 'キャンバス',
    href: '/views',
    icon: <LayoutGrid size={15} />,
    count: (s) => s.views_count,
    pal: { top: '#8FB0AC', left: '#6E8F8B', right: '#4F6D6A' },
    shape: { hw: 20, hh: 10, depth: 3, perCol: 6, maxCols: 1 },
    relief: true,
  },
  {
    key: 'space',
    label: 'スペース',
    href: '/spaces',
    icon: <Frame size={15} />,
    count: (s) => s.spaces_count,
    pal: { top: '#C9C3B4', left: '#A8A08C', right: '#837C6A' },
    shape: { hw: 22, hh: 11, depth: 7, perCol: 4, maxCols: 1 },
  },
]

const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`

// (cx,cy) を底面ダイヤの中心とする立方体1個を描く。
function unitPolys(cx: number, cy: number, s: UnitShape, pal: Palette, key: string) {
  const t = { x: cx, y: cy - s.hh }
  const r = { x: cx + s.hw, y: cy }
  const b = { x: cx, y: cy + s.hh }
  const l = { x: cx - s.hw, y: cy }
  const d = s.depth
  return [
    <polygon key={`${key}-l`} points={`${p(l.x, l.y)} ${p(b.x, b.y)} ${p(b.x, b.y - d)} ${p(l.x, l.y - d)}`} fill={pal.left} />,
    <polygon key={`${key}-r`} points={`${p(r.x, r.y)} ${p(b.x, b.y)} ${p(b.x, b.y - d)} ${p(r.x, r.y - d)}`} fill={pal.right} />,
    <polygon
      key={`${key}-t`}
      points={`${p(t.x, t.y - d)} ${p(r.x, r.y - d)} ${p(b.x, b.y - d)} ${p(l.x, l.y - d)}`}
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
function reliefPolys(cx: number, cy: number, s: UnitShape, pal: Palette) {
  const dia = (k: number) =>
    `${p(cx, cy - s.hh * k)} ${p(cx + s.hw * k, cy)} ${p(cx, cy + s.hh * k)} ${p(cx - s.hw * k, cy)}`
  return (
    <g>
      {/* 額縁 */}
      <polygon points={dia(0.66)} fill="rgba(0,0,0,0.07)" stroke="rgba(255,255,255,0.5)" strokeWidth={0.7} />
      {/* 彫り込まれた画面 */}
      <polygon points={dia(0.42)} fill={pal.right} fillOpacity={0.35} stroke="rgba(255,255,255,0.3)" strokeWidth={0.5} />
    </g>
  )
}

// 描画領域（viewBox）と、積み上げの基準点。
const VB = { w: 92, h: 100, pad: 3 }
const BASE = { cx: 46, y: 80 }

function AssetStack({ id, count, pal, shape, relief }: { id: string; count: number; pal: Palette; shape: UnitShape; relief?: boolean }) {
  const { cx, y: baseY } = BASE
  // perCol まで縦に積み、あふれたら列を増やす（maxCols が上限）。
  // 上限を超えた件数は絵にしない（実数は隣の数字が示す）。
  const n = Math.min(count, shape.perCol * shape.maxCols)
  const cols = Math.max(1, Math.ceil(n / shape.perCol))
  // 列は左奥→右手前へアイソメの横軸に沿って並べる（中央揃え）。
  const colBase = (j: number) => {
    const t = j - (cols - 1) / 2
    return { x: cx + t * (shape.hw + 2), y: baseY + t * (shape.hh + 1) }
  }

  const nodes: ReactNode[] = []
  if (n === 0) {
    // 0個のときは薄い輪郭だけ置いて「空の土台」を示す。
    nodes.push(
      <polygon
        key="ghost"
        points={`${p(cx, baseY - shape.hh)} ${p(cx + shape.hw, baseY)} ${p(cx, baseY + shape.hh)} ${p(cx - shape.hw, baseY)}`}
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
        nodes.push(<g key={`c${j}relief`}>{reliefPolys(b.x, topCy, shape, pal)}</g>)
      }
    }
  }

  // 列数・段数が増えて枠からはみ出す場合は、底面の中心を軸に全体を縮小して収める。
  const first = colBase(0)
  const last = colBase(cols - 1)
  const tallest = Math.min(shape.perCol, n || 1)
  const up = baseY - (first.y - (tallest - 1) * shape.depth - shape.depth - shape.hh)
  const down = last.y + shape.hh - baseY
  const half = (last.x - first.x) / 2 + shape.hw
  const k = Math.min(
    1,
    (baseY - VB.pad) / Math.max(up, 1),
    (VB.h - VB.pad - baseY) / Math.max(down, 1),
    (VB.w / 2 - VB.pad) / Math.max(half, 1)
  )

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full" role="img" aria-hidden>
      <g transform={`translate(${cx} ${baseY}) scale(${k.toFixed(3)}) translate(${-cx} ${-baseY})`}>
        <StoneFloor id={id} cx={cx} cy={baseY} hw={shape.hw} />
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
  return (
    <Card>
      <CardContent>
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
                <AssetStack id={`asset-${t.key}`} count={c} pal={t.pal} shape={t.shape} relief={t.relief} />
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
