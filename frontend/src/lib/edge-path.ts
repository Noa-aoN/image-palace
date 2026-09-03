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

/** 軸に乗っているとみなす誤差（px）。座標は丸めて渡ってくるので小さくてよい */
const AXIS_EPSILON = 0.5

export type EdgeAxis = 'horizontal' | 'vertical'

/**
 * 線を水平・垂直だけで組み直す。
 *
 * **斜めの線分が出る原因は、点どうしが軸に揃っていないこと。**
 * 折れ点はサーバー側で「カードの既定の大きさ」を前提に計算されるが、
 * 実際のカードは AI が 1.5〜2 倍に変える。その差のぶんだけ、
 * 最初と最後の線分が斜めになっていた。
 *
 * ここで揃えれば、**折れ点がどこから来ても**直交が保たれる。
 * 揃っていない対には、間に角を1つ挟む。挟む向きは、
 * カードから出る向き（source の取っ手）から始めて、曲がるたびに入れ替える。
 */
export function orthogonalize(vertices: EdgePoint[], startAxis: EdgeAxis = 'vertical'): EdgePoint[] {
  if (vertices.length < 2) return vertices

  const out: EdgePoint[] = [vertices[0]]
  let axis = startAxis

  for (let i = 1; i < vertices.length; i++) {
    const from = out[out.length - 1]
    const to = vertices[i]
    const alignedX = Math.abs(from.x - to.x) < AXIS_EPSILON
    const alignedY = Math.abs(from.y - to.y) < AXIS_EPSILON

    if (alignedX || alignedY) {
      // 既に軸に乗っている。次に進む向きは、いま動いた向きの逆
      if (!(alignedX && alignedY)) axis = alignedX ? 'horizontal' : 'vertical'
      out.push(to)
      continue
    }

    // 角を1つ挟む。いまの向きに動いてから、直角に曲がって着く
    out.push(axis === 'horizontal' ? { x: to.x, y: from.y } : { x: from.x, y: to.y })
    out.push(to)
    axis = axis === 'horizontal' ? 'vertical' : 'horizontal'
  }

  return dropRepeats(out)
}

/** 同じ場所に重なった点を落とす（角を挟んだ結果、元の点と重なることがある） */
function dropRepeats(points: EdgePoint[]): EdgePoint[] {
  return points.filter((p, i) => {
    if (i === 0) return true
    const prev = points[i - 1]
    return Math.abs(prev.x - p.x) >= AXIS_EPSILON || Math.abs(prev.y - p.y) >= AXIS_EPSILON
  })
}

/** カードのどの辺から出るか → 最初に動く向き */
export function axisForHandle(handle: string | null | undefined): EdgeAxis {
  return handle === 'left' || handle === 'right' ? 'horizontal' : 'vertical'
}

/**
 * カードから離れる助走の長さ(px)。
 *
 * これが無いと、カードの縁を出てすぐ曲がるため、
 * 線がそのカードの側面に張り付いて走る。どちらの辺から出た線なのかも読めない。
 *
 * **矢じりが入る長さを取る。** 短くすると、曲がってすぐ矢じりが来て、
 * 線の先が詰まって見える（18 で試したときがそれだった）。
 */
export const EDGE_STUB = 28

/** カードのどの辺から出るか → 外向きの単位ベクトル */
const OUTWARD: Record<string, EdgePoint> = {
  top: { x: 0, y: -1 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

/**
 * 両端に助走を足す。
 *
 * カードの縁からいったん**まっすぐ外へ**出てから、はじめて曲がる。
 * 曲がる場所がカードから離れるので、線が側面に重ならない。
 *
 * 助走の向きは、どの辺から出るか（取っ手）で決まる。
 * 相手の位置からは決められない——真横のカードへ下辺から出ることもある。
 */
export function withStubs(
  vertices: EdgePoint[],
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined,
  stub = EDGE_STUB
): EdgePoint[] {
  if (vertices.length < 2 || stub <= 0) return vertices

  const out = [...vertices]

  // 先に終点側から入れる（先頭へ入れると、末尾の位置がずれる）
  const to = OUTWARD[targetHandle ?? '']
  if (to) {
    const end = out[out.length - 1]
    const length = stubLength(end, out[out.length - 2], to, stub)
    if (length > 0) out.splice(out.length - 1, 0, { x: end.x + to.x * length, y: end.y + to.y * length })
  }

  const from = OUTWARD[sourceHandle ?? '']
  if (from) {
    const start = out[0]
    const length = stubLength(start, out[1], from, stub)
    if (length > 0) out.splice(1, 0, { x: start.x + from.x * length, y: start.y + from.y * length })
  }
  return out
}

/**
 * 助走をどこまで伸ばすか。
 *
 * **隣の点より外へは出さない。** 線が既にカードの近くを走っているとき、
 * 決め打ちの長さで助走を置くと、その線より外へ飛び出してから戻ることになり、
 * 端のところで折り返して見える。
 *
 * 隣の点が反対側（カードの向こう）にあるときは、回り込むための助走が要るので
 * そのまま伸ばす。
 */
function stubLength(end: EdgePoint, neighbour: EdgePoint, outward: EdgePoint, stub: number): number {
  // 同じ場所なら向きが決まらない。足さない
  if (distance(end, neighbour) < AXIS_EPSILON) return 0

  // 隣の点が、外向きにどれだけ離れているか
  const reach = (neighbour.x - end.x) * outward.x + (neighbour.y - end.y) * outward.y
  // 反対側（カードの向こう）にあるなら、回り込むための助走が要る
  if (reach <= 0) return stub

  return Math.min(stub, reach)
}

