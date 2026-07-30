import type { Space } from '@/types/space'

/**
 * 部屋の見た目（2D / 3D 共通の正本）。
 *
 * バックエンドはプリセット名（spaces.room_style）と個別上書き（spaces.style_overrides）だけを持ち、
 * 実際の配色はここが決める。2D と 3D が同じ値を読むことで、切り替えても見え方が変わらない。
 *
 * 設計方針:
 * - 床は面の中でいちばん広い。彩度を抑えて「地」にし、ポイント画像を主役にする
 * - 壁と天井は床よりわずかに明るくして、奥行きを明度差だけで出す
 * - グリッド線は床色とのコントラストで決める（暗い床には明るい線）
 */
export type RoomStyle = {
  floor: string
  wall: string
  ceiling: string
  /** 稜線・枠線のアクセント */
  edge: string
  /** 部屋の外側。2D の余白と 3D の地色に共通で効く */
  background: string
  /** 床グリッドの線色（hex。不透明度は gridOpacity で与える） */
  gridLine: string
  gridOpacity: number
  gridVisible: boolean
}

export type RoomStyleKey = 'ivory' | 'concrete' | 'wood' | 'dark'

export const ROOM_STYLE_PRESETS: Record<RoomStyleKey, { label: string; description: string; style: RoomStyle }> = {
  ivory: {
    label: 'アイボリー',
    description: '既定。暖色の壁に無彩色の床',
    style: {
      floor: '#dcdcdc',
      wall: '#f2eee4',
      ceiling: '#efeadd',
      edge: '#b08d3f',
      background: '#f6f2e9',
      gridLine: '#000000',
      gridOpacity: 0.22,
      gridVisible: true,
    },
  },
  concrete: {
    label: 'コンクリート',
    description: '無彩色で統一した硬質な部屋',
    style: {
      floor: '#c9c9cb',
      wall: '#e4e4e6',
      ceiling: '#eeeef0',
      edge: '#6f6f76',
      background: '#f0f0f2',
      gridLine: '#000000',
      gridOpacity: 0.2,
      gridVisible: true,
    },
  },
  wood: {
    label: 'ウッド',
    description: '木の床に生成りの壁',
    style: {
      floor: '#d3b489',
      wall: '#efe7d8',
      ceiling: '#f5efe4',
      edge: '#8a6a3a',
      background: '#f7f1e6',
      gridLine: '#4a3418',
      gridOpacity: 0.26,
      gridVisible: true,
    },
  },
  dark: {
    label: 'ダーク',
    description: '暗い部屋。ポイント画像が際立つ',
    style: {
      // 床は地の中でいちばん明るくする（背景に沈むと部屋の形が読めない）
      floor: '#4a4a54',
      wall: '#3a3a44',
      ceiling: '#32323c',
      // 3D の壁は半透明なので、部屋の形は稜線が担う。背景から浮く明るさにする
      edge: '#b3a6e6',
      background: '#14141a',
      // 暗い床では黒い線が沈むので明るい線にする
      gridLine: '#ffffff',
      gridOpacity: 0.24,
      gridVisible: true,
    },
  },
}

export const ROOM_STYLE_KEYS = Object.keys(ROOM_STYLE_PRESETS) as RoomStyleKey[]
export const DEFAULT_ROOM_STYLE: RoomStyleKey = 'ivory'

const isRoomStyleKey = (v: string | null | undefined): v is RoomStyleKey =>
  !!v && (ROOM_STYLE_KEYS as string[]).includes(v)

/** スペースのプリセット＋個別上書きを、描画に使う具体値へ解決する */
export function resolveRoomStyle(space: Partial<Pick<Space, 'room_style' | 'style_overrides'>> | null | undefined): RoomStyle {
  const key = isRoomStyleKey(space?.room_style) ? space.room_style : DEFAULT_ROOM_STYLE
  const base = ROOM_STYLE_PRESETS[key].style
  const o = space?.style_overrides ?? {}

  return {
    floor: o.floor_color ?? base.floor,
    wall: o.wall_color ?? base.wall,
    ceiling: o.ceiling_color ?? base.ceiling,
    edge: o.edge_color ?? base.edge,
    background: o.background_color ?? base.background,
    gridLine: o.grid_color ?? base.gridLine,
    gridOpacity: o.grid_opacity ?? base.gridOpacity,
    gridVisible: o.grid_visible ?? base.gridVisible,
  }
}

/** hex を r,g,b に分解する（3桁 hex も許容） */
function hexToRgb(hex: string): [number, number, number] {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  return [ (n >> 16) & 255, (n >> 8) & 255, n & 255 ]
}

/** グリッド線の CSS/Canvas 用の色。gridVisible が false のときは完全透明にする */
export function gridStroke(style: RoomStyle): string {
  const alpha = style.gridVisible ? style.gridOpacity : 0
  const [r, g, b] = hexToRgb(style.gridLine)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 面の色に少しだけ明度差をつける（隣り合う面の見分け用） */
export function shadeSurface(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const n = parseInt(full, 16)
  const ch = [ (n >> 16) & 255, (n >> 8) & 255, n & 255 ].map((c) =>
    Math.max(0, Math.min(255, Math.round(c + amount)))
  )
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`
}
