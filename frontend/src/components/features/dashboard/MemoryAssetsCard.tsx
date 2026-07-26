'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { GalleryVerticalEnd, Box, LayoutGrid, Frame } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { useDiagramMode } from '@/hooks/useDiagramMode'
import { useMotion } from '@/hooks/useMotion'
import { DiagramModeToggle } from './DiagramModeToggle'
import type { ItemsSummary } from '@/lib/api/items'

// 立方体1個分の3面配色（天面・左面・右面）。種類ごとに色を変えて判別しやすくする。
type Palette = { top: string; left: string; right: string }
// 積み上げ単位の形。footprint は平面の w（横）× d（奥行き）で持つので、
// 正方形だけでなく長方形（カードのような縦長）も表せる。厚みは depth。
// 積み上げは「位」ごとに1列（1000/100/10/1）。大きくなったぶんは描画側で自動縮小する。
type UnitShape = { w: number; d: number; depth: number }

// アイソメの基底ベクトル（2:1）。平面の +x / +y へ1進んだときの画面上のずれ。
const EX = { x: 0.5, y: 0.25 }
const EY = { x: -0.5, y: 0.25 }

// footprint を包む菱形の半幅（配置や自動縮小の計算に使う）。
const halfW = (s: UnitShape) => (s.w + s.d) / 2

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
  // 最上段の天面に、道路の区画線のような破線の枠を引く（＝場所＝スペース）。
  roadMark?: boolean
  // 最上段の天面に、ダンボールのフタの合わせ目のような線を1本引く（＝ボックス）。
  lidSeam?: boolean
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
    shape: { w: 12, d: 22, depth: 0.7 },
    relief: true,
  },
  {
    key: 'box',
    label: 'ボックス',
    href: '/boxes',
    icon: <Box size={15} />,
    count: (s) => s.boxes_count,
    pal: { top: '#D9BC7E', left: '#C09A50', right: '#96742F' },
    shape: { w: 22, d: 22, depth: 12 },
    lidSeam: true,
  },
  {
    key: 'view',
    label: 'キャンバス',
    href: '/views',
    icon: <LayoutGrid size={15} />,
    count: (s) => s.views_count,
    pal: { top: '#E3D19C', left: '#CFB06C', right: '#AA8A46' },
    shape: { w: 30, d: 30, depth: 3 },
    relief: true,
  },
  {
    key: 'space',
    label: 'スペース',
    href: '/spaces',
    icon: <Frame size={15} />,
    count: (s) => s.spaces_count,
    pal: { top: '#CDB176', left: '#B4924C', right: '#8C6C2E' },
    shape: { w: 36, d: 36, depth: 7 },
    roadMark: true,
  },
]

const p = (x: number, y: number) => `${x.toFixed(1)},${y.toFixed(1)}`

// 平面座標（footprint 上の点）をアイソメの画面座標へ写す。
// 平面 +x へ1進むと画面は EX、+y へ1進むと EY だけ動く。
const toScreen = (px: number, py: number) => ({
  x: px * EX.x + py * EY.x,
  y: px * EX.y + py * EY.y,
})

// footprint（w × d）の四隅を、縦軸まわりに yaw ぶん回してから投影する。
// yaw を動かすと、箱は比率を保ったまま「縦軸を中心に」回る（＝ターンテーブル）。
function footprint(cx: number, cy: number, s: UnitShape, yaw: number) {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const hw = s.w / 2
  const hd = s.d / 2
  // 平面上の四隅（回転前）。反時計回りに並べる。
  return [
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ].map(([px, py]) => {
    const rx = px * cos - py * sin
    const ry = px * sin + py * cos
    const sc = toScreen(rx, ry)
    return { x: cx + sc.x, y: cy + sc.y }
  })
}

