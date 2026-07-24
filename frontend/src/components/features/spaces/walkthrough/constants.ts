// スペース・ウォークスルー（一人称の道）の共有定数。
// CSS 側（globals.css の .sw-*）は --sw-spacing / --sw-arrival をステージから受け取り、
// ここと同じ値で描くため、SPACING/ARRIVAL は「平面座標(px)」で JS/CSS の単一ソースにする。

// 隣り合うポイントの平面上の間隔（px）。--sw-shift = progress * SPACING。
// ARRIVAL より小さくして、次の点が地平（y>0）から見え始めるようにする。
export const SPACING = 340

// progress==index のとき、その点が置かれる平面Y（到着位置）。
// 大きいほどカメラに近く＝画面いっぱいに。小さいほど遠く＝道に乗っている程度。
export const ARRIVAL = 420

// 点から点へ道を進む所要時間（ms）と、到着後の停留（自動再生の間隔, ms）。
export const TRAVEL_MS = 1400
export const DWELL_MS = 2600

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

// ウォークスルーの1停留点。スペース詳細（割当 item）と space_map ビュー（配置 placed_item）で
// データ形が違うため、共通の形へ正規化して使う。loci＝背景（道の点）、card＝手前に来るカード。
export type WalkthroughStop = {
  id: string
  name: string | null
  generating: boolean
  loci: { url: string; blur?: string } | null
  card: { id: string; title: string; url: string | null; blur?: string } | null
}

const isGenerating = (s: string) => s === 'pending' || s === 'processing'
const withBlur = (m: { blur?: string } | null | undefined) => m?.blur

// スペース詳細のポイント → 停留点。
// スペースのロードは「1点=1画像」。画像は生成ロキ（image）優先、無ければ既存カード（item）の画像。
// 背景の1枚だけを見せ、手前カードは出さない（card=null）。
export function stopsFromSpacePoints(
  points: {
    id: string
    position: number
    name: string | null
    generation_status: string
    image: { url: string; thumb_url?: string; blur?: string } | null
    item: { id: string; title: string; media: { url: string; thumb_url?: string; blur?: string } | null } | null
  }[]
): WalkthroughStop[] {
  return [...points]
    .sort((a, b) => a.position - b.position)
    .map((p) => {
      // 点の1画像＝配置カードの画像を優先、無ければ生成ロキ画像。背景1枚だけ（手前カードは出さない）。
      const media = p.item?.media ?? p.image
      return {
        id: p.id,
        name: p.name,
        generating: isGenerating(p.generation_status),
        loci: media ? { url: media.thumb_url ?? media.url, blur: withBlur(media) } : null,
        card: null,
      }
    })
}

// space_map ビューのポイント（loci 画像＋配置カード）→ 停留点。実践のウォークスルーはこちらが本命。
export function stopsFromSpaceMapPoints(
  points: {
    space_point_id: string
    position: number
    name: string | null
    generation_status: string
    image: { url: string; thumb_url?: string } | null
    placed_item: { id: string; title: string; media: { url: string; thumb_url?: string; blur?: string } | null } | null
  }[]
): WalkthroughStop[] {
  return [...points]
    .sort((a, b) => a.position - b.position)
    .map((p) => ({
      id: p.space_point_id,
      name: p.name,
      generating: isGenerating(p.generation_status),
      loci: p.image ? { url: p.image.thumb_url ?? p.image.url } : null,
      card: p.placed_item
        ? {
            id: p.placed_item.id,
            title: p.placed_item.title,
            url: p.placed_item.media?.thumb_url ?? p.placed_item.media?.url ?? null,
            blur: withBlur(p.placed_item.media),
          }
        : null,
    }))
}
