import type { PreviewState } from '@/lib/api/studio'

/**
 * 下見で開く先。**箱があればそこ、無ければキャンバス。**
 *
 * 受け取った人が最初に見る場所と同じにする。
 * どちらも無いなら、少なくとも宮殿は開く（何も起きないより分かる）
 */
export function previewEntryPath(preview: PreviewState): string {
  if (!preview.active) return '/dashboard'
  if (preview.box_id) return `/boxes/${preview.box_id}`
  if (preview.view_id) return `/views/${preview.view_id}`
  return '/dashboard'
}

/**
 * 下見の帯を出す場所かどうか。
 *
 * **工房室では出さない。** あそこは下見を始めた側で、
 * 「工房室へ戻る」と言われても戻る先が今そこ。
 * 工房室の中では、一覧の上に別の形で出す
 */
export function showsPreviewBanner(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return !pathname.startsWith('/studio')
}
