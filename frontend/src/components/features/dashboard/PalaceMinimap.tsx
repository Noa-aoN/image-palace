import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import type { ItemsSummary } from '@/lib/api/items'

// アイソメトリック投影のタイル寸法（2:1）。
const TILE_W = 46
const TILE_H = 23
const HW = TILE_W / 2
const HH = TILE_H / 2
const OX = 175
const OY = 58

type Pt = { x: number; y: number }
// グリッド座標(gx,gy)のタイル中心をスクリーン座標へ。
function project(gx: number, gy: number): Pt {
  return { x: OX + (gx - gy) * HW, y: OY + (gx + gy) * HH }
}

const pts = (ps: Pt[]) => ps.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

// 立方体の3面（天面・左面・右面）の配色。
type Palette = { top: string; left: string; right: string }
const GOLD: Palette = { top: '#DCC488', left: '#C6A75E', right: '#A2803B' }
const STONE: Palette = { top: '#D2CCC0', left: '#B3AB9C', right: '#8B8474' }

type Block = { gx: number; gy: number; h: number; pal: Palette; kind?: 'panel' }

// 1つのアイソメトリック立方体（またはパネル）のポリゴン群を返す。
function cubePolys(b: Block, keyBase: string) {
  const c = project(b.gx, b.gy)
  const base = {
    t: { x: c.x, y: c.y - HH },
    r: { x: c.x + HW, y: c.y },
    b: { x: c.x, y: c.y + HH },
    l: { x: c.x - HW, y: c.y },
  }
  const up = (p: Pt): Pt => ({ x: p.x, y: p.y - b.h })
  const top = { t: up(base.t), r: up(base.r), b: up(base.b), l: up(base.l) }
  return [
    <polygon key={`${keyBase}-l`} points={pts([base.l, base.b, top.b, top.l])} fill={b.pal.left} />,
    <polygon key={`${keyBase}-r`} points={pts([base.r, base.b, top.b, top.r])} fill={b.pal.right} />,
    <polygon
      key={`${keyBase}-t`}
      points={pts([top.t, top.r, top.b, top.l])}
      fill={b.pal.top}
      stroke="rgba(255,255,255,0.25)"
      strokeWidth={0.5}
    />,
  ]
}

const clamp = (n: number, max: number) => Math.max(0, Math.min(max, n))

// 所有数から宮殿の構成（中央棟の高さ・棚・別棟・パネル数）を決める。
function buildBlocks(s: ItemsSummary): Block[] {
  const cardTier = s.total_count === 0 ? 0 : s.total_count < 10 ? 1 : s.total_count < 50 ? 2 : 3
  const boxN = clamp(s.boxes_count, 4)
  const spaceN = clamp(s.spaces_count, 3)
  const viewN = clamp(s.views_count, 3)

  const blocks: Block[] = []
  // 中央の宮殿ホール（所有カード数で高くなる）
  blocks.push({ gx: 1, gy: 1, h: 24 + cardTier * 9, pal: GOLD })
  // カードが増えると両脇に塔が立つ
  if (cardTier >= 1) {
    blocks.push({ gx: 1, gy: 0, h: 16 + cardTier * 4, pal: GOLD })
    blocks.push({ gx: 0, gy: 1, h: 16 + cardTier * 4, pal: GOLD })
  }
  // ボックス＝背面に並ぶ棚
  const boxSpots: [number, number][] = [
    [2, 0],
    [3, 0],
    [3, 1],
    [2, 1],
  ]
  boxSpots.slice(0, boxN).forEach(([gx, gy]) => blocks.push({ gx, gy, h: 15, pal: GOLD }))
  // スペース＝別棟（石造り）
  const spaceSpots: [number, number][] = [
    [0, 2],
    [0, 3],
    [1, 3],
  ]
  spaceSpots.slice(0, spaceN).forEach(([gx, gy]) => blocks.push({ gx, gy, h: 19, pal: STONE }))
  // キャンバス＝手前の低いパネル
  const viewSpots: [number, number][] = [
    [3, 2],
    [3, 3],
    [2, 3],
  ]
  viewSpots.slice(0, viewN).forEach(([gx, gy]) => blocks.push({ gx, gy, h: 7, pal: GOLD, kind: 'panel' }))

  return blocks
}

/**
 * エントランス用の装飾的な宮殿ミニマップ。
 * 所有数（カード/ボックス/キャンバス/スペース）でアイソメトリックな宮殿の姿が変わる。
 * データ取得は行わず、渡された summary の数値だけで見た目を組み立てる（純SVG・外部依存なし）。
 */
export function PalaceMinimap({ summary }: { summary: ItemsSummary }) {
  const blocks = buildBlocks(summary)
  // 奥→手前（gx+gy 昇順）で描画して重なりを正しくする。
  const ordered = [...blocks].sort((a, b) => a.gx + a.gy - (b.gx + b.gy))

  // 4×4 の床タイル（市松模様で淡く）
  const ground: React.ReactNode[] = []
  for (let gy = 0; gy < 4; gy++) {
    for (let gx = 0; gx < 4; gx++) {
      const c = project(gx, gy)
      const diamond = [
        { x: c.x, y: c.y - HH },
        { x: c.x + HW, y: c.y },
        { x: c.x, y: c.y + HH },
        { x: c.x - HW, y: c.y },
      ]
      ground.push(
        <polygon
          key={`g-${gx}-${gy}`}
          points={pts(diamond)}
          fill={(gx + gy) % 2 === 0 ? 'rgba(198,167,94,0.14)' : 'rgba(198,167,94,0.06)'}
          stroke="rgba(198,167,94,0.22)"
          strokeWidth={0.5}
        />
      )
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">あなたの宮殿</h2>
      <Link
        href="/spaces"
        aria-label="スペースを見る"
        className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palace)]"
      >
        <Card className="cursor-pointer overflow-hidden transition hover:border-[var(--palace)] hover:shadow-md">
          <CardContent className="relative">
            <svg
              viewBox="0 15 350 150"
              className="w-full"
              role="img"
              aria-label="所有アイテムで姿が変わる宮殿のミニマップ"
            >
              {ground}
              {ordered.map((b, i) => cubePolys(b, `b-${i}`))}
            </svg>
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                カード{summary.total_count} ・ ボックス{summary.boxes_count} ・ キャンバス{summary.views_count} ・ スペース
                {summary.spaces_count}
              </p>
              <ChevronRight
                size={16}
                className="shrink-0 transition-transform group-hover:translate-x-0.5"
                style={{ color: 'var(--palace)' }}
              />
            </div>
          </CardContent>
        </Card>
      </Link>
    </section>
  )
}
