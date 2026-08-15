// SNS に貼られたときに出る絵。
//
// **記事ページは自前で openGraph を組み立てている。** その場合、
// 置き場所の規約（`opengraph-image.jpg`）で入るはずの絵が入らない
// （自前の指定が優先され、絵の欄が空のまま確定する）。
// だから絵は決め打ちのパスで持ち、どのページからも同じように指す。

export const SECTION_SHARE_IMAGE = {
  blog: '/og/blog.jpg',
  guide: '/og/guide.jpg',
} as const

export type ShareSection = keyof typeof SECTION_SHARE_IMAGE

/**
 * そのページに貼る絵。記事が自分の絵を持っていればそれを使い、
 * 無ければその区画の絵にする。**空では返さない**
 */
export function shareImage(section: ShareSection, own?: string | null): string {
  return own?.trim() || SECTION_SHARE_IMAGE[section]
}
