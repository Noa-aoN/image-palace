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