// (cx,cy) を底面の中心とする箱1個を描く。側面は手前にあるものを後に描き、
// 面の向き（画面の左右どちら側か）で陰影を変える。
function unitPolys(cx: number, cy: number, s: UnitShape, pal: Palette, key: string, yaw = 0, bundled = false) {
  const base = footprint(cx, cy, s, yaw)
  const d = s.depth
  const top = base.map((pt) => ({ x: pt.x, y: pt.y - d }))

  // 側面4枚（隣り合う2辺と、その真上）。奥のものから描く。
  const sides = base.map((pt, i) => {
    const next = base[(i + 1) % 4]
    const mid = { x: (pt.x + next.x) / 2, y: (pt.y + next.y) / 2 }
    return {
      points: `${p(pt.x, pt.y)} ${p(next.x, next.y)} ${p(next.x, next.y - d)} ${p(pt.x, pt.y - d)}`,
      depth: mid.y,
      // 画面の左半分を向く面は暗く、右半分を向く面は明るくする。
      fill: mid.x < cx ? pal.left : pal.right,
      corners: { a: pt, b: next },
    }
  })
  sides.sort((a, b) => a.depth - b.depth)

  // 束（10個・100個）は、重なっていることがわかるよう側面に筋を入れる。
  // 筋は「その面と一緒に」描く（面ごとに重ねる）。まとめて最後に描くと、
  // 奥の面の筋が手前の面の上に乗って、箱が透けて見えてしまう。
  const seamsFor = (side: (typeof sides)[number], i: number) =>
    bundled
      ? [1, 2, 3].map((kk) => {
          const t = kk / 4
          const a = { x: side.corners.a.x, y: side.corners.a.y - d * t }
          const b = { x: side.corners.b.x, y: side.corners.b.y - d * t }
          return (
            <line key={`${key}-s${i}seam${kk}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="rgba(255,255,255,0.3)" strokeWidth={0.35} />
          )
        })
      : []

  return [
    ...sides.map((side, i) => (
      <g key={`${key}-s${i}`}>
        <polygon points={side.points} fill={side.fill} />
        {seamsFor(side, i)}
      </g>
    )),
    <polygon
      key={`${key}-t`}
      points={top.map((pt) => p(pt.x, pt.y)).join(' ')}
      fill={pal.top}
      stroke="rgba(255,255,255,0.28)"
      strokeWidth={0.6}
    />,
  ]
}

// アイテムの足元に敷く石床。アイテムが乗る中央の1枚を囲む 3×3＝9枚の石畳を敷き、
// 中央から外へ向かってフェードさせる（外周は途中で消えて、床が広がり続ける感じを出す）。
function StoneFloor({ cx, cy, hw, id, yaw = 0 }: { cx: number; cy: number; hw: number; id: string; yaw?: number }) {
  // 石床もアイテムと同じ縦軸まわりに回す（平面で回してから投影する）。
  const size = hw + 3
  const tiles: { key: string; points: string; dim: boolean }[] = []
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const at = (px: number, py: number) => {
    const rx = px * cos - py * sin
    const ry = px * sin + py * cos
    const sc = toScreen(rx, ry)
    return { x: cx + sc.x, y: cy + sc.y }
  }

  for (let i = -1; i <= 1; i++) {
    for (let j = -1; j <= 1; j++) {
      // 平面上の 3×3 の石畳（1枚 size×size）。
      const px = i * size
      const py = j * size
      const c = [
        at(px - size / 2, py - size / 2),
        at(px + size / 2, py - size / 2),
        at(px + size / 2, py + size / 2),
        at(px - size / 2, py + size / 2),
      ]
      tiles.push({
        key: `${i}${j}`,
        points: c.map((pt) => p(pt.x, pt.y)).join(' '),
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
function reliefPolys(cx: number, cy: number, s: UnitShape, pal: Palette, half = false, yaw = 0) {
  // 奥へ半分ぶんずらす（平面の -y 方向。回転にも追随させる）。
  const shift = half ? s.d * 0.25 : 0
  const off = { x: -shift * Math.sin(yaw + Math.PI / 2) * 0, y: 0 }
  const shifted = {
    px: shift * Math.sin(yaw),
    py: -shift * Math.cos(yaw),
  }
  const sc = toScreen(shifted.px, shifted.py)
  const ox = cx + sc.x + off.x
  const oy = cy + sc.y + off.y
  const scale = half ? { w: 0.72, d: 0.42 } : { w: 0.66, d: 0.66 }

  const dia = (k: number) => {
    const pts = footprint(ox, oy, { ...s, w: s.w * scale.w * k, d: s.d * scale.d * k }, yaw)
    return pts.map((pt) => p(pt.x, pt.y)).join(' ')
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

// 件数を「位」で束ねる。234 なら「100の束 ×2」「10の束 ×3」「1枚 ×4」= 実数そのもの。
// 位ごとに1列にして積むので、どの件数でも列数は最大4（1000/100/10/1）に収まる。
type Place = { unit: number; count: number }

function placeValues(count: number): Place[] {
  const places: Place[] = []
  for (const unit of [1000, 100, 10, 1]) {
    const n = Math.floor(count / unit) % 10
    if (n > 0) places.push({ unit, count: n })
  }
  return places
}

// 天面に引く、道路の区画線のような「四角い破線の枠」（スペース＝場所の記号）。
// 平面上で引いてから投影するので、回転にも追随する。
function roadMarkPolys(cx: number, cy: number, s: UnitShape, yaw: number) {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const at = (px: number, py: number) => {
    const rx = px * cos - py * sin
    const ry = px * sin + py * cos
    const sc = toScreen(rx, ry)
    return { x: cx + sc.x, y: cy + sc.y }
  }

  // 天面より一回り内側に、破線の四角い枠を引く。
  const hw = s.w * 0.34
  const hd = s.d * 0.34
  const lineW = Math.min(s.w, s.d) * 0.045 // 線の太さ（平面上）
  const dashes = 4 // 1辺あたりの破線の数

  // 1辺（(x0,y0)→(x1,y1)）を破線で描く。線は太さを持つ帯として置く。
  const dashedEdge = (x0: number, y0: number, x1: number, y1: number, key: string) => {
    const dx = x1 - x0
    const dy = y1 - y0
    const len = Math.hypot(dx, dy)
    const ux = dx / len
    const uy = dy / len
    // 線に垂直な方向（太さ）
    const nx = -uy * lineW
    const ny = ux * lineW
    const seg = len / (dashes * 2 - 1)

    return Array.from({ length: dashes }).map((_, i) => {
      const t0 = i * seg * 2
      const t1 = t0 + seg
      const a = { x: x0 + ux * t0, y: y0 + uy * t0 }
      const b = { x: x0 + ux * t1, y: y0 + uy * t1 }
      const pts = [
        at(a.x - nx, a.y - ny),
        at(b.x - nx, b.y - ny),
        at(b.x + nx, b.y + ny),
        at(a.x + nx, a.y + ny),
      ]
      return <polygon key={`${key}${i}`} points={pts.map((pt) => p(pt.x, pt.y)).join(' ')} fill="rgba(255,255,255,0.7)" />
    })
  }

  return (
    <g>
      {/* 枠の内側をごく薄く落として、区画らしく見せる */}
      <polygon
        points={[at(-hw, -hd), at(hw, -hd), at(hw, hd), at(-hw, hd)].map((pt) => p(pt.x, pt.y)).join(' ')}
        fill="rgba(0,0,0,0.04)"
      />
      {/* 四辺の破線 */}
      {dashedEdge(-hw, -hd, hw, -hd, 'top')}
      {dashedEdge(hw, -hd, hw, hd, 'right')}
      {dashedEdge(hw, hd, -hw, hd, 'bottom')}
      {dashedEdge(-hw, hd, -hw, -hd, 'left')}
    </g>
  )
}

// 天面に引く「ダンボールのフタの合わせ目」の線（ボックス）。平面で引いてから投影する。
function lidSeamPolys(cx: number, cy: number, s: UnitShape, yaw: number) {
  const cos = Math.cos(yaw)
  const sin = Math.sin(yaw)
  const at = (px: number, py: number) => {
    const rx = px * cos - py * sin
    const ry = px * sin + py * cos
    const sc = toScreen(rx, ry)
    return { x: cx + sc.x, y: cy + sc.y }
  }
  const hd = s.d / 2

  return (
    <line
      x1={at(0, -hd).x}
      y1={at(0, -hd).y}
      x2={at(0, hd).x}
      y2={at(0, hd).y}
      stroke="rgba(0,0,0,0.28)"
      strokeWidth={0.7}
    />
  )
}

// 縦軸まわりの回転の周期。アニメーション ON のときだけ回し、ホバー中は止める。
const SPIN_PERIOD_MS = 18000

function useYaw(active: boolean): number {
  const [yaw, setYaw] = useState(0)
  const yawRef = useRef(0)

  useEffect(() => {
    if (!active) return

    let raf = 0
    let last: number | null = null
    const tick = (now: number) => {
      if (last !== null) {
        yawRef.current = (yawRef.current + ((now - last) / SPIN_PERIOD_MS) * Math.PI * 2) % (Math.PI * 2)
        setYaw(yawRef.current)
      }
      last = now
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active])

  return yaw
}

// 描画領域（viewBox）と、積み上げの基準点。
// 縦を長めに取り、積みを下寄せで長く見せる（カード高さいっぱいに使う）。
// h と y を同じだけ引き上げると、SVG（横幅基準）が縦長になり積みをより高く描ける（下マージンは維持）。
const VB = { w: 92, h: 172, pad: 3 }
const BASE = { cx: 46, y: 150 }

// 2D（平面）の積み上げ。アイソメをやめ、種類ごとの形・色のタイルを正面から積む。
// 位ごとの列の間隔（画面上）。
const COL_GAP = 6

// アイテム1個ぶんの「見た目の幅」（アイソメ投影での菱形の全幅）。2D のタイル幅もこれに合わせる。
const itemWidth = (s: UnitShape) => s.w + s.d

// 2D（正面）のタイル幅。真横から見た「見付け幅」に近づける。
// 正方形（ボックス・キャンバス・スペース）は菱形の全幅より細く、
// 縦長のカードは短辺（w）側を正面に向けるので、さらに細い（ボックスの半分ほど）。
const tileWidth = (s: UnitShape) => (s.w === s.d ? itemWidth(s) * 0.62 : s.w * 1.15)

// 束の厚みは「何個ぶんか」に正比例させる（10の束＝1個の10倍、100の束＝100倍）。
// つまり 100枚の束は 1枚の 100倍の厚みで描かれ、高さがそのまま実数を表す。
// 全体が枠に収まらないぶんは、描画側で一律に縮小する（比率は保たれる）。
const baseDepth = (s: UnitShape) => s.depth
const unitDepth = (s: UnitShape, unit: number) => s.depth * unit

/**
 * 2D（横から見た絵）の積み上げ。位ごとに1列（100の束・10の束・1個）に積むので、
 * 描かれている数がそのまま実数になる。幅は 3D の見た目の幅に合わせる。
 */
function AssetStack2D({ count, pal, shape }: { count: number; pal: Palette; shape: UnitShape }) {
  const { cx, y: baseY } = BASE
  const places = placeValues(count)
  const tw = tileWidth(shape)
  const gap = 1.2

  const colX = (j: number, cols: number) => cx + (j - (cols - 1) / 2) * (tw + COL_GAP)

  const nodes: ReactNode[] = []
  if (places.length === 0) {
    nodes.push(
      <rect
        key="ghost"
        x={cx - tw / 2}
        y={baseY - baseDepth(shape)}
        width={tw}
        height={baseDepth(shape)}
        fill="none"
        stroke="var(--palace)"
        strokeOpacity={0.35}
        strokeDasharray="3 3"
        strokeWidth={1}
        rx={1.5}
      />
    )
  }

  let maxStackH = 0
  places.forEach((place, j) => {
    const x = colX(j, places.length) - tw / 2
    const h = unitDepth(shape, place.unit)
    let y = baseY
    for (let i = 0; i < place.count; i++) {
      y -= h
      nodes.push(
        <rect
          key={`p${j}i${i}`}
          x={x}
          y={y}
          width={tw}
          height={h}
          rx={1.2}
          fill={pal.top}
          stroke={pal.right}
          strokeWidth={0.6}
          // 最小の位（最後の列）の一番上：ホバーでぽんと跳ねる
          className={j === places.length - 1 && i === place.count - 1 ? 'asset-hop-target' : undefined}
        />
      )
      // 束は「重なっている」ことがわかるよう、内側に筋を入れる。
      if (place.unit > 1) {
        for (let k = 1; k <= 3; k++) {
          const ly = y + (h / 4) * k
          nodes.push(
            <line key={`p${j}i${i}l${k}`} x1={x + 1} y1={ly} x2={x + tw - 1} y2={ly} stroke={pal.right} strokeOpacity={0.55} strokeWidth={0.4} />
          )
        }
      }
      y -= gap
    }
    maxStackH = Math.max(maxStackH, baseY - y)
  })

  // 枠の高さ／幅いっぱいまで積みを収める（縮小も拡大もする＝上限までスタックする）。
  // 束と単品の比率＝実数の比率はそのまま保たれる。
  const halfWidth = ((places.length || 1) * (tw + COL_GAP)) / 2
  const k = Math.min((baseY - VB.pad) / Math.max(maxStackH, 1), (VB.w / 2 - VB.pad) / Math.max(halfWidth, 1))

  return (
    <svg viewBox={`0 0 ${VB.w} ${VB.h}`} className="w-full" role="img" aria-hidden>
      <g transform={`translate(${cx} ${baseY}) scale(${k.toFixed(3)}) translate(${-cx} ${-baseY})`}>
        <line x1={cx - halfWidth - 4} y1={baseY} x2={cx + halfWidth + 4} y2={baseY} stroke="var(--palace)" strokeOpacity={0.4} strokeWidth={1} />
        {nodes}
      </g>
    </svg>
  )
}

/**
 * 3D（アイソメ）の積み上げ。2D と同じく位ごとに1列（100の束・10の束・1個）に積むので、
 * 描かれている数がそのまま実数になる。アニメーション ON のときは縦軸まわりに回る。
 */
function AssetStack({
  id,
  count,
  pal,
  shape,
  relief,
  roadMark,
  lidSeam,
  spin,
}: {
  id: string
  count: number
  pal: Palette
  shape: UnitShape
  relief?: boolean
  roadMark?: boolean
  lidSeam?: boolean
  spin?: boolean
}) {
  const { cx, y: baseY } = BASE
  const [hovered, setHovered] = useState(false)
  const animations = useMotion()
  const yaw = useYaw(Boolean(spin) && animations && !hovered)

  const places = placeValues(count)
  const cols = places.length || 1
  // 列は平面上（回転前）で横並びに置き、アイテム全体の中心を貫く縦軸まわりに一緒に回す。
  // こうしないと、列ごとに「その場で自転」してしまい、ひとかたまりに見えない。
  const planStep = Math.max(shape.w, shape.d) + 8
  const colBase = (j: number) => {
    const t = j - (cols - 1) / 2
    const px = t * planStep
    const sc = toScreen(px * Math.cos(yaw), px * Math.sin(yaw))
    return { x: cx + sc.x, y: baseY + sc.y }
  }

  const nodes: ReactNode[] = []
  if (places.length === 0) {
    // 0個のときは薄い輪郭だけ置いて「空の土台」を示す。
    const pts = footprint(cx, baseY, shape, yaw)
    nodes.push(
      <polygon
        key="ghost"
        points={pts.map((pt) => p(pt.x, pt.y)).join(' ')}
        fill="none"
        stroke="var(--palace)"
        strokeOpacity={0.35}
        strokeDasharray="3 3"
        strokeWidth={1}
      />
    )
  }

  let maxTop = baseY
  // 回転で列の前後が入れ替わるので、奥（画面上の y が小さい）の列から描く。
  // 描画順が固定だと、後ろに回った列が手前の列の上に乗って「透けた」ように見える。
  const columns = places
    .map((place, j) => ({ place, j, b: colBase(j) }))
    .sort((a, b) => a.b.y - b.b.y)

  columns.forEach(({ place, j, b }) => {
    const depth = unitDepth(shape, place.unit)
    const unitShape = { ...shape, depth }
    const isLast = j === places.length - 1 // 最小の位（最後の列）
    let y = b.y
    // 最後の列の最上段ユニットだけ、天面装飾ごとまとめてホバーで跳ねさせる。
    const topPolys: ReactNode[] = []
    for (let i = 0; i < place.count; i++) {
      const polys = unitPolys(b.x, y, unitShape, pal, `p${j}u${i}`, yaw, place.unit > 1)
      if (isLast && i === place.count - 1) topPolys.push(...polys)
      else nodes.push(...polys)
      y -= depth
    }
    maxTop = Math.min(maxTop, y)
    // 最上段の天面の装飾（レリーフ＝カード/キャンバス・破線＝スペース・合わせ目＝ボックス）。
    const deco: ReactNode[] = []
    if (relief && place.count > 0) deco.push(<g key={`p${j}relief`}>{reliefPolys(b.x, y, unitShape, pal, shape.w !== shape.d, yaw)}</g>)
    if (roadMark && place.count > 0) deco.push(<g key={`p${j}road`}>{roadMarkPolys(b.x, y, unitShape, yaw)}</g>)
    if (lidSeam && place.count > 0) deco.push(<g key={`p${j}lid`}>{lidSeamPolys(b.x, y, unitShape, yaw)}</g>)
    if (isLast) {
      // 最小の位の一番上：ユニット＋天面装飾をまとめ、ホバーでぽんと跳ねる対象にする。
      nodes.push(
        <g key={`hop-${j}`} className="asset-hop-target">
          {topPolys}
          {deco}
        </g>
      )
    } else {
      nodes.push(...deco)
    }
  })

  // 枠に収まるよう縮小する（回転で列が左右に振れるぶんも見込む）。
  const spread = ((cols - 1) * planStep) / 2
  const halfW2 = spread + itemWidth(shape) / 2
  const up = baseY - maxTop + itemWidth(shape) / 4
  const down = itemWidth(shape) / 4 + spread / 2
  // 枠の高さ／幅いっぱいまで積みを収める（縮小も拡大もする＝上限までスタックする）。
  // 束と単品の比率＝実数の比率はそのまま保たれる。
  const k = Math.min(
    (baseY - VB.pad) / Math.max(up, 1),
    (VB.h - VB.pad - baseY) / Math.max(down, 1),
    (VB.w / 2 - VB.pad) / Math.max(halfW2, 1)
  )

  return (
    <svg
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      className="w-full"
      role="img"
      aria-hidden
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <g transform={`translate(${cx} ${baseY}) scale(${k.toFixed(3)}) translate(${-cx} ${-baseY})`}>
        <StoneFloor id={id} cx={cx} cy={baseY} hw={halfW(shape)} yaw={yaw} />
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
export function MemoryAssetsCard({ summary, className }: { summary: ItemsSummary; className?: string }) {
  const [mode, setMode] = useDiagramMode('memory-assets')

  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col">
        <div className="mb-2 flex justify-end">
          <DiagramModeToggle mode={mode} onChange={setMode} label="宮殿の記憶資産" />
        </div>

        {/* 種類が増えても自動で折り返す（4種のときは今まで通り 2列→4列）。
            flex-1＋行を 1fr にして、各アイテムの選択範囲をカード高さいっぱいに伸ばす。 */}
        <div className="grid flex-1 gap-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gridTemplateRows: 'minmax(0, 1fr)' }}>
          {ASSET_TYPES.map((t) => {
            const c = t.count(summary)
            return (
              <Link
                key={t.key}
                href={t.href}
                aria-label={`${t.label}（${c}）を見る`}
                className="group flex h-full flex-col items-center justify-end rounded-xl border border-transparent px-1 py-2 transition hover:border-[var(--palace)] hover:bg-[rgba(198,167,94,0.06)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
              >
                {mode === '3d' ? (
                  // アニメーション ON のときは、縦軸（アイテムの中心を貫く軸）まわりに回る（ホバー中は停止）。
                  <AssetStack
                    id={`asset-${t.key}`}
                    count={c}
                    pal={t.pal}
                    shape={t.shape}
                    relief={t.relief}
                    roadMark={t.roadMark}
                    lidSeam={t.lidSeam}
                    spin
                  />
                ) : (
                  // 2D は横から見た平面の絵なので回さない。
                  <AssetStack2D count={c} pal={t.pal} shape={t.shape} />
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
