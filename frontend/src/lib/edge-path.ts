import type { EdgeCurve, EdgeLineStyle, EdgePoint } from '@/types/view'

/**
 * 折れ点をつないだ線の形。
 *
 * 手で折れ点を置くと、これまでは角がそのまま尖っていた（直線をつなぐだけ）。
 * 図として見せるときは、角を丸めたい・全体をなめらかにしたい場面がある。
 * つなぎ方だけを差し替えられるように、経路の組み立てをここに出す。
 */

/** 角を丸める既定の大きさ(px)。大きすぎると折れ点の位置が分からなくなる */
export const DEFAULT_CURVE_RADIUS = 16

export function buildEdgePath(vertices: EdgePoint[], curve: EdgeCurve = 'sharp', radius = DEFAULT_CURVE_RADIUS): string {
  if (vertices.length < 2) return ''
  if (vertices.length === 2 || curve === 'sharp') return polyline(vertices)
  if (curve === 'round') return rounded(vertices, radius)
  return smooth(vertices)
}

function polyline(points: EdgePoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
}

/**
 * 角だけを丸める。
 *
 * 各頂点の手前で止めて、二次ベジェで曲がってから次へ向かう。
 * 丸める量は、隣り合う線分の短いほうの半分を超えないようにする
 * （超えると曲線どうしが食い合って、線が縮んで見える）。
 */
function rounded(points: EdgePoint[], radius: number): string {
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`]

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const next = points[i + 1]
    const r = Math.min(radius, distance(prev, cur) / 2, distance(cur, next) / 2)

    if (r < 1) {
      parts.push(`L ${cur.x} ${cur.y}`)
      continue
    }

    const enter = along(cur, prev, r)
    const exit = along(cur, next, r)
    parts.push(`L ${enter.x} ${enter.y}`)
    parts.push(`Q ${cur.x} ${cur.y} ${exit.x} ${exit.y}`)
  }

  const last = points[points.length - 1]
  parts.push(`L ${last.x} ${last.y}`)
  return parts.join(' ')
}

/**
 * 全体をなめらかにつなぐ（Catmull-Rom をベジェへ変換）。
 *
 * 折れ点そのものは通る。通らない曲線にすると、置いた点と線がずれて
 * 「掴んでいるものと動くものが違う」状態になる。
 */
function smooth(points: EdgePoint[]): string {
  const parts: string[] = [`M ${points[0].x} ${points[0].y}`]

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = points[i + 2] ?? p2

    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    parts.push(`C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`)
  }

  return parts.join(' ')
}

function distance(a: EdgePoint, b: EdgePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

/** from から to の向きに length だけ進んだ点 */
function along(from: EdgePoint, to: EdgePoint, length: number): EdgePoint {
  const d = distance(from, to)
  if (d === 0) return from
  return { x: from.x + ((to.x - from.x) / d) * length, y: from.y + ((to.y - from.y) / d) * length }
}

/**
 * 線の種類 → 破線の刻み。
 *
 * 太さに応じて刻みを変える。固定値にすると、太い線では点線が繋がって見え、
 * 細い線では隙間が空きすぎる。
 */
export function dashArrayFor(lineStyle: EdgeLineStyle, width: number): string | undefined {
  if (lineStyle === 'dashed') return `${Math.max(6, width * 3)} ${Math.max(4, width * 2)}`
  // 点は「長さ0の線」を丸い端で描く。strokeLinecap='round' と組で使う
  if (lineStyle === 'dotted') return `0.1 ${Math.max(4, width * 2.5)}`
  return undefined
}

/**
 * 旧データの読み替え。
 * line_style が無ければ dashed（真偽値）を見る。移行前のボードを壊さない。
 */
export function resolveLineStyle(style: { line_style?: EdgeLineStyle; dashed?: boolean }): EdgeLineStyle {
  return style.line_style ?? (style.dashed ? 'dashed' : 'solid')
}
