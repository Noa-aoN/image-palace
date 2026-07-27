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
