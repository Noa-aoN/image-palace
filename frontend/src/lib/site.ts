// サイト全体で共有するメタ情報。layout / robots / sitemap / 構造化データから参照する。

// 正式ドメイン。NEXT_PUBLIC_SITE_URL は .env.production で与えるが、
// **フォールバックも正式ドメインにしておく**。ここが旧 workers.dev のままだと、
// env の設定漏れで canonical / og:url / sitemap が黙って旧URLに戻り、
// 検索エンジンから見て別サイトの重複コンテンツになる（気づきにくい壊れ方をする）。
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://imagepalace.app'

// 表記は **すべて大文字・語間は半角スペース1つ**。ロゴ・OGP と同じ形にする。
// 続け書き（旧表記）と混ぜない。タブ・共有カード・ホーム画面で別サービスに見える
export const SITE_NAME = 'IMAGE PALACE'

// 検索結果と SNS カードに出る一文。**まだ無い機能を書かない**。
// 「カードにする → 並べて整理する → 自分の宮殿になる」の順で、実装済みの範囲だけ。
export const SITE_DESCRIPTION =
  '覚えたい言葉を、AI がイメージのカードに変えます。集めたカードを並べて整理し、自分だけの記憶の宮殿をつくれる学習サービスです。'

// 認証が必要でクロールさせたくないパス（robots の Disallow と一致させる）。
//
// **`(app)` の下にあるページは、ここから外さない。** あの下は AuthGuard が
// ログインへ送り、PageGate はサーバー側で何も描かない。外して案内だけ出しても、
// 検索側から見えるのは中身の無い殻とログインへの転送になる。
//
// 使い方ガイドと読みものは `(public)` へ移した（#683）ので、ここには入れない。
// あちらは門を通さず、本文がそのまま HTML で返る。
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
  '/delphi',
  '/delphi',
  '/search',
  '/agora',
  '/stadion',
  '/arena',
  '/account',
  '/billing',
  '/profile',
  '/settings',
  '/trophy',
  '/achievements',
  '/forgot-password',
  '/reset-password',
] as const
