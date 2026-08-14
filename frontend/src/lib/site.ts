// サイト全体で共有するメタ情報。layout / robots / sitemap / 構造化データから参照する。

// 正式ドメイン。NEXT_PUBLIC_SITE_URL は .env.production で与えるが、
// **フォールバックも正式ドメインにしておく**。ここが旧 workers.dev のままだと、
// env の設定漏れで canonical / og:url / sitemap が黙って旧URLに戻り、
// 検索エンジンから見て別サイトの重複コンテンツになる（気づきにくい壊れ方をする）。
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://imagepalace.app'

export const SITE_NAME = 'ImagePalace'

export const SITE_DESCRIPTION = '単語をAI画像に変換して記憶できるサービス。'

// 認証が必要でクロールさせたくないパス（robots の Disallow と一致させる）。
//
// **`(app)` の下にあるページは、ここから外さない。** あの下は AuthGuard が
// ログインへ送り、PageGate はサーバー側で何も描かない。外して案内だけ出しても、
// 検索側から見えるのは中身の無い殻とログインへの転送になる。
// 使い方ガイド・読みものを外に出したい場合は、置き場所のほうを先に動かすこと。
export const PRIVATE_PATHS = [
  '/entrance',
  '/dashboard',
  '/items',
  '/library',
  '/decks',
  '/boxes',
  '/views',
  '/spaces',
  '/tags',
  '/index',
  '/study',
  '/atelier',
  '/myroom',
  '/materials',
  '/wordlists',
  '/acropolis',
  '/delphi',
  '/search',
  '/agora',
  '/stadion',
  '/arena',
  '/guide',
  '/blog',
  '/account',
  '/billing',
  '/profile',
  '/settings',
  '/trophy',
  '/achievements',
  '/forgot-password',
  '/reset-password',
] as const
