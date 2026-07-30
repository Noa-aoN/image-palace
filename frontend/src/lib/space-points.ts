import type { SpacePoint } from '@/types/space'

/**
 * ポイントに表示する画像の URL。
 *
 * ポイントは「名前から生成した画像」を持つ場合と、「既存カードを配置した」場合がある。
 * 後者は point.image が無く item.media 側に画像があるため、両方を見ないと
 * 「カードを置いたのに絵が出ない」状態になる。2D/3D/展開図で同じ規則を使う。
 *
 * サムネイルを優先する（一覧・テクスチャ用途で十分な解像度、転送量も小さい）。
 */
export function pointImageUrl(point: Pick<SpacePoint, 'image' | 'item'>): string | null {
  return (
    point.image?.thumb_url ??
    point.image?.url ??
    point.item?.media?.thumb_url ??
    point.item?.media?.url ??
    null
  )
}

/**
 * ポイント画像の回転を CSS の transform に変換する（2D 用）。
 *
 * 回転値は 3D（three.js）の規約で保存している。CSS は +Y が下向きで座標系の
 * 向きが違うため、そのまま渡すと 2D だけ鏡像になる。対応は以下のとおり。
 *
 * - X 軸: three.js は「上端が手前に倒れる」、CSS は「上端が奥に倒れる」→ 符号を反転
 * - Y 軸: どちらも「右端が奥へ回る」→ そのまま
 * - Z 軸: three.js は反時計回り、CSS は時計回り→ 符号を反転
 *
 * 2D は平面なので x/y の傾きは遠近法での近似表示になる（できる範囲で 3D に合わせる）。
 * 回転の合成順は three.js の Euler 'XYZ' と CSS の記述順が一致するため、X→Y→Z で書く。
 */
const PERSPECTIVE_PX = 600

export function pointCssTransform(
  point: Pick<SpacePoint, 'rotation_x' | 'rotation_y' | 'rotation_z'>,
  options: { scale?: number } = {}
): string {
  const { scale } = options
  const rx = -(point.rotation_x ?? 0)
  const ry = point.rotation_y ?? 0
  const rz = -(point.rotation_z ?? 0)
  const tilted = rx !== 0 || ry !== 0
  return [
    scale !== undefined ? `scale(${scale})` : null,
    // 傾きがあるときだけ遠近を効かせる（平面のままなら不要な合成を挟まない）
    tilted ? `perspective(${PERSPECTIVE_PX}px)` : null,
    rx !== 0 ? `rotateX(${rx}deg)` : null,
    ry !== 0 ? `rotateY(${ry}deg)` : null,
    rz !== 0 ? `rotateZ(${rz}deg)` : null,
  ]
    .filter(Boolean)
    .join(' ')
}
