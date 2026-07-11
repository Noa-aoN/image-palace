// 宮殿の間取りの平面データ。2D（真上からの平面図）と 3D（アイソメ）で同じデータを使い、
// どちらのモードでも同じ間取りになることを保証する。座標系は平面 360×158。

export type Room = {
  key: string
  href: string
  label: string
  desc: string
  // 平面座標での部屋の矩形（壁の内側）
  rect: { x: number; y: number; w: number; h: number }
  current?: boolean
}

export type Segment = [x1: number, y1: number, x2: number, y2: number]

// 左右対称の宮殿平面：左右にライブラリ／スタディ・アトリエ／マイルーム、
// 中央にペリスタイル（列柱中庭）、正面（下）に列柱ポルチコ＝エントランス。
export const ROOMS: Room[] = [
  { key: 'library', href: '/library', label: 'ライブラリ', desc: 'つくった記憶を見返し、整える広間', rect: { x: 36, y: 14, w: 88, h: 50 } },
  { key: 'study', href: '/study', label: 'スタディ', desc: 'カードで覚え、思い出す学びの間', rect: { x: 236, y: 14, w: 88, h: 50 } },
  { key: 'atelier', href: '/atelier', label: 'アトリエ', desc: '単語をカードや素材に仕立てる工房', rect: { x: 36, y: 72, w: 88, h: 50 } },
  { key: 'myroom', href: '/myroom', label: 'マイルーム', desc: 'アカウント・プラン・環境設定の私室', rect: { x: 236, y: 72, w: 88, h: 50 } },
  { key: 'entrance', href: '/entrance', label: 'エントランス', desc: '情報石碑が立ち並ぶ玄関。ここからすべての場所へ', rect: { x: 114, y: 128, w: 132, h: 22 }, current: true },
]

// 壁（ドア・列柱の開口はギャップとして残す）。左右対称。
export const WALL_SEGMENTS: Segment[] = [
  // 外周（上辺中央は中庭から外へ出る裏口、下辺中央は玄関ポルチコへの開口）
  [30, 10, 160, 10], [200, 10, 330, 10], [30, 10, 30, 126], [330, 10, 330, 126],
  [30, 126, 108, 126], [252, 126, 330, 126],
  // 左右の間仕切り（x130 / x230・中庭への開口を残す）
  [130, 10, 130, 34], [130, 50, 130, 86], [130, 102, 130, 126],
  [230, 10, 230, 34], [230, 50, 230, 86], [230, 102, 230, 126],
  // 左右の部屋の上下分割（y68）
  [30, 68, 130, 68], [230, 68, 330, 68],
]

// 正面ポルチコ（玄関）の枠。中央は玄関ドアの開口として残す。
export const PORCH_SEGMENTS: Segment[] = [
  [108, 126, 108, 150], [252, 126, 252, 150],
  [108, 150, 160, 150], [200, 150, 252, 150],
]

// エントランスと中庭の間の軽い仕切り（中央はドア開口）。
export const PARTITION_SEGMENTS: Segment[] = [
  [130, 126, 160, 126], [200, 126, 230, 126],
]

// 基壇（スタイロベート）の外形。
export const STYLOBATE = { x: 24, y: 6, w: 312, h: 126 }

// 建物の床（外周壁の内側）。
export const BUILDING_FLOOR = { x: 30, y: 10, w: 300, h: 116 }

// 玄関ポルチコの床（現在地のハイライト）。
export const PORCH_FLOOR = { x: 108, y: 126, w: 144, h: 24 }

// 中庭（ペリスタイルの内側）。3D では床だけ敷いて壁を立てない。
export const COURTYARD = { x: 130, y: 10, w: 100, h: 116 }

// 列柱（中庭のペリスタイル＋正面ポルチコ）。[x, y, 半径]。
// 裏口（上辺中央）と玄関ドア（下辺中央）の正面は、通り道として柱を置かない。
export const COLUMNS: [number, number, number][] = [
  [140, 20, 4], [220, 20, 4], [220, 68, 4],
  [220, 116, 4], [140, 116, 4], [140, 68, 4],
  [134, 143, 5], [226, 143, 5],
]

// 中庭の中心（炉／泉の装飾）。
export const HEARTH = { x: 180, y: 68 }

// 裏口（外へ抜ける開口）の中心。「宮殿外へ」のラベルを置く。
export const BACK_EXIT = { x: 180, y: 10 }

// 2D（平面図）の viewBox
export const PLAN_VIEWBOX = { w: 360, h: 158 }

// 線分の配列を SVG のパス文字列にする（2D 用）。
export function segmentsToPath(segments: Segment[]): string {
  return segments.map(([x1, y1, x2, y2]) => `M${x1},${y1} L${x2},${y2}`).join(' ')
}
