import type { MetadataRoute } from 'next'
import { SITE_NAME, SITE_DESCRIPTION } from '@/lib/site'

// 端末に入れて使うための素性書き。
//
// **入れたあとの入口は `/entrance`** にする。ホーム画面から開く人は、
// もうサービスを知っている人なので、宣伝の顔（LP）ではなく持ち物の前に出す。
// 未ログインなら、いつもどおり `/entrance` が門へ送る。
export const START_URL = '/entrance'

/** 見た目の地色。読み込み中の白い一瞬を、宮殿の地色で埋める */
export const BACKGROUND_COLOR = '#F4EFE6'

/** 端末の枠（Android のステータスバー等）に乗る色 */
export const THEME_COLOR = '#C6A75E'

export function buildManifest(): MetadataRoute.Manifest {
  return {
    name: `${SITE_NAME} — イメージで覚える`,
    // ホーム画面のラベル。端末は 12 文字前後で切るので、名前だけにする
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    lang: 'ja',
    dir: 'ltr',
    start_url: START_URL,
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: BACKGROUND_COLOR,
    theme_color: THEME_COLOR,
    categories: ['education', 'productivity'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // 角を丸く切る端末向け。切られても欠けないよう、内側に寄せた絵を別に持つ
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'カードを作成', short_name: '作成', url: '/items/new' },
      { name: 'ライブラリ', short_name: '一覧', url: '/library' },
      { name: '学習をはじめる', short_name: '学習', url: '/study' },
    ],
  }
}
