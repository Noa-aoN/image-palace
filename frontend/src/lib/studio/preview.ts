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

/**
 * 何を下見しているのか。**色だけに頼らず、文字で言う。**
 *
 * 下書きの下見と、出しているものの下見は意味がまるで違う。
 * 前者はまだ誰にも届いていないので、そう書き添える。
 */
export function previewSubject(preview: PreviewState): {
  label: string
  note: string | null
} {
  if (!preview.active) return { label: '', note: null }

  const name = preview.name ?? preview.key
  const version = `v${preview.version}`

  switch (preview.status) {
    case 'draft':
      return {
        label: `下書き ${version}「${name}」の下見中です`,
        note: 'この内容は、まだ一般には配布されていません',
      }
    case 'published':
      return { label: `公開版 ${version}「${name}」の下見中です`, note: null }
    case 'suspended':
      return { label: `止めている ${version}「${name}」の下見中です`, note: 'いまは配っていません' }
    case 'archived':
      return { label: `終了した ${version}「${name}」の下見中です`, note: 'もう配りません' }
    default:
      // 原本の行がもう無い（下書きを作り直した等）。中身は固まったままなので見られる
      return { label: `${version}「${name}」の下見中です`, note: '元の荷物はもうありません' }
  }
}

/** 原本が作り直されたときの促し。**「直したのに変わらない」と見えたままにしない** */
export const STALE_NOTE = '原本が作り直されています。いま見ているのは作った時点の姿です'
