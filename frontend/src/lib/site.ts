// サイト全体で共有するメタ情報。layout / robots / sitemap / 構造化データから参照する。

// 本番ドメイン未確定のため Workers のデフォルトURLをフォールバックにする（#103 で確定予定）。
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://image-palace-frontend.image-palace.workers.dev'

export const SITE_NAME = 'ImagePalace'

export const SITE_DESCRIPTION = '単語をAI画像に変換して記憶できるサービス。'

// 認証が必要でクロールさせたくないパス（robots の Disallow と一致させる）。
export const PRIVATE_PATHS = [
  '/entrance',
  '/dashboard',
  '/items',
  '/library',
  '/decks',
  '/collections',
  '/views',
  '/spaces',
  '/tags',
  '/study',
  '/atelier',
  '/myroom',
  '/wordlists',
  '/delphi',
  '/search',
  '/agora',
  '/arena',
  '/guide',
  '/blog',
  '/account',
  '/billing',
  '/forgot-password',
  '/reset-password',
] as const
