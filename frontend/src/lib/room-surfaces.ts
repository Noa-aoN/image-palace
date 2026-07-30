import type { RoomSurface } from '@/types/space'

// 多面ルームの面。セレクタや面ラベルの表示順・文言はここに集約する。
export const ROOM_SURFACES: { key: RoomSurface; label: string; short: string }[] = [
  { key: 'floor', label: '床（俯瞰）', short: '俯瞰' },
  { key: 'wall_north', label: '北の壁', short: '北' },
  { key: 'wall_east', label: '東の壁', short: '東' },
  { key: 'wall_south', label: '南の壁', short: '南' },
  { key: 'wall_west', label: '西の壁', short: '西' },
  { key: 'ceiling', label: '天井', short: '天井' },
]

// 配置可能な面（天井にはポイントを置かない想定）。順は 俯瞰(床)→北→東→南→西。
export const PLACEABLE_SURFACES = ROOM_SURFACES.filter((s) => s.key !== 'ceiling')

// 2D の上下左右インジケータで隣の面へ移動する隣接関係（部屋の中で見回すイメージ）。
// 壁は時計回り N→E→S→W。壁の下＝床、床の上下左右＝各壁。天井は不使用。
export const SURFACE_NAV: Record<RoomSurface, Partial<Record<'up' | 'down' | 'left' | 'right', RoomSurface>>> = {
  floor: { up: 'wall_north', down: 'wall_south', left: 'wall_west', right: 'wall_east' },
  wall_north: { down: 'floor', left: 'wall_west', right: 'wall_east' },
  wall_east: { down: 'floor', left: 'wall_north', right: 'wall_south' },
  wall_south: { down: 'floor', left: 'wall_east', right: 'wall_west' },
  wall_west: { down: 'floor', left: 'wall_south', right: 'wall_north' },
  ceiling: {},
}

export const roomSurfaceShort = (surface: RoomSurface): string =>
  ROOM_SURFACES.find((s) => s.key === surface)?.short ?? surface

export const roomSurfaceLabel = (surface: RoomSurface): string =>
  ROOM_SURFACES.find((s) => s.key === surface)?.label ?? surface

// ── 壁ビューに見える床（手前半分）の 1m グリッド ────────────
// RoomCanvas の PERSPECTIVE.floor と同じ台形の内側に線を引く。
// 台形の頂点（ステージ%座標）: 奥辺 (17,72)-(83,72) / 手前辺 (0,100)-(100,100)
const FAR_Y = 72
const NEAR_Y = 100
const FAR_LEFT = 17
const FAR_RIGHT = 83
const NEAR_LEFT = 0
const NEAR_RIGHT = 100
// 壁ビューに映る床は、向いている壁から部屋の中央まで（floorPointInWall の d <= 0.5 と一致）
const VISIBLE_DEPTH = 0.5

const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export type FloorGridLine = { x1: number; y1: number; x2: number; y2: number }

/**
 * 壁ビューの床に引く 1m グリッドの線分をステージ%座標で返す。
 *
 * h 軸（横）と d 軸（奥行き）がどちらの寸法に対応するかは向いている壁で入れ替わる
 * （RoomCanvas の floorHD と同じ対応）。
 */
export function wallViewFloorGrid(facedWall: RoomSurface, width: number, depth: number): FloorGridLine[] {
  const alongWidth = facedWall === 'wall_north' || facedWall === 'wall_south'
  const hMeters = Math.max(1, alongWidth ? width : depth)
  const dMeters = Math.max(1, alongWidth ? depth : width)
  const lines: FloorGridLine[] = []

  // 奥（壁の足元）から手前へ伸びる線。h 一定で 1m ごと
  for (let k = 0; k <= Math.floor(hMeters); k++) {
    const h = Math.min(1, k / hMeters)
    lines.push({
      x1: lerp(FAR_LEFT, FAR_RIGHT, h),
      y1: FAR_Y,
      x2: lerp(NEAR_LEFT, NEAR_RIGHT, h),
      y2: NEAR_Y,
    })
  }

  // 壁からの距離が 1m ごとの横線。見えるのは中央（d = 0.5）まで
  for (let k = 0; k / dMeters <= VISIBLE_DEPTH + 1e-9; k++) {
    const dd = k / dMeters / VISIBLE_DEPTH
    const y = lerp(FAR_Y, NEAR_Y, dd)
    lines.push({
      x1: lerp(FAR_LEFT, NEAR_LEFT, dd),
      y1: y,
      x2: lerp(FAR_RIGHT, NEAR_RIGHT, dd),
      y2: y,
    })
  }

  return lines
}
